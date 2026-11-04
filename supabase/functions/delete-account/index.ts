// TOTOFANTA · delete-account
// Elimina l'account dell'utente che chiama (token nell'header Authorization).
// Il database cancella a cascata: leghe di cui è admin (con partecipanti e pronostici),
// le sue iscrizioni e i suoi pronostici nelle altre leghe.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Non autorizzato" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return json({ error: "Sessione non valida, accedi di nuovo" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "ELIMINA") return json({ error: "Conferma mancante" }, 400);
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
