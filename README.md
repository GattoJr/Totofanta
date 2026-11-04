# Totofanta

Gioco di pronostici sulla Serie A tra amici. Si crea una lega, ogni giornata si pronostica 1 · X · 2 sulle 10 partite e chi indovina prende punti pari alla quota.

Versione attuale: prototipo con la sola modalità **Quote**.

## Struttura

```
index.html            pagina dell'app
css/style.css         grafica (stile dei mockup Figma)
js/config.js          indirizzo e chiave pubblica del progetto Supabase
js/app.js             logica del gioco: login, leghe, giornate, pronostici, classifica
supabase/schema.sql   tabelle, regole di sicurezza (RLS) e funzioni del database
supabase/reset.sql    azzera il database (cancella tutto lo schema public)
```

## Database (Supabase)

1. SQL Editor › New query: incolla `supabase/reset.sql` › Run (solo se il progetto contiene vecchie tabelle).
2. New query: incolla `supabase/schema.sql` › Run.
3. Authentication › URL Configuration: Site URL `https://gattojr.github.io/Totofanta/`, e la stessa in Redirect URLs.
4. Per i test: Authentication › Sign In / Providers › Email › disattiva *Confirm email* (il servizio email gratuito di Supabase invia pochissime mail all'ora).

Regole principali garantite dal database:
- le leghe le vede solo chi ne fa parte; password e codice d'invito non sono leggibili;
- le quote sono nascoste finché la giornata non è pubblicata (a mano o all'anticipo scelto);
- i pronostici si possono cambiare solo prima del calcio d'inizio e quelli degli altri si vedono solo dopo;
- risultati, giornate e iscrizioni li gestisce solo l'admin della lega.

## Provarlo

- Online: GitHub Pages, dal ramo `main`.
- In locale: apri `index.html` nel browser, oppure `python3 -m http.server` nella cartella e vai su http://localhost:8000.

Con `js/config.js` compilato il sito usa Supabase (login con email e password, dati condivisi). Se i campi sono vuoti gira in **modalità prova**: i dati restano nel browser e dal menu si può cambiare giocatore per simulare più partecipanti.

## Prossimi passi

- Quote e risultati automatici da un servizio esterno.
- Modalità Punteggi fissi e Risultati esatti.
- Competizioni parallele (Miglior giornata, Battle Royale, Sopravvissuto).
