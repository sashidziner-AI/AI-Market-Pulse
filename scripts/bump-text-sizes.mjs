// Bump the very small arbitrary `text-[Npx]` font-sizes used throughout the UI
// so dense panels remain readable. Only touches sizes <= 11.5px; anything
// larger is left alone.
//
// Run with: node scripts/bump-text-sizes.mjs <file> [<file>...]

import fs from 'node:fs';

// Explicit map of {old: new}, all in px. Anything not in the map is left alone.
const MAP = {
  '8': '10',
  '8.5': '10',
  '9': '11',
  '9.5': '11',
  '10': '12',
  '10.5': '12',
  '11': '13',
  '11.5': '13',
};

const RE = /text-\[(\d+(?:\.\d+)?)px\]/g;

function transform(src) {
  let count = 0;
  const out = src.replace(RE, (match, num) => {
    const next = MAP[num];
    if (!next) return match;
    count++;
    return `text-[${next}px]`;
  });
  return { out, count };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/bump-text-sizes.mjs <file> [<file>...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, count } = transform(src);
  if (count > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${count} bumps`);
  total += count;
}
console.log(`Total: ${total} text-size bumps`);
