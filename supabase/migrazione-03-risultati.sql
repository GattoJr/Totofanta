-- =====================================================================
-- TOTOFANTA · migrazione 03 · risultati unici + pannello amministratore
--
-- Da eseguire dopo migrazione-02-calendario.sql e calendario-2026-27.sql.
-- Come usarlo: Supabase › SQL Editor › New query › incolla tutto › Run.
--
-- - I risultati delle partite stanno nel calendario: li inserisce
--   l'amministratore del sito una volta sola e valgono per tutte le leghe.
-- - Elimina le giornate create a mano prima del calendario (non collegate),
--   con le relative partite e schedine.
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
