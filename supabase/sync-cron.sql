-- =====================================================================
-- TOTOFANTA · attività programmate per la funzione sync-calendario
-- (orari in UTC: 9:00 UTC = 10:00 in Italia con l'ora solare, 11:00 con l'ora legale)
-- Prima: schema.sql (crea private.settings con sync_secret) e funzione
-- sync-calendario pubblicata con il secret FOOTBALL_DATA_TOKEN.
-- =====================================================================

-- ogni mattina: date, orari confermati e risultati
select cron.schedule('sync-calendario-mattina', '0 9 * * *', $$
  select net.http_post(
    url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/sync-calendario',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',(select value from private.settings where key='sync_secret')),
    body := '{"results":true}'::jsonb, timeout_milliseconds := 30000)
$$);

-- ogni ora dalle 12:15 alle 23:15 UTC: risultati delle partite finite
select cron.schedule('sync-risultati-orario', '15 12-23 * * *', $$
  select net.http_post(
    url := 'https://cmjdfhkmzrfuukgeudet.supabase.co/functions/v1/sync-calendario',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',(select value from private.settings where key='sync_secret')),
    body := '{"results":true}'::jsonb, timeout_milliseconds := 30000)
$$);

-- per toglierle: select cron.unschedule('sync-calendario-mattina'); select cron.unschedule('sync-risultati-orario');

-- QUOTE (v7, funzione sync-quote con il secret ODDS_API_KEY): controllo ogni 5 minuti,
-- la logica (8–21 ora italiana, 30' prima della prima partita, pausa a giornata in corso)
-- è in private.odds_tick() → vedi migrazione-v7-quote.sql
-- per toglierla: select cron.unschedule('sync-quote-tick');
