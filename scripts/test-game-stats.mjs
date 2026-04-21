/**
 * test-game-stats.mjs
 *
 * Loads your saved GC session, navigates to the game-stats page,
 * clicks: Batting → Advanced for each team, and prints every
 * player's advanced batting stats.
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
async function tryClick(page, text, timeout = 4000) {
  try {
    const el = page.locator(
      `button:has-text("${text}"), [role="tab"]:has-text("${text}"), [role="button"]:has-text("${text}")`
    ).first();
    await el.waitFor({ timeout });
    await el.click();
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
}

// Scroll every overflow-x container all the way right then back,
// forcing any horizontally-virtualized columns to render.
async function triggerHorizontalRender(page) {
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll("*")).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 10
      );
    });
    for (const el of scrollables) {
      el.scrollLeft = el.scrollWidth; // scroll right to edge
    }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll("*")).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 10
      );
    });
    for (const el of scrollables) {
      el.scrollLeft = 0; // scroll back to start
    }
  });
  await page.waitForTimeout(400);
}

// Extract all rows from whatever stats table is currently visible
// Uses a spatial approach: group all visible text elements by Y-position
// to reconstruct table rows regardless of DOM structure.
async function extractCurrentTable(page) {
  // Scroll to bottom/top to trigger lazy row rendering
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Scroll any overflow-x containers to the right then back, forcing
  // horizontally-virtualized columns to render
  await triggerHorizontalRender(page);

  return page.evaluate(() => {
    const STAT_COLS = new Set([
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "1B","2B","3B","PA","GP","SF","SH","HBP","IBB","TB","K","E","LOB",
      "QAB","HHB","LD","FB","GB","BABIP","XBH","PS","PS/PA","2OUTRBI",
      "BA/RISP","CS","SB","GIDP","PO","A","2S+3","6+","CI",
    ]);

    function normalize(raw) {
      return raw
        .replace(/[\u2190-\u21ff\u25a0-\u25ff\u2600-\u27ff]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
    }
    function isStatCol(h) { return STAT_COLS.has(h); }
    function isPlayerHeader(h) {
      return h === "PLAYER" || h === "NAME" || h === "#" || h.includes("PLAYER");
    }

    const debugInfo = [];
    const results = [];

    // ── Strategy A: standard <table> ──────────────────────────────────────────
    for (const table of document.querySelectorAll("table")) {
      const headerCells = Array.from(table.querySelectorAll("thead th, thead td"));
      if (headerCells.length === 0) {
        const firstRow = table.querySelector("tr");
        if (firstRow) headerCells.push(...firstRow.querySelectorAll("th, td"));
      }
      const normHeaders = headerCells.map(c => normalize(c.textContent ?? ""));
      if (!normHeaders.some(isPlayerHeader)) continue;
      if (normHeaders.filter(isStatCol).length < 2) continue;
      const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
      const allRows = bodyRows.length > 0
        ? bodyRows
        : Array.from(table.querySelectorAll("tr")).slice(1);
      const rows = [];
      for (const tr of allRows) {
        const cells = Array.from(tr.querySelectorAll("td, th"));
        if (cells.length < 3) continue;
        const row = {};
        normHeaders.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
        const first = Object.values(row)[0] ?? "";
        if (!first || isStatCol(first.toUpperCase())) continue;
        rows.push(row);
      }
      if (rows.length > 0) { results.push({ type: "table", headers: normHeaders, rows }); break; }
    }

    // ── Strategy B: div grid ───────────────────────────────────────────────────
    if (results.length === 0) {
      for (const el of document.querySelectorAll("div, ul, ol, section")) {
        const children = Array.from(el.children);
        if (children.length < 5 || children.length > 40) continue;
        const normTexts = children.map(c => normalize(c.textContent ?? ""));
        if (!normTexts.some(isPlayerHeader)) continue;
        if (normTexts.filter(isStatCol).length < 3) continue;
        const parent = el.parentElement;
        if (!parent) continue;
        const rows = [];
        for (const sib of parent.children) {
          if (sib === el) continue;
          const cells = Array.from(sib.children);
          if (cells.length < children.length - 3) continue;
          const row = {};
          normTexts.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
          const first = Object.values(row)[0] ?? "";
          if (!first || isStatCol(first.toUpperCase())) continue;
          rows.push(row);
        }
        if (rows.length > 0) { results.push({ type: "div-grid", headers: normTexts, rows }); break; }
      }
    }

    // ── Strategy C: split sticky-column layout ────────────────────────────────
    // GC uses a frozen "Player" column + separate scrollable stats columns.
    // Find the stats header row (has many STAT_COLS but no PLAYER header).
    // Find the player names column separately. Zip by row index.
    if (results.length === 0) {
      // Find the stats header row: a container whose direct children are all stat columns
      let statsHeaderEl = null;
      for (const el of document.querySelectorAll("div")) {
        const children = Array.from(el.children);
        if (children.length < 5 || children.length > 35) continue;
        const normTexts = children.map(c => normalize(c.textContent ?? ""));
        const statCount = normTexts.filter(isStatCol).length;
        // No player header, but lots of stat columns
        if (statCount >= 5 && !normTexts.some(isPlayerHeader)) {
          statsHeaderEl = el;
          break;
        }
      }

      if (statsHeaderEl) {
        const statsHeaders = Array.from(statsHeaderEl.children)
          .map(c => normalize(c.textContent ?? ""));
        debugInfo.push("Strategy C: stats header row found, cols=" + statsHeaders.join("|"));

        // Look for the stats data rows: siblings of statsHeaderEl's parent,
        // or elements with the same number of children as the header
        const headerParent = statsHeaderEl.parentElement;
        const grandParent = headerParent?.parentElement;

        let statsRows = [];

        // Option 1: rows are siblings of statsHeaderEl within headerParent
        if (headerParent) {
          for (const sib of headerParent.children) {
            if (sib === statsHeaderEl) continue;
            const cells = Array.from(sib.children);
            if (cells.length !== statsHeaders.length) continue;
            statsRows.push(cells.map(c => c.textContent?.trim() ?? ""));
          }
        }

        // Option 2: rows are siblings of headerParent within grandParent
        if (statsRows.length === 0 && grandParent) {
          for (const sib of grandParent.children) {
            if (sib === headerParent) continue;
            const cells = Array.from(sib.children);
            if (cells.length !== statsHeaders.length) continue;
            statsRows.push(cells.map(c => c.textContent?.trim() ?? ""));
          }
        }

        debugInfo.push("Strategy C: found " + statsRows.length + " stats data rows");

        // Find player names: look for a div that is positionally adjacent to the stats
        // and contains a list of names (strings with letters that aren't stat columns)
        const playerNameLists = [];
        for (const el of document.querySelectorAll("div")) {
          const children = Array.from(el.children);
          if (children.length !== statsRows.length) continue;
          const texts = children.map(c => c.textContent?.trim() ?? "");
          // All children should look like names (have letters, not stat columns)
          if (texts.every(t => /[a-zA-Z]{2}/.test(t) && !isStatCol(normalize(t)))) {
            playerNameLists.push(texts);
          }
        }

        debugInfo.push("Strategy C: found " + playerNameLists.length + " candidate player name lists");
        if (playerNameLists.length > 0) {
          debugInfo.push("  first list: " + playerNameLists[0].slice(0, 3).join(", "));
        }

        if (statsRows.length > 0 && playerNameLists.length > 0) {
          const playerNames = playerNameLists[0];
          const rows = statsRows.map((cells, i) => {
            const row = { PLAYER: playerNames[i] ?? "" };
            statsHeaders.forEach((h, j) => { row[h] = cells[j] ?? ""; });
            return row;
          }).filter(r => r.PLAYER && !isStatCol(r.PLAYER.toUpperCase()));

          if (rows.length > 0) {
            results.push({
              type: "split-layout",
              headers: ["PLAYER", ...statsHeaders],
              rows,
            });
          }
        } else if (statsRows.length > 0) {
          // No separate player names found — return stats without names
          const rows = statsRows.map(cells => {
            const row = {};
            statsHeaders.forEach((h, j) => { row[h] = cells[j] ?? ""; });
            return row;
          });
          results.push({ type: "split-layout-no-names", headers: statsHeaders, rows });
        }
      } else {
        debugInfo.push("Strategy C: no stats header row found");
      }
    }

    // ── Strategy D: spatial — group visible leaf text nodes by Y position ─────
    if (results.length === 0) {
      const STAT_PATTERN = /^-?\d{1,4}(\.\d{1,4})?$|^\.?\d{3}$|^—$|^-$|^$/;
      const allLeaves = Array.from(document.querySelectorAll("*")).filter(el => {
        return el.children.length === 0 &&
               (el.textContent?.trim().length ?? 0) > 0 &&
               el.offsetParent !== null; // visible
      });

      // Collect {text, x, y, w} for each visible leaf
      const nodes = allLeaves.map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent?.trim() ?? "", x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) };
      }).filter(n => n.y > 0 && n.x > 0);

      // Group by Y (within ±6px)
      const rows = [];
      const used = new Set();
      const sortedByY = [...nodes].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sortedByY.length; i++) {
        if (used.has(i)) continue;
        const row = [sortedByY[i]];
        used.add(i);
        for (let j = i + 1; j < sortedByY.length; j++) {
          if (used.has(j)) continue;
          if (Math.abs(sortedByY[j].y - sortedByY[i].y) <= 6) {
            row.push(sortedByY[j]);
            used.add(j);
          }
        }
        rows.push(row.sort((a, b) => a.x - b.x).map(n => n.text));
      }

      // Find a row that contains 5+ stat column headers
      const headerRowIdx = rows.findIndex(row =>
        row.filter(t => isStatCol(normalize(t))).length >= 5
      );
      if (headerRowIdx >= 0) {
        const headerRow = rows[headerRowIdx];
        debugInfo.push("Strategy D: header row found at row " + headerRowIdx + "/" + rows.length + ": " + headerRow.join("|"));
        const headers = headerRow.map(normalize);

        // Debug: show the next 5 rows after the header
        for (let i = headerRowIdx + 1; i <= Math.min(headerRowIdx + 5, rows.length - 1); i++) {
          debugInfo.push("  row " + i + " (len=" + rows[i].length + "): " + rows[i].slice(0, 5).join("|") + "...");
        }

        // GC uses a split layout: stats row (len≈19) alternates with name row (len=1).
        // Pattern: [stats_row, name_row, stats_row, name_row, ..., totals_row, name_row]
        // Pair them up; skip totals and footer.
        const expectedStatsCols = headers.length - 1; // header has PLAYER + N stat cols
        const statsRows = [];  // { cells: [], name: "" }
        let pendingStats = null;

        const UI_JUNK = /back to schedule|batting|pitching|fielding|standard|advanced|fan pricing|privacy|terms|disclosures|sign in|sign up|get the app/i;

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const first = row[0] ?? "";
          if (!first || UI_JUNK.test(first)) continue;

          if (row.length === 1) {
            // Player name row — attach to the pending stats row
            if (pendingStats !== null) {
              statsRows.push({ cells: pendingStats, name: first });
              pendingStats = null;
            }
          } else if (row.length >= expectedStatsCols - 2 && row.length <= expectedStatsCols + 2) {
            // Stats row — check it's not the totals row by seeing if first cell is large aggregate
            // (totals tend to have very high PA like 40+)
            if (pendingStats !== null) {
              // Two consecutive stats rows with no name between — save the previous one nameless
              statsRows.push({ cells: pendingStats, name: "" });
            }
            pendingStats = row;
          }
        }
        // Handle any trailing pending stats row
        if (pendingStats !== null) statsRows.push({ cells: pendingStats, name: "" });

        debugInfo.push("Strategy D: " + statsRows.length + " (stats, name) pairs collected");

        // Clean player name: "Aaron Tanner, #47" → "Aaron Tanner"
        function cleanName(raw) {
          return raw.replace(/,?\s*#\d+.*$/, "").trim();
        }

        // Build final rows: strip totals and team summary rows
        const dataRows = statsRows
          .filter(({ cells, name }) => {
            const cleanedName = cleanName(name);
            // Skip "Team" totals row
            if (!cleanedName || /^team$/i.test(cleanedName)) return false;
            // Skip if name looks like a stat value (shouldn't happen, but safety)
            if (STAT_PATTERN.test(cleanedName)) return false;
            return true;
          })
          .map(({ cells, name }) => {
            const obj = { PLAYER: cleanName(name) };
            headers.slice(1).forEach((h, j) => { obj[h] = cells[j] ?? ""; });
            return obj;
          });

        debugInfo.push("Strategy D: " + dataRows.length + " final player rows after filtering");
        if (dataRows.length > 0) {
          results.push({ type: "spatial", headers, rows: dataRows });
        }
      } else {
        debugInfo.push("Strategy D: no header row with 5+ stat columns found");
      }
    }

    return { results, debugInfo };
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
    // Extra-wide viewport so all columns are visible without horizontal scrolling
    viewport: { width: 2400, height: 900 },
  });
  const page = await context.newPage();

  // Capture API responses in case we want to switch to API-based extraction later
  const captured = [];
  page.on("response", async (response) => {
    if (!response.url().includes("gc.com")) return;
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      const json = await response.json();
      const size = JSON.stringify(json).length;
      if (size > 300) captured.push({ url: response.url(), data: json });
    } catch { /* ignore */ }
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

  // ── Step 1: Wait for Batting tab to appear (game stats is ready) ──────────
  try {
    await page.waitForSelector(
      'button:has-text("Batting"), [role="tab"]:has-text("Batting")',
      { timeout: 12000 }
    );
  } catch {
    await tryClick(page, "GAME STATS");
    await tryClick(page, "Game Stats");
    await page.waitForTimeout(2000);
  }

  // Entry screenshot
  await page.screenshot({ path: "gc-game-debug.png", fullPage: true });
  console.log("  Entry screenshot saved.\n");

  // ── Step 2: Find team toggle buttons/tabs ─────────────────────────────────
  // GC team selector can be <button>, [role="tab"], or [role="button"]
  const EXCLUDED_UI = [
    "BOX SCORE","GAME STATS","BATTING","PITCHING","FIELDING",
    "STANDARD","ADVANCED","PLAYS","VIDEOS","RECAP","INSIGHTS",
    "INFO","STARTING LINEUP","EDIT STATS","HOME","SCHEDULE",
    "TEAM","STATS","OPPONENTS","TOOLS","GET THE APP","SIGN IN",
    "SIGN UP","TRY FOR FREE","SUPPORT","ACCOUNT","SIGN OUT",
    "BUY A TEAM PASS","BACK TO SCHEDULE","ADD EVENT",
  ];

  const teamNames = await page.evaluate((excluded) => {
    const seen = new Set();
    const results = [];
    const els = document.querySelectorAll(
      'button, [role="tab"], [role="button"]'
    );
    for (const el of els) {
      const text = el.textContent?.trim() ?? "";
      if (text.length < 4 || text.length > 55) continue;
      if (text.includes("@")) continue;
      if (text.includes("Back to")) continue;
      if (text.includes("©")) continue;
      if (!/[a-zA-Z]{3}/.test(text)) continue;
      if (excluded.includes(text.toUpperCase())) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      results.push(text);
    }
    return results;
  }, EXCLUDED_UI);

  const uniqueTeams = teamNames.slice(0, 2);
  console.log(`  Teams found: ${uniqueTeams.join(" | ") || "(none — will use default team)"}\n`);

  const allResults = [];

  // ── Step 3: For each team → Batting → Advanced → extract ─────────────────
  const teamsToProcess = uniqueTeams.length >= 2 ? uniqueTeams : [null, null].slice(0, 1);

  for (const teamName of teamsToProcess) {
    if (teamName) {
      const clicked = await tryClick(page, teamName, 5000);
      console.log(`  Team: "${teamName}" ${clicked ? "✓" : "(click failed)"}`);
      await page.waitForTimeout(800);
    }

    const clickedBatting = await tryClick(page, "Batting", 6000);
    console.log(`  Sub-tab: Batting ${clickedBatting ? "✓" : "(not found)"}`);
    await page.waitForTimeout(1500);

    const clickedAdv = await tryClick(page, "Advanced", 6000);
    console.log(`  View: ${clickedAdv ? "Advanced ✓" : "Standard (Advanced tab not found)"}`);
    await page.waitForTimeout(1500);

    const { results: tables, debugInfo } = await extractCurrentTable(page);

    if (debugInfo?.length) console.log("  DEBUG:", debugInfo.join("\n  DEBUG: "));

    if (tables.length > 0) {
      for (const t of tables) {
        allResults.push({ team: teamName ?? "Team 1", ...t });
        console.log(`  ✓ Extracted ${t.rows.length} player rows (${t.type})\n`);
      }
    } else {
      console.log(`  ⚠️  No table found — saving mid-loop screenshot.\n`);
      await page.screenshot({ path: `gc-game-debug-${(teamName ?? "team").replace(/[^a-z0-9]/gi, "_")}.png`, fullPage: true });
    }
  }

  // ── Final screenshot + save ───────────────────────────────────────────────
  await page.screenshot({ path: "gc-game-debug-final.png", fullPage: true });
  writeFileSync("gc-game-api-responses.json", JSON.stringify(captured, null, 2));
  console.log(`\n📸 gc-game-debug-final.png  |  📡 gc-game-api-responses.json (${captured.length} responses)\n`);

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
