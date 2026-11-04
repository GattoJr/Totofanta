# Totofanta

Gioco di pronostici sulla Serie A tra amici. Si crea una lega, ogni giornata si pronostica 1 · X · 2 sulle 10 partite e chi indovina prende punti pari alla quota.

Versione attuale: prototipo con la sola modalità **Quote**.

## Struttura

```
index.html        pagina dell'app
css/style.css     grafica (stile dei mockup Figma)
js/config.js      configurazione Supabase (vuota = modalità prova)
js/app.js         logica del gioco: leghe, giornate, pronostici, classifica
```

## Provarlo

- Online: GitHub Pages, dal ramo `main`.
- In locale: apri `index.html` nel browser, oppure `python3 -m http.server` nella cartella e vai su http://localhost:8000.

Senza Supabase configurato il sito gira in **modalità prova**: i dati restano nel browser e dal menu si può cambiare giocatore per simulare più partecipanti.

## Prossimi passi

- Database e login su Supabase, con regole di sicurezza lato server.
- Modalità Punteggi fissi e Risultati esatti.
- Competizioni parallele (Miglior giornata, Battle Royale, Sopravvissuto).
