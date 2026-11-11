// Totofanta si è spostato su Cloudflare: rimanda al nuovo indirizzo conservando pagina e link d'invito (#lega=…).
(function () {
  var nuovo = "https://totofanta.tototips.workers.dev";
  var path = location.pathname.replace(/^\/Totofanta/i, "").replace(/\.html$/, "").replace(/\/index$/, "/");
  location.replace(nuovo + (path || "/") + location.search + location.hash);
})();
