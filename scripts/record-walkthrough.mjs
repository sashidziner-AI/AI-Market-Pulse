/**
 * Product walkthrough video recorder for the AI Market Pulse hackathon demo.
 *
 * Records a natural user-journey through the app to outputs/video/raw-walkthrough.webm
 * Total target duration: ~4.5 minutes.
 *
 * Journey (with time budget):
 *   [0:00-0:35] Landing page — hero + scroll through problem/solution
 *   [0:35-0:55] Analyze Website — paste URL, click Analyze
 *   [0:55-1:35] Dashboard — Analysis tab (ICP, overview, account cards)
 *   [1:35-1:55] Dashboard — Target Segments
 *   [1:55-2:15] Dashboard — Partner Pathways
 *   [2:15-2:35] Dashboard — GTM Pipeline
 *   [2:35-3:00] Dashboard — Leads
 *   [3:00-3:30] Account Detail — buyer personas, competitors
 *   [3:30-3:55] Jarvis voice segment — dispatch a voice command programmatically
 *   [3:55-4:15] Connect CRM System — open the sync modal
 *   [4:15-4:40] Saved Reports library
 *   [4:40-4:55] Return to Dashboard — closing beat
 *
 * The recording IS SILENT (no audio track). A separate narration audio file
 * should be recorded from outputs/video/narration-script.md and muxed later
 * (see the README ffmpeg instructions).
 *
 * Usage:  node scripts/record-walkthrough.mjs
 * Requires: dev server running at http://localhost:3000
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000/';
const DEMO_ANALYZE_URL =
  process.env.DEMO_ANALYZE_URL ||
  'https://www.veetechnologies.com/industries/architecture-engineering-and-construction-aec-services.htm';
const OUT_DIR = path.resolve('outputs/video');
const VIEWPORT = { width: 1440, height: 900 };

async function safeClick(page, selector, opts = {}) {
  const timeout = opts.timeout ?? 4000;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch { return false; }
}

async function pollFor(page, predicate, { timeoutMs = 120000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await page.evaluate(predicate)) return true; } catch {}
    await page.waitForTimeout(intervalMs);
  }
  return false;
}

// Smooth-scroll helper — creates a slow visual scroll effect suitable for
// video, unlike an instant window.scrollTo jump.
async function smoothScroll(page, deltaY, durationMs = 1200) {
  const steps = Math.max(12, Math.floor(durationMs / 40));
  const perStep = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), perStep);
    await page.waitForTimeout(durationMs / steps);
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`Recording walkthrough to ${OUT_DIR}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    permissions: ['microphone'],
    locale: 'en-US',
    recordVideo: {
      dir: OUT_DIR,
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();

  // Reset state for a deterministic demo.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // ------------------------------------------------------------------
  // [0:00 - 0:35] Landing page — hero, then scroll through key sections
  // ------------------------------------------------------------------
  await page.waitForTimeout(4500); // hero animations play (~3s) + settle
  // Scroll slowly through key landing sections so the video shows the story.
  await smoothScroll(page, 700, 2000);   // features area
  await page.waitForTimeout(2000);
  await smoothScroll(page, 700, 2000);   // watch section
  await page.waitForTimeout(2000);
  await smoothScroll(page, 900, 2500);   // scroll further
  await page.waitForTimeout(2000);
  // Scroll back to hero so the CTA click is on screen for viewers.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  // ------------------------------------------------------------------
  // [0:35 - 0:55] Analyze Website — click hero CTA, paste URL, submit
  // ------------------------------------------------------------------
  const enterCandidates = [
    'button:has-text("Analyze my website")',
    'button:has-text("Launch workspace")',
    'button:has-text("Analyze")',
  ];
  for (const sel of enterCandidates) { if (await safeClick(page, sel, { timeout: 1200 })) break; }
  await page.waitForTimeout(2500); // route transition

  // Type the URL in a human-visible way
  const urlInputSelectors = [
    'input[placeholder*="URL" i]',
    'input[placeholder*="website" i]',
    'input[placeholder*="domain" i]',
    'input[type="url"]',
    'input[type="text"]',
  ];
  let urlInputSel = null;
  for (const sel of urlInputSelectors) {
    if (await page.$(sel)) { urlInputSel = sel; break; }
  }
  if (urlInputSel) {
    await page.click(urlInputSel);
    // Type slowly for a natural typing effect on video. Fall back to a
    // direct value-set if the char-by-char type() stalls (has been seen to
    // hang mid-way on this environment) so a flaky keystroke never aborts
    // the whole ~5 minute recording.
    try {
      await page.type(urlInputSel, DEMO_ANALYZE_URL, { delay: 25, timeout: 15000 });
    } catch {
      console.warn('  ! page.type stalled on the URL field — falling back to a direct value-set.');
      await page.evaluate(({ sel, url }) => {
        const input = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, url);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, { sel: urlInputSel, url: DEMO_ANALYZE_URL });
    }
    await page.waitForTimeout(1200);
  }
  // IMPORTANT: submit via type="submit" or Enter. A "Analyze" text-match
  // would hit the header nav tab first.
  let submitted =
    await safeClick(page, 'form button[type="submit"]', { timeout: 1500 }) ||
    await safeClick(page, 'button[type="submit"]', { timeout: 1000 });
  if (!submitted) await page.keyboard.press('Enter');

  // ------------------------------------------------------------------
  // [0:55 - 1:35] Dashboard — Analysis tab appears once analysis is done
  // ------------------------------------------------------------------
  console.log('  Waiting for dashboard to load...');
  await pollFor(page, () => /Target Segments|GTM Pipeline|Partner Pathways/i.test(document.body.innerText || ''), {
    timeoutMs: 120000,
  });
  await pollFor(page, () => /Fit|Score|Priority|ICP/i.test(document.body.innerText || ''), {
    timeoutMs: 60000,
  });
  await page.waitForTimeout(3500); // let cards populate + toast dismiss
  await smoothScroll(page, 500, 2000);
  await page.waitForTimeout(2500);
  await smoothScroll(page, 500, 2000);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // ------------------------------------------------------------------
  // [1:35 - 2:35] Dashboard tabs — Target Segments, Partner Pathways, Pipeline
  // ------------------------------------------------------------------
  const tabs = [
    { label: 'Target Segments',   dwellMs: 20000 },
    { label: 'Partner Pathways',  dwellMs: 20000 },
    { label: 'GTM Pipeline',      dwellMs: 20000 },
    { label: 'Leads',             dwellMs: 25000 },
  ];
  for (const t of tabs) {
    const ok =
      await safeClick(page, `text=/^${t.label}$/`, { timeout: 3000 }) ||
      await safeClick(page, `button:has-text("${t.label}")`, { timeout: 2000 });
    if (!ok) console.warn(`  ! Could not click tab ${t.label}`);
    await page.waitForTimeout(2000);
    // Show some scroll within the tab so viewers see more than the fold.
    await smoothScroll(page, 400, 1800);
    await page.waitForTimeout(t.dwellMs - 4000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ------------------------------------------------------------------
  // [2:35 - 3:00] Account Detail — go back to Pipeline, open first account
  // ------------------------------------------------------------------
  await safeClick(page, `text=/^GTM Pipeline$/`, { timeout: 3000 });
  await page.waitForTimeout(2000);
  // Click first real account card (cursor-pointer motion.div, no explicit button)
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    const real = cards.find((c) => (c.textContent || '').length > 80 && /\.(com|io|ai|net|co|org|us)\b/i.test(c.textContent || ''));
    (real || cards[0])?.click();
  });
  console.log('  Waiting for account detail deep-analysis (up to 18s)...');
  // NOTE: without OPENAI_API_KEY, the live streaming deep-dive never
  // resolves (account.analysisProgress never clears), so "please wait" /
  // "Starting deep-dive analysis" stay in the DOM as permanent trace-log
  // history even after the modal itself is long gone — matching on those
  // makes this predicate never succeed. Match only the modal's own heading.
  await pollFor(page, () => {
    const t = document.body.innerText || '';
    const stillLoading = /AI is analyzing this account/i.test(t);
    const loaded = /Evidence-Based Fit Intel|Industry-Specific Buying Intent|Social Signals|Fit Score:/i.test(t);
    return loaded && !stillLoading;
  }, { timeoutMs: 18000 });
  await page.waitForTimeout(2000);
  await smoothScroll(page, 700, 3500);
  await page.waitForTimeout(3000);
  await smoothScroll(page, 800, 4000);
  await page.waitForTimeout(3000);

  // Close via the AccountDetail's specific Back button (title="Back to
  // accounts"), which stays clickable even while the analyzing modal is
  // still showing (it lives in the fixed header, outside the modal). Fall
  // back to a direct DOM click bypassing actionability checks, then the
  // Jarvis close event as a last resort.
  const backClicked = await safeClick(page, 'button[title="Back to accounts"]', { timeout: 3000 });
  if (!backClicked) {
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Back to accounts"]');
      btn?.click();
    });
  }
  await page.waitForTimeout(2000);

  // ------------------------------------------------------------------
  // [3:30 - 3:55] Jarvis voice segment — dispatch commands programmatically
  // to show the assistant in action without needing a real microphone in
  // the recording environment.
  // ------------------------------------------------------------------
  console.log('  Simulating a Jarvis voice command...');
  await page.evaluate(() => {
    // Simulate clicking the Jarvis orb to open the panel.
    const orb = document.querySelector('button[aria-label="Jarvis voice assistant"]');
    (orb)?.click();
  });
  await page.waitForTimeout(2000);
  // Trigger a dashboard-tab change through the Jarvis event bus — the
  // action registry Dashboard listens for. This visibly demonstrates
  // Jarvis controlling the app.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('jarvis:dashboard', {
      detail: { action: 'dashboard.tab', args: { tab: 'leads' } }
    }));
  });
  await page.waitForTimeout(4000);
  // Second action — scroll top to demonstrate global voice actions.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2500);
  // Close orb panel
  await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button[aria-label="Close Jarvis"]'))[0];
    (closeBtn)?.click();
  }).catch(() => {});
  await page.waitForTimeout(2500);

  // ------------------------------------------------------------------
  // [3:55 - 4:15] Connect CRM System — open the sync modal
  // ------------------------------------------------------------------
  // Use a direct DOM click (bypassing Playwright's actionability checks) —
  // a lingering toast notification from the earlier steps can sit over the
  // header and cause a real page.click() to time out even though the
  // button is genuinely there and functional.
  console.log('  Opening Connect CRM modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => (b.textContent || '').includes('Connect CRM'));
    btn?.click();
  });
  const crmOpened = await pollFor(page, () => /Connect CRM System/i.test(document.body.innerText || ''), {
    timeoutMs: 6000,
    intervalMs: 300,
  });
  if (crmOpened) {
    await page.waitForTimeout(1200);
    await page.waitForTimeout(3500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
  } else {
    console.warn('  ! Connect CRM modal did not open — skipping segment.');
  }

  // ------------------------------------------------------------------
  // [4:15 - 4:40] Saved Reports library
  // ------------------------------------------------------------------
  // Save current scope so the library has content
  const savePathCandidates = [
    'button:has-text("Save Scope")',
    'button:has-text("Save As")',
  ];
  for (const sel of savePathCandidates) { if (await safeClick(page, sel, { timeout: 1200 })) break; }
  await page.waitForTimeout(1500);
  await safeClick(page, 'button:has-text("Confirm & Save Scope"), button:has-text("Confirm")', { timeout: 3000 });
  await page.waitForTimeout(2000);

  const libraryCandidates = [
    'button:has-text("Show Reports")',
    'button:has-text("Saved Reports")',
    'a:has-text("Saved Reports")',
    'button:has-text("Reports")',
  ];
  for (const sel of libraryCandidates) { if (await safeClick(page, sel, { timeout: 1500 })) break; }
  await page.waitForTimeout(3000);
  await smoothScroll(page, 400, 2000);
  await page.waitForTimeout(3000);

  // ------------------------------------------------------------------
  // [4:20 - 4:35] Closing beat — return to landing hero
  // ------------------------------------------------------------------
  // Navigate back home for a clean closing shot.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // ------------------------------------------------------------------
  // Finalize video — must close the CONTEXT to flush the recording,
  // then rename the auto-generated file to a predictable name.
  // ------------------------------------------------------------------
  console.log('  Closing context to flush video...');
  await context.close();
  await browser.close();

  // Playwright writes the video with an auto-generated name — find it and
  // rename to raw-walkthrough.webm.
  const files = await fs.readdir(OUT_DIR);
  const webm = files.find((f) => f.endsWith('.webm') && f !== 'raw-walkthrough.webm');
  if (webm) {
    const src = path.join(OUT_DIR, webm);
    const dst = path.join(OUT_DIR, 'raw-walkthrough.webm');
    // Remove any prior recording so the rename doesn't fail on Windows.
    try { await fs.unlink(dst); } catch {}
    await fs.rename(src, dst);
    console.log(`\nRecording saved to ${dst}`);
  } else {
    console.warn('  ! No .webm produced — check for errors above.');
  }
}

main().catch((err) => {
  console.error('record-walkthrough failed:', err);
  process.exit(1);
});
