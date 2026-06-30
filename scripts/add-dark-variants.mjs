// One-shot sweep: append dark: variants to common hardcoded Tailwind color classes.
// Run with: node scripts/add-dark-variants.mjs <file> [<file>...]
// Idempotent: skips classes that already have a matching dark: sibling in the same
// class string.

import fs from 'node:fs';

// Slate / white chrome mappings.
const SLATE_MAP = {
  'bg-white': 'dark:bg-slate-900',
  'bg-slate-50': 'dark:bg-slate-800/50',
  'bg-slate-100': 'dark:bg-slate-800',
  'bg-slate-150': 'dark:bg-slate-800',
  'bg-slate-200': 'dark:bg-slate-700',
  'bg-slate-300': 'dark:bg-slate-700',

  'text-slate-900': 'dark:text-slate-100',
  'text-slate-850': 'dark:text-slate-200',
  'text-slate-800': 'dark:text-slate-200',
  'text-slate-700': 'dark:text-slate-300',
  'text-slate-650': 'dark:text-slate-400',
  'text-slate-600': 'dark:text-slate-400',
  'text-slate-500': 'dark:text-slate-400',
  'text-slate-400': 'dark:text-slate-500',
  'text-slate-350': 'dark:text-slate-500',
  'text-slate-300': 'dark:text-slate-500',

  'border-slate-100': 'dark:border-slate-800',
  'border-slate-150': 'dark:border-slate-700',
  'border-slate-200': 'dark:border-slate-700',
  'border-slate-250': 'dark:border-slate-700',
  'border-slate-300': 'dark:border-slate-700',
};

// Accent palettes used for chips, badges, tinted panels.
const ACCENTS = [
  'indigo', 'emerald', 'amber', 'red', 'rose', 'sky', 'blue',
  'teal', 'purple', 'orange', 'violet', 'pink', 'cyan', 'fuchsia',
  'green', 'yellow',
];

// Builds dark variant entries for each accent palette.
// Strategy:
//   bg-{c}-50  -> dark:bg-{c}-950/40   (subtle tinted backdrop)
//   bg-{c}-100 -> dark:bg-{c}-900/40
//   bg-{c}-200 -> dark:bg-{c}-900/60
//   border-{c}-100/150/200/250 -> dark:border-{c}-800/40
//   text-{c}-600/700/800/900   -> dark:text-{c}-300/200 (lighter for contrast)
const ACCENT_MAP = {};
for (const c of ACCENTS) {
  ACCENT_MAP[`bg-${c}-50`]   = `dark:bg-${c}-950/40`;
  ACCENT_MAP[`bg-${c}-55`]   = `dark:bg-${c}-950/40`;
  ACCENT_MAP[`bg-${c}-100`]  = `dark:bg-${c}-900/40`;
  ACCENT_MAP[`bg-${c}-200`]  = `dark:bg-${c}-900/60`;

  ACCENT_MAP[`border-${c}-100`] = `dark:border-${c}-800/50`;
  ACCENT_MAP[`border-${c}-150`] = `dark:border-${c}-800/50`;
  ACCENT_MAP[`border-${c}-200`] = `dark:border-${c}-800/60`;
  ACCENT_MAP[`border-${c}-250`] = `dark:border-${c}-800/60`;
  ACCENT_MAP[`border-${c}-300`] = `dark:border-${c}-700/60`;

  ACCENT_MAP[`text-${c}-900`] = `dark:text-${c}-200`;
  ACCENT_MAP[`text-${c}-850`] = `dark:text-${c}-200`;
  ACCENT_MAP[`text-${c}-800`] = `dark:text-${c}-200`;
  ACCENT_MAP[`text-${c}-700`] = `dark:text-${c}-300`;
  ACCENT_MAP[`text-${c}-650`] = `dark:text-${c}-300`;
  ACCENT_MAP[`text-${c}-600`] = `dark:text-${c}-300`;
}

const MAP = { ...SLATE_MAP, ...ACCENT_MAP };

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transform(src) {
  let out = src;
  let total = 0;

  for (const [light, dark] of Object.entries(MAP)) {
    // Anchor: leading whitespace/quote/backtick/brace/paren, then exact token,
    // then NOT another word-char or hyphen (so `slate-50` won't match in `slate-500`).
    const re = new RegExp(
      `(^|[\\s"'\`{(])` + esc(light) + `(?![\\w-])`,
      'g'
    );

    out = out.replace(re, (match, lead, offset) => {
      // Find the surrounding class string boundaries to check idempotency.
      const startIdx = offset + lead.length;
      const quoteChars = new Set(['"', "'", '`']);
      let qStart = startIdx;
      while (qStart > 0 && !quoteChars.has(out[qStart - 1]) && out[qStart - 1] !== '{') {
        qStart--;
        if (out[qStart] === '\n') break;
      }
      let qEnd = startIdx;
      while (qEnd < out.length && !quoteChars.has(out[qEnd]) && out[qEnd] !== '}' && out[qEnd] !== '\n') {
        qEnd++;
      }
      const classStr = out.slice(qStart, qEnd);
      if (classStr.includes(dark)) return match;
      total++;
      return `${lead}${light} ${dark}`;
    });
  }

  return { out, total };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/add-dark-variants.mjs <file> [<file>...]');
  process.exit(1);
}

let grandTotal = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, total } = transform(src);
  if (total > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${total} additions`);
  grandTotal += total;
}
console.log(`Total: ${grandTotal} dark variant additions`);
