-- =====================================================================
-- TOTOFANTA · migrazione 02 · calendario Serie A unico per tutte le leghe
--
-- Per il database già in uso (creato con schema.sql versione 1).
-- Come usarlo: Supabase › SQL Editor › New query › incolla tutto › Run.
-- Poi esegui anche calendario-2026-27.sql (carica le 380 partite).
-- Le leghe, le giornate e i pronostici esistenti restano come sono.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Calendario: accoppiamenti fissi, orari provvisori
-- ---------------------------------------------------------------------
create table public.fixtures (
  id         int  primary key,                          -- giornata*100 + posizione (es. 1103)
  n          int  not null check (n between 1 and 38),
  pos        int  not null check (pos between 1 and 10),
  home       text not null,
  away       text not null,
  kickoff    timestamptz,                               -- null = orario non ancora ufficiale
  day        date,                                      -- data indicativa della partita
  updated_at timestamptz not null default now(),
  constraint fixtures_unique unique (n, pos),
  constraint fixtures_teams check (home <> away)
);

-- Gestori del calendario (possono cambiare date e orari per tutte le leghe).
create table public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Le partite di una lega possono puntare a una partita del calendario.
alter table public.matches add column fixture_id int references public.fixtures (id);
create index matches_fixture_idx on public.matches (fixture_id);

create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_admins s where s.user_id = auth.uid());
$$;

-- Una partita collegata al calendario prende squadre e orario dal calendario
-- (l'admin della lega non li può cambiare) e deve essere della stessa giornata.
create or replace function public.matches_from_fixture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.fixtures; rn int;
begin
  if new.fixture_id is null then return new; end if;
  select * into f from public.fixtures x where x.id = new.fixture_id;
  select r.n into rn from public.rounds r where r.id = new.round_id;
  if f.n is distinct from rn then
    raise exception 'La partita del calendario non appartiene alla %ª giornata', rn;
  end if;
  new.home := f.home; new.away := f.away; new.kickoff := f.kickoff;
  return new;
end $$;
create trigger matches_from_fixture before insert or update on public.matches
  for each row execute function public.matches_from_fixture();

-- Quando il gestore cambia un orario, si aggiorna in tutte le leghe.
create or replace function public.fixtures_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger fixtures_touch before update on public.fixtures
  for each row execute function public.fixtures_touch();

create or replace function public.fixtures_propagate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches m set kickoff = new.kickoff, home = new.home, away = new.away
   where m.fixture_id = new.id
     and (m.kickoff is distinct from new.kickoff or m.home is distinct from new.home or m.away is distinct from new.away);
  return null;
end $$;
create trigger fixtures_propagate after update on public.fixtures
  for each row execute function public.fixtures_propagate();

-- Regole di accesso
alter table public.fixtures    enable row level security;
alter table public.site_admins enable row level security;

-- Calendario: lo leggono tutti quelli che hanno fatto l'accesso; date e orari li cambia il gestore.
create policy fixtures_select on public.fixtures for select to authenticated using (true);
create policy fixtures_update on public.fixtures for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
-- Squadre e numero di giornata non si toccano dal sito (solo da SQL Editor).
revoke update on public.fixtures from authenticated;
grant  update (kickoff, day) on public.fixtures to authenticated;

-- Gestori: ognuno vede solo la propria riga (serve al sito per mostrare la modifica).
create policy site_admins_select on public.site_admins for select to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.fixtures;
