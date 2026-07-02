import { chromium } from "playwright";
import fs from "fs";

const OUT = "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3000";

const views = [
  { name: "mobile-844", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "mobile-667", viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1" },
];

const browser = await chromium.launch({ headless: true });

for (const v of views) {
  const context = await browser.newContext({
    viewport: v.viewport,
    isMobile: v.isMobile,
    hasTouch: v.hasTouch,
    userAgent: v.ua,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Full page screenshot
  await page.screenshot({ path: `${OUT}/${v.name}-full.png`, fullPage: true });

  // Viewport-only screenshot
  await page.screenshot({ path: `${OUT}/${v.name}-viewport.png`, fullPage: false });

  // Scroll to bottom of main, then take viewport screenshot
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTo(0, main.scrollHeight);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${v.name}-bottom.png`, fullPage: false });

  console.log(`[${v.name}] screenshots saved`);
  await context.close();
}

await browser.close();
console.log("done");
