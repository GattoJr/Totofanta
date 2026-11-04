// TOTOFANTA · sync-calendario
// Confronta il calendario Serie A con football-data.org e corregge date e orari
// delle partite non ancora iniziate (e, se richiesto, inserisce i risultati).
//
// Chiamata: POST con corpo JSON facoltativo { "results": true, "dry": true }
//   - results: inserisce anche i risultati delle partite finite (default false)
//   - dry: non scrive niente, restituisce solo cosa cambierebbe
// Autorizzazione: header x-sync-secret (attività programmata) oppure accesso
// di un amministratore del sito (Authorization: Bearer <token utente>).
// Segreto richiesto: FOOTBALL_DATA_TOKEN (chiave di football-data.org).
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://api.football-data.org/v4/competitions/SA/matches";
const TLA: Record<string, string> = {
  INT: "Inter", MIL: "Milan", NAP: "Napoli", JUV: "Juventus", ROM: "Roma", LAZ: "Lazio",
  ATA: "Atalanta", BOL: "Bologna", CAG: "Cagliari", COM: "Como", FIO: "Fiorentina",
  FRO: "Frosinone", GEN: "Genoa", LEC: "Lecce", MON: "Monza", PAR: "Parma",
  SAS: "Sassuolo", TOR: "Torino", UDI: "Udinese", VEN: "Venezia",
};
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 1), { status, headers: { "Content-Type": "application/json" } });

// data di calendario in Italia (YYYY-MM-DD) di un istante
const romeDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, service, { auth: { persistSession: false } });

  // --- autorizzazione
  const secret = req.headers.get("x-sync-secret");
  let allowed = false;
  if (secret) {
    const { data } = await db.rpc("check_sync_secret", { p: secret });
    allowed = data === true;
  } else if (req.headers.get("Authorization")) {
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    });
    const { data } = await user.rpc("is_site_admin");
    allowed = data === true;
  }
  if (!allowed) return json({ error: "Non autorizzato" }, 401);

  const opts = await req.json().catch(() => ({}));
  const doResults = opts.results === true;
  const dry = opts.dry === true;
  const season = Number(opts.season) || 2026;

  const token = Deno.env.get("FOOTBALL_DATA_TOKEN");
  const log = async (ok: boolean, summary: unknown) => {
    if (!dry) await db.from("sync_log").insert({ ok, summary });
  };
  if (!token) {
    await log(false, { error: "Manca il segreto FOOTBALL_DATA_TOKEN" });
    return json({ error: "Manca il segreto FOOTBALL_DATA_TOKEN" }, 500);
  }

  // --- una sola richiesta a football-data.org
  const res = await fetch(`${API}?season=${season}`, { headers: { "X-Auth-Token": token } });
  const quota = {
    perMinuteLeft: res.headers.get("X-Requests-Available-Minute"),
    resetSeconds: res.headers.get("X-RequestCounter-Reset"),
  };
  if (!res.ok) {
    const err = { error: `football-data.org ha risposto ${res.status}`, detail: (await res.text()).slice(0, 300), quota };
    await log(false, err);
    return json(err, 502);
  }
  const api = await res.json();
  const matches: any[] = api.matches || [];

  // --- calendario nel database
  const { data: fixtures, error } = await db.from("fixtures").select("id,n,home,away,kickoff,day,hg,ag");
  if (error) return json({ error: error.message }, 500);
  const teams = [...new Set(fixtures!.map((f) => f.home))];
  const teamOf = (t: any): string | null => {
    const sn = norm(t?.shortName);
    const exact = teams.find((x) => norm(x) === sn);
    if (exact) return exact;
    if (t?.tla && TLA[t.tla] && teams.includes(TLA[t.tla])) return TLA[t.tla];
    const nm = norm(t?.name);
    if (nm.includes("internazionale")) return teams.includes("Inter") ? "Inter" : null;
    return teams.filter((x) => nm.includes(norm(x))).sort((a, b) => b.length - a.length)[0] || null;
  };
  const byKey = new Map(fixtures!.map((f) => [`${f.n}|${f.home}|${f.away}`, f]));

  const now = Date.now();
  const changes: any[] = [], unmatched: any[] = [], postponed: any[] = [];
  for (const m of matches) {
    const home = teamOf(m.homeTeam), away = teamOf(m.awayTeam);
    const f = home && away ? byKey.get(`${m.matchday}|${home}|${away}`) : undefined;
    if (!f) { unmatched.push({ matchday: m.matchday, home: m.homeTeam?.name, away: m.awayTeam?.name }); continue; }
    const label = `${f.n}ª ${f.home}–${f.away}`;
    if (m.status === "POSTPONED" || m.status === "SUSPENDED" || m.status === "CANCELLED") {
      postponed.push({ id: f.id, match: label, status: m.status });
      continue;
    }
    const started = f.kickoff != null && Date.parse(f.kickoff) <= now;
    const upd: Record<string, unknown> = {};
    if (!started && (m.status === "SCHEDULED" || m.status === "TIMED") && m.utcDate) {
      const d = romeDay(m.utcDate);
      if (d !== f.day) upd.day = d;
      // orario solo se confermato (TIMED); con SCHEDULED l'ora è ancora provvisoria
      if (m.status === "TIMED" && (f.kickoff == null || Date.parse(f.kickoff) !== Date.parse(m.utcDate))) upd.kickoff = m.utcDate;
    }
    if (doResults && m.status === "FINISHED" && started) {
      const h = m.score?.fullTime?.home, a = m.score?.fullTime?.away;
      if (Number.isInteger(h) && Number.isInteger(a) && (h !== f.hg || a !== f.ag)) { upd.hg = h; upd.ag = a; }
    }
    if (Object.keys(upd).length) changes.push({ id: f.id, match: label, from: { kickoff: f.kickoff, day: f.day, hg: f.hg, ag: f.ag }, to: upd });
  }

  const failed: any[] = [];
  if (!dry) {
    for (const c of changes) {
      const { error } = await db.from("fixtures").update(c.to).eq("id", c.id);
      if (error) failed.push({ match: c.match, error: error.message });
    }
  }
  const summary = { season, results: doResults, dry, apiMatches: matches.length, changed: changes.length, changes, unmatched, postponed, failed, quota };
  await log(failed.length === 0 && unmatched.length === 0, summary);
  return json(summary);
});
