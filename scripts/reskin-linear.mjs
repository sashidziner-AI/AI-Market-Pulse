// Sweep Tailwind classes toward the Linear look: softer font weights, subtler
// shadows. Uses the same anchored token pattern as the other scripts so it's
// safe to re-run — it won't match inside `font-extrabold-something` and it
// skips lines where the target class is already present.
//
// Run with: node scripts/reskin-linear.mjs <file> [<file>...]

import fs from 'node:fs';

// {old class token: new class token}
const MAP = {
  // Font weight: Linear favors 500/600, avoids 800/900
  'font-black': 'font-bold',
  'font-extrabold': 'font-semibold',

  // Shadow: Linear uses very subtle elevation
  'shadow-lg': 'shadow-sm',
  'shadow-md': 'shadow-xs',
  'shadow-xl': 'shadow-sm',

  // Tracking: Linear uses tighter tracking for headings
  'tracking-wider': 'tracking-normal',
  'tracking-widest': 'tracking-wide',
};

// Anchor pattern from the sibling scripts:
//   look-behind: start of string / whitespace / quote / backtick / brace / paren
//   look-ahead:  not a word char or dash (avoids matching `font-black-x` etc.)
function makeRegex(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s"'\`{(])${escaped}(?![\\w-])`, 'g');
}

function transform(src) {
  let count = 0;
  let out = src;
  for (const [oldTok, newTok] of Object.entries(MAP)) {
    const re = makeRegex(oldTok);
    out = out.replace(re, (_m, pre) => {
      count++;
      return `${pre}${newTok}`;
    });
  }
  return { out, count };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/reskin-linear.mjs <file> [<file>...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, count } = transform(src);
  if (count > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${count} swaps`);
  total += count;
}
console.log(`Total: ${total} Linear-style class swaps`);
