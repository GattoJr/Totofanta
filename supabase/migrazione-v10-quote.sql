-- =====================================================================
-- TOTOFANTA · v10 · quote automatiche (The Odds API, funzione sync-quote)
-- =====================================================================

-- Quote: origine, protezione "manuale", numero di bookmaker usati
alter table public.odds
  add column if not exists manual boolean not null default false,  -- true: l'aggiornamento automatico non la tocca
  add column if not exists source text not null default 'admin' check (source in ('admin','api')),
  add column if not exists books  int;

-- Avvisi del controllo di verosimiglianza (li vede e gestisce solo l'admin del sito)
create table if not exists public.odds_alerts (
  fixture_id int primary key references public.fixtures (id) on delete cascade,
  reason     text not null,
  blocking   boolean not null default true,   -- true: quota NON applicata · false: applicata, solo da controllare
  c1 numeric(6,2), cx numeric(6,2), c2 numeric(6,2),   -- quota proposta dall'API
  created_at timestamptz not null default now()
);
alter table public.odds_alerts enable row level security;
drop policy if exists odds_alerts_admin on public.odds_alerts;
create policy odds_alerts_admin on public.odds_alerts for all to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());

-- Blocco: dal fischio d'inizio della prima partita della giornata le quote non cambiano più.
-- Unica eccezione: l'amministratore del sito (pannello admin).
create or replace function public.odds_freeze() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fid int := case when tg_op = 'DELETE' then old.fixture_id else new.fixture_id end;
begin
  if not public.is_site_admin() and public.fixture_locked(fid) then
    raise exception 'Quote bloccate: la giornata è già iniziata';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists odds_freeze on public.odds;
create trigger odds_freeze before insert or update or delete on public.odds
  for each row execute function public.odds_freeze();

-- Registro: distingue calendario e quote
alter table public.sync_log add column if not exists kind text not null default 'calendario';

-- ---------------------------------------------------------------------
-- Programmazione: un controllo ogni 5 minuti (non consuma crediti) decide se chiamare l'API
--  · ogni ora piena dalle 8 alle 21 (ora italiana)
--  · più un aggiornamento 30 minuti prima della prima partita della giornata
--  · mai mentre una giornata è in corso
--  · solo se la prossima giornata inizia entro 7 giorni
--  · con meno di 30 crediti restano solo gli aggiornamenti dei 30 minuti prima
-- ---------------------------------------------------------------------
create or replace function private.odds_tick() returns text
language plpgsql security definer set search_path = '' as $$
declare
  loc   timestamp := now() at time zone 'Europe/Rome';
  nxt   timestamptz;
  pre   boolean;
  hourly boolean;
  left_ int;
begin
  -- giornata in corso? (dalla prima partita a 2h30 dopo l'ultima; ignora i rinvii oltre 6 giorni)
  if exists (
    select 1 from (select n, min(kickoff) a from public.fixtures group by n) r
     where r.a <= now()
       and (select max(f.kickoff) from public.fixtures f
             where f.n = r.n and f.kickoff <= r.a + interval '6 days') + interval '2 hours 30 minutes' > now()
  ) then return 'giornata in corso'; end if;

  -- prossima giornata non ancora iniziata
  select min_k into nxt from (select n, min(kickoff) min_k from public.fixtures group by n) t
   where min_k > now() order by min_k limit 1;
  if nxt is null or nxt > now() + interval '7 days' then return 'nessuna giornata entro 7 giorni'; end if;

  pre    := now() >= nxt - interval '32 minutes' and now() < nxt - interval '27 minutes';
  hourly := extract(hour from loc) between 8 and 21 and extract(minute from loc) < 5;
  if not (pre or hourly) then return 'non è il momento'; end if;

  select (summary->>'remaining')::int into left_ from public.sync_log
   where kind = 'quote' and summary ? 'remaining' order by ran_at desc limit 1;
  if not pre and left_ is not null and left_ < 30 then return 'crediti in esaurimento: solo aggiornamento pre-partita'; end if;

  perform net.http_post(
    url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/sync-quote',
    headers := jsonb_build_object('Content-Type','application/json',
               'x-sync-secret',(select value from private.settings where key='sync_secret')),
    body := jsonb_build_object('reason', case when pre then 'pre-partita' else 'orario' end),
    timeout_milliseconds := 30000);
  return case when pre then 'chiamata pre-partita' else 'chiamata oraria' end;
end $$;
revoke all on function private.odds_tick() from public, anon, authenticated;

select cron.unschedule('sync-quote-tick') where exists (select 1 from cron.job where jobname = 'sync-quote-tick');
select cron.schedule('sync-quote-tick', '*/5 * * * *', $$ select private.odds_tick() $$);

alter publication supabase_realtime add table public.odds_alerts;
revoke execute on function public.odds_freeze() from public, anon, authenticated;

-- v11 (5/11): create_league rifiuta una giornata di inizio già iniziata
-- (aggiunto in create_league: if exists fixture della giornata con kickoff <= now() → errore)
