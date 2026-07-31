// Convert docs/ENTERPRISE_DOCUMENTATION.md → docs/ENTERPRISE_DOCUMENTATION.pdf
// Uses the already-installed Playwright devDep. Markdown → HTML via `marked`
// (CDN); Mermaid diagrams rendered client-side (CDN); Chromium prints to PDF.
//
// Run: node scripts/build-docs-pdf.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const MD_PATH = join(REPO_ROOT, 'docs', 'ENTERPRISE_DOCUMENTATION.md');
const PDF_PATH = join(REPO_ROOT, 'docs', 'ENTERPRISE_DOCUMENTATION.pdf');

const markdown = readFileSync(MD_PATH, 'utf-8');

// Wrap the markdown in a full HTML doc. `marked` parses everything; the
// mermaid `<pre class="language-mermaid">` blocks are then handed to mermaid.js
// which swaps them for rendered SVGs before we print.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AI Market Pulse — Enterprise Documentation</title>
<style>
  :root {
    --text: #1f2328;
    --muted: #656d76;
    --bg: #ffffff;
    --code-bg: #f6f8fa;
    --border: #d0d7de;
    --accent: #d97706;
    --link: #0969da;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11.5pt;
    line-height: 1.55;
    padding: 40px 56px;
    max-width: 100%;
  }
  h1, h2, h3, h4, h5, h6 { color: #111; line-height: 1.2; margin-top: 1.6em; margin-bottom: 0.6em; }
  h1 { font-size: 26pt; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-size: 18pt; border-bottom: 1px solid var(--border); padding-bottom: 0.25em; margin-top: 2em; }
  h3 { font-size: 14pt; }
  h4 { font-size: 12pt; color: #333; }
  p, ul, ol, table, pre, blockquote { margin: 0 0 0.9em; }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.88em;
    background: var(--code-bg);
    padding: 2px 5px;
    border-radius: 4px;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 14px;
    overflow-x: auto;
    font-size: 9.5pt;
    line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code { background: transparent; padding: 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
    page-break-inside: avoid;
  }
  th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; font-weight: 600; }
  blockquote {
    border-left: 4px solid var(--accent);
    padding: 4px 14px;
    color: var(--muted);
    background: #fff8ec;
    margin-left: 0;
  }
  hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
  .mermaid { text-align: center; page-break-inside: avoid; margin: 1em 0; }
  ul, ol { padding-left: 1.4em; }
  li { margin-bottom: 0.2em; }
  .toc { background: #f6f8fa; border: 1px solid var(--border); border-radius: 6px; padding: 16px 24px; }
  .cover {
    text-align: center;
    padding: 40vh 20px 0;
    page-break-after: always;
  }
  .cover h1 { font-size: 32pt; border: 0; padding: 0; margin-bottom: 0.4em; }
  .cover .subtitle { color: var(--muted); font-size: 13pt; }
  .cover .meta { margin-top: 3em; font-size: 10pt; color: var(--muted); font-family: monospace; }
  @page {
    size: A4;
    margin: 18mm 14mm 20mm;
  }
</style>
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
</head>
<body>

<div class="cover">
  <h1>AI Market Pulse</h1>
  <div class="subtitle">Enterprise Project Documentation</div>
  <div class="meta">
    Generated ${new Date().toISOString().slice(0, 10)}<br/>
    Branch: ui-ux · Version: v1.0
  </div>
</div>

<div id="content"></div>

<script id="md" type="text/plain">
${markdown.replace(/<\/script>/g, '<\\/script>')}
</script>

<script>
  const raw = document.getElementById('md').textContent;
  // Configure marked to emit language classes so we can detect mermaid blocks.
  marked.setOptions({ gfm: true, breaks: false });
  const renderer = new marked.Renderer();
  const originalCode = renderer.code.bind(renderer);
  renderer.code = function(code, lang) {
    if (lang === 'mermaid') {
      return '<div class="mermaid">' + code + '</div>';
    }
    return originalCode(code, lang);
  };
  const html = marked.parse(raw, { renderer });
  document.getElementById('content').innerHTML = html;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    flowchart: { htmlLabels: true, curve: 'basis' },
    sequence: { useMaxWidth: true },
    er: { useMaxWidth: true },
  });
  window.__mermaidReady = false;
  mermaid.run({ nodes: document.querySelectorAll('.mermaid') })
    .then(() => { window.__mermaidReady = true; })
    .catch((e) => { console.error('mermaid error', e); window.__mermaidReady = true; });
</script>
</body>
</html>`;

console.log('[build-docs-pdf] Launching Chromium...');
const browser = await chromium.launch();
const page = await browser.newPage();

// Some Mermaid + CDN loads produce noisy but non-fatal console errors; log
// only if debugging.
if (process.env.PDF_DEBUG === '1') {
  page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
}

await page.setContent(html, { waitUntil: 'networkidle' });

console.log('[build-docs-pdf] Waiting for Mermaid to render diagrams...');
await page.waitForFunction(() => window.__mermaidReady === true, { timeout: 60_000 });
// A brief extra tick to let layout settle after SVGs are injected.
await page.waitForTimeout(500);

console.log('[build-docs-pdf] Printing PDF -> ' + PDF_PATH);
await page.pdf({
  path: PDF_PATH,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '20mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:8pt;color:#888;width:100%;padding:0 14mm;text-align:right;">AI Market Pulse — Enterprise Documentation</div>',
  footerTemplate: '<div style="font-size:8pt;color:#888;width:100%;padding:0 14mm;display:flex;justify-content:space-between;"><span>Generated ' + new Date().toISOString().slice(0,10) + '</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
});

await browser.close();

const stats = await import('node:fs').then(m => m.statSync(PDF_PATH));
console.log('[build-docs-pdf] Done. Size: ' + (stats.size / 1024).toFixed(0) + ' KB');
