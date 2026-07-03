// One-shot: bump `font-medium` back to `font-semibold` on <h1>..<h6> tag lines.
// Used to correct an over-demotion from running the softening sweep twice.
//
// Run with: node scripts/bump-h-tag-weight.mjs <file> [<file>...]

import fs from 'node:fs';

const HEADING_LINE_RE = /<h[1-6][\s>]/;
const TOKEN_RE = /(^|[\s"'`{(])font-medium(?![\w-])/;

const files = process.argv.slice(2);
let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!HEADING_LINE_RE.test(lines[i])) continue;
    const next = lines[i].replace(TOKEN_RE, (_m, pre) => `${pre}font-semibold`);
    if (next !== lines[i]) { lines[i] = next; count++; }
  }
  if (count > 0) fs.writeFileSync(file, lines.join('\n'));
  console.log(`${file}: ${count} bumps`);
  total += count;
}
console.log(`Total: ${total} h-tag bumps back to font-semibold`);
