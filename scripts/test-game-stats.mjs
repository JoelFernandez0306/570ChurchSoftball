/**
 * test-game-stats.mjs
 *
 * One-off script to scrape a specific GC game-stats page and preview
 * what stats are available. Safe to run — does NOT write to the database.
 *
 * Usage:
 *   node scripts/test-game-stats.mjs
 *
 * Or with a different URL:
 *   GC_GAME_URL="https://web.gc.com/teams/.../game-stats" node scripts/test-game-stats.mjs
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";

const GAME_URL =
  process.env.GC_GAME_URL ||
  "https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule/e776ee11-d34a-4a4f-a3e1-31c7e85c0e0d/game-stats";

async function main() {
  console.log(`\n🔍 Scraping game stats from:\n   ${GAME_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Capture all JSON responses to find the stats API
  const captured = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("gc.com")) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const json = await response.json();
      captured.push({ url, data: json });
    } catch { /* ignore */ }
  });

  console.log("Loading page...");
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.warn("  Load warning:", e.message);
  }
  await page.waitForTimeout(3000);

  // --- Try to find and click the "GAME STATS" tab ---
  const tabNames = ["GAME STATS", "Game Stats", "game-stats", "BATTING", "Batting"];
  let clickedTab = false;
  for (const name of tabNames) {
    try {
      const tab = page.getByRole("tab", { name, exact: false });
      const count = await tab.count();
      if (count > 0) {
        await tab.first().click();
        await page.waitForTimeout(2000);
        console.log(`  ✓ Clicked tab: "${name}"`);
        clickedTab = true;
        break;
      }
    } catch { /* try next */ }
  }

  if (!clickedTab) {
    // Try text-based click
    for (const name of tabNames) {
      try {
        const el = page.locator(`text="${name}"`);
        if (await el.count() > 0) {
          await el.first().click();
          await page.waitForTimeout(2000);
          console.log(`  ✓ Clicked text element: "${name}"`);
          clickedTab = true;
          break;
        }
      } catch { /* try next */ }
    }
  }

  if (!clickedTab) console.log("  ℹ️  Could not find GAME STATS tab — reading current view.");

  // --- Extract from DOM ---
  const extracted = await page.evaluate(() => {
    const KNOWN_STAT_COLS = new Set([
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "2B","3B","1B","PA","GP","SF","SH","HBP","IBB","TB","K","E"
    ]);

    const results = { tables: [] };

    // ── Standard <table> elements ──
    for (const table of document.querySelectorAll("table")) {
      const headerCells = Array.from(table.querySelectorAll("thead th, thead td"));
      const headers = headerCells.map(c => c.textContent?.trim().toUpperCase() ?? "");
      if (!headers.some(h => KNOWN_STAT_COLS.has(h))) continue;

      const colMap = Object.fromEntries(headers.map((h, i) => [h, i]));
      const rows = [];
      for (const tr of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(tr.querySelectorAll("td"));
        if (cells.length < 3) continue;
        const rowData = {};
        headers.forEach((h, i) => {
          rowData[h] = cells[i]?.textContent?.trim() ?? "";
        });
        if (rowData[headers[0]]) rows.push(rowData);
      }
      if (rows.length > 0) results.tables.push({ headers, rows });
    }

    // ── Div-based grids ──
    for (const el of document.querySelectorAll("div, section")) {
      const children = Array.from(el.children);
      if (children.length < 5) continue;
      const texts = children.map(c => c.textContent?.trim().toUpperCase() ?? "");
      const statCount = texts.filter(t => KNOWN_STAT_COLS.has(t)).length;
      if (statCount < 4) continue;

      // This looks like a stats header row — get sibling data rows
      const container = el.parentElement;
      if (!container) continue;
      const headers = texts;
      const rows = [];
      for (const sib of container.children) {
        if (sib === el) continue;
        const cells = Array.from(sib.children);
        if (cells.length < children.length - 2) continue;
        const rowData = {};
        headers.forEach((h, i) => {
          rowData[h] = cells[i]?.textContent?.trim() ?? "";
        });
        const name = rowData[headers[0]];
        if (name && !KNOWN_STAT_COLS.has(name)) rows.push(rowData);
      }
      if (rows.length > 0) results.tables.push({ headers, rows, source: "div-grid" });
    }

    // Visible page text for inspection
    results.pageText = document.body.innerText?.slice(0, 5000) ?? "";

    return results;
  });

  await page.screenshot({ path: "gc-game-debug.png", fullPage: true });
  console.log("  📸 Screenshot saved: gc-game-debug.png\n");

  // --- Log captured API responses ---
  console.log(`\n📡 API responses captured: ${captured.length}`);
  for (const { url, data } of captured) {
    const size = JSON.stringify(data).length;
    console.log(`   ${size.toString().padStart(7)} chars — ${url.slice(0, 100)}`);
  }

  // Save full API data for inspection
  writeFileSync("gc-game-api-responses.json", JSON.stringify(captured, null, 2));
  console.log("   Full API data saved: gc-game-api-responses.json\n");

  // --- Log extracted DOM tables ---
  console.log(`\n📊 DOM tables found: ${extracted.tables.length}`);
  for (const { headers, rows, source } of extracted.tables) {
    console.log(`\n  [${source ?? "table"}] Columns: ${headers.join(" | ")}`);
    for (const row of rows.slice(0, 5)) { // first 5 rows
      console.log("  " + Object.values(row).join(" | "));
    }
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more rows`);
  }

  // Page text snippet
  console.log("\n📄 Page text snippet:");
  console.log("---");
  console.log(extracted.pageText.slice(0, 1500));
  console.log("---");

  await browser.close();
  console.log("\n✅ Done. Review gc-game-debug.png and gc-game-api-responses.json for full detail.");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
