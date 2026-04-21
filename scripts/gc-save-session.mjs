/**
 * gc-save-session.mjs
 *
 * One-time setup: opens a real Chrome window so you can log in to
 * GameChanger manually (including any 2FA), then saves your session
 * to gc-session.json. Run this whenever your session expires.
 *
 * Usage:
 *   node scripts/gc-save-session.mjs
 *
 * After running, encode for GitHub Actions:
 *   base64 -i gc-session.json | tr -d '\n'
 * Then store the output as a GitHub secret named GC_SESSION.
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function main() {
  console.log("\n🔐 GC Session Setup");
  console.log("===================");
  console.log("A Chrome window will open. Log in to GameChanger normally.");
  console.log("(Handle your email 2FA code as usual.)\n");
  console.log("This script will wait until you are fully logged in,");
  console.log("then save your session automatically.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null, // use full window
  });

  const page = await context.newPage();
  await page.goto("https://web.gc.com/login", { waitUntil: "domcontentloaded" });

  console.log("Waiting for you to log in...");

  // Wait until the URL leaves the login page (up to 3 minutes for 2FA)
  await page.waitForURL(
    (url) => !url.includes("/login") && !url.includes("/sign-up"),
    { timeout: 180000 }
  );

  // Give the app a moment to fully settle
  await page.waitForTimeout(3000);
  console.log(`\n✓ Logged in! URL: ${page.url()}`);

  // Save cookies + localStorage
  const storageState = await context.storageState();
  writeFileSync("gc-session.json", JSON.stringify(storageState, null, 2));

  const cookieCount = storageState.cookies?.length ?? 0;
  console.log(`✓ Session saved to gc-session.json (${cookieCount} cookies)`);

  await browser.close();

  console.log("\n📋 Next steps:");
  console.log("  1. Test it:   node scripts/test-game-stats.mjs");
  console.log("  2. For GitHub Actions, encode the session:");
  console.log('     base64 -i gc-session.json | tr -d \'\\n\'');
  console.log("  3. Add the output as a GitHub secret named: GC_SESSION");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
