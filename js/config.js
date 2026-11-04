// Configurazione di Totofanta.
// Quando il progetto Supabase è pronto, inserisci qui l'indirizzo del progetto
// e la chiave pubblica ("anon public key"): Settings › API nel pannello Supabase.
// La chiave anon è pensata per stare nel browser: la sicurezza la fanno le regole (RLS) del database.
// Finché i campi sono vuoti, il sito funziona in modalità prova sul singolo dispositivo.
window.TOTOFANTA_CONFIG = {
  supabaseUrl: "https://cmjdfhkmzrfuukgeudet.supabase.co",
  supabaseAnonKey: "sb_publishable_X7R7m3eoJv7GUOaQrXjBPw_EfO6mkv0",
  // ID client OAuth di Google (pubblico, non è il "secret"): Google Cloud › Google Auth Platform › Clients.
  // Se compilato, l'accesso con Google avviene in una finestra di Google che mostra il nome del sito
  // invece dell'indirizzo di Supabase. Se vuoto si usa il vecchio reindirizzamento.
  googleClientId: ""
};
