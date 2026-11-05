-- =====================================================================
-- TOTOFANTA · v12 · risultati a fine partita, controllo del mattino alle 8:00
-- Sostituisce le attività 'sync-calendario-mattina' e 'sync-risultati-orario'.
-- =====================================================================
create or replace function private.results_tick() returns text
language plpgsql security definer set search_path = '' as $$
declare
  loc  timestamp := now() at time zone 'Europe/Rome';
  last timestamptz := (select value::timestamptz from private.settings where key = 'results_last_call');
  morning boolean := extract(hour from loc) = 8 and extract(minute from loc) < 5;
  ended boolean;
  why text;
begin
  -- partita iniziata da almeno 1h50 e da non più di 6 ore, ancora senza risultato
  ended := exists (select 1 from public.fixtures f
                    where f.hg is null and f.kickoff is not null
                      and f.kickoff <= now() - interval '110 minutes'
                      and f.kickoff >  now() - interval '6 hours');
  if morning then why := 'mattino';
  elsif ended and (last is null or last <= now() - interval '9 minutes') then why := 'fine-partita';
  else return 'niente da fare';
  end if;

  insert into private.settings (key, value) values ('results_last_call', now()::text)
  on conflict (key) do update set value = excluded.value;
  perform net.http_post(
    url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/sync-calendario',
    headers := jsonb_build_object('Content-Type','application/json',
               'x-sync-secret',(select value from private.settings where key='sync_secret')),
    body := jsonb_build_object('results', true, 'reason', why),
    timeout_milliseconds := 30000);
  return 'chiamata: ' || why;
end $$;
revoke all on function private.results_tick() from public, anon, authenticated;

select cron.unschedule('sync-calendario-mattina') where exists (select 1 from cron.job where jobname = 'sync-calendario-mattina');
select cron.unschedule('sync-risultati-orario')  where exists (select 1 from cron.job where jobname = 'sync-risultati-orario');
select cron.unschedule('sync-risultati-tick')    where exists (select 1 from cron.job where jobname = 'sync-risultati-tick');
select cron.schedule('sync-risultati-tick', '*/5 * * * *', $$ select private.results_tick() $$);

-- v13 (5/11): nome lega da 3 a 24 caratteri
alter table public.leagues add constraint leagues_name_len check (char_length(btrim(name)) between 3 and 24);
