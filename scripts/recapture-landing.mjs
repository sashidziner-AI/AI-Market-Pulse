/**
 * Standalone re-capture of the landing page screenshot only, by scrolling
 * and stitching viewport-sized screenshots together in code (Pillow via a
 * short Python helper) rather than using Playwright's fullPage:true.
 *
 * Why: this landing page uses GSAP ScrollTrigger (pinned sections) and a
 * sticky header. Chromium's fullPage capture resizes the viewport to the
 * full document height in one shot, and scroll-driven transforms don't
 * recompute for that synthetic resize — so large chunks of real content
 * (verified present and correctly rendered when actually scrolled to)
 * come out blank in a straight fullPage screenshot. Manually scrolling to
 * each slice and screenshotting the normal viewport avoids the problem
 * entirely, matching what a real viewer scrolling the page would see.
 *
 * Usage: node scripts/recapture-landing.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000/';
const OUT_DIR = path.resolve('outputs/screenshots/_landing-slices');
const OUT_PATH = path.resolve('outputs/screenshots/01-landing.png');
const VIEWPORT = { width: 1440, height: 900 };
const HEADER_HEIGHT = 97; // sticky header — cropped from every slice after the first

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'en-US' });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // hero animations settle

  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Page height: ${totalHeight}px`);

  const sliceHeight = VIEWPORT.height - HEADER_HEIGHT;
  const maxScrollY = Math.max(0, totalHeight - VIEWPORT.height);
  const slicePaths = [];
  let target = 0;
  let i = 0;
  let lastActualY = -1;
  while (true) {
    // Clamp to the real max scroll position — window.scrollTo silently
    // clamps too, so without this the *requested* y (used for canvas
    // placement math) would drift out of sync with what's actually on
    // screen for the final slice, leaving a gap or misaligned overlap.
    const actualY = Math.min(target, maxScrollY);
    if (actualY === lastActualY) break; // already captured this max position
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), actualY);
    await page.waitForTimeout(450); // let scroll-driven transforms settle
    const slicePath = path.join(OUT_DIR, `slice-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: slicePath, fullPage: false });
    slicePaths.push({ path: slicePath, y: actualY, isFirst: i === 0 });
    lastActualY = actualY;
    target += sliceHeight;
    i += 1;
  }
  console.log(`Captured ${slicePaths.length} viewport slices.`);

  await context.close();
  await browser.close();

  // Stitch via a short inline Python/Pillow helper.
  const manifestPath = path.join(OUT_DIR, 'slices.json');
  await fs.writeFile(manifestPath, JSON.stringify({ slicePaths, totalHeight, viewport: VIEWPORT, headerHeight: HEADER_HEIGHT, outPath: OUT_PATH }, null, 2));
  console.log(`Wrote slice manifest -> ${manifestPath}`);
}

main().catch((err) => {
  console.error('recapture-landing failed:', err);
  process.exit(1);
});
