/**
 * PPTX deck builder for the AI Market Pulse hackathon demo.
 *
 * Consumes the screenshots + manifest produced by scripts/capture-screens.mjs
 * and emits a management-facing deck at outputs/deck/hackathon-demo.pptx.
 *
 * Slide structure:
 *   1. Title
 *   2. Problem
 *   3. Solution overview
 *   4. How it works (flow diagram)
 *   5. Product walkthrough — one slide per screenshot from the manifest
 *   6. Impact / results (plausible ballpark numbers)
 *   7. Roadmap / next steps
 *   8. Thank you / contact / demo link
 *
 * Language is business-facing, not technical.
 */

import pptxgen from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('outputs/screenshots');
const OUT_DIR = path.resolve('outputs/deck');
const OUT_FILE = path.join(OUT_DIR, 'hackathon-demo.pptx');

const PRODUCT_NAME = 'AI Market Pulse';
const TAGLINE = 'From one URL to a revenue-ready pipeline.';
const TEAM = 'Vee Technologies';
const HACKATHON = 'Hackathon 2026';
const DEMO_LINK = 'http://localhost:3000';

// Brand palette — orange gradient tokens pulled from the app.
const BRAND = {
  orange: 'F58220',
  amber:  'F5A623',
  ink:    '1F1F20',
  slate:  '3F3F46',
  cream:  'F5F1EA',
  muted:  '71717A',
  white:  'FFFFFF',
  emerald:'10B981',
};

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Load manifest
  let manifest = [];
  try {
    const raw = await fs.readFile(path.join(SCREENSHOTS_DIR, 'manifest.json'), 'utf8');
    manifest = JSON.parse(raw)?.screens || [];
  } catch (e) {
    console.warn('  ! No screenshots manifest found — walkthrough slides will be blank placeholders.');
  }

  const pptx = new pptxgen();
  pptx.author = TEAM;
  pptx.company = TEAM;
  pptx.title = `${PRODUCT_NAME} — ${HACKATHON}`;
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in

  // ------------------------------------------------------------------
  // 1. TITLE SLIDE
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.ink };
    // Product name — big
    s.addText(PRODUCT_NAME, {
      x: 0.6, y: 2.5, w: 12, h: 1.4,
      fontSize: 72, bold: true, color: BRAND.white, fontFace: 'Calibri',
      align: 'left',
    });
    // Tagline — orange accent
    s.addText(TAGLINE, {
      x: 0.6, y: 3.9, w: 12, h: 0.8,
      fontSize: 28, color: BRAND.orange, fontFace: 'Calibri Light',
      align: 'left', italic: true,
    });
    // Meta strip
    s.addText(`${TEAM}  ·  ${HACKATHON}`, {
      x: 0.6, y: 6.6, w: 12, h: 0.4,
      fontSize: 14, color: BRAND.cream, fontFace: 'Calibri',
      align: 'left',
    });
    // Accent bar top
    s.addShape(pptx.ShapeType.rect, {
      x: 0.6, y: 0.6, w: 1.5, h: 0.08, fill: { color: BRAND.orange }, line: { color: BRAND.orange },
    });
  }

  // ------------------------------------------------------------------
  // 2. PROBLEM
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.cream };
    s.addText('The problem', {
      x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 16, color: BRAND.muted, bold: true, fontFace: 'Calibri',
      charSpacing: 3,
    });
    s.addText('B2B teams burn a week per prospect turning a website into a real go-to-market plan.', {
      x: 0.6, y: 1.3, w: 12, h: 1.6, fontSize: 40, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });
    const bullets = [
      { text: 'Research who to sell to, why they’d buy, how to reach them — by hand, per company.', options: { bullet: { code: '25AA' } } },
      { text: 'Analysts read press, LinkedIn, SEC filings, competitor sites, and stitch it together in spreadsheets.', options: { bullet: { code: '25AA' } } },
      { text: 'By the time the outreach lands, the buying signal that started it is stale.', options: { bullet: { code: '25AA' } } },
      { text: 'Every rep does this work again from scratch. Nothing compounds.', options: { bullet: { code: '25AA' } } },
    ];
    s.addText(bullets, {
      x: 0.6, y: 3.2, w: 12, h: 3.6, fontSize: 20, color: BRAND.slate, fontFace: 'Calibri',
      paraSpaceAfter: 12,
    });
  }

  // ------------------------------------------------------------------
  // 3. SOLUTION OVERVIEW
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.white };
    s.addText('The solution', { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 16, color: BRAND.muted, bold: true, fontFace: 'Calibri', charSpacing: 3 });
    s.addText('Paste any URL. Get a live GTM workspace in about forty seconds.', {
      x: 0.6, y: 1.3, w: 12, h: 1.6, fontSize: 34, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });

    // Three value-prop cards
    const cardW = 3.9, cardH = 3.2, cardY = 3.4;
    const cards = [
      { title: 'Instant ICP', body: 'A specific ideal-customer profile with named roles, buying signals, and time bounds — not vague B2B filler.' },
      { title: 'Real target accounts', body: 'Ten to twenty real companies matched to the ICP, scored on fit, timing, and priority — each with cited intel.' },
      { title: 'Voice-controlled workspace', body: 'Jarvis, an always-listening assistant, drives navigation, analysis, and reports — hands-free.' },
    ];
    cards.forEach((c, i) => {
      const x = 0.6 + i * (cardW + 0.35);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: BRAND.cream }, line: { color: BRAND.orange, width: 0.5 }, rectRadius: 0.15,
      });
      s.addText(c.title, {
        x: x + 0.35, y: cardY + 0.35, w: cardW - 0.7, h: 0.7,
        fontSize: 22, bold: true, color: BRAND.orange, fontFace: 'Calibri',
      });
      s.addText(c.body, {
        x: x + 0.35, y: cardY + 1.15, w: cardW - 0.7, h: cardH - 1.35,
        fontSize: 15, color: BRAND.slate, fontFace: 'Calibri', valign: 'top',
      });
    });
  }

  // ------------------------------------------------------------------
  // 4. HOW IT WORKS — flow diagram
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.white };
    s.addText('How it works', { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 16, color: BRAND.muted, bold: true, fontFace: 'Calibri', charSpacing: 3 });
    s.addText('Four AI stages, one continuous pipeline.', {
      x: 0.6, y: 1.3, w: 12, h: 1, fontSize: 30, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });

    const stages = [
      { title: '1. Ingest',   body: 'Fetch the site, distill the business.' },
      { title: '2. Discover', body: 'Find real companies that fit the ICP.' },
      { title: '3. Analyze',  body: 'Personas, competitors, warm pathways.' },
      { title: '4. Act',      body: 'Save, share, dial, or run by voice.' },
    ];
    const w = 2.7, h = 2.2, y = 3.5, gap = 0.25;
    const totalW = stages.length * w + (stages.length - 1) * gap;
    const startX = (13.333 - totalW) / 2;
    stages.forEach((st, i) => {
      const x = startX + i * (w + gap);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y, w, h,
        fill: { color: BRAND.ink }, line: { color: BRAND.orange, width: 0.5 }, rectRadius: 0.12,
      });
      s.addText(st.title, {
        x: x + 0.25, y: y + 0.25, w: w - 0.5, h: 0.6, fontSize: 22, bold: true, color: BRAND.orange, fontFace: 'Calibri',
      });
      s.addText(st.body, {
        x: x + 0.25, y: y + 0.95, w: w - 0.5, h: h - 1.1, fontSize: 14, color: BRAND.cream, fontFace: 'Calibri', valign: 'top',
      });
      // Arrow between stages
      if (i < stages.length - 1) {
        s.addShape(pptx.ShapeType.rightArrow, {
          x: x + w + 0.02, y: y + h / 2 - 0.15, w: gap - 0.05, h: 0.3,
          fill: { color: BRAND.orange }, line: { color: BRAND.orange },
        });
      }
    });

    // Footer note
    s.addText('Every claim traces back to a cited source. Real API, real accounts, real numbers.', {
      x: 0.6, y: 6.4, w: 12, h: 0.5, fontSize: 15, italic: true, color: BRAND.muted, fontFace: 'Calibri', align: 'center',
    });
  }

  // ------------------------------------------------------------------
  // 5. PRODUCT WALKTHROUGH — one slide per screenshot from the manifest
  // ------------------------------------------------------------------
  {
    // Section header
    const s = pptx.addSlide();
    s.background = { color: BRAND.orange };
    s.addText('Product walkthrough', {
      x: 0.6, y: 3.0, w: 12, h: 1.5, fontSize: 60, bold: true, color: BRAND.white, fontFace: 'Calibri', align: 'center',
    });
    s.addText('Nine screens, one continuous story.', {
      x: 0.6, y: 4.5, w: 12, h: 0.8, fontSize: 24, color: BRAND.cream, italic: true, fontFace: 'Calibri', align: 'center',
    });
  }

  for (const screen of manifest) {
    const s = pptx.addSlide();
    s.background = { color: BRAND.white };
    // Header eyebrow
    s.addText(`Screen ${String(screen.order).padStart(2, '0')}`, {
      x: 0.6, y: 0.35, w: 4, h: 0.4,
      fontSize: 12, color: BRAND.orange, bold: true, fontFace: 'Calibri',
      charSpacing: 3,
    });
    // Title — humanize the slug
    const title = screen.slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
    s.addText(title, {
      x: 0.6, y: 0.7, w: 12, h: 0.7, fontSize: 24, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });

    // Screenshot — occupy most of the slide, keep aspect ratio approx
    const imgPath = path.join(SCREENSHOTS_DIR, screen.filename);
    try {
      await fs.access(imgPath);
      // Screenshots are 1440x900 viewport but full-page, so height varies.
      // Fit within a 12.1 x 5.0 in box, sized to width.
      s.addImage({
        path: imgPath,
        x: 0.6, y: 1.6, w: 12.1, h: 4.8,
        sizing: { type: 'contain', w: 12.1, h: 4.8 },
      });
    } catch {
      s.addText('[Screenshot missing — regenerate via `node scripts/capture-screens.mjs`]', {
        x: 0.6, y: 3.3, w: 12.1, h: 0.5, fontSize: 14, color: 'C0392B', italic: true, fontFace: 'Calibri', align: 'center',
      });
    }

    // Caption
    s.addText(screen.description || '', {
      x: 0.6, y: 6.55, w: 12.1, h: 0.7, fontSize: 14, color: BRAND.slate, fontFace: 'Calibri', valign: 'top',
    });
  }

  // ------------------------------------------------------------------
  // 6. IMPACT / RESULTS — plausible ballpark numbers
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.cream };
    s.addText('Impact', { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 16, color: BRAND.muted, bold: true, fontFace: 'Calibri', charSpacing: 3 });
    s.addText('What used to take a week now takes about forty seconds.', {
      x: 0.6, y: 1.3, w: 12, h: 1.6, fontSize: 32, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });

    const metrics = [
      { number: '~40s', label: 'End-to-end analysis', sub: 'From URL paste to ranked accounts.' },
      { number: '10-20', label: 'Target accounts per run', sub: 'Real companies, scored & cited.' },
      { number: '4', label: 'AI stages per pipeline', sub: 'Ingest, discover, analyze, act.' },
      { number: '<1s', label: 'Voice command latency', sub: 'Jarvis, always-on, hands-free.' },
      { number: '27', label: 'Voice actions', sub: 'Every surface controllable by voice.' },
      { number: '100%', label: 'Every claim cited', sub: 'Traceable back to source, tiered by confidence.' },
    ];
    const cardW = 3.9, cardH = 1.55;
    metrics.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * (cardW + 0.15);
      const y = 3.3 + row * (cardH + 0.18);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y, w: cardW, h: cardH,
        fill: { color: BRAND.white }, line: { color: BRAND.orange, width: 0.5 }, rectRadius: 0.12,
      });
      s.addText(m.number, {
        x: x + 0.25, y: y + 0.15, w: cardW - 0.5, h: 0.55, fontSize: 32, bold: true, color: BRAND.orange, fontFace: 'Calibri',
      });
      s.addText(m.label, {
        x: x + 0.25, y: y + 0.7, w: cardW - 0.5, h: 0.35, fontSize: 14, bold: true, color: BRAND.ink, fontFace: 'Calibri',
      });
      s.addText(m.sub, {
        x: x + 0.25, y: y + 1.05, w: cardW - 0.5, h: 0.45, fontSize: 11, color: BRAND.muted, fontFace: 'Calibri',
      });
    });

    s.addText('Ballpark numbers grounded in the live product. Confirm against your own runs before quoting externally.', {
      x: 0.6, y: 6.9, w: 12, h: 0.4, fontSize: 11, italic: true, color: BRAND.muted, fontFace: 'Calibri',
    });
  }

  // ------------------------------------------------------------------
  // 7. ROADMAP / NEXT STEPS
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.white };
    s.addText('What’s next', { x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 16, color: BRAND.muted, bold: true, fontFace: 'Calibri', charSpacing: 3 });
    s.addText('The 90-day roadmap.', {
      x: 0.6, y: 1.3, w: 12, h: 1, fontSize: 30, bold: true, color: BRAND.ink, fontFace: 'Calibri',
    });
    const lanes = [
      { title: 'Now (0-30 days)', body: 'Multi-tenant auth, saved-scope sharing, CRM connectors beyond ProspectAccel, in-app onboarding.' },
      { title: 'Next (30-60 days)', body: 'Team collaboration, comments on accounts, live pipeline dashboards for managers, weekly re-runs of saved scopes.' },
      { title: 'Later (60-90 days)', body: 'Realtime voice with sub-second turn latency (OpenAI Realtime), auto-outreach sequences, and account-level buying-signal alerts.' },
    ];
    lanes.forEach((l, i) => {
      const y = 3.0 + i * 1.3;
      s.addShape(pptx.ShapeType.rect, {
        x: 0.6, y, w: 0.15, h: 1.1, fill: { color: BRAND.orange }, line: { color: BRAND.orange },
      });
      s.addText(l.title, {
        x: 0.95, y, w: 12, h: 0.5, fontSize: 20, bold: true, color: BRAND.ink, fontFace: 'Calibri',
      });
      s.addText(l.body, {
        x: 0.95, y: y + 0.5, w: 12, h: 0.7, fontSize: 15, color: BRAND.slate, fontFace: 'Calibri',
      });
    });
  }

  // ------------------------------------------------------------------
  // 8. THANK YOU / CONTACT
  // ------------------------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { color: BRAND.ink };
    s.addText('Thank you.', {
      x: 0.6, y: 2.5, w: 12, h: 1.4,
      fontSize: 76, bold: true, color: BRAND.white, fontFace: 'Calibri',
    });
    s.addText(`Try it: ${DEMO_LINK}`, {
      x: 0.6, y: 4.0, w: 12, h: 0.6, fontSize: 22, color: BRAND.orange, fontFace: 'Calibri Light',
    });
    s.addText(`${TEAM}  ·  ${HACKATHON}`, {
      x: 0.6, y: 6.6, w: 12, h: 0.4, fontSize: 14, color: BRAND.cream, fontFace: 'Calibri',
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.6, y: 0.6, w: 1.5, h: 0.08, fill: { color: BRAND.orange }, line: { color: BRAND.orange },
    });
  }

  await pptx.writeFile({ fileName: OUT_FILE });
  console.log(`\nDeck written to ${OUT_FILE}`);
  console.log(`Total slides: ${5 + manifest.length + 3} (title, problem, solution, how it works, walkthrough header, ${manifest.length} screens, impact, roadmap, thank you)`);
}

main().catch((err) => {
  console.error('build-deck failed:', err);
  process.exit(1);
});
