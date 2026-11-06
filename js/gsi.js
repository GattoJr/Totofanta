// Carica Google Identity Services. Se non si carica (rete, blocchi) app.js usa l'accesso con reindirizzamento.
// Sta in un file a parte perché la politica di sicurezza (CSP) della pagina non permette script scritti nell'HTML.
(function(){var s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.defer=true;
  s.onerror=function(){window.__gsiErr=1};document.head.appendChild(s)})();
