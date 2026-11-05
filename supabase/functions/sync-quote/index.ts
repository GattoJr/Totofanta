// TOTOFANTA · sync-quote
// Scarica le quote 1X2 della Serie A da The Odds API (1 chiamata = 1 credito:
// mercato h2h, regione eu) e aggiorna le quote delle giornate non ancora iniziate.
//
// Quota salvata = mediana dei bookmaker europei, arrotondata a 2 decimali.
// Controllo di verosimiglianza per ogni partita:
//   BLOCCANTI (la quota non viene applicata, resta l'ultima buona, avviso in admin):
//     · almeno 3 bookmaker
//     · ogni quota tra 1.01 e 50
//     · somma delle probabilità (1/q) tra 97% e 115%
//     · bookmaker d'accordo: per ogni esito almeno il 60% entro ±15% dalla mediana
//   NON BLOCCANTI (la quota viene applicata, avviso in admin):
//     · salto oltre il 25% rispetto all'ultimo aggiornamento, o cambio della favorita
// Non tocca: partite con quota "manuale", giornate già iniziate (bloccate anche dal database).
// Pubblica in automatico le giornate con tutte e 10 le partite pronte (orario e quote).
//
// Chiamata: POST { "dry": true } per una prova senza scrivere niente.
// Autorizzazione: header x-sync-secret (attività programmata) oppure admin del sito.
// Segreto richiesto: ODDS_API_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://api.the-odds-api.com/v4/sports/soccer_italy_serie_a/odds";
// nomi di The Odds API che non coincidono con i nostri
const ALIAS: Record<string, string> = {
  "inter milan": "Inter", "internazionale": "Inter", "fc internazionale milano": "Inter",
  "ac milan": "Milan", "as roma": "Roma", "ssc napoli": "Napoli", "ss lazio": "Lazio",
  "atalanta bc": "Atalanta", "juventus fc": "Juventus", "hellas verona": "Verona",
  "acf fiorentina": "Fiorentina", "torino fc": "Torino", "genoa cfc": "Genoa",
  "us lecce": "Lecce", "parma calcio": "Parma", "us sassuolo": "Sassuolo", "venezia fc": "Venezia",
};
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 1), { status, headers: { "Content-Type": "application/json" } });
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (x: number) => Math.round(x * 100) / 100;

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

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
  const dry = opts.dry === true;
  const reason = typeof opts.reason === "string" ? opts.reason : (secret ? "programmato" : "manuale");
  const log = async (ok: boolean, summary: unknown) => {
    if (!dry) await db.from("sync_log").insert({ ok, summary, kind: "quote" });
  };

  const key = ["ODDS_API_KEY", "THE_ODDS_API_KEY", "ODDS_API", "ODDS_KEY", "ODDSAPI_KEY"].map((k) => Deno.env.get(k)).find(Boolean);
  if (!key) {
    // aiuto: nomi (non valori) dei secret che somigliano a quello atteso
    const simili = Object.keys(Deno.env.toObject()).filter((k) => /odd|quot/i.test(k));
    const err = { error: "Manca il segreto ODDS_API_KEY", secretSimili: simili };
    await log(false, err);
    return json(err, 500);
  }

  // --- una sola richiesta: tutte le partite di Serie A in programma (1 credito)
  const res = await fetch(`${API}?apiKey=${key}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`);
  const quota = {
    remaining: Number(res.headers.get("x-requests-remaining")) || null,
    used: Number(res.headers.get("x-requests-used")) || null,
    last: Number(res.headers.get("x-requests-last")) || 0,
  };
  if (!res.ok) {
    const err = { error: `The Odds API ha risposto ${res.status}`, detail: (await res.text()).slice(0, 300), reason, ...quota };
    await log(false, err);
    return json(err, 502);
  }
  const events: any[] = await res.json();

  // --- calendario, quote attuali e giornate
  const [fx, od, cr] = await Promise.all([
    db.from("fixtures").select("id,n,home,away,kickoff,day"),
    db.from("odds").select("fixture_id,o1,ox,o2,manual,source"),
    db.from("calendar_rounds").select("n,published"),
  ]);
  if (fx.error || od.error || cr.error) return json({ error: (fx.error || od.error || cr.error)!.message }, 500);
  const fixtures = fx.data!;
  const oddsBy = new Map(od.data!.map((o) => [o.fixture_id, o]));
  const now = Date.now();
  const firstKick = new Map<number, number>();
  for (const f of fixtures) if (f.kickoff) {
    const t = Date.parse(f.kickoff);
    if (!firstKick.has(f.n) || t < firstKick.get(f.n)!) firstKick.set(f.n, t);
  }
  const roundStarted = (n: number) => firstKick.has(n) && firstKick.get(n)! <= now;

  const teams = [...new Set(fixtures.map((f) => f.home))];
  const teamOf = (name: string): string | null => {
    const n = norm(name);
    if (ALIAS[n] && teams.includes(ALIAS[n])) return ALIAS[n];
    const exact = teams.find((t) => norm(t) === n);
    if (exact) return exact;
    return teams.filter((t) => n.includes(norm(t))).sort((a, b) => b.length - a.length)[0] || null;
  };
  // partita del nostro calendario: stesse squadre, data entro 36 ore
  const fixtureOf = (home: string, away: string, iso: string) => {
    const t = Date.parse(iso);
    return fixtures.find((f) => {
      if (f.home !== home || f.away !== away) return false;
      const ref = f.kickoff ? Date.parse(f.kickoff) : f.day ? Date.parse(f.day + "T12:00:00Z") : NaN;
      return !isNaN(ref) && Math.abs(ref - t) <= 36 * 3600e3;
    });
  };

  const updates: any[] = [], alerts: any[] = [];
  const unmatched: any[] = [], skipped: any[] = [];
  for (const ev of events) {
    const home = teamOf(ev.home_team), away = teamOf(ev.away_team);
    const f = home && away ? fixtureOf(home, away, ev.commence_time) : undefined;
    if (!f) { unmatched.push({ home: ev.home_team, away: ev.away_team, at: ev.commence_time }); continue; }
    const label = `${f.n}ª ${f.home}–${f.away}`;
    if (roundStarted(f.n)) { skipped.push({ match: label, why: "giornata iniziata" }); continue; }
    const cur = oddsBy.get(f.id);
    if (cur?.manual) { skipped.push({ match: label, why: "quota manuale" }); continue; }

    // quote di ogni bookmaker
    const q: { "1": number[]; X: number[]; "2": number[] } = { "1": [], X: [], "2": [] };
    for (const b of ev.bookmakers || []) {
      const m = (b.markets || []).find((x: any) => x.key === "h2h");
      if (!m) continue;
      const get = (nm: string) => m.outcomes.find((o: any) => o.name === nm)?.price;
      const p1 = get(ev.home_team), px = get("Draw"), p2 = get(ev.away_team);
      if ([p1, px, p2].every((x) => typeof x === "number" && x > 1)) { q["1"].push(p1); q.X.push(px); q["2"].push(p2); }
    }
    const books = q["1"].length;
    const problems: string[] = [];
    let o1 = 0, ox = 0, o2 = 0;
    if (books < 3) problems.push(`solo ${books} bookmaker`);
    else {
      o1 = r2(median(q["1"])); ox = r2(median(q.X)); o2 = r2(median(q["2"]));
      if ([o1, ox, o2].some((x) => x < 1.01 || x > 50)) problems.push("quota fuori dall'intervallo 1.01–50");
      const sum = 1 / o1 + 1 / ox + 1 / o2;
      if (sum < 0.97 || sum > 1.15) problems.push(`somma delle probabilità ${(sum * 100).toFixed(1)}%`);
      for (const [k, arr, med] of [["1", q["1"], o1], ["X", q.X, ox], ["2", q["2"], o2]] as const) {
        const near = arr.filter((x) => Math.abs(x - med) / med <= 0.15).length;
        if (near / arr.length < 0.6) problems.push(`bookmaker in disaccordo sull'esito ${k}`);
      }
    }
    if (problems.length) {
      alerts.push({ fixture_id: f.id, match: label, reason: problems.join(" · "), blocking: true, c1: o1 || null, cx: ox || null, c2: o2 || null });
      continue;
    }

    // salto improvviso (solo rispetto a una quota automatica precedente): avviso, ma la quota si applica
    if (cur && cur.source === "api") {
      const prev = [Number(cur.o1), Number(cur.ox), Number(cur.o2)], next = [o1, ox, o2];
      const jumps = prev.map((p, i) => Math.abs(next[i] - p) / p);
      const fav = (a: number[]) => a.indexOf(Math.min(...a));
      const notes: string[] = [];
      if (Math.max(...jumps) > 0.25) notes.push(`salto del ${Math.round(Math.max(...jumps) * 100)}% (prima ${prev.map((x) => x.toFixed(2)).join(" / ")})`);
      if (fav(prev) !== fav(next)) notes.push("cambiata la favorita");
      if (notes.length) alerts.push({ fixture_id: f.id, match: label, reason: notes.join(" · "), blocking: false, c1: o1, cx: ox, c2: o2 });
    }
    updates.push({ fixture_id: f.id, match: label, o1, ox, o2, books });
  }

  // --- scrittura
  const failed: any[] = [];
  const published: number[] = [];
  if (!dry) {
    if (updates.length) {
      const { error } = await db.from("odds").upsert(
        updates.map(({ fixture_id, o1, ox, o2, books }) => ({ fixture_id, o1, ox, o2, books, manual: false, source: "api" })),
        { onConflict: "fixture_id" });
      if (error) failed.push({ step: "quote", error: error.message });
      // le partite tornate a posto perdono l'avviso bloccante
      const ok = updates.map((u) => u.fixture_id);
      await db.from("odds_alerts").delete().in("fixture_id", ok).eq("blocking", true);
    }
    if (alerts.length) {
      const { error } = await db.from("odds_alerts").upsert(
        alerts.map(({ match: _m, ...a }) => ({ ...a, created_at: new Date().toISOString() })), { onConflict: "fixture_id" });
      if (error) failed.push({ step: "avvisi", error: error.message });
    }
    // pubblicazione automatica: giornate non iniziate con 10 partite pronte
    const { data: ready } = await db.from("odds").select("fixture_id");
    const have = new Set((ready || []).map((x) => x.fixture_id));
    for (const r of cr.data!) {
      if (r.published || roundStarted(r.n)) continue;
      const fs = fixtures.filter((f) => f.n === r.n);
      if (fs.length === 10 && fs.every((f) => f.kickoff && have.has(f.id))) {
        const { error } = await db.from("calendar_rounds").update({ published: true }).eq("n", r.n);
        if (error) failed.push({ step: `pubblica ${r.n}`, error: error.message }); else published.push(r.n);
      }
    }
  }

  const summary = {
    reason, dry, ...quota, apiEvents: events.length,
    updated: updates.length, updates, alerts, published, unmatched, skipped, failed,
  };
  await log(failed.length === 0 && unmatched.length === 0, summary);
  return json(summary);
});
