-- Totofanta — migrazione v17: punti salvati per giocatore e giornata
--
-- Il database calcola i punti a ogni risultato (e a ogni correzione di quota o di pubblicazione)
-- e li salva in public.round_scores: una riga per iscritto per giornata.
-- Il sito legge da qui classifica generale, classifica di giornata e riepiloghi,
-- e scarica i pronostici degli altri solo per la giornata che sta mostrando.
--
-- Regola di calcolo (uguale a computeStandings/roundScore in js/app.js, che resta per la modalità prova):
--   pronostico indovinato = quota dell'esito (1, X, 2) in centesimi, arrotondata;
--   contano solo le giornate pubblicate e dalla giornata di inizio della lega in poi;
--   pts = somma, correct = pronostici indovinati, best = quota indovinata più alta (centesimi).
-- I bonus e le penalità restano in public.league_adjustments.

create table if not exists public.round_scores (
  member_id uuid not null references public.members(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  n int not null check (n between 1 and 38),
  pts int not null default 0,      -- punti in centesimi (2,49 punti = 249)
  correct int not null default 0,  -- pronostici indovinati
  best int not null default 0,     -- quota più alta indovinata, in centesimi
  updated_at timestamptz not null default now(),
  primary key (member_id, n)
);
create index if not exists round_scores_league_idx on public.round_scores (league_id, n);

alter table public.round_scores enable row level security;
-- leggibili dagli iscritti della lega; nessuno li scrive dal sito (solo il calcolo automatico)
drop policy if exists round_scores_select on public.round_scores;
create policy round_scores_select on public.round_scores for select using (public.is_member(league_id));
revoke insert, update, delete on public.round_scores from anon, authenticated;
grant select on public.round_scores to authenticated;

-- ricalcolo di una giornata per tutte le leghe: scrive solo le righe cambiate e toglie quelle sparite
create or replace function private.recompute_round(p_n int)
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
     group by p.member_id, p.league_id, f.n
  ), up as (
    insert into public.round_scores as r (member_id, league_id, n, pts, correct, best)
    select member_id, league_id, n, pts, correct, best from calc
    on conflict (member_id, n) do update
      set pts = excluded.pts, correct = excluded.correct, best = excluded.best, updated_at = now()
      where (r.pts, r.correct, r.best) is distinct from (excluded.pts, excluded.correct, excluded.best)
  )
  delete from public.round_scores r
   where r.n = p_n and not exists (select 1 from calc where calc.member_id = r.member_id);
end $$;

create or replace function private.recompute_all()
returns void language plpgsql security definer set search_path = '' as $$
declare k int;
begin
  for k in 1..38 loop perform private.recompute_round(k); end loop;
end $$;

-- per l'amministratore del sito: "ricalcola tutti i punti"
create or replace function public.recompute_scores()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_site_admin() then raise exception 'Solo l''amministratore del sito'; end if;
  perform private.recompute_all();
end $$;
revoke all on function public.recompute_scores() from public, anon;
grant execute on function public.recompute_scores() to authenticated;

-- trigger: risultato scritto o corretto
create or replace function private.scores_on_fixture()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_round(new.n);
  if new.n <> old.n then perform private.recompute_round(old.n); end if;
  return null;
end $$;
drop trigger if exists scores_on_fixture on public.fixtures;
create trigger scores_on_fixture after update of hg, ag, n on public.fixtures
  for each row when ((old.hg, old.ag, old.n) is distinct from (new.hg, new.ag, new.n))
  execute function private.scores_on_fixture();

-- trigger: quota cambiata (conta solo se la giornata ha già almeno un risultato)
create or replace function private.scores_on_odds()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k int := (case when tg_op = 'DELETE' then old.fixture_id else new.fixture_id end) / 100;
begin
  if exists (select 1 from public.fixtures f where f.n = k and f.hg is not null) then
    perform private.recompute_round(k);
  end if;
  return null;
end $$;
drop trigger if exists scores_on_odds on public.odds;
create trigger scores_on_odds after insert or delete or update of o1, ox, o2 on public.odds
  for each row execute function private.scores_on_odds();

-- trigger: giornata pubblicata o ritirata
create or replace function private.scores_on_round()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_round(new.n);
  return null;
end $$;
drop trigger if exists scores_on_round on public.calendar_rounds;
create trigger scores_on_round after update of published on public.calendar_rounds
  for each row when (old.published is distinct from new.published)
  execute function private.scores_on_round();

-- trigger: giornata di inizio della lega cambiata
create or replace function private.scores_on_league()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_all();
  return null;
end $$;
drop trigger if exists scores_on_league on public.leagues;
create trigger scores_on_league after update of start_round on public.leagues
  for each row when (old.start_round is distinct from new.start_round)
  execute function private.scores_on_league();

-- tempo reale: i browser ricevono le righe cambiate (filtrate dalla regola di lettura)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'round_scores') then
    alter publication supabase_realtime add table public.round_scores;
  end if;
end $$;

-- controllo notturno di sicurezza: ricalcola tutto alle 4:10 (ora UTC, il calcolo è indipendente dall'ora)
select cron.unschedule('ricalcolo-punti-notte') where exists (select 1 from cron.job where jobname = 'ricalcolo-punti-notte');
select cron.schedule('ricalcolo-punti-notte', '10 4 * * *', 'select private.recompute_all()');

-- riempimento iniziale con le giornate già giocate
select private.recompute_all();
