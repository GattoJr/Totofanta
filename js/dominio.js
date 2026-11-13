// Indirizzo ufficiale di unoXdue: chi arriva dal vecchio indirizzo Cloudflare (o da www.) viene
// rimandato a https://unoxdue.it conservando pagina, parametri e link d'invito (#lega=…).
(function () {
  var vecchi = ["totofanta.tototips.workers.dev", "www.unoxdue.it"];
  if (vecchi.indexOf(location.hostname) !== -1) {
    location.replace("https://unoxdue.it" + location.pathname + location.search + location.hash);
  }
})();
