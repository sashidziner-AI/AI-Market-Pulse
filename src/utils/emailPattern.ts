/**
 * Email-pattern engine — hackathon Phase B.
 *
 * Two responsibilities:
 *   1. Given a handful of known-good emails at a company, DETECT the pattern
 *      the company uses (e.g. `{first}.{last}@` vs `{f}{last}@`).
 *   2. Given a person's name + domain + pattern, APPLY the pattern to
 *      produce a best-guess email with a confidence score.
 *
 * All functions are pure — no network, no I/O. The Hunter.io integration
 * lives in server.ts and hands sample emails to `detectPattern`.
 */

export type EmailPatternKey =
  | 'first.last'
  | 'firstlast'
  | 'flast'
  | 'first_last'
  | 'lastf'
  | 'first'
  | 'last'
  | 'first-last'
  | 'firstl'
  | 'unknown';

export type EmailConfidence = 'verified' | 'probable' | 'guess' | 'unknown';

export interface EmailSample {
  firstName: string;
  lastName: string;
  email: string;
}

export interface DetectedPattern {
  pattern: EmailPatternKey;
  template: string; // human-readable, e.g. "{first}.{last}@{domain}"
  confidence: EmailConfidence;
  supportingSamples: number; // how many samples matched the winning pattern
  totalSamples: number;
}

export interface EmailGuess {
  email: string;
  pattern: EmailPatternKey;
  confidence: EmailConfidence;
  reason: string; // short human-readable justification
}

/**
 * Normalize a name token for use in an email local-part.
 * - Lowercase
 * - Strip accents (é → e)
 * - Drop anything that isn't a-z0-9
 */
export function normalizeNameToken(raw: string): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize a domain: strip protocol, path, and leading `www.`.
 * Falls back to the raw input if it doesn't look like a URL.
 */
export function normalizeDomain(raw: string): string {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return '';
  try {
    const url = new URL(s.includes('://') ? s : `https://${s}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * The pattern bank. Each entry knows how to build a local-part from a
 * (firstName, lastName) pair. Order matters only for reporting — matching
 * is exhaustive.
 */
const PATTERN_BANK: { key: EmailPatternKey; template: string; build: (f: string, l: string) => string }[] = [
  { key: 'first.last',  template: '{first}.{last}@{domain}',  build: (f, l) => `${f}.${l}` },
  { key: 'firstlast',   template: '{first}{last}@{domain}',   build: (f, l) => `${f}${l}` },
  { key: 'flast',       template: '{f}{last}@{domain}',       build: (f, l) => `${f.charAt(0)}${l}` },
  { key: 'first_last',  template: '{first}_{last}@{domain}',  build: (f, l) => `${f}_${l}` },
  { key: 'lastf',       template: '{last}{f}@{domain}',       build: (f, l) => `${l}${f.charAt(0)}` },
  { key: 'first',       template: '{first}@{domain}',         build: (f) => f },
  { key: 'last',        template: '{last}@{domain}',          build: (_, l) => l },
  { key: 'first-last',  template: '{first}-{last}@{domain}',  build: (f, l) => `${f}-${l}` },
  { key: 'firstl',      template: '{first}{l}@{domain}',      build: (f, l) => `${f}${l.charAt(0)}` },
];

/**
 * Detect the shared email pattern across a bag of known-good samples.
 *
 * Tallies which pattern each sample matches, then returns the pattern with
 * the most support. Confidence tiers:
 *   - `verified`  ≥ 3 samples agree AND ≥ 60% of the bag agrees
 *   - `probable`  2 samples agree, OR 1 sample if it's the only one
 *   - `guess`     no clear winner — falls back to `first.last`
 *   - `unknown`   empty input
 */
export function detectPattern(samples: EmailSample[]): DetectedPattern {
  if (!samples || samples.length === 0) {
    return {
      pattern: 'unknown',
      template: '{first}.{last}@{domain}',
      confidence: 'unknown',
      supportingSamples: 0,
      totalSamples: 0,
    };
  }

  const tally = new Map<EmailPatternKey, number>();

  for (const s of samples) {
    const first = normalizeNameToken(s.firstName);
    const last = normalizeNameToken(s.lastName);
    const local = (s.email ?? '').toLowerCase().split('@')[0];
    if (!first || !last || !local) continue;

    for (const p of PATTERN_BANK) {
      if (p.build(first, last) === local) {
        tally.set(p.key, (tally.get(p.key) ?? 0) + 1);
      }
    }
  }

  if (tally.size === 0) {
    return {
      pattern: 'unknown',
      template: '{first}.{last}@{domain}',
      confidence: 'guess',
      supportingSamples: 0,
      totalSamples: samples.length,
    };
  }

  let winnerKey: EmailPatternKey = 'first.last';
  let winnerCount = 0;
  for (const [key, count] of tally.entries()) {
    if (count > winnerCount) {
      winnerKey = key;
      winnerCount = count;
    }
  }

  const winner = PATTERN_BANK.find((p) => p.key === winnerKey)!;
  const ratio = winnerCount / samples.length;

  let confidence: EmailConfidence;
  if (winnerCount >= 3 && ratio >= 0.6) confidence = 'verified';
  else if (winnerCount >= 2) confidence = 'probable';
  else confidence = 'guess';

  return {
    pattern: winnerKey,
    template: winner.template,
    confidence,
    supportingSamples: winnerCount,
    totalSamples: samples.length,
  };
}

/**
 * Apply a known pattern to a person to produce a guessed email.
 * If pattern is 'unknown', we default to `first.last@` and mark it as a guess.
 */
export function applyPattern(
  pattern: EmailPatternKey,
  firstName: string,
  lastName: string,
  domain: string,
): EmailGuess {
  const f = normalizeNameToken(firstName);
  const l = normalizeNameToken(lastName);
  const d = normalizeDomain(domain);

  if (!f || !l || !d) {
    return {
      email: '',
      pattern: 'unknown',
      confidence: 'unknown',
      reason: 'Missing first name, last name, or domain.',
    };
  }

  const chosenKey: EmailPatternKey = pattern === 'unknown' ? 'first.last' : pattern;
  const entry = PATTERN_BANK.find((p) => p.key === chosenKey) ?? PATTERN_BANK[0];
  const local = entry.build(f, l);

  return {
    email: `${local}@${d}`,
    pattern: chosenKey,
    confidence: pattern === 'unknown' ? 'guess' : 'probable',
    reason:
      pattern === 'unknown'
        ? `No learned pattern for ${d} yet — defaulted to first.last@ (industry norm).`
        : `Applied learned pattern ${entry.template} for ${d}.`,
  };
}

/**
 * Convenience helper: end-to-end detect + apply.
 * Used when the caller already has samples in hand and just wants a guess.
 */
export function guessEmailFromSamples(
  firstName: string,
  lastName: string,
  domain: string,
  samples: EmailSample[],
): EmailGuess & { detected: DetectedPattern } {
  const detected = detectPattern(samples);
  const applied = applyPattern(detected.pattern, firstName, lastName, domain);
  return {
    ...applied,
    confidence: detected.confidence === 'verified' ? 'probable' : applied.confidence,
    detected,
  };
}
