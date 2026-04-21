/**
 * sync-gc-stats.mjs
 *
 * Authenticated per-game scraper:
 *   1. Loads GC session (gc-session.json or GC_SESSION base64 env var)
 *   2. Navigates to IC's schedule page to discover all completed games
 *   3. For each completed game, scrapes Advanced batting stats for BOTH teams
 *   4. Aggregates per-player season totals across all games
 *   5. Upserts to Supabase league.player_batting_stats
 *
 * Required env vars:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   GC_TEAM_URL               — IC schedule page URL
 *                               e.g. https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule
 *
 * Auth (one of):
 *   gc-session.json file  — created by: node scripts/gc-save-session.mjs
 *   GC_SESSION env var    — base64-encoded gc-session.json (used in CI)
 *
 * Optional:
 *   GC_DEBUG=1  — save a debug screenshot after each game scrape
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, readFileSync } from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GC_TEAM_URL              = process.env.GC_TEAM_URL ||
  "https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule";
const DEBUG = process.env.GC_DEBUG === "1";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ── Session ───────────────────────────────────────────────────────────────────

function loadSession() {
  if (existsSync("gc-session.json")) {
    return JSON.parse(readFileSync("gc-session.json", "utf8"));
  }
  if (process.env.GC_SESSION) {
    return JSON.parse(Buffer.from(process.env.GC_SESSION, "base64").toString("utf8"));
  }
  console.error("No GC session found. Run: node scripts/gc-save-session.mjs");
  process.exit(1);
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "league" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseStat(v) {
  if (v === null || v === undefined || v === "" || v === "—" || v === "-") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseRate(v) {
  if (v === null || v === undefined || v === "" || v === "—" || v === "-") return null;
  const s = String(v).trim();
  const n = parseFloat(s.startsWith(".") ? "0" + s : s);
  return isNaN(n) ? null : n;
}

// ── Click helper ──────────────────────────────────────────────────────────────

async function tryClick(page, text, timeout = 5000) {
  try {
    const el = page.locator(
      `button:has-text("${text}"), [role="tab"]:has-text("${text}"), [role="button"]:has-text("${text}")`
    ).first();
    await el.waitFor({ timeout });
    await el.click();
    await page.waitForTimeout(1200);
    return true;
  } catch { return false; }
}

// ── Horizontal scroll to force all columns into DOM ──────────────────────────

async function triggerHorizontalRender(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") &&
          el.scrollWidth > el.clientWidth + 10) {
        el.scrollLeft = el.scrollWidth;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") &&
          el.scrollWidth > el.clientWidth + 10) {
        el.scrollLeft = 0;
      }
    }
  });
  await page.waitForTimeout(300);
}

// ── Spatial table extractor (proven strategy from test-game-stats.mjs) ────────

async function extractAdvancedStats(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await triggerHorizontalRender(page);

  return page.evaluate(() => {
    const STAT_COLS = new Set([
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "1B","2B","3B","PA","GP","SF","SH","HBP","IBB","TB","K","E","LOB",
      "QAB","HHB","LD","FB","GB","BABIP","XBH","PS","PS/PA","2OUTRBI",
      "BA/RISP","CS","SB","GIDP","PO","A","2S+3","6+","CI",
    ]);

    function norm(raw) {
      return raw
        .replace(/[\u2190-\u21ff\u25a0-\u25ff\u2600-\u27ff]/g, "")
        .replace(/\s+/g, " ").trim().toUpperCase();
    }
    const isStatCol = h => STAT_COLS.has(h);
    const UI_JUNK = /back to schedule|batting|pitching|fielding|standard|advanced|fan pricing|privacy|terms|disclosures|sign in|sign up|get the app/i;
    const STAT_PAT = /^-?\d{1,4}(\.\d{1,4})?$|^\.?\d{3}$|^—$|^-$|^$/;

    // Spatial: group leaf text nodes by Y position
    const leaves = Array.from(document.querySelectorAll("*")).filter(el =>
      el.children.length === 0 &&
      (el.textContent?.trim().length ?? 0) > 0 &&
      el.offsetParent !== null
    );
    const nodes = leaves.map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.trim() ?? "", x: Math.round(r.left), y: Math.round(r.top) };
    }).filter(n => n.y > 0 && n.x > 0);

    const rowMap = new Map();
    for (const n of nodes) {
      const key = [...rowMap.keys()].find(k => Math.abs(k - n.y) <= 6);
      if (key !== undefined) rowMap.get(key).push(n);
      else rowMap.set(n.y, [n]);
    }

    const rows = [...rowMap.values()]
      .sort((a, b) => a[0].y - b[0].y)
      .map(row => row.sort((a, b) => a.x - b.x).map(n => n.text));

    // Find header row with 5+ stat columns
    const headerIdx = rows.findIndex(r => r.filter(t => isStatCol(norm(t))).length >= 5);
    if (headerIdx < 0) return [];

    const headers = rows[headerIdx].map(norm); // ["PLAYER", "PA", "AB", ...]
    const expectedStatCols = headers.length - 1;

    // Pair alternating stats rows (len≈19) with name rows (len=1)
    const pairs = [];
    let pending = null;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const first = row[0] ?? "";
      if (!first || UI_JUNK.test(first)) continue;

      if (row.length === 1) {
        if (pending !== null) {
          pairs.push({ cells: pending, name: first });
          pending = null;
        }
      } else if (row.length >= expectedStatCols - 2 && row.length <= expectedStatCols + 2) {
        if (pending !== null) pairs.push({ cells: pending, name: "" });
        pending = row;
      }
    }
    if (pending !== null) pairs.push({ cells: pending, name: "" });

    function cleanName(raw) { return raw.replace(/,?\s*#\d+.*$/, "").trim(); }

    return pairs
      .filter(({ name }) => {
        const n = cleanName(name);
        return n && !/^team$/i.test(n) && !STAT_PAT.test(n);
      })
      .map(({ cells, name }) => {
        const obj = { PLAYER: cleanName(name) };
        headers.slice(1).forEach((h, j) => { obj[h] = cells[j] ?? ""; });
        return obj;
      });
  });
}

// ── Discover completed game URLs from IC's schedule page ─────────────────────

async function discoverGameUrls(page, scheduleUrl) {
  console.log(`  Navigating to schedule: ${scheduleUrl}`);
  let scheduleData = null;

  // Intercept the schedule API response
  const handler = async (response) => {
    if (!response.url().includes("/schedule")) return;
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      const json = await response.json();
      if (Array.isArray(json) && json[0]?.event?.id) {
        scheduleData = json;
      }
    } catch { /* ignore */ }
  };
  page.on("response", handler);

  try {
    await page.goto(scheduleUrl, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.warn("  Schedule load warning:", e.message);
  }
  await page.waitForTimeout(3000);
  page.off("response", handler);

  if (!scheduleData) {
    // Fallback: look for game links in the DOM
    console.log("  API intercept missed — scanning DOM for game links...");
    const gameUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href*='/schedule/']"));
      return links.map(a => a.href).filter(h => h.includes("/schedule/"));
    });
    const baseUrl = page.url().split("/schedule")[0];
    return gameUrls.map(u => u.endsWith("/game-stats") ? u : u + "/game-stats");
  }

  // Build game-stats URLs from the schedule API data
  const baseUrl = scheduleUrl.replace(/\/schedule$/, "");
  const completedGames = scheduleData.filter(item => {
    const gs = item.game_stream;
    return gs && (gs.game_status === "completed" || gs.game_status === "final");
  });

  console.log(`  Found ${completedGames.length} completed game(s) out of ${scheduleData.length} total.`);

  return completedGames.map(item => `${baseUrl}/schedule/${item.event.id}/game-stats`);
}

// ── Per-player season aggregation ────────────────────────────────────────────

function aggregateStats(allGameRows) {
  // allGameRows: [{ player_name, team_name, pa, ab, qab, ... }, ...]
  const byPlayer = new Map();

  for (const row of allGameRows) {
    const key = `${row.player_name}|${row.team_name}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { player_name: row.player_name, team_name: row.team_name, gp: 0 });
    }
    const agg = byPlayer.get(key);
    agg.gp += 1;

    // Sum integer stats
    for (const col of ["pa","ab","qab","hhb","ld","fb","gb","lob",
                        "two_out_rbi","xbh","tb","ps","two_s3","six_plus","gidp","ci",
                        "h","singles","doubles","triples","hr","rbi"]) {
      agg[col] = (agg[col] ?? 0) + (row[col] ?? 0);
    }

    // Accumulate for weighted rate stats
    agg._babip_sum  = (agg._babip_sum  ?? 0) + (row.babip  !== null ? row.babip  * row.pa : 0);
    agg._barisp_sum = (agg._barisp_sum ?? 0) + (row.ba_risp !== null ? row.ba_risp * row.pa : 0);
    agg._pa_for_rates = (agg._pa_for_rates ?? 0) + (row.pa ?? 0);
  }

  const now = new Date().toISOString();

  return [...byPlayer.values()].map(agg => {
    const pa = agg.pa ?? 0;
    const ab = agg.ab ?? 0;
    const h  = agg.h  ?? 0;

    return {
      player_name:  agg.player_name,
      team_name:    agg.team_name,
      gp:           agg.gp,
      pa, ab,
      avg:          ab > 0 ? h / ab : null,
      obp:          null, // need BB + HBP + SF from Standard tab
      slg:          ab > 0 ? (agg.tb ?? 0) / ab : null,
      ops:          null,
      h,
      singles:      agg.singles   ?? 0,
      doubles:      agg.doubles   ?? 0,
      triples:      agg.triples   ?? 0,
      hr:           agg.hr        ?? 0,
      rbi:          agg.rbi       ?? 0,
      qab:          agg.qab       ?? 0,
      hhb:          agg.hhb       ?? 0,
      ld:           agg.ld        ?? 0,
      fb:           agg.fb        ?? 0,
      gb:           agg.gb        ?? 0,
      babip:        agg._pa_for_rates > 0 ? agg._babip_sum  / agg._pa_for_rates : null,
      ba_risp:      agg._pa_for_rates > 0 ? agg._barisp_sum / agg._pa_for_rates : null,
      lob:          agg.lob        ?? 0,
      two_out_rbi:  agg.two_out_rbi ?? 0,
      xbh:          agg.xbh        ?? 0,
      tb:           agg.tb         ?? 0,
      ps:           agg.ps         ?? 0,
      ps_pa:        pa > 0 ? (agg.ps ?? 0) / pa : null,
      two_s3:       agg.two_s3     ?? 0,
      six_plus:     agg.six_plus   ?? 0,
      gidp:         agg.gidp       ?? 0,
      ci:           agg.ci         ?? 0,
      synced_at:    now,
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Syncing GC stats from per-game pages`);
  console.log(`   Team URL: ${GC_TEAM_URL}\n`);

  const session = loadSession();
  console.log(`  Session: ${session.cookies?.length ?? 0} cookies\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const context = await browser.newContext({
    storageState: session,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 2400, height: 900 },
  });
  // Hide headless signals GC might use to detect automation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });
  const page = await context.newPage();

  // ── Verify session by loading the team schedule page ─────────────────────
  console.log("  Verifying session...");
  try {
    await page.goto(GC_TEAM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.warn("  Schedule load warning:", e.message);
  }
  await page.waitForTimeout(3000);
  const verifyUrl = page.url();
  const verifyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log(`  Verify URL: ${verifyUrl}`);
  // GC shows the login form inline (URL stays the same) — detect by checking
  // for the email input prompt which only appears when NOT logged in
  if (/enter your email to join or sign in/i.test(verifyText)) {
    console.error("❌ GC session expired — cookies no longer valid.");
    console.error("   Refresh locally:  node scripts/gc-save-session.mjs");
    console.error("   Then update the GC_SESSION GitHub secret.");
    await page.screenshot({ path: "gc-stats-debug.png", fullPage: false });
    await browser.close();
    process.exit(1);
  }
  console.log("  ✓ Session valid\n");

  // ── Discover completed games ───────────────────────────────────────────────
  const gameUrls = await discoverGameUrls(page, GC_TEAM_URL);

  if (gameUrls.length === 0) {
    console.log("ℹ️  No completed games found — nothing to sync.");
    await browser.close();
    process.exit(0);
  }

  console.log(`\n  Games to scrape: ${gameUrls.length}`);
  gameUrls.forEach((u, i) => console.log(`    ${i + 1}. ${u}`));

  // ── Scrape each game ───────────────────────────────────────────────────────
  const allGameRows = [];

  const EXCLUDED_UI = [
    "BOX SCORE","GAME STATS","BATTING","PITCHING","FIELDING",
    "STANDARD","ADVANCED","PLAYS","VIDEOS","RECAP","INSIGHTS",
    "INFO","STARTING LINEUP","EDIT STATS","HOME","SCHEDULE",
    "TEAM","STATS","OPPONENTS","TOOLS","GET THE APP","SIGN IN",
    "SIGN UP","TRY FOR FREE","SUPPORT","ACCOUNT","SIGN OUT",
    "BUY A TEAM PASS","BACK TO SCHEDULE","ADD EVENT",
  ];

  for (let gi = 0; gi < gameUrls.length; gi++) {
    const gameUrl = gameUrls[gi];
    const gameNum = gi + 1;
    console.log(`\n  ── Game ${gameNum}/${gameUrls.length} ──────────────────────────`);
    console.log(`     ${gameUrl}`);

    try {
      await page.goto(gameUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (e) {
      console.warn("    Load warning:", e.message);
    }
    await page.waitForTimeout(4000);

    // Log current URL so we know if we got redirected to login
    const landedUrl = page.url();
    console.log(`    Landed: ${landedUrl}`);
    if (landedUrl.includes("/login") || landedUrl.includes("/sign-up")) {
      console.error("    ❌ Redirected to login — session may be expired. Skipping.");
      await page.screenshot({ path: "gc-stats-debug.png", fullPage: false });
      continue;
    }

    // Wait for Batting tab to appear (try both capitalizations GC uses)
    const battingFound = await page.locator(
      'button, [role="tab"], [role="button"]'
    ).filter({ hasText: /^batting$/i }).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);

    if (!battingFound) {
      console.warn("    Batting tab not found — saving debug screenshot and skipping.");
      await page.screenshot({ path: "gc-stats-debug.png", fullPage: false });
      // Log visible top-level text so we can diagnose in CI
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log("    Page text sample:", pageText.replace(/\n+/g, " | ").slice(0, 400));
      continue;
    }

    // Find both team buttons
    const teamNames = await page.evaluate((excluded) => {
      const seen = new Set();
      const results = [];
      for (const el of document.querySelectorAll('button, [role="tab"], [role="button"]')) {
        const text = el.textContent?.trim() ?? "";
        if (text.length < 4 || text.length > 55) continue;
        if (text.includes("@") || text.includes("Back to") || text.includes("©")) continue;
        if (!/[a-zA-Z]{3}/.test(text)) continue;
        if (excluded.includes(text.toUpperCase())) continue;
        if (seen.has(text)) continue;
        seen.add(text);
        results.push(text);
      }
      return results.slice(0, 2);
    }, EXCLUDED_UI);

    console.log(`    Teams: ${teamNames.join(" | ") || "(auto)"}`);

    const teamsToProcess = teamNames.length >= 2 ? teamNames : [null];

    for (const teamName of teamsToProcess) {
      if (teamName) {
        await tryClick(page, teamName, 5000);
        await page.waitForTimeout(600);
      }

      await tryClick(page, "Batting", 6000);
      await page.waitForTimeout(1500);
      await tryClick(page, "Advanced", 6000);
      await page.waitForTimeout(1500);

      const rows = await extractAdvancedStats(page);

      if (rows.length > 0) {
        const inferredTeam = teamName ?? "Team";
        console.log(`    ✓ ${inferredTeam}: ${rows.length} player rows`);

        for (const row of rows) {
          allGameRows.push({
            player_name:  row["PLAYER"] ?? "",
            team_name:    inferredTeam,
            pa:           parseStat(row["PA"]),
            ab:           parseStat(row["AB"]),
            qab:          parseStat(row["QAB"]),
            hhb:          parseStat(row["HHB"]),
            ld:           parseStat(row["LD"]),
            fb:           parseStat(row["FB"]),
            gb:           parseStat(row["GB"]),
            babip:        parseRate(row["BABIP"]),
            ba_risp:      parseRate(row["BA/RISP"]),
            lob:          parseStat(row["LOB"]),
            two_out_rbi:  parseStat(row["2OUTRBI"]),
            xbh:          parseStat(row["XBH"]),
            tb:           parseStat(row["TB"]),
            ps:           parseStat(row["PS"]),
            ps_pa:        parseRate(row["PS/PA"]),
            two_s3:       parseStat(row["2S+3"]),
            six_plus:     parseStat(row["6+"]),
            gidp:         parseStat(row["GIDP"]),
            ci:           parseStat(row["CI"]),
            h: 0, singles: 0, doubles: 0, triples: 0, hr: 0, rbi: 0,
          });
        }
      } else {
        console.warn(`    ⚠️  No rows found for "${teamName ?? "default team"}"`);
        if (DEBUG) {
          await page.screenshot({ path: `gc-stats-debug-game${gameNum}.png`, fullPage: true });
        }
      }
    }
  }

  await browser.close();

  if (allGameRows.length === 0) {
    console.log("\n⚠️  No stats extracted from any game — skipping DB write.");
    process.exit(0);
  }

  // ── Aggregate season totals ────────────────────────────────────────────────
  console.log(`\n  Raw rows collected: ${allGameRows.length}`);
  const aggregated = aggregateStats(allGameRows);
  console.log(`  Aggregated to ${aggregated.length} unique players.`);

  // ── Upsert to Supabase ─────────────────────────────────────────────────────
  console.log("  Writing to Supabase...");

  // Upsert in batches of 50
  for (let i = 0; i < aggregated.length; i += 50) {
    const batch = aggregated.slice(i, i + 50);
    const { error } = await supabase.from("player_batting_stats").upsert(batch, {
      onConflict: "player_name,team_name",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("❌ Upsert failed:", error.message);
      process.exit(1);
    }
  }

  // Remove players no longer seen in GC
  const currentKeys = aggregated.map(r => r.player_name);
  await supabase
    .from("player_batting_stats")
    .delete()
    .not("player_name", "in", `(${currentKeys.map(n => `"${n}"`).join(",")})`);

  console.log(`\n🏆 Sync complete — ${aggregated.length} players updated.`);
  aggregated
    .sort((a, b) => (b.pa ?? 0) - (a.pa ?? 0))
    .forEach(r => {
      const avg = r.avg !== null ? r.avg.toFixed(3).replace(/^0/, "") : "---";
      console.log(`   ${r.player_name.padEnd(24)} ${String(r.team_name ?? "").padEnd(26)} GP=${r.gp} PA=${r.pa} AVG=${avg} QAB=${r.qab} PS=${r.ps}`);
    });
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
