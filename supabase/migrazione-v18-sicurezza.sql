-- Totofanta — migrazione v18: sicurezza (report "limiti e sicurezza con 500 utenti", falle 1–5, 9, 11)
--
-- 1-2  Niente modifiche dirette a iscritti e leghe: le regole di Supabase decidono quali RIGHE si toccano,
--      non quali colonne, quindi l'admin di una lega poteva cambiare qualsiasi campo. Il sito non le usa più.
-- 3    Password delle leghe private: almeno 6 caratteri; al massimo 10 tentativi sbagliati all'ora
--      per utente e lega (i tentativi si registrano anche se la password è errata, quindi join_league
--      restituisce l'errore invece di sollevarlo).
-- 4    Al massimo 6 leghe di cui si è admin; logo ignorato finché è nascosto nel sito.
-- 5    transfer_admin: l'admin nomina un nuovo admin (serve prima di eliminare l'account; lo controlla
--      la funzione delete-account).
-- 9    Nessun permesso agli utenti non registrati (anon): il sito richiede sempre l'accesso.
-- 11   Vecchi codici d'invito disattivati (league_name_by_code, get_invite_code).
-- In più: regole riscritte con (select auth.uid()), regole separate per le quote, due indici,
--      ricalcolo dei punti limitato alla lega quando cambia la sua giornata di inizio.

-- ---------- 1-2: modifiche dirette a iscritti e leghe ----------
drop policy if exists members_update on public.members;
drop policy if exists leagues_update on public.leagues;
revoke update on public.members from anon, authenticated;
revoke update on public.leagues from anon, authenticated;

-- ---------- 3: password e tentativi ----------
create table if not exists private.join_attempts (
  user_id uuid not null,
  league_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists join_attempts_idx on private.join_attempts (user_id, league_id, at);

create or replace function public.join_league(p_name text, p_password text, p_code text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_league public.leagues; v_sec public.league_secrets; v_existing public.members; v_tries int;
begin
  if auth.uid() is null then raise exception 'Devi accedere per unirti a una lega'; end if;
  select * into v_league from public.leagues l where l.name_key = lower(btrim(coalesce(p_name, '')));
  if not found then raise exception 'Nessuna lega con questo nome'; end if;
  select * into v_sec from public.league_secrets s where s.league_id = v_league.id;

  select * into v_existing from public.members m where m.league_id = v_league.id and m.user_id = auth.uid();
  if found then return jsonb_build_object('league_id', v_league.id, 'status', v_existing.status); end if;

  -- iscrizioni chiuse dal fischio d'inizio della prima partita della giornata di partenza
  if exists (select 1 from public.fixtures f
              where f.n = v_league.start_round and f.kickoff is not null and f.kickoff <= now()) then
    raise exception 'La lega è già iniziata: le iscrizioni sono chiuse';
  end if;

  if v_league.type = 'private' then
    delete from private.join_attempts a where a.user_id = auth.uid() and a.at < now() - interval '1 day';
    select count(*) into v_tries from private.join_attempts a
     where a.user_id = auth.uid() and a.league_id = v_league.id and a.at > now() - interval '1 hour';
    if v_tries >= 10 then
      return jsonb_build_object('error', 'Troppi tentativi con la password sbagliata: riprova tra un''ora');
    end if;
    if v_sec.password_hash is null or extensions.crypt(coalesce(p_password, ''), v_sec.password_hash) <> v_sec.password_hash then
      insert into private.join_attempts (user_id, league_id) values (auth.uid(), v_league.id);
      return jsonb_build_object('error', 'Password errata');
    end if;
  end if;

  if char_length(btrim(coalesce(p_nickname, ''))) < 2 then raise exception 'Scegli il tuo nickname'; end if;
  if exists (select 1 from public.members m where m.league_id = v_league.id and lower(btrim(m.nickname)) = lower(btrim(p_nickname))) then
    raise exception 'Nickname già usato in questa lega';
  end if;

  insert into public.members (league_id, user_id, nickname, status) values (v_league.id, auth.uid(), btrim(p_nickname), 'approved');
  return jsonb_build_object('league_id', v_league.id, 'status', 'approved');
end $$;

create or replace function public.set_league_password(p_league uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_league) then raise exception 'Solo l''admin della lega può cambiare la password'; end if;
  if char_length(coalesce(p_password, '')) < 6 then raise exception 'Scegli una password di almeno 6 caratteri'; end if;
  update public.league_secrets
     set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), password_plain = p_password
   where league_id = p_league;
end $$;

-- ---------- 3-4: creazione lega ----------
create or replace function public.create_league(p_name text, p_type text, p_password text, p_tiebreak text, p_start_round integer, p_logo text, p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare lid uuid; code text;
begin
  if auth.uid() is null then raise exception 'Devi accedere per creare una lega'; end if;
  if (select count(*) from public.leagues l where l.admin_id = auth.uid()) >= 6 then
    raise exception 'Puoi essere admin di al massimo 6 leghe';
  end if;
  if p_type = 'private' and char_length(coalesce(p_password, '')) < 6 then
    raise exception 'Scegli una password di almeno 6 caratteri';
  end if;
  if exists (select 1 from public.fixtures f where f.n = p_start_round and f.kickoff is not null and f.kickoff <= now()) then
    raise exception 'La %ª giornata è già iniziata: scegli una giornata successiva', p_start_round;
  end if;
  if exists (select 1 from public.leagues l where l.name_key = lower(btrim(p_name))) then
    raise exception 'Esiste già una lega con questo nome';
  end if;
  -- il logo è nascosto nel sito: non si salva (p_logo resta nella firma per compatibilità)
  insert into public.leagues (name, type, tiebreak, start_round, logo, admin_id)
  values (btrim(p_name), p_type, p_tiebreak, p_start_round, null, auth.uid())
  returning id into lid;
  loop
    code := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when char_length(code) = 6 and not exists (select 1 from public.league_secrets s where s.invite_code = code);
  end loop;
  insert into public.league_secrets (league_id, password_hash, password_plain, invite_code)
  values (lid,
          case when p_type = 'private' then extensions.crypt(p_password, extensions.gen_salt('bf')) end,
          case when p_type = 'private' then p_password end,
          code);
  insert into public.members (league_id, user_id, nickname, status)
  values (lid, auth.uid(), btrim(p_nickname), 'approved');
  return lid;
end $$;

-- ---------- 5: nuovo admin ----------
create or replace function public.transfer_admin(p_league uuid, p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not exists (select 1 from public.leagues l where l.id = p_league and l.admin_id = auth.uid()) then
    raise exception 'Solo l''admin della lega può nominare un nuovo admin';
  end if;
  select m.user_id into v_user from public.members m
   where m.id = p_member and m.league_id = p_league and m.status = 'approved';
  if v_user is null then raise exception 'Il nuovo admin deve essere un iscritto della lega'; end if;
  if v_user = auth.uid() then raise exception 'Scegli un altro iscritto'; end if;
  update public.leagues set admin_id = v_user where id = p_league;
end $$;
revoke all on function public.transfer_admin(uuid, uuid) from public, anon;
grant execute on function public.transfer_admin(uuid, uuid) to authenticated, service_role;

-- ---------- 11: vecchi codici d'invito ----------
drop function if exists public.league_name_by_code(text);
drop function if exists public.get_invite_code(uuid);

-- ---------- 9: niente permessi agli utenti non registrati ----------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.check_sync_secret(text) from authenticated;
revoke execute on function public.odds_freeze() from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

-- ---------- regole più veloci con molti utenti ----------
drop policy if exists leagues_select on public.leagues;
create policy leagues_select on public.leagues for select to authenticated
  using (public.in_league(id) or admin_id = (select auth.uid()));
drop policy if exists leagues_delete on public.leagues;
create policy leagues_delete on public.leagues for delete to authenticated
  using (admin_id = (select auth.uid()));
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (public.is_member(league_id) or user_id = (select auth.uid()) or public.is_admin(league_id));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated
  using ((public.is_admin(league_id) and user_id is distinct from (select auth.uid()))
      or (user_id = (select auth.uid()) and not public.is_admin(league_id)));
drop policy if exists site_admins_select on public.site_admins;
create policy site_admins_select on public.site_admins for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists odds_write on public.odds;
create policy odds_insert on public.odds for insert to authenticated with check (public.is_site_admin());
create policy odds_update on public.odds for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy odds_delete on public.odds for delete to authenticated using (public.is_site_admin());
drop policy if exists round_scores_select on public.round_scores;
create policy round_scores_select on public.round_scores for select to authenticated using (public.is_member(league_id));
create index if not exists league_adjustments_member_idx on public.league_adjustments (member_id);
create index if not exists leagues_admin_idx on public.leagues (admin_id);

-- ---------- punti: ricalcolo per una sola lega ----------
drop function if exists private.recompute_round(int);
create or replace function private.recompute_round(p_n int, p_league uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  with calc as (
    select p.member_id, p.league_id, f.n,
           sum(case when p.pick = e.esito then round(e.quota * 100)::int else 0 end)::int as pts,
           count(*) filter (where p.pick = e.esito)::int as correct,
           coalesce(max(case when p.pick = e.esito then round(e.quota * 100)::int end), 0)::int as best
      from public.picks p
      join public.fixtures f on f.id = p.fixture_id and f.n = p_n
      join public.leagues l on l.id = p.league_id and f.n >= l.start_round
      join public.calendar_rounds c on c.n = f.n and c.published
      join public.odds o on o.fixture_id = f.id
      cross join lateral (
        select case when f.hg > f.ag then '1' when f.hg < f.ag then '2' else 'X' end as esito,
               case when f.hg > f.ag then o.o1 when f.hg < f.ag then o.o2 else o.ox end as quota
      ) e
     where f.hg is not null and f.ag is not null
       and (p_league is null or p.league_id = p_league)
     group by p.member_id, p.league_id, f.n
  ), up as (
    insert into public.round_scores as r (member_id, league_id, n, pts, correct, best)
    select member_id, league_id, n, pts, correct, best from calc
    on conflict (member_id, n) do update
      set pts = excluded.pts, correct = excluded.correct, best = excluded.best, updated_at = now()
      where (r.pts, r.correct, r.best) is distinct from (excluded.pts, excluded.correct, excluded.best)
  )
  delete from public.round_scores r
   where r.n = p_n and (p_league is null or r.league_id = p_league)
     and not exists (select 1 from calc where calc.member_id = r.member_id);
end $$;

create or replace function private.scores_on_league()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k int;
begin
  for k in 1..38 loop perform private.recompute_round(k, new.id); end loop;
  return null;
end $$;
