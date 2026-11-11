# Totofanta

Gioco di pronostici sulla Serie A tra amici. Si crea una lega, ogni giornata si pronostica 1 · X · 2 sulle 10 partite e chi indovina prende punti pari alla quota.

Versione attuale: prototipo con la sola modalità **Quote**.

## Come funziona

- Il calendario Serie A 2026/27 (squadre, orari, quote, risultati) è **unico per tutte le leghe** e lo gestisce l'**amministratore del sito** dal Pannello amministratore, che sta su una pagina a parte (`admin.html`) senza collegamenti dal sito.
- Ogni lega gioca in automatico dalla sua giornata di inizio alla 38ª: l'admin della lega gestisce partecipanti, bonus/penalità, password ed eliminazione della lega.
- Leghe private: si entra con nome della lega + password. Il link d'invito (`#lega=<nome>`) apre la schermata con il nome già inserito. Leghe pubbliche: basta il nome.
- Le quote di una giornata sono nascoste finché l'amministratore non la pubblica; i pronostici si chiudono al calcio d'inizio di ogni partita.

## Struttura

```
index.html            pagina dell'app
admin.html            pannello amministratore del sito (stessa app, indirizzo separato)
css/style.css         grafica (stile dei mockup Figma)
js/config.js          indirizzo e chiave pubblica del progetto Supabase
js/app.js             logica del gioco: login, leghe, pronostici, classifica, pannello amministratore
js/calendario.js      calendario Serie A 2026/27 (usato dalla modalità prova)
supabase/schema.sql   tabelle, regole di sicurezza (RLS) e funzioni del database
supabase/calendario-2026-27.sql   le 380 partite della Serie A 2026/27
supabase/reset.sql    azzera il database (cancella tutto lo schema public)
```

## Database (Supabase)

1. SQL Editor › New query: incolla `supabase/reset.sql` › Run (solo se il progetto contiene vecchie tabelle).
2. New query: incolla `supabase/schema.sql` › Run.
3. New query: incolla `supabase/calendario-2026-27.sql` › Run.
4. Amministratore del sito:
   `insert into public.site_admins select id from auth.users where email = 'TUA-EMAIL';`
5. Authentication › URL Configuration: Site URL `https://totofanta.tototips.workers.dev/`; in Redirect URLs `https://totofanta.tototips.workers.dev/**` (copre anche `admin`).
6. Per i test: Authentication › Sign In / Providers › Email › disattiva *Confirm email* (il servizio email gratuito di Supabase invia pochissime mail all'ora).

Regole principali garantite dal database:
- le leghe le vede solo chi ne fa parte; le password non sono leggibili; nelle leghe private si entra solo con la password;
- calendario, quote, risultati e pubblicazione delle giornate li cambia solo l'amministratore del sito;
- una giornata si pubblica solo con orario e quote di tutte le 10 partite; prima della pubblicazione le quote non sono leggibili;
- i pronostici si possono cambiare solo prima del calcio d'inizio e quelli degli altri si vedono solo dopo;
- si pronosticano solo le giornate dalla giornata di inizio della lega in poi;
- il risultato si può inserire solo dopo il calcio d'inizio.

## Provarlo

- Online: GitHub Pages, dal ramo `main`.
- In locale: apri `index.html` nel browser, oppure `python3 -m http.server` nella cartella e vai su http://localhost:8000.

Con `js/config.js` compilato il sito usa Supabase (login con email e password, dati condivisi). Se i campi sono vuoti gira in **modalità prova**: i dati restano nel browser, si è amministratori del sito e dal menu si può cambiare giocatore per simulare più partecipanti.

## Prossimi passi

- Quote e risultati automatici da un servizio esterno (API).
- Modalità Punteggi fissi e Risultati esatti.
- Competizioni parallele (Miglior giornata, Battle Royale, Sopravvissuto).

## Pubblicazione (dall'11/11/2026)

Il sito è servito da Cloudflare Workers (static assets): https://totofanta.tototips.workers.dev — si pubblica da solo a ogni push su `main`. Configurazione in `wrangler.jsonc`, file esclusi in `.assetsignore`, intestazioni di sicurezza in `_headers`. Il vecchio indirizzo GitHub Pages (ramo `gh-pages`) rimanda al nuovo, conservando i link d'invito (`#lega=…`).
