/**
 * gc-save-session.mjs
 *
 * One-time setup: opens a real Chrome window so you can log in to
 * GameChanger manually (email, password, 2FA code — whatever GC asks).
 * When you're fully logged in, press Enter in this terminal and your
 * session gets saved to gc-session.json.
 *
 * Usage:
 *   node scripts/gc-save-session.mjs
 *
 * After running, encode for GitHub Actions:
 *   base64 -i gc-session.json | tr -d '\n'
 * Store the output as a GitHub secret named GC_SESSION.
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import * as readline from "readline";

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function main() {
  console.log("\n🔐 GC Session Setup");
  console.log("===================");
  console.log("1. A Chrome window will open to the GC login page.");
  console.log("2. Log in normally — enter your email, password, and 2FA code.");
  console.log("3. Once you are fully logged in and see the GC home screen,");
  console.log("   come back here and press Enter.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto("https://web.gc.com/login", { waitUntil: "domcontentloaded" });
  console.log("Browser opened. Log in to GameChanger...\n");

  // Wait for the user to finish logging in manually
  await waitForEnter("✅ Press Enter here when you are fully logged in: ");

  // Check we're not still on the login page
  const currentUrl = page.url();
  if (currentUrl.includes("/login") || currentUrl.includes("/sign-up")) {
    console.error(`\n❌ Still on login page (${currentUrl}). Make sure you're fully logged in before pressing Enter.`);
    await browser.close();
    process.exit(1);
  }

  // Save session
  const storageState = await context.storageState();
  writeFileSync("gc-session.json", JSON.stringify(storageState, null, 2));

  const cookieCount = storageState.cookies?.length ?? 0;
  console.log(`\n✓ Session saved — gc-session.json (${cookieCount} cookies)`);
  console.log(`  Logged in as: ${currentUrl}`);

  await browser.close();

  console.log("\n📋 Next steps:");
  console.log("  Test it now:  node scripts/test-game-stats.mjs");
  console.log("\n  For GitHub Actions (so the cron job works):");
  console.log("  Run this and copy the output:");
  console.log("    base64 -i gc-session.json | tr -d '\\n'");
  console.log("  Then add it as a GitHub secret named: GC_SESSION");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
