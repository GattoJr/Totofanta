// TOTOFANTA · keepalive
// Tiene attivo il progetto Supabase gratuito (si mette in pausa dopo 7 giorni senza richieste),
// per esempio d'estate quando non si gioca. La chiamano ogni settimana pg_cron ("accesso-settimanale")
// e GitHub Actions (.github/workflows/keepalive.yml). Fa una lettura minima e non restituisce dati.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await db.from("calendar_rounds").select("n").limit(1);
  return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200, headers: { "Content-Type": "application/json" } });
});
