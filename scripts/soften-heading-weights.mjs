// Reduce font-weight class on heading tags (<h1>..<h6>) by one step.
// Leaves body text, buttons, labels, values alone.
//
// Mapping applied per line that contains an opening heading tag:
//   font-extrabold -> font-bold
//   font-bold      -> font-semibold
//   font-semibold  -> font-medium
//
// Idempotent-ish: re-running will keep stepping weights down until they hit
// font-medium, so run once.
//
// Run with: node scripts/soften-heading-weights.mjs <file> [<file>...]

import fs from 'node:fs';

// Order matters: do heavier swaps first so we don't cascade a class down twice
// in a single pass. e.g. font-bold -> font-semibold, then later
// font-semibold -> font-medium would demote it twice. We stop after the first
// applicable mapping per line.
const STEPS = [
  ['font-extrabold', 'font-bold'],
  ['font-bold', 'font-semibold'],
  ['font-semibold', 'font-medium'],
];

// Match opening tags for <h1>..<h6> as well as heading-equivalent components
// like <DialogTitle>.
const HEADING_LINE_RE = /<(h[1-6]|DialogTitle)[\s>]/;

// Anchor same pattern as sibling scripts.
function makeRegex(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s"'\`{(])${escaped}(?![\\w-])`);
}

function transform(src) {
  const lines = src.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!HEADING_LINE_RE.test(lines[i])) continue;
    for (const [oldTok, newTok] of STEPS) {
      const re = makeRegex(oldTok);
      if (re.test(lines[i])) {
        lines[i] = lines[i].replace(re, (_m, pre) => `${pre}${newTok}`);
        count++;
        break; // one-step-per-line
      }
    }
  }
  return { out: lines.join('\n'), count };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/soften-heading-weights.mjs <file> [<file>...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, count } = transform(src);
  if (count > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${count} heading weight reductions`);
  total += count;
}
console.log(`Total: ${total} heading weight reductions`);
