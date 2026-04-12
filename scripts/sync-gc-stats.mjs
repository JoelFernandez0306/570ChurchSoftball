/**
 * sync-gc-stats.mjs
 *
 * Scrapes batting stats from the GameChanger organization stats page and
 * upserts them into the Supabase league.player_batting_stats table.
 *
 * Strategy (in order):
 *   1. Intercept GC's internal API JSON responses as the React app loads
 *   2. Standard <table> / ARIA role="table" DOM extraction
 *   3. Div-based table extraction (GC may use custom components)
 *
 * Required environment variables:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (not anon key)
 *   GC_ORG_ID                 — GameChanger organization ID (e.g. 998p0wVMzCOT)
 *
 * Optional:
 *   GC_DEBUG=1  — save a screenshot + HTML dump regardless of outcome
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const ORG_ID = process.env.GC_ORG_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEBUG = process.env.GC_DEBUG === "1";

if (!ORG_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing required environment variables: GC_ORG_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const GC_STATS_URL = `https://web.gc.com/organizations/${ORG_ID}/stats`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "league" },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStat(value) {
  if (value === null || value === undefined || value === "" || value === "—" || value === "-")
    return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseAvg(value) {
  if (value === null || value === undefined || value === "" || value === "—" || value === "-")
    return null;
  const s = String(value).trim();
  const n = parseFloat(s.startsWith(".") ? "0" + s : s);
  return isNaN(n) ? null : n;
}

// Scan any JSON response from GC for an array that looks like player stats
function extractStatsFromApiResponse(url, data) {
  const candidates = [];

  if (Array.isArray(data)) {
    candidates.push(data);
  } else if (data && typeof data === "object") {
    for (const key of ["players", "stats", "data", "results", "leaderboard", "batting", "items"]) {
      if (Array.isArray(data[key])) candidates.push(data[key]);
    }
    for (const val of Object.values(data)) {
      if (Array.isArray(val)) candidates.push(val);
    }
  }

  for (const arr of candidates) {
    if (arr.length === 0) continue;
    const sample = arr[0];
    if (typeof sample !== "object" || !sample) continue;
    const keys = Object.keys(sample).map((k) => k.toLowerCase());

    const hasName = keys.some(
      (k) => k.includes("name") || k.includes("player") || k === "first_name"
    );
    const hasBatting = keys.some((k) =>
      ["avg", "batting_average", "ab", "at_bat", "rbi", "hr", "home_run"].some((s) =>
        k.includes(s)
      )
    );

    if (hasName && hasBatting) {
      console.log(
        `  → API: found player stats array (${arr.length} rows) from: ${url}`
      );
      return arr;
    }
  }

  return null;
}

function mapApiRowToStats(row) {
  const k = (key) => {
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    return found !== undefined ? row[found] : undefined;
  };

  const playerName =
    k("player_name") ||
    k("name") ||
    k("full_name") ||
    (k("first_name") && k("last_name") ? `${k("first_name")} ${k("last_name")}` : null) ||
    k("player");

  if (!playerName) return null;

  const batting = k("batting") || k("stats") || k("battingStats") || row;
  const bk = (key) => {
    const found = Object.keys(batting).find((k) => k.toLowerCase() === key.toLowerCase());
    return found !== undefined ? batting[found] : undefined;
  };

  return {
    player_name: String(playerName).trim(),
    team_name: String(k("team_name") || k("team") || k("teamName") || "").trim() || null,
    gp: parseStat(bk("gp") ?? bk("games_played") ?? bk("games")) ?? 0,
    pa: parseStat(bk("pa") ?? bk("plate_appearances")) ?? 0,
    ab: parseStat(bk("ab") ?? bk("at_bats") ?? bk("atBats")) ?? 0,
    avg: parseAvg(bk("avg") ?? bk("batting_average") ?? bk("battingAverage")),
    obp: parseAvg(bk("obp") ?? bk("on_base_percentage") ?? bk("onBasePct")),
    slg: parseAvg(bk("slg") ?? bk("slugging") ?? bk("sluggingPct")),
    ops: parseAvg(bk("ops") ?? bk("on_base_plus_slugging")),
    h: parseStat(bk("h") ?? bk("hits")) ?? 0,
    singles: parseStat(bk("1b") ?? bk("singles") ?? bk("single")) ?? 0,
    doubles: parseStat(bk("2b") ?? bk("doubles") ?? bk("double")) ?? 0,
    triples: parseStat(bk("3b") ?? bk("triples") ?? bk("triple")) ?? 0,
    hr: parseStat(bk("hr") ?? bk("home_runs") ?? bk("homeRuns")) ?? 0,
    rbi: parseStat(bk("rbi") ?? bk("runs_batted_in")) ?? 0,
    synced_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// DOM extraction — handles <table>, ARIA tables, and GC div-based grids
// ---------------------------------------------------------------------------

async function extractFromDom(page) {
  console.log("  Attempting DOM extraction (table + div strategies)...");

  return page.evaluate(() => {
    const STAT_HEADERS = new Set(["GP","PA","AB","AVG","OBP","OPS","SLG","H","1B","2B","3B","HR","RBI"]);

    // ── Strategy A: standard <table> or ARIA role table ────────────────────
    const tableCandidates = [
      ...document.querySelectorAll("table"),
      ...document.querySelectorAll('[role="grid"],[role="table"]'),
    ];

    for (const table of tableCandidates) {
      const headerCells = Array.from(
        table.querySelectorAll(
          "thead th, thead td, [role='columnheader'], [role='rowheader']"
        )
      );
      const headers = headerCells.map((c) => c.textContent?.trim().toUpperCase() ?? "");

      if (!headers.some((h) => h === "AVG") || !headers.some((h) => h === "AB")) continue;

      const colMap = Object.fromEntries(headers.map((h, i) => [h, i]));
      const COL = {
        player: colMap["PLAYER"] ?? colMap["NAME"] ?? 0,
        team:   colMap["TEAM"] ?? -1,
        gp: colMap["GP"] ?? -1, pa: colMap["PA"] ?? -1, ab: colMap["AB"] ?? -1,
        avg: colMap["AVG"] ?? -1, obp: colMap["OBP"] ?? -1,
        ops: colMap["OPS"] ?? -1, slg: colMap["SLG"] ?? -1,
        h: colMap["H"] ?? -1, singles: colMap["1B"] ?? -1,
        doubles: colMap["2B"] ?? -1, triples: colMap["3B"] ?? -1,
        hr: colMap["HR"] ?? -1, rbi: colMap["RBI"] ?? -1,
      };

      const dataRows = Array.from(
        table.querySelectorAll("tbody tr, [role='row']:not(:has([role='columnheader']))")
      );
      const stats = [];

      for (const row of dataRows) {
        const cells = Array.from(row.querySelectorAll("td, [role='cell']"));
        if (cells.length < 5) continue;
        const t = (idx) => (idx >= 0 && idx < cells.length ? cells[idx]?.textContent?.trim() ?? "" : "");
        const name = t(COL.player);
        if (!name) continue;
        stats.push({ player_name: name, team_name: t(COL.team) || null,
          gp: parseInt(t(COL.gp)) || 0, pa: parseInt(t(COL.pa)) || 0, ab: parseInt(t(COL.ab)) || 0,
          avg_raw: t(COL.avg), obp_raw: t(COL.obp), slg_raw: t(COL.slg), ops_raw: t(COL.ops),
          h: parseInt(t(COL.h)) || 0, singles: parseInt(t(COL.singles)) || 0,
          doubles: parseInt(t(COL.doubles)) || 0, triples: parseInt(t(COL.triples)) || 0,
          hr: parseInt(t(COL.hr)) || 0, rbi: parseInt(t(COL.rbi)) || 0,
        });
      }

      if (stats.length > 0) {
        console.log(`Strategy A: extracted ${stats.length} rows from <table>/<role=table>`);
        return stats;
      }
    }

    // ── Strategy B: div-based grid — find the header row by stat labels ─────
    // Walk every element looking for one whose direct children spell out the
    // batting column headers (GC uses custom React components with divs).
    const allElements = Array.from(document.querySelectorAll("div, ul, section"));

    for (const el of allElements) {
      const children = Array.from(el.children);
      if (children.length < 8) continue; // need at least Player + 7 stat cols

      const childTexts = children.map((c) => c.textContent?.trim().toUpperCase() ?? "");
      const statCount = childTexts.filter((t) => STAT_HEADERS.has(t)).length;
      if (statCount < 6) continue; // must have ≥6 of our known stat headers

      // Found the header row — now find its parent container and look for sibling rows
      const container = el.parentElement;
      if (!container) continue;

      const colMap = Object.fromEntries(childTexts.map((h, i) => [h, i]));
      // "Player" may appear as first child with different text — use index 0
      const COL = {
        player: 0,
        team:   colMap["TEAM"] ?? -1,
        gp: colMap["GP"] ?? -1, pa: colMap["PA"] ?? -1, ab: colMap["AB"] ?? -1,
        avg: colMap["AVG"] ?? -1, obp: colMap["OBP"] ?? -1,
        ops: colMap["OPS"] ?? -1, slg: colMap["SLG"] ?? -1,
        h: colMap["H"] ?? -1, singles: colMap["1B"] ?? -1,
        doubles: colMap["2B"] ?? -1, triples: colMap["3B"] ?? -1,
        hr: colMap["HR"] ?? -1, rbi: colMap["RBI"] ?? -1,
      };

      const sibs = Array.from(container.children).filter((s) => s !== el);
      const stats = [];

      for (const sib of sibs) {
        const cells = Array.from(sib.children);
        if (cells.length < children.length - 2) continue;
        const t = (idx) => (idx >= 0 && idx < cells.length ? cells[idx]?.textContent?.trim() ?? "" : "");
        const name = t(COL.player);
        if (!name || STAT_HEADERS.has(name.toUpperCase())) continue;
        stats.push({ player_name: name, team_name: t(COL.team) || null,
          gp: parseInt(t(COL.gp)) || 0, pa: parseInt(t(COL.pa)) || 0, ab: parseInt(t(COL.ab)) || 0,
          avg_raw: t(COL.avg), obp_raw: t(COL.obp), slg_raw: t(COL.slg), ops_raw: t(COL.ops),
          h: parseInt(t(COL.h)) || 0, singles: parseInt(t(COL.singles)) || 0,
          doubles: parseInt(t(COL.doubles)) || 0, triples: parseInt(t(COL.triples)) || 0,
          hr: parseInt(t(COL.hr)) || 0, rbi: parseInt(t(COL.rbi)) || 0,
        });
      }

      if (stats.length > 0) {
        console.log(`Strategy B: extracted ${stats.length} rows from div-grid`);
        return stats;
      }
    }

    return [];
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔄 Syncing GameChanger stats for org: ${ORG_ID}`);
  console.log(`   URL: ${GC_STATS_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // ── Strategy 1: Intercept API JSON responses ──────────────────────────────
  let apiStats = null;

  page.on("response", async (response) => {
    if (apiStats) return;
    const url = response.url();
    if (!url.includes("gc.com")) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;

    try {
      const json = await response.json();
      const found = extractStatsFromApiResponse(url, json);
      if (found && found.length > 0) apiStats = found;
    } catch {
      /* ignore */
    }
  });

  console.log("Opening GC stats page...");
  try {
    await page.goto(GC_STATS_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (err) {
    console.warn(`  Page load warning: ${err.message} — continuing`);
  }

  // Give React extra time to render
  await page.waitForTimeout(4000);

  // Check page state
  const pageText = await page.evaluate(() => document.body.innerText ?? "");
  const hasNoStats =
    pageText.toLowerCase().includes("no batting stats") ||
    pageText.toLowerCase().includes("no stats at this time");

  console.log(`  Page rendered ${pageText.length} chars of text.`);
  if (hasNoStats) console.log("  GC page shows: no batting stats.");
  if (apiStats)   console.log(`  API interception: ${apiStats.length} records found.`);

  // Early exit when GC explicitly says there are no stats
  if (hasNoStats && !apiStats) {
    console.log("\nℹ️  No batting stats in GameChanger yet — nothing to sync.");

    if (DEBUG) {
      await page.screenshot({ path: "gc-stats-debug.png", fullPage: true });
      console.log("  Debug screenshot saved: gc-stats-debug.png");
    }

    await browser.close();
    process.exit(0);
  }

  // ── Strategy 2 / 3: DOM extraction ───────────────────────────────────────
  let rows = [];

  if (apiStats && apiStats.length > 0) {
    rows = apiStats.map(mapApiRowToStats).filter(Boolean);
    console.log(`  Mapped ${rows.length} valid rows from API data.`);
  } else {
    const domRows = await extractFromDom(page);
    if (domRows.length > 0) {
      rows = domRows.map((r) => ({
        ...r,
        avg: parseAvg(r.avg_raw),
        obp: parseAvg(r.obp_raw),
        slg: parseAvg(r.slg_raw),
        ops: parseAvg(r.ops_raw),
        synced_at: new Date().toISOString(),
      }));
      rows = rows.map(({ avg_raw, obp_raw, slg_raw, ops_raw, ...rest }) => rest);
    }
  }

  // Always save a debug screenshot when rows = 0 (extraction failed but page has content)
  // Also save when GC_DEBUG=1
  if (rows.length === 0 || DEBUG) {
    await page.screenshot({ path: "gc-stats-debug.png", fullPage: true });
    // Dump the first 4000 chars of visible text so we can see what GC rendered
    const snippet = pageText.slice(0, 4000);
    writeFileSync("gc-stats-page-text.txt", snippet);
    console.log("  Debug files saved: gc-stats-debug.png, gc-stats-page-text.txt");
    console.log("  Page text snippet:\n---\n" + snippet.slice(0, 800) + "\n---");
  }

  await browser.close();

  if (rows.length === 0) {
    console.log("\n⚠️  No player stats extracted — skipping DB write.");
    console.log("  Check the gc-stats-debug.png artifact to see what GC rendered.");
    process.exit(0);
  }

  console.log(`\n✅ Extracted ${rows.length} player rows. Writing to Supabase...`);

  // Upsert all rows
  const { error } = await supabase.from("player_batting_stats").upsert(rows, {
    onConflict: "player_name,team_name",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("❌ Supabase upsert failed:", error.message);
    process.exit(1);
  }

  // Prune players no longer in GC
  const currentNames = rows.map((r) => r.player_name);
  await supabase
    .from("player_batting_stats")
    .delete()
    .not("player_name", "in", `(${currentNames.map((n) => `"${n}"`).join(",")})`);

  console.log(`\n🏆 Sync complete — ${rows.length} players updated.`);
  rows.forEach((r) => {
    const avg = r.avg !== null ? r.avg.toFixed(3).replace(/^0/, "") : "---";
    console.log(`   ${r.player_name.padEnd(26)} ${String(r.team_name ?? "—").padEnd(22)} AVG ${avg}  HR ${r.hr}  RBI ${r.rbi}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
