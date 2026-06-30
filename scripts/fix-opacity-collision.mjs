// Fixes the `/N/N` opacity-collision bug introduced by add-dark-variants.mjs.
//
// The original code had e.g. `bg-indigo-50/20`. The sweep regex matched
// `bg-indigo-50` (since `/` was not excluded by the negative lookahead) and
// inserted `dark:bg-indigo-950/40` directly after the match, leaving the
// original `/20` stranded onto the new class:
//
//   `bg-indigo-50 dark:bg-indigo-950/40/20`
//
// In Tailwind this means:
//   - Light: bg-indigo-50 (lost the intended /20)
//   - Dark:  invalid class (Tailwind ignores it)
//
// Fix: move the trailing `/N` back to the light class.
//
//   `bg-indigo-50/20 dark:bg-indigo-950/40`

import fs from 'node:fs';

// Properties Tailwind opacity-modifiers apply to.
const PROPS = '(?:bg|border|text|ring|from|to|via|fill|stroke|outline|divide|placeholder|caret|accent|decoration|shadow)';

// Capture:
//   $1 = light class token (no opacity)
//   $2 = whitespace separator
//   $3 = dark class token incl. its /opacity
//   $4 = stranded opacity that originally belonged to $1
const RE = new RegExp(
  `(\\b${PROPS}-[a-z]+-\\d+)(\\s+)(dark:${PROPS}-[a-z]+-\\d+/\\d+)/(\\d+)`,
  'g'
);

function transform(src) {
  let count = 0;
  const out = src.replace(RE, (_m, light, ws, dark, origOpac) => {
    count++;
    return `${light}/${origOpac}${ws}${dark}`;
  });
  return { out, count };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/fix-opacity-collision.mjs <file> [<file>...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, count } = transform(src);
  if (count > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${count} fixes`);
  total += count;
}
console.log(`Total: ${total} opacity-collision fixes`);
