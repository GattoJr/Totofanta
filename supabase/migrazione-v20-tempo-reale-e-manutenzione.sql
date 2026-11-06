-- Totofanta — migrazione v20 (6/11/2026)
-- 1. Avviso unico per i punti: round_scores esce dal tempo reale (un evento per ogni riga cambiata,
--    cioè per ogni giocatore di ogni lega a ogni risultato). Al suo posto public.score_ticks:
--    una riga per giornata, toccata solo quando i punti di quella giornata cambiano davvero.
--    I siti ricevono un solo evento e scaricano i punti della propria lega per quella giornata.
-- 2. Pulizia settimanale dei registri: storico delle attività programmate (7 giorni),
--    registro delle sincronizzazioni (60 giorni), richieste HTTP di pg_net già risposte.
-- 3. Accesso automatico settimanale: una richiesta alla funzione keepalive passando dall'indirizzo
--    pubblico del progetto (come farebbe un utente). La richiesta esterna da GitHub Actions è in
--    .github/workflows/keepalive.yml: serve a risvegliare il progetto anche se pg_cron fosse fermo.

create table if not exists public.score_ticks (
  n int primary key check (n between 1 and 38),
  updated_at timestamptz not null default now()
);
alter table public.score_ticks enable row level security;
drop policy if exists score_ticks_select on public.score_ticks;
create policy score_ticks_select on public.score_ticks for select to authenticated using (true);
grant select on public.score_ticks to authenticated;

do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'round_scores') then
    alter publication supabase_realtime drop table public.round_scores;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'score_ticks') then
    alter publication supabase_realtime add table public.score_ticks;
  end if;
end $$;

create or replace function private.recompute_round(p_n int, p_league uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_changed int;
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
    returning 1
  ), del as (
    delete from public.round_scores r
     where r.n = p_n and (p_league is null or r.league_id = p_league)
       and not exists (select 1 from calc where calc.member_id = r.member_id)
    returning 1
  )
  select (select count(*) from up) + (select count(*) from del) into v_changed;
  if v_changed > 0 then
    insert into public.score_ticks (n, updated_at) values (p_n, now())
    on conflict (n) do update set updated_at = excluded.updated_at;
  end if;
end $$;

-- pulizia settimanale (domenica 3:20 UTC)
create or replace function private.cleanup_logs()
returns text language plpgsql security definer set search_path = '' as $$
declare a int; b int;
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics a = row_count;
  delete from public.sync_log where ran_at < now() - interval '60 days';
  get diagnostics b = row_count;
  return format('storico attività: %s righe, registro sincronizzazioni: %s righe', a, b);
end $$;
select cron.unschedule('pulizia-registri') where exists (select 1 from cron.job where jobname = 'pulizia-registri');
select cron.schedule('pulizia-registri', '20 3 * * 0', 'select private.cleanup_logs()');

-- accesso automatico settimanale (lunedì 6:40 UTC) dall'indirizzo pubblico del progetto
select cron.unschedule('accesso-settimanale') where exists (select 1 from cron.job where jobname = 'accesso-settimanale');
select cron.schedule('accesso-settimanale', '40 6 * * 1',
  $$select net.http_get(url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/keepalive', timeout_milliseconds := 20000)$$);
