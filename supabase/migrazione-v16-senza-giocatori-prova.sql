-- v16 (5/11/2026): rimozione dei giocatori di prova.
-- Ogni partecipante è ora un utente vero: niente più is_bot, niente eccezioni
-- per l'admin di lega sulle schedine dopo il fischio d'inizio.

drop policy if exists members_insert_bot on public.members;

drop policy if exists picks_select on public.picks;
drop policy if exists picks_insert on public.picks;
drop policy if exists picks_update on public.picks;
drop policy if exists picks_delete on public.picks;

create policy picks_select on public.picks for select to authenticated
  using ( public.owns_member(member_id)
       or (public.is_member(league_id) and public.fixture_locked(fixture_id)) );
create policy picks_insert on public.picks for insert to authenticated
  with check ( public.owns_member(member_id) and public.fixture_open(fixture_id) );
create policy picks_update on public.picks for update to authenticated
  using      ( public.owns_member(member_id) and public.fixture_open(fixture_id) )
  with check ( public.owns_member(member_id) and public.fixture_open(fixture_id) );
create policy picks_delete on public.picks for delete to authenticated
  using ( public.owns_member(member_id) and public.fixture_open(fixture_id) );

drop function if exists public.admin_of_bot(uuid);

drop function if exists public.league_pick_status(uuid, integer);
create function public.league_pick_status(p_league uuid, p_round integer)
returns table(member_id uuid, nickname text, picks integer)
language sql stable security definer set search_path = '' as $$
  select m.id, m.nickname,
         (select count(*)::int from public.picks p join public.fixtures f on f.id = p.fixture_id
           where p.member_id = m.id and f.n = p_round)
    from public.members m
   where m.league_id = p_league and m.status = 'approved' and public.is_admin(p_league)
   order by lower(m.nickname);
$$;
revoke all on function public.league_pick_status(uuid, integer) from public, anon;
grant execute on function public.league_pick_status(uuid, integer) to authenticated;

alter table public.members drop constraint if exists members_bot_has_no_user;
alter table public.members drop column if exists is_bot;
alter table public.members alter column user_id set not null;
