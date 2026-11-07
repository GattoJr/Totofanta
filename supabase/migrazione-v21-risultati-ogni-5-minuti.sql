-- Totofanta — migrazione v21 (7/11/2026): a fine partita il risultato si chiede ogni 5 minuti invece di 10.
-- L'attività sync-risultati-tick gira ogni 5 minuti; il margine di 4 minuti evita chiamate doppie.
-- Uso di football-data.org: circa 1 richiesta ogni 5 minuti nelle fasce di gioco, limite gratuito 10 al minuto.
create or replace function private.results_tick()
returns text language plpgsql security definer set search_path = '' as $function$
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
  elsif ended and (last is null or last <= now() - interval '4 minutes') then why := 'fine-partita';
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
end $function$;
