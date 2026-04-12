/**
 * sync-gc-stats.mjs
 *
 * Scrapes batting stats from the GameChanger organization stats page and
 * upserts them into the Supabase league.player_batting_stats table.
 *
 * Strategy:
 *   1. Intercept GC's internal API responses as the React app loads
 *   2. Fall back to DOM table extraction if no JSON response is captured
 *
 * Required environment variables:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (not anon key)
 *   GC_ORG_ID                 — GameChanger organization ID (e.g. 998p0wVMzCOT)
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = process.env.GC_ORG_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ORG_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables: GC_ORG_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
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
  if (value === null || value === undefined || value === "" || value === "—" || value === "-") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseAvg(value) {
  if (value === null || value === undefined || value === "" || value === "—" || value === "-") return null;
  const s = String(value).trim();
  // Handle both ".350" and "0.350" formats
  const n = parseFloat(s.startsWith(".") ? "0" + s : s);
  return isNaN(n) ? null : n;
}

// Try to find player stats arrays inside any JSON response from GC
function extractStatsFromApiResponse(url, data) {
  // Candidate arrays to check
  const candidates = [];

  if (Array.isArray(data)) {
    candidates.push(data);
  } else if (data && typeof data === "object") {
    for (const key of ["players", "stats", "data", "results", "leaderboard", "batting", "items"]) {
      if (Array.isArray(data[key])) candidates.push(data[key]);
    }
    // Also check one level deeper
    for (const val of Object.values(data)) {
      if (Array.isArray(val)) candidates.push(val);
    }
  }

  for (const arr of candidates) {
    if (arr.length === 0) continue;
    const sample = arr[0];
    const keys = Object.keys(sample).map((k) => k.toLowerCase());

    const hasName = keys.some((k) => k.includes("name") || k.includes("player") || k === "first_name");
    const hasBatting = keys.some((k) =>
      ["avg", "batting_average", "ab", "at_bat", "rbi", "hr", "home_run"].some((s) => k.includes(s))
    );

    if (hasName && hasBatting) {
      console.log(`  → Found player stats array (${arr.length} rows) at key in response from: ${url}`);
      return arr;
    }
  }

  return null;
}

// Map a raw API object to our DB schema (handles multiple GC API shapes)
function mapApiRowToStats(row) {
  const k = (key) => {
    // Case-insensitive key lookup
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

  // Stats may be nested under "batting" or flat
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

// Extract stats from the rendered DOM table as a fallback
async function extractFromDom(page) {
  console.log("  Attempting DOM table extraction...");

  return page.evaluate(() => {
    // Try standard <table> first
    const tables = Array.from(document.querySelectorAll("table"));

    // Also try ARIA role="grid" / role="table"
    const roleGrids = Array.from(document.querySelectorAll('[role="grid"],[role="table"]'));
    const allTables = [...tables, ...roleGrids];

    for (const table of allTables) {
      // Get headers
      const headerCells = Array.from(
        table.querySelectorAll("thead th, thead td, [role='columnheader'], [role='rowheader']")
      );
      const headers = headerCells.map((c) => c.textContent?.trim().toUpperCase() ?? "");

      // Check if this looks like a batting stats table
      const hasAVG = headers.some((h) => h === "AVG");
      const hasAB = headers.some((h) => h === "AB");
      if (!hasAVG || !hasAB) continue;

      console.log("Found batting stats table with headers:", headers.join(", "));

      // Map column names to indices
      const colMap = {};
      headers.forEach((h, i) => {
        colMap[h] = i;
      });

      const COL = {
        player: colMap["PLAYER"] ?? colMap["NAME"] ?? 0,
        gp: colMap["GP"] ?? -1,
        pa: colMap["PA"] ?? -1,
        ab: colMap["AB"] ?? -1,
        avg: colMap["AVG"] ?? -1,
        obp: colMap["OBP"] ?? -1,
        ops: colMap["OPS"] ?? -1,
        slg: colMap["SLG"] ?? -1,
        h: colMap["H"] ?? -1,
        singles: colMap["1B"] ?? -1,
        doubles: colMap["2B"] ?? -1,
        triples: colMap["3B"] ?? -1,
        hr: colMap["HR"] ?? -1,
        rbi: colMap["RBI"] ?? -1,
        team: colMap["TEAM"] ?? -1,
      };

      const rows = Array.from(table.querySelectorAll("tbody tr, [role='row']:not(:has([role='columnheader']))"));
      const stats = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td, [role='cell']"));
        if (cells.length < 5) continue;

        const text = (idx) => (idx >= 0 && idx < cells.length ? cells[idx]?.textContent?.trim() ?? "" : "");

        const playerName = text(COL.player);
        if (!playerName) continue;

        stats.push({
          player_name: playerName,
          team_name: text(COL.team) || null,
          gp: parseInt(text(COL.gp)) || 0,
          pa: parseInt(text(COL.pa)) || 0,
          ab: parseInt(text(COL.ab)) || 0,
          avg_raw: text(COL.avg),
          obp_raw: text(COL.obp),
          slg_raw: text(COL.slg),
          ops_raw: text(COL.ops),
          h: parseInt(text(COL.h)) || 0,
          singles: parseInt(text(COL.singles)) || 0,
          doubles: parseInt(text(COL.doubles)) || 0,
          triples: parseInt(text(COL.triples)) || 0,
          hr: parseInt(text(COL.hr)) || 0,
          rbi: parseInt(text(COL.rbi)) || 0,
        });
      }

      return stats;
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
    if (apiStats) return; // already found
    const url = response.url();
    if (!url.includes("gc.com")) return;

    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;

    try {
      const json = await response.json();
      const found = extractStatsFromApiResponse(url, json);
      if (found && found.length > 0) {
        apiStats = found;
      }
    } catch {
      // ignore non-JSON or parse errors
    }
  });

  // Navigate and wait for the app to load data
  console.log("Opening GC stats page...");
  try {
    await page.goto(GC_STATS_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (err) {
    console.warn(`  Page load warning: ${err.message} — continuing anyway`);
  }

  // Give React extra time to render and fire API calls
  await page.waitForTimeout(3000);

  // Check if the page shows "No batting stats" — if so, nothing to sync
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasNoStats =
    pageText.toLowerCase().includes("no batting stats") ||
    pageText.toLowerCase().includes("no stats at this time");

  if (hasNoStats && !apiStats) {
    console.log("ℹ️  GC reports no batting stats yet — nothing to sync.");
    await browser.close();
    process.exit(0);
  }

  // ── Strategy 2: DOM scraping fallback ─────────────────────────────────────
  let rows = [];

  if (apiStats && apiStats.length > 0) {
    console.log(`  API interception found ${apiStats.length} player records.`);
    rows = apiStats.map(mapApiRowToStats).filter(Boolean);
  } else {
    console.log("  No API response captured — falling back to DOM extraction.");
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
      // Remove raw string fields
      rows = rows.map(({ avg_raw, obp_raw, slg_raw, ops_raw, ...rest }) => rest);
    }
  }

  await browser.close();

  if (rows.length === 0) {
    console.log("⚠️  No player stats extracted — skipping DB write.");
    process.exit(0);
  }

  console.log(`\n✅ Extracted ${rows.length} player stat rows. Writing to Supabase...\n`);

  // ── Write to Supabase ──────────────────────────────────────────────────────
  // Upsert: update all fields on conflict (player_name + team_name unique)
  const { error } = await supabase.from("player_batting_stats").upsert(rows, {
    onConflict: "player_name,team_name",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("❌ Supabase upsert failed:", error.message);
    process.exit(1);
  }

  // Remove any players no longer in GC (left the org)
  const currentNames = rows.map((r) => r.player_name);
  const { error: deleteError } = await supabase
    .from("player_batting_stats")
    .delete()
    .not("player_name", "in", `(${currentNames.map((n) => `"${n}"`).join(",")})`);

  if (deleteError) {
    // Non-fatal — old players just stay in the table
    console.warn("  Could not prune stale players:", deleteError.message);
  }

  console.log(`🏆 Sync complete — ${rows.length} players updated in DB.`);
  rows.forEach((r) => {
    const avg = r.avg !== null ? r.avg.toFixed(3).replace(/^0/, "") : "---";
    console.log(`   ${r.player_name.padEnd(25)} ${r.team_name ?? "no team"} | AVG ${avg} | HR ${r.hr} | RBI ${r.rbi}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
