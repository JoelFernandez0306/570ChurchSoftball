/**
 * test-game-stats.mjs
 *
 * Loads your saved GC session and scrapes a game-stats page.
 * Safe — does NOT write to the database.
 *
 * Run gc-save-session.mjs first if you haven't already.
 *
 * Usage:
 *   node scripts/test-game-stats.mjs
 *
 * Override the game URL:
 *   GC_GAME_URL="https://web.gc.com/teams/.../game-stats" node scripts/test-game-stats.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, existsSync, readFileSync } from "fs";

const GAME_URL =
  process.env.GC_GAME_URL ||
  "https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule/e776ee11-d34a-4a4f-a3e1-31c7e85c0e0d/game-stats";

function loadSession() {
  // Try file first, then base64-encoded env var (for CI)
  if (existsSync("gc-session.json")) {
    return JSON.parse(readFileSync("gc-session.json", "utf8"));
  }
  if (process.env.GC_SESSION) {
    return JSON.parse(Buffer.from(process.env.GC_SESSION, "base64").toString("utf8"));
  }
  console.error("No session found. Run: node scripts/gc-save-session.mjs");
  process.exit(1);
}

async function extractStats(page) {
  return page.evaluate(() => {
    const KNOWN = new Set([
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "2B","3B","1B","PA","GP","SF","SH","HBP","TB","K","E","LOB"
    ]);

    const found = [];

    // Standard <table>
    for (const table of document.querySelectorAll("table")) {
      const headerCells = Array.from(table.querySelectorAll("thead th, thead td"));
      const headers = headerCells.map(c => c.textContent?.trim().toUpperCase() ?? "");
      if (!headers.some(h => KNOWN.has(h))) continue;
      const rows = [];
      for (const tr of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(tr.querySelectorAll("td"));
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
        if (Object.values(row)[0]) rows.push(row);
      }
      if (rows.length) found.push({ type: "table", headers, rows });
    }

    // Div-based grids
    for (const el of document.querySelectorAll("div, ul")) {
      const children = Array.from(el.children);
      if (children.length < 5) continue;
      const texts = children.map(c => c.textContent?.trim().toUpperCase() ?? "");
      if (texts.filter(t => KNOWN.has(t)).length < 4) continue;
      const container = el.parentElement;
      if (!container) continue;
      const rows = [];
      for (const sib of container.children) {
        if (sib === el) continue;
        const cells = Array.from(sib.children);
        if (cells.length < children.length - 2) continue;
        const row = {};
        texts.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
        const name = row[texts[0]];
        if (name && !KNOWN.has(name)) rows.push(row);
      }
      if (rows.length) found.push({ type: "div-grid", headers: texts, rows });
    }

    return { tables: found, pageText: document.body.innerText?.slice(0, 6000) ?? "" };
  });
}

async function main() {
  console.log(`\n🔍 GC Game Stats Test`);
  console.log(`   ${GAME_URL}\n`);

  const session = loadSession();
  console.log(`  Session loaded (${session.cookies?.length ?? 0} cookies)\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: session,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Capture API JSON responses
  const captured = [];
  page.on("response", async (response) => {
    if (!response.url().includes("gc.com")) return;
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      const json = await response.json();
      if (JSON.stringify(json).length > 200) captured.push({ url: response.url(), data: json });
    } catch { /* ignore */ }
  });

  console.log("Loading game stats page...");
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.warn("  Load warning:", e.message);
  }

  // Check we didn't land on login page
  if (page.url().includes("/login")) {
    console.error("❌ Session expired. Run: node scripts/gc-save-session.mjs");
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(3000);
  console.log(`  Landed on: ${page.url()}\n`);

  // Click through all tabs and capture their stats
  const allStats = [];
  const tabsToCheck = ["BOX SCORE", "GAME STATS", "BATTING", "PITCHING"];

  for (const tabName of tabsToCheck) {
    const tab = page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}")`);
    if (await tab.count() > 0) {
      await tab.first().click();
      await page.waitForTimeout(1500);
      console.log(`  Tab: "${tabName}"`);
      const { tables } = await extractStats(page);
      for (const t of tables) {
        allStats.push({ tab: tabName, ...t });
      }
    }
  }

  // Screenshot + save data
  await page.screenshot({ path: "gc-game-debug.png", fullPage: true });
  writeFileSync("gc-game-api-responses.json", JSON.stringify(captured, null, 2));

  console.log(`\n📸 Screenshot: gc-game-debug.png`);
  console.log(`📡 API responses (${captured.length}): gc-game-api-responses.json\n`);

  // Print results
  if (allStats.length === 0) {
    const { pageText } = await extractStats(page);
    console.log("⚠️  No stat tables found. Page text:");
    console.log(pageText.slice(0, 1500));
  } else {
    for (const { tab, type, headers, rows } of allStats) {
      console.log(`\n── ${tab} [${type}] ──────────────────`);
      console.log("  " + headers.join(" | "));
      for (const row of rows) console.log("  " + Object.values(row).join(" | "));
    }
  }

  await page.waitForTimeout(2000);
  await browser.close();
  console.log("\n✅ Done.");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
