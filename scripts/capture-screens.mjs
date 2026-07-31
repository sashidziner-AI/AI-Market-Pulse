/**
 * Screenshot capture for the AI Market Pulse hackathon demo package.
 *
 * The app is a single-page React app with STATE-based screens (no URL routes),
 * so we drive it by scripting UI interactions rather than navigating URLs.
 *
 * Screens captured (numbered):
 *   01. Landing page (marketing hero)
 *   02. Analyze Website (URL input)
 *   03. Dashboard — Analysis (recommendations tab)
 *   04. Dashboard — Target Segments (clusters)
 *   05. Dashboard — Partner Pathways
 *   06. Dashboard — GTM Pipeline
 *   07. Dashboard — Leads
 *   08. Account Detail (drill-down)
 *   09. Jarvis voice assistant panel
 *   10. Connect CRM System
 *   11. Saved Reports library
 *
 * Output: outputs/screenshots/NN-slug.png + outputs/screenshots/manifest.json
 *
 * Usage:  node scripts/capture-screens.mjs
 * Requires: dev server running at http://localhost:3000
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000/';
const DEMO_ANALYZE_URL =
  process.env.DEMO_ANALYZE_URL ||
  'https://www.veetechnologies.com/industries/architecture-engineering-and-construction-aec-services.htm';
const OUT_DIR = path.resolve('outputs/screenshots');
const VIEWPORT = { width: 1440, height: 900 };

const manifest = [];

async function shot(page, num, slug, description) {
  const filename = `${String(num).padStart(2, '0')}-${slug}.png`;
  const filepath = path.join(OUT_DIR, filename);
  // Give the page a beat so animations, GSAP timelines, and toasts settle
  // before the shot. Full-page so tall dashboards are captured in one image.
  await page.waitForTimeout(650);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  [${filename}] captured — ${description}`);
  manifest.push({ order: num, filename, slug, description });
}

async function safeClick(page, selector, opts = {}) {
  const timeout = opts.timeout ?? 5000;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch {
    console.warn(`  ! Could not click ${selector} — skipping`);
    return false;
  }
}

/**
 * Poll a predicate against the page until it returns true or timeout is
 * exceeded. More reliable than page.waitForFunction because Playwright's
 * signature (fn, arg, opts) makes the second-arg options case awkward,
 * and the analysis pipeline can take 30-90s.
 */
async function pollFor(page, predicate, { timeoutMs = 120000, intervalMs = 1000, label = '' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = false;
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(predicate);
      if (last) return true;
    } catch {}
    await page.waitForTimeout(intervalMs);
  }
  console.warn(`  ! Poll timed out (${label || 'unnamed'}) — continuing anyway.`);
  return false;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`Launching Chromium and connecting to ${BASE_URL}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    // Grant mic permission upfront so Jarvis doesn't pop the browser prompt.
    permissions: ['microphone'],
    // Consistent locale so numbers/dates render identically to the demo.
    locale: 'en-US',
  });
  const page = await context.newPage();

  // Clear any prior localStorage so the landing page is guaranteed to show
  // on the first navigation and no stale analysis or saved reports leak in.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // ------------------------------------------------------------------
  // 01. Landing page — marketing hero
  // ------------------------------------------------------------------
  await page.waitForTimeout(1500); // Let hero animations settle
  await shot(page, 1, 'landing', 'Marketing landing page with hero, tagline, and CTA — the entry point for new visitors.');

  // ------------------------------------------------------------------
  // 02. Analyze Website — dismiss landing and land on the URL input
  // ------------------------------------------------------------------
  // Landing has multiple "Get Started" / "Try it" buttons. Click the first
  // magnetic button in the hero which routes into the app.
  const enterCandidates = [
    'button:has-text("Analyze my website")',
    'button:has-text("Launch workspace")',
    'button:has-text("Get Started")',
    'button:has-text("Try it Free")',
    'button:has-text("Analyze")',
    'button:has-text("Start")',
    'a:has-text("Get Started")',
  ];
  let entered = false;
  for (const sel of enterCandidates) {
    if (await safeClick(page, sel, { timeout: 800 })) { entered = true; break; }
  }
  if (!entered) {
    // Fallback — programmatically dismiss landing by dispatching a click on
    // any first button in the hero.
    await page.evaluate(() => {
      const btn = document.querySelector('button');
      btn?.click();
    });
  }
  await page.waitForTimeout(1200);
  await shot(page, 2, 'analyze-input', 'Analyze Website — user pastes any company URL to kick off the AI pipeline.');

  // ------------------------------------------------------------------
  // Fill URL, submit, and wait for the Dashboard to render
  // ------------------------------------------------------------------
  // Prefer the URL-specific input over any generic <input> that might be
  // present (theme toggle, search, etc.). The BusinessInput has an input
  // with a URL-ish placeholder.
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
  if (!urlInputSel) {
    console.error('  ! No URL input found on the analyze screen — aborting.');
    await page.screenshot({ path: path.join(OUT_DIR, '_debug-no-input.png'), fullPage: true });
    throw new Error('URL input not found');
  }
  await page.fill(urlInputSel, DEMO_ANALYZE_URL);
  console.log(`  Filled URL input (${urlInputSel}) with: ${DEMO_ANALYZE_URL}`);
  // IMPORTANT: submit via type="submit" or Enter. A plain text-match on
  // "Analyze" would match the header nav tab ("Analyze Website") FIRST and
  // navigate nowhere instead of kicking off the analysis pipeline.
  let submitted = false;
  if (await safeClick(page, 'form button[type="submit"]', { timeout: 1500 })) {
    submitted = true;
  } else if (await safeClick(page, 'button[type="submit"]', { timeout: 1000 })) {
    submitted = true;
  }
  if (!submitted) {
    console.log('  Falling back to Enter key for form submit.');
    await page.keyboard.press('Enter');
  }

  console.log('  Waiting for dashboard sidebar (business analysis)...');
  await pollFor(page, () => /Target Segments|GTM Pipeline|Partner Pathways/i.test(document.body.innerText || ''), {
    timeoutMs: 120000,
    label: 'dashboard-loaded',
  });
  // Now wait for account cards to populate — indicated by the loading
  // banner "AI is scanning" going AWAY. This can take up to ~2 minutes
  // depending on the AI provider load.
  console.log('  Waiting for account cards to populate (up to 180s)...');
  await pollFor(page, () => {
    const text = document.body.innerText || '';
    const stillLoading = /AI is scanning|Scanning\.\.\.|scanning the web|Building account profiles|Discovering high-intent/i.test(text);
    // Real cards have a fit-score number and an outreach action — we look
    // for a numeric priority + a domain-like TLD to be sure it's not a skeleton.
    return !stillLoading;
  }, { timeoutMs: 180000, label: 'accounts-populated' });
  await page.waitForTimeout(3500);

  // ------------------------------------------------------------------
  // 03. Dashboard — Analysis tab (default)
  // ------------------------------------------------------------------
  await shot(page, 3, 'dashboard-analysis', 'Dashboard Analysis tab — auto-generated ICP, business overview, and account recommendations.');

  // ------------------------------------------------------------------
  // 04-07. Dashboard tabs — click each sidebar item and screenshot
  // ------------------------------------------------------------------
  const tabs = [
    { num: 4, slug: 'dashboard-segments',        label: 'Target Segments',   description: 'Strategic account segments — AI clusters accounts sharing common characteristics into pursuit-ready groups.' },
    { num: 5, slug: 'dashboard-partner-pathways', label: 'Partner Pathways',  description: 'Partner routing — surfaces warm-intro pathways via channel partners, integrations, or mutual connections.' },
    { num: 6, slug: 'dashboard-pipeline',        label: 'GTM Pipeline',      description: 'Go-to-market pipeline — the full list of discovered target accounts with fit / timing / priority scores.' },
    { num: 7, slug: 'dashboard-leads',           label: 'Leads',             description: 'Leads pipeline — individual stakeholders enriched from Hunter.io with roles, emails, and LinkedIn profiles.' },
  ];
  for (const t of tabs) {
    const selector = `text=/^${t.label}$/`;
    const ok = await safeClick(page, selector, { timeout: 3000 });
    if (!ok) {
      // Fallback: click by label containing text (some SidebarItems wrap text differently)
      await safeClick(page, `button:has-text("${t.label}"), div[role="button"]:has-text("${t.label}")`, { timeout: 2000 });
    }
    await page.waitForTimeout(1400);
    await shot(page, t.num, t.slug, t.description);
  }

  // ------------------------------------------------------------------
  // 08. Account Detail — click the first account card on Pipeline tab
  // ------------------------------------------------------------------
  // Go back to GTM Pipeline (which shows the account cards clearly)
  await safeClick(page, `text=/^GTM Pipeline$/`, { timeout: 3000 });
  await page.waitForTimeout(1000);
  // AccountCards are clickable motion.div tiles (no explicit button). Click
  // the first one directly by matching the card class pattern.
  const cardOpened = await page.evaluate(() => {
    // Find the first card that has a domain-looking text (real account,
    // not a skeleton) and click it.
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    const realCard = cards.find((c) => {
      const t = c.textContent || '';
      // Skeletons have very little text; real cards mention scores or industries.
      return t.length > 80 && /\.(com|io|ai|net|co|org|us)\b/i.test(t);
    });
    if (realCard) {
      (realCard).click();
      return true;
    }
    // Fallback — click the first cursor-pointer card
    if (cards.length > 0) {
      cards[0].click();
      return true;
    }
    return false;
  });
  console.log(`  Account card click: ${cardOpened ? 'ok' : 'no cards found'}`);
  console.log('  Waiting for deep-analysis to complete (up to 240s)...');
  await pollFor(page, () => {
    const t = document.body.innerText || '';
    const stillLoading = /AI is analyzing this account|please wait|Starting deep-dive analysis/i.test(t);
    const loaded = /Evidence-Based Fit Intel|Industry-Specific Buying Intent|Social Signals|Fit Score:/i.test(t);
    return loaded && !stillLoading;
  }, { timeoutMs: 240000, label: 'account-detail-loaded' });
  await page.waitForTimeout(3000);
  await shot(page, 8, 'account-detail', 'Account Detail — buyer personas, competitor displacement, multi-threading stakeholder map, and cited intel per account.');

  // Close the detail. Try the specific Back button first, else fire the
  // Jarvis close event which the Dashboard listens for (this bypasses any
  // modal that might be blocking clicks).
  const closedViaButton = await safeClick(page, 'button[title="Back to accounts"]', { timeout: 3000 });
  if (!closedViaButton) {
    console.log('  Falling back to Jarvis event to close detail.');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('jarvis:dashboard', {
        detail: { action: 'dashboard.closeDetail' },
      }));
    });
  }
  await page.waitForTimeout(2500);

  // ------------------------------------------------------------------
  // 09. Jarvis voice assistant panel
  // ------------------------------------------------------------------
  const jarvisOpened = await safeClick(page, 'button[aria-label="Jarvis voice assistant"]', { timeout: 4000 });
  if (jarvisOpened) {
    await page.waitForTimeout(900); // panel fade-in
    await shot(page, 9, 'jarvis-voice', 'Jarvis — the always-on voice assistant that can navigate, explain, and control the workspace hands-free.');
    await safeClick(page, 'button[aria-label="Close Jarvis"]', { timeout: 2000 });
    await page.waitForTimeout(500);
  } else {
    console.warn('  ! Jarvis orb button not found — skipping screen 09.');
  }

  // ------------------------------------------------------------------
  // 10. Connect CRM System
  // ------------------------------------------------------------------
  const crmOpened = await safeClick(page, 'button:has-text("Connect CRM")', { timeout: 4000 });
  if (crmOpened) {
    await page.waitForSelector('text=Connect CRM System', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, 10, 'connect-crm', 'Connect CRM System — one-click sync of qualified accounts, personas, and outreach triggers into HubSpot, Salesforce, or Pipedrive.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.warn('  ! Connect CRM button not found — skipping screen 10.');
  }

  // ------------------------------------------------------------------
  // 11. Saved Reports library — save current, then open the library
  // ------------------------------------------------------------------
  // Wait for the Save Scope button to actually be visible + interactable.
  // After closing the detail there's a small transition where the button
  // is present but not clickable.
  await page.waitForTimeout(2000);
  let saved = false;
  try {
    await page.waitForSelector('button:has-text("Save Scope"), button:has-text("Save As")', { state: 'visible', timeout: 8000 });
    await page.click('button:has-text("Save Scope"), button:has-text("Save As")', { force: true });
    console.log('  Clicked Save Scope.');
    // Modal fade-in animation
    await page.waitForSelector('button:has-text("Confirm & Save Scope"), button:has-text("Confirm")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Confirm & Save Scope"), button:has-text("Confirm")');
    console.log('  Confirmed Save Scope.');
    saved = true;
    await page.waitForTimeout(1500);
  } catch (e) {
    console.warn(`  ! Save Scope flow failed: ${e?.message?.slice(0, 100)}. Library will show empty state.`);
  }

  // Open the Saved Reports library.
  let openedLib = false;
  if (saved) {
    // After saving, "Show Reports" button appears on Dashboard.
    for (const sel of ['button:has-text("Show Reports")', 'button:has-text("Saved Reports")']) {
      try {
        await page.waitForSelector(sel, { state: 'visible', timeout: 3000 });
        await page.click(sel);
        openedLib = true;
        console.log(`  Opened saved-reports via ${sel}`);
        break;
      } catch {}
    }
  }
  if (!openedLib) {
    // Fallback: navigate to landing then click Saved Reports in the header.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Header shows "Saved Reports" tab.
    for (const sel of ['button:has-text("Saved Reports")', 'a:has-text("Saved Reports")']) {
      try {
        await page.waitForSelector(sel, { state: 'visible', timeout: 4000 });
        await page.click(sel);
        openedLib = true;
        console.log(`  Opened saved-reports via fallback nav (${sel})`);
        break;
      } catch {}
    }
  }
  await page.waitForTimeout(2500);
  await shot(page, 11, 'saved-reports', 'Saved Reports library — every analyzed scope preserved as a re-openable "market scope" with company + lead counts.');

  // ------------------------------------------------------------------
  // Write manifest.json
  // ------------------------------------------------------------------
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), viewport: VIEWPORT, screens: manifest }, null, 2));
  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`Captured ${manifest.length} screens in ${OUT_DIR}\n`);

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error('capture-screens failed:', err);
  process.exit(1);
});
