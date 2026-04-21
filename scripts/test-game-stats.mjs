/**
 * test-game-stats.mjs
 *
 * Logs into GameChanger and scrapes a specific game-stats page.
 * Safe to run — does NOT write to the database.
 *
 * Required env vars:
 *   GC_EMAIL     — your GameChanger login email
 *   GC_PASSWORD  — your GameChanger password
 *
 * Optional:
 *   GC_GAME_URL  — override the default scrimmage URL
 *
 * Usage:
 *   GC_EMAIL="you@example.com" GC_PASSWORD="yourpass" node scripts/test-game-stats.mjs
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";

const GC_EMAIL    = process.env.GC_EMAIL;
const GC_PASSWORD = process.env.GC_PASSWORD;
const GAME_URL    = process.env.GC_GAME_URL ||
  "https://web.gc.com/teams/pse8HXYXmslZ/2026-summer-innovation-church-26/schedule/e776ee11-d34a-4a4f-a3e1-31c7e85c0e0d/game-stats";

if (!GC_EMAIL || !GC_PASSWORD) {
  console.error("Missing GC_EMAIL or GC_PASSWORD environment variables.");
  console.error("Usage: GC_EMAIL=you@example.com GC_PASSWORD=yourpass node scripts/test-game-stats.mjs");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Login to GameChanger
// ---------------------------------------------------------------------------
async function loginToGC(page) {
  console.log("  Navigating to GC login...");
  await page.goto("https://web.gc.com/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // GC may show email field first, then password on next step
  // Try to fill in email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  await emailInput.first().waitFor({ timeout: 15000 });
  await emailInput.first().fill(GC_EMAIL);
  console.log("  Entered email.");

  // Click Continue / Next / Sign In
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Sign in"), button[type="submit"]');
  await continueBtn.first().click();
  await page.waitForTimeout(2000);

  // Password field may now appear
  const passwordInput = page.locator('input[type="password"]');
  const hasPassword = await passwordInput.count() > 0;
  if (hasPassword) {
    await passwordInput.first().fill(GC_PASSWORD);
    console.log("  Entered password.");
    const signInBtn = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue"), button[type="submit"]');
    await signInBtn.first().click();
    await page.waitForTimeout(3000);
  } else {
    console.warn("  ⚠️  Password field not found — GC may require Google sign-in.");
    console.warn("     If you signed up with Google, set up a password at web.gc.com → Profile → Security.");
  }

  // Wait for login to complete (URL should change away from /login)
  try {
    await page.waitForURL(url => !url.includes("/login"), { timeout: 10000 });
    console.log("  ✓ Logged in successfully.\n");
  } catch {
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      await page.screenshot({ path: "gc-login-debug.png" });
      console.error("  ❌ Login failed — still on login page. Check gc-login-debug.png");
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// DOM extraction — tables and div grids
// ---------------------------------------------------------------------------
async function extractStatsFromPage(page) {
  return page.evaluate(() => {
    const KNOWN_STATS = new Set([
      "AB","R","H","RBI","BB","SO","HR","AVG","OBP","SLG","OPS",
      "2B","3B","1B","PA","GP","SF","SH","HBP","IBB","TB","K","E","LOB"
    ]);

    const allTables = [];

    // Standard <table>
    for (const table of document.querySelectorAll("table")) {
      const headerCells = Array.from(table.querySelectorAll("thead th, thead td"));
      const headers = headerCells.map(c => c.textContent?.trim().toUpperCase() ?? "");
      if (!headers.some(h => KNOWN_STATS.has(h))) continue;
      const colMap = Object.fromEntries(headers.map((h, i) => [h, i]));
      const rows = [];
      for (const tr of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(tr.querySelectorAll("td"));
        if (cells.length < 3) continue;
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
        if (Object.values(row)[0]) rows.push(row);
      }
      if (rows.length > 0) allTables.push({ type: "table", headers, rows });
    }

    // Div-based grids
    for (const el of document.querySelectorAll("div, ul")) {
      const children = Array.from(el.children);
      if (children.length < 5) continue;
      const texts = children.map(c => c.textContent?.trim().toUpperCase() ?? "");
      if (texts.filter(t => KNOWN_STATS.has(t)).length < 4) continue;
      const container = el.parentElement;
      if (!container) continue;
      const headers = texts;
      const rows = [];
      for (const sib of container.children) {
        if (sib === el) continue;
        const cells = Array.from(sib.children);
        if (cells.length < children.length - 2) continue;
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ""; });
        const name = row[headers[0]];
        if (name && !KNOWN_STATS.has(name)) rows.push(row);
      }
      if (rows.length > 0) allTables.push({ type: "div-grid", headers, rows });
    }

    return { tables: allTables, pageText: document.body.innerText?.slice(0, 6000) ?? "" };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔍 GC Game Stats Test`);
  console.log(`   URL: ${GAME_URL}\n`);

  const browser = await chromium.launch({ headless: false }); // visible so you can see login
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Capture API responses
  const captured = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("gc.com")) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const json = await response.json();
      const size = JSON.stringify(json).length;
      if (size > 100) captured.push({ url, data: json });
    } catch { /* ignore */ }
  });

  // Login
  await loginToGC(page);

  // Navigate to the game stats page
  console.log("Loading game stats page...");
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.warn("  Load warning:", e.message);
  }
  await page.waitForTimeout(3000);

  // Try each stats tab
  const tabsToTry = ["GAME STATS", "Game Stats", "BOX SCORE", "Box Score", "BATTING", "Batting"];
  for (const tabName of tabsToTry) {
    try {
      const el = page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}")`);
      if (await el.count() > 0) {
        await el.first().click();
        await page.waitForTimeout(2000);
        console.log(`  Clicked tab: "${tabName}"`);
      }
    } catch { /* skip */ }
  }

  // Extract stats
  const { tables, pageText } = await extractStatsFromPage(page);

  // Screenshot
  await page.screenshot({ path: "gc-game-debug.png", fullPage: true });
  console.log("\n📸 Screenshot: gc-game-debug.png");

  // Save API responses
  writeFileSync("gc-game-api-responses.json", JSON.stringify(captured, null, 2));
  console.log(`📡 API responses (${captured.length}): gc-game-api-responses.json`);

  // Print DOM tables
  console.log(`\n📊 Stats tables found: ${tables.length}`);
  for (const { type, headers, rows } of tables) {
    console.log(`\n  [${type}] Columns: ${headers.join(" | ")}`);
    for (const row of rows) {
      console.log("  " + Object.values(row).join(" | "));
    }
  }

  // Print page text
  console.log("\n📄 Rendered page text (first 2000 chars):");
  console.log("---");
  console.log(pageText.slice(0, 2000));
  console.log("---");

  console.log("\n✅ Done. Check gc-game-debug.png and gc-game-api-responses.json for full detail.");

  // Keep browser open a moment so you can see it
  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
