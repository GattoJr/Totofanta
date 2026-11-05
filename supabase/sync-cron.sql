-- =====================================================================
-- TOTOFANTA · attività programmate (pg_cron + pg_net)
-- Prima: schema.sql (private.settings con sync_secret), funzioni sync-calendario
-- (secret FOOTBALL_DATA_TOKEN) e sync-quote (secret ODDS_API_KEY).
-- Entrambe le attività girano ogni 5 minuti ma chiamano le API solo quando serve:
-- la logica (in ora italiana, quindi anche con l'ora legale) è nelle funzioni private.
-- =====================================================================

-- RISULTATI e CALENDARIO (v12) → private.results_tick(), vedi migrazione-v12-risultati.sql
--   · ogni mattina alle 8:00: date, orari confermati e risultati
--   · a fine partita: da 1h50 dopo il calcio d'inizio, ogni ~10 minuti finché arriva il risultato
--     (al massimo fino a 6 ore dopo l'inizio)
select cron.schedule('sync-risultati-tick', '*/5 * * * *', $$ select private.results_tick() $$);

-- QUOTE (v10) → private.odds_tick(), vedi migrazione-v10-quote.sql
--   · ogni ora piena 8–21 e 30' prima della prima partita della giornata; mai a giornata in corso
select cron.schedule('sync-quote-tick', '*/5 * * * *', $$ select private.odds_tick() $$);

-- per toglierle: select cron.unschedule('sync-risultati-tick'); select cron.unschedule('sync-quote-tick');
