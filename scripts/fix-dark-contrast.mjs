// Fixes contrast-reducing dark variants the prior sweep introduced and adds
// dark variants for accent text-{color}-{400|500} icon colors.
// Run with: node scripts/fix-dark-contrast.mjs <file> [<file>...]

import fs from 'node:fs';

const ACCENTS = [
  'indigo', 'emerald', 'amber', 'red', 'rose', 'sky', 'blue',
  'teal', 'purple', 'orange', 'violet', 'pink', 'cyan', 'fuchsia',
  'green', 'yellow',
];

// Step 1: literal corrections for the wrong-direction mappings I previously
// applied. Removing the dark: variant leaves the source slate shade active in
// both modes — these slate-300/350/400 shades were typically already placed on
// dark/colored backgrounds where they read fine without inversion.
const LITERAL_FIXES = [
  ['text-slate-300 dark:text-slate-500', 'text-slate-300'],
  ['text-slate-350 dark:text-slate-500', 'text-slate-350'],
  ['text-slate-400 dark:text-slate-500', 'text-slate-400'],
  // Bump secondary body text one stop lighter for stronger contrast on dark bg.
  ['text-slate-500 dark:text-slate-400', 'text-slate-500 dark:text-slate-300'],
  ['text-slate-600 dark:text-slate-400', 'text-slate-600 dark:text-slate-300'],
];

// Step 2: anchored-token additions for accent text shades we missed.
const ACCENT_ADDS = {};
for (const c of ACCENTS) {
  ACCENT_ADDS[`text-${c}-500`] = `dark:text-${c}-400`;
  ACCENT_ADDS[`text-${c}-400`] = `dark:text-${c}-300`;
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transform(src) {
  let out = src;
  let fixes = 0;
  let adds = 0;

  for (const [from, to] of LITERAL_FIXES) {
    const re = new RegExp(esc(from), 'g');
    out = out.replace(re, () => {
      fixes++;
      return to;
    });
  }

  for (const [light, dark] of Object.entries(ACCENT_ADDS)) {
    const re = new RegExp(
      `(^|[\\s"'\`{(])` + esc(light) + `(?![\\w-])`,
      'g'
    );
    out = out.replace(re, (match, lead, offset) => {
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
      adds++;
      return `${lead}${light} ${dark}`;
    });
  }

  return { out, fixes, adds };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/fix-dark-contrast.mjs <file> [<file>...]');
  process.exit(1);
}

let totalFixes = 0;
let totalAdds = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const { out, fixes, adds } = transform(src);
  if (fixes + adds > 0) fs.writeFileSync(file, out);
  console.log(`${file}: ${fixes} fixes, ${adds} adds`);
  totalFixes += fixes;
  totalAdds += adds;
}
console.log(`Total: ${totalFixes} fixes, ${totalAdds} adds`);
