/**
 * sync-gc-stats.mjs
 *
 * Box-score scraper for all league teams:
 *   1. Loads GC session (gc-session.json or GC_SESSION base64 env var)
 *   2. Navigates to the org schedule page to discover all past games
 *   3. For each unscraped past game, loads the public /box-score page
 *   4. Extracts AB, R, H, 2B, 3B, HR, RBI, BB, SO for every player (both teams)
 *   5. Stores per-game rows in player_game_stats, aggregates to player_batting_stats
 *
 * Required env vars:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   GC_TEAM_URLS              — at least one team schedule URL (used as fallback
 *                               discovery and for session verification)
 *   GC_ORG_SCHEDULE_URL       — org schedule page, e.g.
 *                               https://web.gc.com/organizations/998p0wVMzCOT/schedule
 *
 * Auth (one of):
 *   gc-session.json file  — created by: node scripts/gc-save-session.mjs
 *   GC_SESSION env var    — base64-encoded gc-session.json (used in CI)
 *
 * Optional:
 *   GC_SEASON_START — YYYY-MM-DD cutoff; games before this date are skipped
 *   GC_DEBUG=1      — save debug screenshots on failure
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, readFileSync } from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEBUG                     = process.env.GC_DEBUG === "1";

// Accept comma-separated GC_TEAM_URLS or legacy single GC_TEAM_URL
const GC_TEAM_URLS = (process.env.GC_TEAM_URLS || process.env.GC_TEAM_URL || "")
  .split(",").map(u => u.trim()).filter(Boolean);

// Optional org-level schedule URL — when set, all league games are discovered
// from a single page instead of snowballing through individual team pages.
// e.g. https://web.gc.com/organizations/998p0wVMzCOT/schedule
const GC_ORG_SCHEDULE_URL = process.env.GC_ORG_SCHEDULE_URL?.trim() || null;

// Date boundaries (all optional)
const GC_SEASON_START  = process.env.GC_SEASON_START  ? new Date(process.env.GC_SEASON_START)  : null;
const GC_SEASON_END    = process.env.GC_SEASON_END    ? new Date(process.env.GC_SEASON_END)    : null;
const GC_PLAYOFF_START = process.env.GC_PLAYOFF_START ? new Date(process.env.GC_PLAYOFF_START) : null;

// Auto-detect current phase based on today's date
const today = new Date();
const SYNC_PHASE = (GC_PLAYOFF_START && today >= GC_PLAYOFF_START) ? "playoff" : "regular";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (GC_TEAM_URLS.length === 0) {
  console.error("Missing: GC_TEAM_URLS (or GC_TEAM_URL) — at least one team schedule URL required");
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
    await page.waitForTimeout(400);
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
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") &&
          el.scrollWidth > el.clientWidth + 10) {
        el.scrollLeft = 0;
      }
    }
  });
  await page.waitForTimeout(100);
}

// ── Spatial table extractor (proven strategy from test-game-stats.mjs) ────────

async function extractAdvancedStats(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
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

// Extract the best available date from a schedule event item.
// Tries every plausible field name GC has used across API versions.
function getEventDate(item) {
  const e = item.event ?? item;
  const raw = e.start_date_time
    ?? e.start_time
    ?? e.starts_at
    ?? e.start_at
    ?? e.start
    ?? e.scheduled_time
    ?? e.scheduled_at
    ?? e.game_date
    ?? e.event_date
    ?? e.date
    ?? e.datetime
    ?? null;
  if (raw === null || raw === undefined) return null;
  // Handle Unix timestamps (seconds or milliseconds)
  if (typeof raw === "number") {
    const ms = raw > 1e10 ? raw : raw * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// Returns { gameUrls, teamUrls } — gameUrls are game-stats pages to scrape,
// teamUrls are other team schedule pages discovered from the API response
// (used for snowball league-wide discovery).
async function discoverSchedule(page, scheduleUrl, baseUrlOverride = null) {
  console.log(`  Navigating to schedule: ${scheduleUrl}`);
  let scheduleData = null;

  // Accept any JSON response that looks like GC schedule data — do NOT filter
  // by URL because GC's schedule API endpoint does not contain "/schedule".
  const handler = async (response) => {
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      const json = await response.json();
      if (Array.isArray(json) && json.length > 0 && json[0]?.event?.id) {
        scheduleData = json;
        // Always log the event keys and any date-looking fields so we can diagnose
        const e = json[0]?.event ?? {};
        const dateKeys = Object.keys(e).filter(k =>
          /date|time|start|schedul|at$/i.test(k)
        );
        console.log(`    API captured (${json.length} events) from ${response.url()}`);
        console.log(`    Date-related fields: ${dateKeys.length ? dateKeys.map(k => `${k}=${JSON.stringify(e[k])}`).join(" | ") : "(none found — all event keys: " + Object.keys(e).join(", ") + ")"}`);
      }
    } catch { /* ignore */ }
  };
  page.on("response", handler);

  try {
    await page.goto(scheduleUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.warn("  Schedule load warning:", e.message);
  }
  // Org pages are heavier — give them extra time to render
  await page.waitForTimeout(scheduleUrl.includes("/organizations/") ? 8000 : 5000);
  page.off("response", handler);

  // ── Discover team URLs from the DOM (team pages only) ───────────────────────
  const domTeamUrls = await page.evaluate(() => {
    const pat = /^https:\/\/web\.gc\.com\/teams\/[^/]+\/[^/]+\/schedule$/;
    return [...new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .map(a => a.href.split("?")[0].replace(/\/$/, ""))
        .filter(h => pat.test(h))
    )];
  });

  if (!scheduleData) {
    // ── Org page fallback: find "Final" game links directly from the DOM ────────
    // The org schedule page renders game cards with "FINAL" text for completed
    // games — no date info needed, just look for that label.
    if (scheduleUrl.includes("/organizations/")) {
      console.log("  API miss on org page — scanning DOM for Final game links...");
      const orgBase    = scheduleUrl.replace(/\/schedule$/, "");
      const finalGameIds = await page.evaluate(() => {
        const ids = new Set();
        document.querySelectorAll("a[href]").forEach(a => {
          // Game links on org pages: /organizations/{orgId}/schedule/{gameId}
          const m = a.href.match(/\/schedule\/([A-Za-z0-9_-]{8,})(?:\/|$)/);
          if (!m) return;
          // Only include if the link's ancestor contains "FINAL"
          for (let el = a; el && el !== document.body; el = el.parentElement) {
            if (/\bfinal\b/i.test(el.textContent ?? "")) { ids.add(m[1]); break; }
          }
        });
        return [...ids];
      });
      console.log(`  Found ${finalGameIds.length} Final game(s) via DOM.`);
      return {
        gameUrls: finalGameIds.map(id => `${orgBase}/schedule/${id}`),
        teamUrls: [],
      };
    }

    // Team page fallback: no date info, skip game links to avoid including future games
    console.warn(`  ⚠️  API intercept missed for ${scheduleUrl} — skipping game links (no date info).`);
    console.warn(`     ${domTeamUrls.length} team URL(s) from DOM still queued for discovery.`);
    return { gameUrls: [], teamUrls: domTeamUrls };
  }

  // For org schedule pages the URL has no team context, so use the override
  const baseUrl = baseUrlOverride ?? scheduleUrl.replace(/\/schedule$/, "");

  // Extract team schedule URLs from the API event objects (GC includes both teams)
  const apiTeamUrls = [];
  for (const item of scheduleData) {
    // event.teams is an array of {id, slug} objects in newer GC API versions
    const teams = item.event?.teams ?? [];
    for (const t of teams) {
      if (t.id && t.slug) {
        apiTeamUrls.push(`https://web.gc.com/teams/${t.id}/${t.slug}/schedule`);
      }
    }
    // Older API: event.home_team / event.away_team
    for (const key of ["home_team", "away_team", "team"]) {
      const t = item.event?.[key];
      if (t?.id && t?.slug) {
        apiTeamUrls.push(`https://web.gc.com/teams/${t.id}/${t.slug}/schedule`);
      }
    }
  }

  // Filter snowball team URLs to the same season as the seed URLs (e.g. "2026-summer")
  // to avoid following links to teams in other leagues or seasons.
  const seasonPrefixes = GC_TEAM_URLS.map(u => {
    const m = u.match(/\/teams\/[^/]+\/(\d{4}-[^-]+)-/);
    return m?.[1] ?? null;
  }).filter(Boolean);

  const allDiscoveredTeamUrls = [...new Set([...apiTeamUrls, ...domTeamUrls])]
    .filter(u => seasonPrefixes.length === 0 || seasonPrefixes.some(p => u.includes(`/${p}-`)));

  const afterDate  = SYNC_PHASE === "playoff" ? GC_PLAYOFF_START : GC_SEASON_START;
  const beforeDate = SYNC_PHASE === "playoff" ? null             : GC_SEASON_END;

  // Log each game
  for (const item of scheduleData) {
    const gameDate = getEventDate(item);
    const dateStr  = gameDate ? gameDate.toISOString().slice(0, 10) : "no-date";
    const opp      = item.event?.title ?? item.event?.id ?? "?";
    const noDate   = !gameDate ? " [SKIPPED — date unknown]" : "";
    const future   = gameDate && gameDate > today ? " [SKIPPED — future]" : "";
    const tooEarly = !noDate && !future && afterDate && gameDate && gameDate < afterDate ? " [SKIPPED — before season start]" : "";
    console.log(`    [${dateStr}] ${opp}${noDate}${future}${tooEarly}`);
  }

  const eligibleGames = scheduleData.filter(item => {
    if (!item.event?.id) return false;
    const gameDate = getEventDate(item);
    if (!gameDate) return false;             // skip games with no parseable date
    if (gameDate > today)          return false;
    if (afterDate  && gameDate < afterDate)  return false;
    if (beforeDate && gameDate > beforeDate) return false;
    return true;
  });

  console.log(`  ${eligibleGames.length} past game(s) of ${scheduleData.length} total | ${allDiscoveredTeamUrls.length} same-season team URL(s) found`);

  return {
    gameUrls:  eligibleGames.map(item => `${baseUrl}/schedule/${item.event.id}/game-stats`),
    teamUrls:  allDiscoveredTeamUrls,
  };
}

// ── Box score scraper ─────────────────────────────────────────────────────────
// Extracts batting stats from the public /box-score page (no team-admin needed).
// Returns: [{ player_name, team_name, ab, r, h, rbi, bb, so, singles, doubles, triples, hr }]

async function scrapeBoxScore(page, boxScoreUrl) {
  try {
    await page.goto(boxScoreUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.warn("    Load warning:", e.message);
  }

  const found = await page.locator("text=LINEUP").first()
    .waitFor({ timeout: 10000 }).then(() => true).catch(() => false);

  if (!found) {
    if (DEBUG) await page.screenshot({ path: "gc-stats-debug.png" });
    console.warn("    Box score not available (LINEUP not found) — will retry next run.");
    return [];
  }
  await page.waitForTimeout(300);

  return await page.evaluate(() => {
    function cleanName(raw) {
      // "Aaron Eby #27 (SS)" → "Aaron Eby"
      return raw.replace(/\s*#\d+.*$/, "").replace(/\s*\([^)]*\)\s*/g, "").trim();
    }

    // Collect all visible leaf text nodes with screen positions
    const nodes = [];
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length > 0 || !el.offsetParent) return;
      const text = el.textContent?.trim();
      if (!text) return;
      const r = el.getBoundingClientRect();
      if (r.top > 0 && r.left > 0) nodes.push({ text, x: Math.round(r.left), y: Math.round(r.top) });
    });

    // Group nodes into visual rows by Y coordinate (within 6 px)
    const rowMap = new Map();
    for (const n of nodes) {
      const k = [...rowMap.keys()].find(k => Math.abs(k - n.y) <= 6);
      if (k !== undefined) rowMap.get(k).push(n);
      else rowMap.set(n.y, [n]);
    }
    const rows = [...rowMap.values()]
      .sort((a, b) => a[0].y - b[0].y)
      .map(r => r.sort((a, b) => a.x - b.x));

    // Find LINEUP header rows — each has both "LINEUP" and "AB" in the same row
    const lineupIdxs = [];
    rows.forEach((row, i) => {
      const texts = row.map(n => n.text);
      if (texts.some(t => /^lineup$/i.test(t)) && texts.includes("AB")) lineupIdxs.push(i);
    });
    if (!lineupIdxs.length) return [];

    // Use X positions of the two LINEUP headers to split viewport into left/right teams
    const mid = lineupIdxs.length >= 2
      ? (rows[lineupIdxs[0]][0].x + rows[lineupIdxs[1]][0].x) / 2
      : window.innerWidth / 2;

    const results = [];

    for (let ti = 0; ti < lineupIdxs.length; ti++) {
      const lineupIdx = lineupIdxs[ti];
      const inZone    = n => ti === 0 ? n.x < mid + 50 : n.x >= mid - 50;

      // Team name: scan backward from the LINEUP row
      let teamName = `Team ${ti + 1}`;
      for (let i = lineupIdx - 1; i >= Math.max(0, lineupIdx - 8); i--) {
        const cands = rows[i].filter(inZone);
        if (cands.length === 1 && /[a-zA-Z]{3}/.test(cands[0].text) && !/^\d+$/.test(cands[0].text)) {
          teamName = cands[0].text.replace(/\.$/, "").trim();
          break;
        }
      }

      // noteMap: { "Zach Zimmerman": { "2B": 1, "HR": 2 }, ... }
      const noteMap = {};
      const playerRows = [];
      const end = lineupIdxs[ti + 1] ?? rows.length;

      for (let i = lineupIdx + 1; i < end; i++) {
        const cells = rows[i].filter(inZone).map(n => n.text);
        if (!cells.length) continue;
        const first = cells[0];

        // Note lines: "2B: Lee Stanziale, Mike Smith" or "HR: Zach Zimmerman 2"
        const noteMatch = first.match(/^(2B|3B|HR):\s*(.*)$/i);
        if (noteMatch) {
          const type = noteMatch[1].toUpperCase();
          const full  = (noteMatch[2] + " " + cells.slice(1).join(" ")).trim();
          for (const part of full.split(",")) {
            const m = part.trim().match(/^(.+?)\s*(\d+)?\s*$/);
            if (!m) continue;
            const name  = m[1].trim();
            const count = parseInt(m[2] ?? "1", 10);
            if (!noteMap[name]) noteMap[name] = {};
            noteMap[name][type] = (noteMap[name][type] ?? 0) + count;
          }
          continue;
        }

        if (/^team$/i.test(first)) continue;                  // totals row
        if (/^(TB|SF|E|SB|CS|HBP|GDP):/i.test(first)) continue;
        if (!/[a-zA-Z]{2}/.test(first)) continue;

        const nums = cells.slice(1).map(t => parseInt(t, 10));
        if (nums.filter(n => !isNaN(n)).length < 4) continue;
        const [ab = 0, r = 0, h = 0, rbi = 0, bb = 0, so = 0] = nums;

        const playerName = cleanName(first);
        if (!playerName || playerName.length < 2) continue;
        playerRows.push({ player_name: playerName, team_name: teamName, ab, r, h, rbi, bb, so });
      }

      // Match 2B/3B/HR notes to players by last name or full-name substring
      for (const row of playerRows) {
        let doubles = 0, triples = 0, hr = 0;
        const pLower = row.player_name.toLowerCase();
        const pLast  = pLower.split(/\s+/).pop();
        for (const [noteName, counts] of Object.entries(noteMap)) {
          const nLower = noteName.toLowerCase().trim();
          if (pLower.includes(nLower) || (pLast.length > 2 && nLower.includes(pLast))) {
            doubles += counts["2B"] ?? 0;
            triples += counts["3B"] ?? 0;
            hr      += counts["HR"] ?? 0;
          }
        }
        row.doubles = doubles;
        row.triples = triples;
        row.hr      = hr;
        row.singles = Math.max(0, row.h - doubles - triples - hr);
      }

      results.push(...playerRows);
    }
    return results;
  });
}

// ── Per-player season aggregation ────────────────────────────────────────────

function aggregateStats(allGameRows) {
  const byPlayer = new Map();

  for (const row of allGameRows) {
    const key = `${row.player_name}|${row.team_name}|${row.season_type}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { player_name: row.player_name, team_name: row.team_name, season_type: row.season_type, gp: 0 });
    }
    const agg = byPlayer.get(key);
    agg.gp += 1;
    for (const col of ["ab","r","h","rbi","bb","so","singles","doubles","triples","hr"]) {
      agg[col] = (agg[col] ?? 0) + (row[col] ?? 0);
    }
  }

  const now = new Date().toISOString();

  return [...byPlayer.values()].map(agg => {
    const ab = agg.ab ?? 0;
    const h  = agg.h  ?? 0;
    return {
      player_name: agg.player_name,
      team_name:   agg.team_name,
      season_type: agg.season_type,
      gp:          agg.gp,
      ab,
      r:           agg.r       ?? 0,
      h,
      singles:     agg.singles ?? 0,
      doubles:     agg.doubles ?? 0,
      triples:     agg.triples ?? 0,
      hr:          agg.hr      ?? 0,
      rbi:         agg.rbi     ?? 0,
      bb:          agg.bb      ?? 0,
      so:          agg.so      ?? 0,
      avg:         ab > 0 ? h / ab : null,
      synced_at:   now,
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Syncing GC stats from per-game pages`);
  console.log(`   Phase:        ${SYNC_PHASE}`);
  console.log(`   Teams:        ${GC_TEAM_URLS.length} team URL(s)`);
  if (SYNC_PHASE === "regular") {
    console.log(`   Date range:   ${GC_SEASON_START?.toISOString().slice(0,10) ?? "any"} → ${GC_SEASON_END?.toISOString().slice(0,10) ?? "any"}`);
  } else {
    console.log(`   Date range:   ${GC_PLAYOFF_START?.toISOString().slice(0,10) ?? "any"} → end`);
  }
  console.log();

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

  // ── Verify session by loading the first team schedule page ───────────────
  console.log("  Verifying session...");
  try {
    await page.goto(GC_TEAM_URLS[0], { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.warn("  Schedule load warning:", e.message);
  }
  await page.waitForTimeout(1500);
  const verifyUrl = page.url();
  const verifyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log(`  Verify URL: ${verifyUrl}`);
  // GC shows the login form inline (URL stays the same) — detect by checking
  // for the email input prompt which only appears when NOT logged in
  if (/enter your email to join or sign in/i.test(verifyText)) {
    console.error("");
    console.error("════════════════════════════════════════════════════════");
    console.error("  ❌  GC SESSION EXPIRED — STATS SYNC FAILED");
    console.error("════════════════════════════════════════════════════════");
    console.error("  The GameChanger login session is no longer valid.");
    console.error("  Stats have NOT been updated.");
    console.error("");
    console.error("  To fix (takes ~2 minutes):");
    console.error("  1. On your Mac, run:");
    console.error("       node scripts/gc-save-session.mjs");
    console.error("  2. Log in to GameChanger when Chrome opens, then press Enter.");
    console.error("  3. Run:");
    console.error("       base64 -i gc-session.json | tr -d '\\n' > gc-session-secret.txt");
    console.error("       cat gc-session-secret.txt | pbcopy");
    console.error("  4. Go to GitHub → repo → Settings → Secrets → GC_SESSION → update it.");
    console.error("  5. Re-run the workflow from the Actions tab.");
    console.error("════════════════════════════════════════════════════════");
    await page.screenshot({ path: "gc-stats-debug.png", fullPage: false });
    await browser.close();
    process.exit(1);
  }
  console.log("  ✓ Session valid\n");

  // ── Discover all past game IDs from the org schedule ────────────────────────
  const gameIdSet = new Set();

  // Box score base: org URL is preferred; fall back to team URL
  const orgBase    = GC_ORG_SCHEDULE_URL ? GC_ORG_SCHEDULE_URL.replace(/\/schedule$/, "") : null;
  const teamBase   = GC_TEAM_URLS[0].replace(/\/schedule$/, "");
  const schedBase  = orgBase ?? teamBase;

  if (GC_ORG_SCHEDULE_URL) {
    console.log(`\n  Discovering league games from: ${GC_ORG_SCHEDULE_URL}`);
    const { gameUrls } = await discoverSchedule(page, GC_ORG_SCHEDULE_URL, teamBase);
    for (const url of gameUrls) {
      const id = url.match(/\/schedule\/([^/]+)\//)?.[1];
      if (id) gameIdSet.add(id);
    }
    console.log(`  League games found: ${gameIdSet.size}`);
  } else {
    console.log(`\n  GC_ORG_SCHEDULE_URL not set — snowballing from team schedules.`);
    const visited = new Set();
    const queue   = [...GC_TEAM_URLS];
    while (queue.length > 0) {
      const teamUrl = queue.shift();
      const norm = teamUrl.split("?")[0].replace(/\/$/, "");
      if (visited.has(norm)) continue;
      visited.add(norm);
      console.log(`\n  Discovering: ${norm}`);
      const { gameUrls, teamUrls } = await discoverSchedule(page, norm);
      for (const url of gameUrls) {
        const id = url.match(/\/schedule\/([^/]+)\//)?.[1];
        if (id) gameIdSet.add(id);
      }
      for (const url of teamUrls) {
        if (!visited.has(url.split("?")[0].replace(/\/$/, ""))) queue.push(url);
      }
    }
    console.log(`\n  Teams visited: ${visited.size}`);
  }

  const allPastGameIds = [...gameIdSet];

  if (allPastGameIds.length === 0) {
    console.log("\nℹ️  No past games found — nothing to sync.");
    await browser.close();
    process.exit(0);
  }

  // ── Check which games are already in player_game_stats ───────────────────────
  const alreadyScraped = new Set();
  for (let i = 0; i < allPastGameIds.length; i += 100) {
    const { data, error } = await supabase
      .from("player_game_stats")
      .select("game_id")
      .in("game_id", allPastGameIds.slice(i, i + 100));
    if (!error && data) for (const row of data) alreadyScraped.add(row.game_id);
  }

  const gameIdsToScrape = allPastGameIds.filter(id => !alreadyScraped.has(id));

  console.log(`\n  Past games in schedule: ${allPastGameIds.length}`);
  console.log(`  Already scraped:        ${alreadyScraped.size}`);
  console.log(`  Need to scrape:         ${gameIdsToScrape.length}`);

  if (gameIdsToScrape.length === 0) {
    console.log("\n✅ All past games already scraped.");
  }

  // ── Scrape box scores for new games ─────────────────────────────────────────
  let newRowsStored = 0;

  for (let gi = 0; gi < gameIdsToScrape.length; gi++) {
    const gameId      = gameIdsToScrape[gi];
    const boxScoreUrl = `${schedBase}/schedule/${gameId}/box-score`;
    console.log(`\n  ── Game ${gi + 1}/${gameIdsToScrape.length}: ${boxScoreUrl}`);

    const gameRows = await scrapeBoxScore(page, boxScoreUrl);

    if (gameRows.length === 0) {
      console.warn("    No data — will retry next run.");
      continue;
    }

    const teams = [...new Set(gameRows.map(r => r.team_name))];
    console.log(`    ✓ ${gameRows.length} players across: ${teams.join(" | ")}`);

    const rowsWithMeta = gameRows.map(r => ({
      game_id:     gameId,
      season_type: SYNC_PHASE,
      ...r,
    }));

    // Store per-game rows immediately — only if we got stats (so empty games retry next run)
    if (rowsWithMeta.length > 0) {
      for (let i = 0; i < gameRows.length; i += 50) {
        const { error } = await supabase.from("player_game_stats").upsert(
          gameRows.slice(i, i + 50),
          { onConflict: "game_id,player_name,team_name", ignoreDuplicates: false }
        );
        if (error) console.error(`    ❌ player_game_stats upsert failed: ${error.message}`);
      }
      newRowsStored += gameRows.length;
      console.log(`    Stored ${gameRows.length} rows to player_game_stats.`);
    }
  }

  await browser.close();

  // ── Re-aggregate season totals from all stored per-game data ────────────────
  // Read every row in player_game_stats for this phase, then aggregate.
  // This ensures season totals are always computed from the full history,
  // not just this run's newly scraped games.
  console.log(`\n  Newly stored rows: ${newRowsStored}`);
  console.log("  Reading all stored game stats for re-aggregation...");

  const { data: allStoredRows, error: readError } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("season_type", SYNC_PHASE);

  if (readError) {
    console.error("❌ Failed to read player_game_stats:", readError.message);
    process.exit(1);
  }

  if (!allStoredRows || allStoredRows.length === 0) {
    console.log("⚠️  No stored game stats found — skipping aggregation.");
    process.exit(0);
  }

  console.log(`  Total stored rows: ${allStoredRows.length}`);
  const aggregated = aggregateStats(allStoredRows);
  console.log(`  Aggregated to ${aggregated.length} unique players.`);

  // ── Upsert aggregated season totals ─────────────────────────────────────────
  console.log("  Writing to player_batting_stats...");
  for (let i = 0; i < aggregated.length; i += 50) {
    const batch = aggregated.slice(i, i + 50);
    const { error } = await supabase.from("player_batting_stats").upsert(batch, {
      onConflict: "player_name,team_name,season_type",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("❌ Upsert failed:", error.message);
      process.exit(1);
    }
  }

  // Remove stale rows only for teams present in the stored game data.
  // Teams entered manually (not on GC) are never touched.
  const scrapedTeams = [...new Set(aggregated.map(r => r.team_name).filter(Boolean))];
  for (const team of scrapedTeams) {
    const teamPlayerNames = aggregated
      .filter(r => r.team_name === team)
      .map(r => r.player_name);
    await supabase
      .from("player_batting_stats")
      .delete()
      .eq("season_type", SYNC_PHASE)
      .eq("team_name", team)
      .not("player_name", "in", `(${teamPlayerNames.map(n => `"${n}"`).join(",")})`);
  }

  console.log(`\n🏆 Sync complete — ${aggregated.length} players updated.`);
  aggregated
    .sort((a, b) => (b.ab ?? 0) - (a.ab ?? 0))
    .forEach(r => {
      const avg = r.avg !== null ? r.avg.toFixed(3).replace(/^0/, "") : "---";
      console.log(`   ${r.player_name.padEnd(24)} ${String(r.team_name ?? "").padEnd(26)} GP=${r.gp} AB=${r.ab} H=${r.h} AVG=${avg} HR=${r.hr} RBI=${r.rbi}`);
    });
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
