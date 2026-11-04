-- =====================================================================
-- TOTOFANTA · schema del database (Supabase / Postgres)
-- Versione 3 · modalità Quote + calendario e risultati unici
--
-- Come usarlo: Supabase › SQL Editor › New query › incolla tutto › Run.
-- Si può rieseguire: le tabelle esistono già? Prima esegui reset.sql.
-- Dopo questo file esegui calendario-2026-27.sql (le 380 partite).
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
  odds_timer_h  int  not null default 24 check (odds_timer_h between 1 and 168),
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

-- Giornate di una lega.
create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues (id) on delete cascade,
  n             int  not null check (n between 1 and 38),
  published     boolean not null default false,
  locked_at     timestamptz,
  first_kickoff timestamptz,           -- aggiornato da trigger, serve al conto alla rovescia
  updated_at    timestamptz not null default now(),
  constraint rounds_unique unique (league_id, n)
);

-- Partite di una giornata (10 per giornata), con quote e risultato.
create table public.matches (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references public.rounds (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,  -- impostato da trigger
  pos       int  not null check (pos between 1 and 10),
  home      text,
  away      text,
  kickoff   timestamptz,
  o1        numeric(6,2) check (o1 is null or o1 > 1),
  ox        numeric(6,2) check (ox is null or ox > 1),
  o2        numeric(6,2) check (o2 is null or o2 > 1),
  hg        int check (hg is null or hg >= 0),
  ag        int check (ag is null or ag >= 0),
  constraint matches_unique unique (round_id, pos),
  constraint matches_result_complete check ((hg is null) = (ag is null))
);

-- Pronostici: una riga per giocatore e partita.
create table public.picks (
  member_id  uuid not null references public.members (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  league_id  uuid not null references public.leagues (id) on delete cascade,  -- impostato da trigger
  pick       text not null check (pick in ('1', 'X', '2')),
  updated_at timestamptz not null default now(),
  primary key (member_id, match_id)
);

create index members_user_idx on public.members (user_id);
create index rounds_league_idx on public.rounds (league_id);
create index matches_league_idx on public.matches (league_id);
create index picks_league_idx on public.picks (league_id);
create index picks_match_idx on public.picks (match_id);

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

-- Le quote di questa giornata sono visibili ai giocatori?
-- Sì se l'admin le ha pubblicate, oppure se le 10 partite sono complete
-- ed è scattato l'anticipo scelto (odds_timer_h ore prima della prima partita).
create or replace function public.round_visible(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.published
         or ( (select count(*) from public.matches m
               where m.round_id = r.id and m.home is not null and m.away is not null
                 and m.kickoff is not null and m.o1 > 1 and m.ox > 1 and m.o2 > 1) = 10
              and now() >= r.first_kickoff - make_interval(hours => l.odds_timer_h) )
       from public.rounds r join public.leagues l on l.id = r.league_id
      where r.id = rid),
    false);
$$;

-- La partita è iniziata (o l'admin ha chiuso i pronostici della giornata)?
create or replace function public.match_locked(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.locked_at is not null or (m.kickoff is not null and now() >= m.kickoff)
       from public.matches m join public.rounds r on r.id = m.round_id
      where m.id = mid),
    true);
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

-- Si può ancora pronosticare questa partita? (quote pubblicate e partita non iniziata)
create or replace function public.match_open(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.round_visible(m.round_id) and not public.match_locked(m.id)
                     from public.matches m where m.id = mid), false);
$$;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------

-- La partita eredita la lega dalla giornata.
create or replace function public.matches_set_league() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select r.league_id into new.league_id from public.rounds r where r.id = new.round_id;
  return new;
end $$;
create trigger matches_set_league before insert or update of round_id on public.matches
  for each row execute function public.matches_set_league();

-- Tiene aggiornato l'orario della prima partita della giornata.
create or replace function public.rounds_refresh_first_kickoff() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid uuid := coalesce(new.round_id, old.round_id);
begin
  update public.rounds r
     set first_kickoff = (select min(m.kickoff) from public.matches m where m.round_id = rid),
         updated_at = now()
   where r.id = rid;
  return null;
end $$;
create trigger matches_first_kickoff after insert or update or delete on public.matches
  for each row execute function public.rounds_refresh_first_kickoff();

-- Il pronostico eredita la lega dalla partita; partecipante e partita devono essere della stessa lega.
create or replace function public.picks_set_league() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ml uuid; mm uuid;
begin
  select m.league_id into ml from public.matches m where m.id = new.match_id;
  select x.league_id into mm from public.members x where x.id = new.member_id;
  if ml is null or mm is null or ml <> mm then
    raise exception 'Pronostico non valido per questa lega';
  end if;
  new.league_id := ml;
  new.updated_at := now();
  return new;
end $$;
create trigger picks_set_league before insert or update on public.picks
  for each row execute function public.picks_set_league();

-- ---------------------------------------------------------------------
-- Regole di accesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.leagues        enable row level security;
alter table public.league_secrets enable row level security;  -- nessuna regola: illeggibile
alter table public.members        enable row level security;
alter table public.rounds         enable row level security;
alter table public.matches        enable row level security;
alter table public.picks          enable row level security;

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

-- Giornate: le vedono gli iscritti approvati; le gestisce l'admin.
create policy rounds_select on public.rounds for select to authenticated
  using (public.is_member(league_id) or public.is_admin(league_id));
create policy rounds_write on public.rounds for all to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));

-- Partite e quote: visibili ai giocatori solo quando la giornata è pubblicata.
create policy matches_select on public.matches for select to authenticated
  using (public.is_admin(league_id) or (public.is_member(league_id) and public.round_visible(round_id)));
create policy matches_write on public.matches for all to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));

-- Pronostici:
--  · i propri si vedono sempre;
--  · quelli degli altri solo dopo il calcio d'inizio della partita;
--  · si scrivono solo prima del calcio d'inizio e a quote pubblicate;
--  · l'admin può scrivere quelli dei giocatori di prova.
create policy picks_select on public.picks for select to authenticated
  using ( public.owns_member(member_id)
       or (public.is_member(league_id) and public.match_locked(match_id))
       or public.admin_of_bot(member_id) );
create policy picks_insert on public.picks for insert to authenticated
  with check ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.match_open(match_id)) );
create policy picks_update on public.picks for update to authenticated
  using      ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.match_open(match_id)) )
  with check ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.match_open(match_id)) );
create policy picks_delete on public.picks for delete to authenticated
  using ( public.admin_of_bot(member_id) or (public.owns_member(member_id) and public.match_open(match_id)) );

-- ---------------------------------------------------------------------
-- Funzioni chiamate dal sito
-- ---------------------------------------------------------------------

-- Crea una lega con password cifrata e codice d'invito; l'autore diventa admin.
create or replace function public.create_league(
  p_name text, p_type text, p_password text, p_tiebreak text,
  p_start_round int, p_odds_timer_h int, p_logo text, p_nickname text
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
  insert into public.leagues (name, type, tiebreak, start_round, odds_timer_h, logo, admin_id)
  values (btrim(p_name), p_type, p_tiebreak, p_start_round, p_odds_timer_h, p_logo, auth.uid())
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
revoke execute on function public.create_league(text, text, text, text, int, int, text, text) from public, anon;
revoke execute on function public.join_league(text, text, text, text) from public, anon;
revoke execute on function public.get_invite_code(uuid) from public, anon;
grant  execute on function public.create_league(text, text, text, text, int, int, text, text) to authenticated;
grant  execute on function public.join_league(text, text, text, text) to authenticated;
grant  execute on function public.get_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Aggiornamenti in tempo reale (il sito si aggiorna quando un altro gioca)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.leagues, public.members, public.rounds, public.matches, public.picks;

-- =====================================================================
-- Versione 2: calendario (identico a migrazione-02-calendario.sql)
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

-- =====================================================================
-- Versione 3: risultati unici (identico a migrazione-03-risultati.sql)
-- =====================================================================
-- Risultati nel calendario
alter table public.fixtures
  add column hg int check (hg is null or hg >= 0),
  add column ag int check (ag is null or ag >= 0),
  add constraint fixtures_result_complete check ((hg is null) = (ag is null));

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

-- La partita della lega prende dal calendario anche il risultato.
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
  new.hg := f.hg; new.ag := f.ag;
  return new;
end $$;

-- Orari e risultati cambiati dall'amministratore arrivano in tutte le leghe.
create or replace function public.fixtures_propagate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches m
     set kickoff = new.kickoff, home = new.home, away = new.away, hg = new.hg, ag = new.ag
   where m.fixture_id = new.id
     and (m.kickoff is distinct from new.kickoff or m.home is distinct from new.home or m.away is distinct from new.away
          or m.hg is distinct from new.hg or m.ag is distinct from new.ag);
  return null;
end $$;

-- L'amministratore del sito può cambiare date, orari e risultati.
revoke update on public.fixtures from authenticated;
grant  update (kickoff, day, hg, ag) on public.fixtures to authenticated;

-- Elimina le giornate di prova create a mano (nessuna partita collegata al calendario).
delete from public.rounds r
 where not exists (select 1 from public.matches m where m.round_id = r.id and m.fixture_id is not null);
