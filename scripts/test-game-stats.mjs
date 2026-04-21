/**
 * test-game-stats.mjs
 *
 * Loads your saved GC session, navigates to the game-stats page,
 * clicks: GAME STATS → Batting → Advanced for each team, and prints
 * every player's advanced batting stats.
 *
 * Safe — does NOT write to the database.
 *
 * Usage:
 *   node scripts/test-game-stats.mjs
 *
 * Override the game URL:
 *   GC_GAME_URL="https://web.gc.com/..." node scripts/test-game-stats.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, existsSync, readFileSync } from "fs";

const GAME_URL =
  process.env.GC_GAME_URL ||
  "https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule/e776ee11-d34a-4a4f-a3e1-31c7e85c0e0d/game-stats";

function loadSession() {
  if (existsSync("gc-session.json")) {
    return JSON.parse(readFileSync("gc-session.json", "utf8"));
  }
  if (process.env.GC_SESSION) {
    return JSON.parse(Buffer.from(process.env.GC_SESSION, "base64").toString("utf8"));
  }
  console.error("No session found. Run: node scripts/gc-save-session.mjs");
  process.exit(1);
}

// Try to click an element by its visible text, return true if found
async function tryClick(page, text, timeout = 3000) {
  try {
    const el = page.locator(
      `button:has-text("${text}"), [role="tab"]:has-text("${text}"), [role="button"]:has-text("${text}")`
    ).first();
    await el.waitFor({ timeout });
    await el.click();
    await page.waitForTimeout(1500);
    return true;
  } catch {
    return false;
  }
}

// Extract all rows from whatever stats table is currently visible
async function extractCurrentTable(page) {
  // Scroll to bottom to force any lazy-loaded rows to render
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  return page.evaluate(() => {
    // Expanded set — includes all known GC batting columns (standard + advanced)
    const STAT_COLS = new Set([
      // Standard
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "1B","2B","3B","PA","GP","SF","SH","HBP","IBB","TB","K","E","LOB",
      // Advanced
      "QAB","HHB","LD","FB","GB","BABIP","XBH","PS","PSA","2OUTRBI",
      "BA/RISP","CS","SB","GIDP","PO","A",
    ]);

    function tryExtractTable(root) {
      const results = [];

      // ── Standard <table> ──────────────────────────────────────────────────
      for (const table of root.querySelectorAll("table")) {
        const headerCells = Array.from(
          table.querySelectorAll("thead th, thead td")
        );
        const headers = headerCells.map((c) => c.textContent?.trim() ?? "");
        const headersUpper = headers.map((h) => h.toUpperCase());

        // Must have Player/Name column + at least 3 stat columns
        const hasPlayer = headersUpper.some((h) =>
          h === "PLAYER" || h === "NAME" || h === "#" || h.includes("PLAYER")
        );
        const statCount = headersUpper.filter((h) => STAT_COLS.has(h)).length;
        if (!hasPlayer || statCount < 2) continue;

        const colMap = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
        const rows = [];

        for (const tr of table.querySelectorAll("tbody tr")) {
          const cells = Array.from(tr.querySelectorAll("td"));
          if (cells.length < 3) continue;
          const row = {};
          headers.forEach((h, i) => {
            row[h.trim()] = cells[i]?.textContent?.trim() ?? "";
          });
          // First cell should be a player name (not a number, not empty)
          const firstVal = Object.values(row)[0] ?? "";
          if (!firstVal || STAT_COLS.has(firstVal.toUpperCase())) continue;
          rows.push(row);
        }

        if (rows.length > 0) {
          results.push({ type: "table", headers: headers.map((h) => h.trim()), rows });
        }
      }

      // ── Div-based grids ───────────────────────────────────────────────────
      if (results.length === 0) {
        for (const el of root.querySelectorAll("div, ul, section")) {
          const children = Array.from(el.children);
          if (children.length < 5) continue;
          const texts = children.map((c) => c.textContent?.trim() ?? "");
          const textsUpper = texts.map((t) => t.toUpperCase());

          const hasPlayer = textsUpper.some((t) =>
            t === "PLAYER" || t === "NAME" || t.includes("PLAYER")
          );
          const statCount = textsUpper.filter((t) => STAT_COLS.has(t)).length;
          if (!hasPlayer || statCount < 3) continue;

          const container = el.parentElement;
          if (!container) continue;

          const rows = [];
          for (const sib of container.children) {
            if (sib === el) continue;
            const cells = Array.from(sib.children);
            if (cells.length < children.length - 2) continue;
            const row = {};
            texts.forEach((h, i) => {
              row[h] = cells[i]?.textContent?.trim() ?? "";
            });
            const name = row[texts[0]];
            if (!name || STAT_COLS.has(name.toUpperCase())) continue;
            rows.push(row);
          }

          if (rows.length > 0) {
            results.push({ type: "div-grid", headers: texts, rows });
          }
        }
      }

      return results;
    }

    return tryExtractTable(document);
  });
}

async function main() {
  console.log(`\n🔍 GC Advanced Batting Stats`);
  console.log(`   ${GAME_URL}\n`);

  const session = loadSession();
  console.log(`  Session: ${session.cookies?.length ?? 0} cookies\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: session,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Capture API responses
  const captured = [];
  page.on("response", async (response) => {
    if (!response.url().includes("gc.com")) return;
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      const json = await response.json();
      const size = JSON.stringify(json).length;
      if (size > 300) captured.push({ url: response.url(), data: json });
    } catch {
      /* ignore */
    }
  });

  // Load page
  console.log("Loading page...");
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.warn("  Load warning:", e.message);
  }

  if (page.url().includes("/login")) {
    console.error("❌ Session expired. Run: node scripts/gc-save-session.mjs");
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(2000);
  console.log(`  URL: ${page.url()}\n`);

  // ── Step 1: Click GAME STATS tab ──────────────────────────────────────────
  const clickedGameStats = await tryClick(page, "GAME STATS");
  if (!clickedGameStats) await tryClick(page, "Game Stats");
  console.log(`  Clicked: GAME STATS`);

  // ── Step 2: Find team buttons ─────────────────────────────────────────────
  await page.waitForTimeout(1500);

  const teamButtons = await page.evaluate(() => {
    // Look for the team toggle buttons (usually 2 side-by-side pill buttons)
    const btns = Array.from(document.querySelectorAll("button"));
    const teamBtns = btns.filter((b) => {
      const text = b.textContent?.trim() ?? "";
      return text.length > 3 && text.length < 60 &&
        !["BOX SCORE","GAME STATS","BATTING","PITCHING","FIELDING",
          "STANDARD","ADVANCED","PLAYS","VIDEOS","RECAP","INSIGHTS",
          "INFO","STARTING LINEUP","Edit Stats"].includes(text.toUpperCase());
    });
    return teamBtns.map((b) => b.textContent?.trim() ?? "");
  });

  // Filter to unique non-empty team names visible on the page
  const uniqueTeams = [...new Set(teamButtons.filter(Boolean))].slice(0, 2);
  console.log(`  Teams found: ${uniqueTeams.join(", ") || "(auto-detecting)"}\n`);

  const allResults = [];

  // ── Step 3: For each team, click Batting → Advanced ───────────────────────
  const teamsToProcess = uniqueTeams.length > 0 ? uniqueTeams : [null];

  for (const teamName of teamsToProcess) {
    if (teamName) {
      const clicked = await tryClick(page, teamName);
      if (clicked) console.log(`  Team: "${teamName}"`);
    }

    // Click Batting sub-tab
    await tryClick(page, "Batting");
    console.log(`  Sub-tab: Batting`);

    // Click Advanced sub-sub-tab
    const clickedAdv = await tryClick(page, "Advanced");
    if (clickedAdv) {
      console.log(`  View: Advanced`);
    } else {
      console.log(`  View: Standard (Advanced not found)`);
    }

    await page.waitForTimeout(1000);

    // Extract the stats table now visible
    const tables = await extractCurrentTable(page);

    if (tables.length > 0) {
      for (const t of tables) {
        allResults.push({ team: teamName ?? "Team", ...t });
        console.log(`  ✓ Extracted ${t.rows.length} player rows`);
      }
    } else {
      console.log(`  ⚠️  No player table found for "${teamName}"`);
    }
  }

  // ── Screenshot + save ─────────────────────────────────────────────────────
  await page.screenshot({ path: "gc-game-debug.png", fullPage: true });
  writeFileSync("gc-game-api-responses.json", JSON.stringify(captured, null, 2));
  console.log(`\n📸 gc-game-debug.png  |  📡 gc-game-api-responses.json (${captured.length} responses)\n`);

  // ── Print results ─────────────────────────────────────────────────────────
  if (allResults.length === 0) {
    console.log("⚠️  No stats extracted. Check gc-game-debug.png to see what the page shows.");
  } else {
    for (const { team, type, headers, rows } of allResults) {
      console.log(`\n════ ${team} [${type}] ════`);
      console.log("  " + headers.join(" | "));
      for (const row of rows) {
        console.log("  " + Object.values(row).join(" | "));
      }
    }
  }

  await page.waitForTimeout(2000);
  await browser.close();
  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
