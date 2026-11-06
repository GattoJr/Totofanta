// TOTOFANTA · delete-account
// Elimina l'account dell'utente che chiama (token nell'header Authorization).
// Il database cancella a cascata: leghe di cui è admin (con partecipanti e pronostici),
// le sue iscrizioni e i suoi pronostici nelle altre leghe.
// Dal 6/11: se è admin di una lega con altri iscritti deve prima nominare un nuovo admin
// (public.transfer_admin); altrimenti l'eliminazione è rifiutata. Le leghe in cui è l'unico iscritto si eliminano.
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
  const uid = data.user.id;
  const { data: own, error: ownErr } = await admin.from("leagues").select("id,name").eq("admin_id", uid);
  if (ownErr) return json({ error: ownErr.message }, 500);
  if (own && own.length) {
    const { data: others, error: memErr } = await admin.from("members").select("league_id").in("league_id", own.map((l) => l.id)).neq("user_id", uid);
    if (memErr) return json({ error: memErr.message }, 500);
    const blocked = own.filter((l) => (others || []).some((m) => m.league_id === l.id));
    if (blocked.length) return json({ error: `Prima nomina un nuovo admin per: ${blocked.map((l) => l.name).join(", ")}`, leagues: blocked }, 409);
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
