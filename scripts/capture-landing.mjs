/**
 * Landing page section-by-section capture + narration.
 *
 * The default landing screenshot is a full-page 1440x9256 image. When it's
 * scaled down into a 1440x900 slideshow frame the text shrinks to unreadable
 * size. This script instead scrolls to each named landing section, waits for
 * animations to settle, and captures the viewport (1440x900) — so every
 * section is presented at full readable size in the final video.
 *
 * It also generates a matching TTS narration MP3 per section via the app's
 * /api/jarvis/tts endpoint, saved as chunk-landing-<slug>.mp3 next to the
 * existing chunk-NN.mp3 files. build-slideshow.mjs consumes these directly.
 *
 * Usage:  node scripts/capture-landing.mjs
 * Requires: dev server running at http://localhost:3000
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000/';
const OUT_DIR = path.resolve('outputs/screenshots');
const CHUNKS_DIR = path.resolve('outputs/video/_narration-chunks');
const VIEWPORT = { width: 1440, height: 900 };
const VOICE = process.env.TTS_VOICE || 'onyx';

// Each landing section: an anchor id to scroll to (or null for the top hero),
// the output filename, a short label, and the spoken narration for that shot.
const SECTIONS = [
  {
    id: null,
    file: 'landing-01-hero.png',
    label: 'Hero',
    narration:
      'Welcome to AI Market Pulse. Every B2B team burns weeks turning a company website into a real go-to-market plan. We compress that whole process into about forty seconds. Paste any URL and get back an ideal customer profile, target accounts, buying committees, and a way to reach out.',
  },
  {
    id: 'features',
    file: 'landing-02-features.png',
    label: 'Features',
    narration:
      'Six pillars power the workspace — ICP generation, account discovery, deep intelligence per account, partner routing, voice control, and saved market scopes. Every capability plugs into a single continuous story instead of forcing you across five different tools.',
  },
  {
    id: 'how',
    file: 'landing-03-how.png',
    label: 'How it works',
    narration:
      'The pipeline runs in four stages. First, analyze the source page. Then discover fit-scored accounts. Build detailed buyer intelligence per account with citations. And finally cluster them into pursuit-ready segments. All in about a minute of real model time.',
  },
  {
    id: 'capabilities',
    file: 'landing-04-capabilities.png',
    label: 'Capabilities',
    narration:
      'Beyond discovery, the workspace ships with partner-pathway routing, lead enrichment via Hunter dot io, a full account brief with tiered citations, and voice control end-to-end. This is a complete pre-sales workspace, not just a research tool.',
  },
  {
    id: 'market',
    file: 'landing-05-market.png',
    label: 'Market opportunity',
    narration:
      'The problem is worth solving. B2B teams globally spend billions of hours a year on manual account research. Even a fractional efficiency gain against that number is real leverage for a sales organization.',
  },
  {
    id: 'cta',
    file: 'landing-06-cta.png',
    label: 'Call to action',
    narration:
      'Ready to try it on your own market? Paste a URL and hit Analyze. That is the whole surface. Now let us actually run it.',
  },
];

async function fetchTtsMp3(text, outPath) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/jarvis/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: VOICE }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buffer);
  return buffer.length;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CHUNKS_DIR, { recursive: true });

  console.log(`Launching Chromium at ${BASE_URL}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    permissions: ['microphone'],
    locale: 'en-US',
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  // Clear stale state so we always land on the marketing page.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------------
  // 1. Capture each section as a viewport screenshot.
  // -------------------------------------------------------------------
  for (const sec of SECTIONS) {
    if (sec.id === null) {
      // Hero: scroll to top.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    } else {
      const found = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        // Scroll so the section top aligns near the viewport top, leaving a
        // little breathing room below the sticky header (~64px).
        const y = el.getBoundingClientRect().top + window.scrollY - 40;
        window.scrollTo({ top: y, behavior: 'instant' });
        return true;
      }, sec.id);
      if (!found) {
        console.warn(`  ! Section #${sec.id} not found — skipping ${sec.file}`);
        continue;
      }
    }
    // Let GSAP scroll-trigger animations catch up.
    await page.waitForTimeout(1200);
    const outPath = path.join(OUT_DIR, sec.file);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  [${sec.file}] captured — ${sec.label}`);
  }

  await browser.close();

  // -------------------------------------------------------------------
  // 2. Generate TTS narration MP3 for each section.
  //    Named chunks (chunk-landing-<slug>.mp3) sit alongside numeric chunks.
  // -------------------------------------------------------------------
  console.log('\nGenerating landing narration TTS chunks...');
  for (const sec of SECTIONS) {
    const slug = sec.file.replace(/^landing-\d+-/, '').replace(/\.png$/, '');
    const outPath = path.join(CHUNKS_DIR, `chunk-landing-${slug}.mp3`);
    if (fsSync.existsSync(outPath)) {
      console.log(`  chunk-landing-${slug}.mp3 — already exists, skipping`);
      continue;
    }
    const bytes = await fetchTtsMp3(sec.narration, outPath);
    console.log(`  chunk-landing-${slug}.mp3 — ${(bytes / 1024).toFixed(1)} KB`);
  }

  console.log('\n✓ Landing section shots + narration ready.');
  console.log('  Next: node scripts/build-slideshow.mjs');
}

main().catch((err) => {
  console.error('\ncapture-landing failed:', err.message);
  process.exit(1);
});
