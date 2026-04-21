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

  // Save session: all cookies + auth-critical localStorage only
  // GC is a React SPA — it reads JWT tokens from localStorage to decide if you're logged in.
  // We filter out cached game/schedule data (makes the file huge) and keep only auth items.
  const storageState = await context.storageState();
  const AUTH_KEYS = /token|auth|jwt|user|session|credential|access|refresh|cognito|identity|gc_|persist/i;

  const slimOrigins = storageState.origins
    .map(origin => ({
      origin: origin.origin,
      localStorage: (origin.localStorage ?? []).filter(item => AUTH_KEYS.test(item.name)),
    }))
    .filter(o => o.localStorage.length > 0);

  const slim = { cookies: storageState.cookies, origins: slimOrigins };
  const json = JSON.stringify(slim, null, 2);
  writeFileSync("gc-session.json", json);

  const cookieCount = slim.cookies?.length ?? 0;
  const authItemCount = slimOrigins.reduce((n, o) => n + o.localStorage.length, 0);
  const sizeKB = (json.length / 1024).toFixed(1);
  console.log(`\n✓ Session saved — gc-session.json`);
  console.log(`  ${cookieCount} cookies, ${authItemCount} auth localStorage items, ${sizeKB} KB total`);
  if (authItemCount > 0) {
    console.log(`  Auth keys saved:`);
    for (const o of slimOrigins) {
      for (const item of o.localStorage) {
        console.log(`    [${o.origin}] ${item.name} (${item.value.length} chars)`);
      }
    }
  } else {
    console.log(`  ⚠️  No auth localStorage items found — only cookies saved.`);
    console.log(`     Game stats pages may not load correctly.`);
  }
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
