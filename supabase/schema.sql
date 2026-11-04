-- =====================================================================
-- TOTOFANTA · schema del database (Supabase / Postgres)
-- Versione 4 · modalità Quote · giornate, quote e risultati unici
--
-- Come usarlo: Supabase › SQL Editor › New query › incolla tutto › Run.
-- Le tabelle esistono già? Prima esegui reset.sql.
-- Dopo questo file esegui calendario-2026-27.sql (le 380 partite).
--
-- Come funziona:
-- - Il calendario Serie A (squadre, orari, quote, risultati) è unico per
--   tutte le leghe e lo gestisce l'amministratore del sito.
-- - Ogni lega gioca le giornate dalla sua giornata di inizio alla 38ª.
-- - Le quote di una giornata sono nascoste finché l'amministratore non la
--   pubblica; i pronostici si chiudono al calcio d'inizio di ogni partita.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------

-- Leghe. Visibili solo a chi ne fa parte.
create table public.leagues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 3 and 40),
  name_key      text generated always as (lower(btrim(name))) stored,
  logo          text check (logo is null or char_length(logo) < 60000),
  type          text not null check (type in ('private', 'public')),
  mode          text not null default 'quote' check (mode in ('quote')),
  tiebreak      text not null default 'best_day' check (tiebreak in ('best_day', 'highest_odd')),
  start_round   int  not null default 1 check (start_round between 1 and 38),
  admin_id      uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint leagues_name_key_unique unique (name_key)
);

-- Password e codice d'invito: nessun utente può leggerli direttamente.
create table public.league_secrets (
  league_id     uuid primary key references public.leagues (id) on delete cascade,
  password_hash text,
  invite_code   text not null unique
);

-- Partecipanti. I "giocatori di prova" (bot) non hanno un utente.
create table public.members (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(btrim(nickname)) between 2 and 20),
  status     text not null default 'pending' check (status in ('pending', 'approved')),
  is_bot     boolean not null default false,
  joined_at  timestamptz not null default now(),
  constraint members_user_unique unique (league_id, user_id),
  constraint members_bot_has_no_user check (is_bot = (user_id is null))
);
create unique index members_nickname_unique on public.members (league_id, lower(btrim(nickname)));

-- Amministratori del sito (pannello amministratore).
create table public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Calendario Serie A: accoppiamenti fissi, orari provvisori, risultati.
create table public.fixtures (
  id         int  primary key,                          -- giornata*100 + posizione (es. 1103)
  n          int  not null check (n between 1 and 38),
  pos        int  not null check (pos between 1 and 10),
  home       text not null,
  away       text not null,
  kickoff    timestamptz,                               -- null = orario non ancora ufficiale
  day        date,                                      -- data indicativa della partita
  hg         int check (hg is null or hg >= 0),
  ag         int check (ag is null or ag >= 0),
  updated_at timestamptz not null default now(),
  constraint fixtures_unique unique (n, pos),
  constraint fixtures_teams check (home <> away),
  constraint fixtures_result_complete check ((hg is null) = (ag is null))
);

-- Quote 1X2 (tabella a parte: restano nascoste finché la giornata non è pubblicata).
create table public.odds (
  fixture_id int primary key references public.fixtures (id) on delete cascade,
  o1         numeric(6,2) not null check (o1 > 1),
  ox         numeric(6,2) not null check (ox > 1),
  o2         numeric(6,2) not null check (o2 > 1),
  updated_at timestamptz not null default now()
);

-- Giornate: pubblicazione delle quote (una riga per giornata, 1–38).
create table public.calendar_rounds (
  n            int primary key check (n between 1 and 38),
  published    boolean not null default false,
  published_at timestamptz
);
insert into public.calendar_rounds (n) select g from generate_series(1, 38) g;

-- Pronostici: una riga per giocatore e partita del calendario.
create table public.picks (
  member_id  uuid not null references public.members (id) on delete cascade,
  fixture_id int  not null references public.fixtures (id) on delete cascade,
  league_id  uuid not null references public.leagues (id) on delete cascade,  -- impostato da trigger
  pick       text not null check (pick in ('1', 'X', '2')),
  updated_at timestamptz not null default now(),
  primary key (member_id, fixture_id)
);

create index members_user_idx on public.members (user_id);
create index picks_league_idx on public.picks (league_id);
create index picks_fixture_idx on public.picks (fixture_id);

-- ---------------------------------------------------------------------
-- Funzioni di supporto (usate dalle regole di accesso)
-- ---------------------------------------------------------------------

-- Fa parte della lega (iscrizione approvata)?
create or replace function public.is_member(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m
                 where m.league_id = lid and m.user_id = auth.uid() and m.status = 'approved');
$$;

-- Ha una riga nella lega, anche in attesa di approvazione?
create or replace function public.in_league(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.league_id = lid and m.user_id = auth.uid());
$$;

-- È l'amministratore della lega?
create or replace function public.is_admin(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leagues l where l.id = lid and l.admin_id = auth.uid());
$$;

-- È amministratore del sito?
create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_admins s where s.user_id = auth.uid());
$$;

-- Le quote di questa giornata sono pubblicate?
create or replace function public.round_published(rn int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.published from public.calendar_rounds c where c.n = rn), false);
$$;

-- La partita è iniziata?
create or replace function public.fixture_locked(fid int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select f.kickoff is not null and now() >= f.kickoff from public.fixtures f where f.id = fid), true);
$$;

-- Si può ancora pronosticare? (giornata pubblicata, quote presenti, partita non iniziata)
create or replace function public.fixture_open(fid int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select f.kickoff is not null and now() < f.kickoff
            and public.round_published(f.n)
            and exists (select 1 from public.odds o where o.fixture_id = f.id)
       from public.fixtures f where f.id = fid),
    false);
$$;

-- Questo partecipante è l'utente collegato (e approvato)?
create or replace function public.owns_member(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m
                 where m.id = mid and m.user_id = auth.uid() and m.status = 'approved');
$$;

-- Questo partecipante è un giocatore di prova di una lega che amministro?
create or replace function public.admin_of_bot(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m join public.leagues l on l.id = m.league_id
                 where m.id = mid and m.is_bot and l.admin_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------

-- Il risultato si può inserire solo a partita iniziata.
create or replace function public.fixtures_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.hg is not null and (new.kickoff is null or new.kickoff > now()) then
    raise exception 'Il risultato di %–% si inserisce dopo il calcio d''inizio', new.home, new.away;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger fixtures_touch before update on public.fixtures
  for each row execute function public.fixtures_touch();

create or replace function public.odds_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger odds_touch before insert or update on public.odds
  for each row execute function public.odds_touch();

-- Si pubblica solo una giornata completa: 10 partite con orario e quote.
create or replace function public.calendar_rounds_check() returns trigger
language plpgsql set search_path = '' as $$
declare ok int;
begin
  if new.published and not old.published then
    select count(*) into ok from public.fixtures f join public.odds o on o.fixture_id = f.id
     where f.n = new.n and f.kickoff is not null;
    if ok < 10 then
      raise exception 'Per pubblicare la %ª giornata servono orari e quote di tutte le 10 partite (complete: %)', new.n, ok;
    end if;
    new.published_at := now();
  elsif not new.published then
    new.published_at := null;
  end if;
  return new;
end $$;
create trigger calendar_rounds_check before update on public.calendar_rounds
  for each row execute function public.calendar_rounds_check();

-- Il pronostico eredita la lega dal partecipante; la partita deve essere
-- di una giornata che la lega gioca (dalla giornata di inizio in poi).
create or replace function public.picks_set_league() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lid uuid; sr int; rn int;
begin
  select m.league_id, l.start_round into lid, sr
    from public.members m join public.leagues l on l.id = m.league_id where m.id = new.member_id;
  select f.n into rn from public.fixtures f where f.id = new.fixture_id;
  if lid is null or rn is null or rn < sr then
    raise exception 'Pronostico non valido per questa lega';
  end if;
  new.league_id := lid;
  new.updated_at := now();
  return new;
end $$;
create trigger picks_set_league before insert or update on public.picks
  for each row execute function public.picks_set_league();

-- ---------------------------------------------------------------------
-- Regole di accesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.leagues         enable row level security;
alter table public.league_secrets  enable row level security;  -- nessuna regola: illeggibile
alter table public.members         enable row level security;
alter table public.site_admins     enable row level security;
alter table public.fixtures        enable row level security;
alter table public.odds            enable row level security;
alter table public.calendar_rounds enable row level security;
alter table public.picks           enable row level security;

-- Leghe: le vede chi ci è iscritto (anche in attesa); le modifica/elimina l'admin.
create policy leagues_select on public.leagues for select to authenticated
  using (public.in_league(id) or admin_id = auth.uid());
create policy leagues_update on public.leagues for update to authenticated
  using (admin_id = auth.uid()) with check (admin_id = auth.uid());
create policy leagues_delete on public.leagues for delete to authenticated
  using (admin_id = auth.uid());

-- Partecipanti: li vedono gli iscritti approvati; ognuno vede la propria riga.
create policy members_select on public.members for select to authenticated
  using (public.is_member(league_id) or user_id = auth.uid() or public.is_admin(league_id));
-- L'admin può aggiungere solo giocatori di prova (gli altri entrano con join_league).
create policy members_insert_bot on public.members for insert to authenticated
  with check (public.is_admin(league_id) and is_bot and user_id is null);
-- L'admin approva le richieste.
create policy members_update on public.members for update to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));
-- L'admin rimuove gli altri; un giocatore può uscire da solo (l'admin no).
create policy members_delete on public.members for delete to authenticated
  using ( (public.is_admin(league_id) and user_id is distinct from auth.uid())
       or (user_id = auth.uid() and not public.is_admin(league_id)) );

-- Amministratori del sito: ognuno vede solo la propria riga (serve al sito per mostrare il pannello).
create policy site_admins_select on public.site_admins for select to authenticated
  using (user_id = auth.uid());

-- Calendario: lo leggono tutti quelli che hanno fatto l'accesso;
-- date, orari e risultati li cambia l'amministratore del sito.
create policy fixtures_select on public.fixtures for select to authenticated using (true);
create policy fixtures_update on public.fixtures for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
revoke insert, update, delete on public.fixtures from authenticated, anon;
grant  update (kickoff, day, hg, ag) on public.fixtures to authenticated;

-- Quote: visibili a tutti solo a giornata pubblicata; l'amministratore le vede e le scrive sempre.
create policy odds_select on public.odds for select to authenticated
  using (public.is_site_admin() or public.round_published((select f.n from public.fixtures f where f.id = fixture_id)));
create policy odds_write on public.odds for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Pubblicazione delle giornate: la leggono tutti, la cambia l'amministratore.
create policy calendar_rounds_select on public.calendar_rounds for select to authenticated using (true);
create policy calendar_rounds_update on public.calendar_rounds for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
revoke insert, delete on public.calendar_rounds from authenticated, anon;

-- Pronostici:
--  · i propri si vedono sempre;
--  · quelli degli altri solo dopo il calcio d'inizio della partita;
--  · si scrivono solo prima del calcio d'inizio e a giornata pubblicata;
--  · l'admin della lega può scrivere quelli dei giocatori di prova.
create policy picks_select on public.picks for select to authenticated
  using ( public.owns_member(member_id)
       or (public.is_member(league_id) and public.fixture_locked(fixture_id))
       or public.admin_of_bot(member_id) );
create policy picks_insert on public.picks for insert to authenticated
  with check ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.fixture_open(fixture_id)) );
create policy picks_update on public.picks for update to authenticated
  using      ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.fixture_open(fixture_id)) )
  with check ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.fixture_open(fixture_id)) );
create policy picks_delete on public.picks for delete to authenticated
  using ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.fixture_open(fixture_id)) );

-- ---------------------------------------------------------------------
-- Funzioni chiamate dal sito
-- ---------------------------------------------------------------------

-- Crea una lega con password cifrata e codice d'invito; l'autore diventa admin.
create or replace function public.create_league(
  p_name text, p_type text, p_password text, p_tiebreak text,
  p_start_round int, p_logo text, p_nickname text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare lid uuid; code text;
begin
  if auth.uid() is null then raise exception 'Devi accedere per creare una lega'; end if;
  if p_type = 'private' and char_length(coalesce(p_password, '')) < 4 then
    raise exception 'Scegli una password di almeno 4 caratteri';
  end if;
  if exists (select 1 from public.leagues l where l.name_key = lower(btrim(p_name))) then
    raise exception 'Esiste già una lega con questo nome';
  end if;
  insert into public.leagues (name, type, tiebreak, start_round, logo, admin_id)
  values (btrim(p_name), p_type, p_tiebreak, p_start_round, p_logo, auth.uid())
  returning id into lid;
  loop
    code := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when char_length(code) = 6 and not exists (select 1 from public.league_secrets s where s.invite_code = code);
  end loop;
  insert into public.league_secrets (league_id, password_hash, invite_code)
  values (lid,
          case when p_type = 'private' then extensions.crypt(p_password, extensions.gen_salt('bf')) end,
          code);
  insert into public.members (league_id, user_id, nickname, status)
  values (lid, auth.uid(), btrim(p_nickname), 'approved');
  return lid;
end $$;

-- Entra in una lega con nome (+ password se privata) oppure con il codice d'invito.
create or replace function public.join_league(
  p_name text, p_password text, p_code text, p_nickname text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_league public.leagues; v_sec public.league_secrets; v_status text; v_existing public.members;
begin
  if auth.uid() is null then raise exception 'Devi accedere per unirti a una lega'; end if;
  if coalesce(btrim(p_code), '') <> '' then
    select * into v_sec from public.league_secrets s where s.invite_code = upper(btrim(p_code));
    if not found then raise exception 'Codice invito non valido'; end if;
    select * into v_league from public.leagues l where l.id = v_sec.league_id;
  else
    select * into v_league from public.leagues l where l.name_key = lower(btrim(coalesce(p_name, '')));
    if not found then raise exception 'Nessuna lega con questo nome'; end if;
    select * into v_sec from public.league_secrets s where s.league_id = v_league.id;
  end if;

  select * into v_existing from public.members m where m.league_id = v_league.id and m.user_id = auth.uid();
  if found then return jsonb_build_object('league_id', v_league.id, 'status', v_existing.status); end if;

  if coalesce(btrim(p_code), '') = '' and v_league.type = 'private'
     and (v_sec.password_hash is null or extensions.crypt(coalesce(p_password, ''), v_sec.password_hash) <> v_sec.password_hash) then
    raise exception 'Password errata';
  end if;
  if char_length(btrim(coalesce(p_nickname, ''))) < 2 then raise exception 'Scegli il tuo nickname'; end if;
  if exists (select 1 from public.members m where m.league_id = v_league.id and lower(btrim(m.nickname)) = lower(btrim(p_nickname))) then
    raise exception 'Nickname già usato in questa lega';
  end if;

  v_status := case when v_league.type = 'public' then 'approved' else 'pending' end;
  insert into public.members (league_id, user_id, nickname, status) values (v_league.id, auth.uid(), btrim(p_nickname), v_status);
  return jsonb_build_object('league_id', v_league.id, 'status', v_status);
end $$;

-- Codice d'invito: lo leggono solo gli iscritti approvati.
create or replace function public.get_invite_code(p_league uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.invite_code from public.league_secrets s
   where s.league_id = p_league and (public.is_member(p_league) or public.is_admin(p_league));
$$;

-- Le funzioni le può chiamare solo chi ha fatto l'accesso.
revoke execute on function public.create_league(text, text, text, text, int, text, text) from public, anon;
revoke execute on function public.join_league(text, text, text, text) from public, anon;
revoke execute on function public.get_invite_code(uuid) from public, anon;
grant  execute on function public.create_league(text, text, text, text, int, text, text) to authenticated;
grant  execute on function public.join_league(text, text, text, text) to authenticated;
grant  execute on function public.get_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Aggiornamenti in tempo reale (il sito si aggiorna quando un altro gioca)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.leagues, public.members, public.picks, public.fixtures, public.odds, public.calendar_rounds;
