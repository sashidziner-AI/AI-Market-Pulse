// Country detection for scoping the Industry Discovery panel's Google Maps
// search. Uses ccTLDs first (strong signal), falls back to scanning the
// AI-generated analysis.overview text for a known country name.
//
// Returned name is the value we append to Google Places Text Search queries
// — Google is good at biasing results when the country name is in the query.

interface CountryHit {
  code: string; // ISO 3166-1 alpha-2 (lowercase)
  name: string; // English name Google recognizes
}

// ccTLD → { code, name }. Not exhaustive — covers the common ones seen in
// B2B SaaS/services sites. Extend as needed. Excludes truly generic TLDs
// (.com, .org, .net, .io, .co, .app, .ai, .dev) which don't imply a country.
const TLD_MAP: Record<string, CountryHit> = {
  us: { code: 'us', name: 'United States' },
  uk: { code: 'gb', name: 'United Kingdom' },
  gb: { code: 'gb', name: 'United Kingdom' },
  in: { code: 'in', name: 'India' },
  ca: { code: 'ca', name: 'Canada' },
  au: { code: 'au', name: 'Australia' },
  nz: { code: 'nz', name: 'New Zealand' },
  de: { code: 'de', name: 'Germany' },
  fr: { code: 'fr', name: 'France' },
  it: { code: 'it', name: 'Italy' },
  es: { code: 'es', name: 'Spain' },
  nl: { code: 'nl', name: 'Netherlands' },
  be: { code: 'be', name: 'Belgium' },
  ch: { code: 'ch', name: 'Switzerland' },
  at: { code: 'at', name: 'Austria' },
  se: { code: 'se', name: 'Sweden' },
  no: { code: 'no', name: 'Norway' },
  dk: { code: 'dk', name: 'Denmark' },
  fi: { code: 'fi', name: 'Finland' },
  ie: { code: 'ie', name: 'Ireland' },
  pt: { code: 'pt', name: 'Portugal' },
  pl: { code: 'pl', name: 'Poland' },
  jp: { code: 'jp', name: 'Japan' },
  sg: { code: 'sg', name: 'Singapore' },
  hk: { code: 'hk', name: 'Hong Kong' },
  kr: { code: 'kr', name: 'South Korea' },
  cn: { code: 'cn', name: 'China' },
  tw: { code: 'tw', name: 'Taiwan' },
  my: { code: 'my', name: 'Malaysia' },
  th: { code: 'th', name: 'Thailand' },
  ph: { code: 'ph', name: 'Philippines' },
  id: { code: 'id', name: 'Indonesia' },
  vn: { code: 'vn', name: 'Vietnam' },
  ae: { code: 'ae', name: 'United Arab Emirates' },
  sa: { code: 'sa', name: 'Saudi Arabia' },
  il: { code: 'il', name: 'Israel' },
  za: { code: 'za', name: 'South Africa' },
  br: { code: 'br', name: 'Brazil' },
  mx: { code: 'mx', name: 'Mexico' },
  ar: { code: 'ar', name: 'Argentina' },
  cl: { code: 'cl', name: 'Chile' },
  co: { code: 'co', name: 'Colombia' }, // NB: .co is also generic; ambiguous
};

// Second-level guards where ccTLD needs `.co.xx` or `.com.xx` disambiguation.
const SECOND_LEVEL_MAP: Record<string, CountryHit> = {
  'co.uk': { code: 'gb', name: 'United Kingdom' },
  'co.in': { code: 'in', name: 'India' },
  'com.au': { code: 'au', name: 'Australia' },
  'co.nz': { code: 'nz', name: 'New Zealand' },
  'co.jp': { code: 'jp', name: 'Japan' },
  'com.sg': { code: 'sg', name: 'Singapore' },
  'com.hk': { code: 'hk', name: 'Hong Kong' },
  'co.kr': { code: 'kr', name: 'South Korea' },
  'com.br': { code: 'br', name: 'Brazil' },
  'com.mx': { code: 'mx', name: 'Mexico' },
  'com.tr': { code: 'tr', name: 'Turkey' },
};

// Countries recognized in free-text (analysis.overview) fallback scans.
// Simple word-boundary regex per name. Order matters when names overlap
// (e.g. check "United Kingdom" before "United").
const TEXT_COUNTRIES: CountryHit[] = [
  { code: 'us', name: 'United States' },
  { code: 'us', name: 'USA' },
  { code: 'us', name: 'U.S.' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'gb', name: 'UK' },
  { code: 'gb', name: 'Britain' },
  { code: 'gb', name: 'England' },
  { code: 'in', name: 'India' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'it', name: 'Italy' },
  { code: 'es', name: 'Spain' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'ie', name: 'Ireland' },
  { code: 'jp', name: 'Japan' },
  { code: 'sg', name: 'Singapore' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'kr', name: 'South Korea' },
  { code: 'cn', name: 'China' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ph', name: 'Philippines' },
  { code: 'id', name: 'Indonesia' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'ae', name: 'UAE' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'il', name: 'Israel' },
  { code: 'za', name: 'South Africa' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
];

// Normalize a raw URL/domain input into its hostname suffix pieces.
function extractHostname(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return String(raw).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || null;
  }
}

function detectFromHostname(host: string | null): CountryHit | null {
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length < 2) return null;

  // Try second-level (co.uk, com.au) first — more specific.
  const lastTwo = parts.slice(-2).join('.');
  if (SECOND_LEVEL_MAP[lastTwo]) return SECOND_LEVEL_MAP[lastTwo];

  // Then plain ccTLD (.uk, .in, .de, ...).
  const tld = parts[parts.length - 1];
  if (TLD_MAP[tld]) return TLD_MAP[tld];

  return null;
}

function detectFromText(text?: string | null): CountryHit | null {
  if (!text) return null;
  // Bound the scan — overview is short, but AI output can occasionally be
  // long enough that a slow regex hurts.
  const haystack = String(text).slice(0, 4000);
  for (const c of TEXT_COUNTRIES) {
    // Word-boundary match, case-insensitive. Escape periods in names like "U.S.".
    const escaped = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z])${escaped}(?![A-Za-z])`, 'i');
    if (re.test(haystack)) return c;
  }
  return null;
}

// Try to match an AI-produced country name (e.g. "United Kingdom", "USA")
// against our canonical list so the panel can show the same code/name
// regardless of casing / synonyms the model used.
function detectFromName(rawName?: string | null): CountryHit | null {
  if (!rawName) return null;
  const needle = String(rawName).trim().toLowerCase();
  if (!needle) return null;
  // Exact match on any TEXT_COUNTRIES entry (case-insensitive).
  const exact = TEXT_COUNTRIES.find(c => c.name.toLowerCase() === needle);
  if (exact) return exact;
  // Partial: needle contains a known country name OR vice versa.
  const partial = TEXT_COUNTRIES.find(
    c => needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle)
  );
  if (partial) return partial;
  return null;
}

// Public entry point used by MapsPanel. Priority:
//   1. Explicit AI-derived country from BusinessAnalysis.country
//   2. Domain ccTLD (e.g. .co.uk → United Kingdom)
//   3. Country name scan in the AI overview text
// AI wins over TLD because `.com` domains often belong to non-US companies,
// and the AI has access to the full analyzed page content.
export function detectCountry(
  url?: string | null,
  overviewText?: string | null,
  aiCountry?: string | null,
): CountryHit | null {
  const fromAI = detectFromName(aiCountry);
  if (fromAI) return fromAI;
  // Fall back to raw AI string even if we couldn't map it — Google accepts
  // most country names verbatim, so it's better than nothing.
  if (aiCountry && aiCountry.trim().length > 1) {
    return { code: '', name: aiCountry.trim() };
  }
  const host = extractHostname(url || null);
  const fromTld = detectFromHostname(host);
  if (fromTld) return fromTld;
  const fromText = detectFromText(overviewText || null);
  if (fromText) return fromText;
  return null;
}

// Curated dropdown list of countries Google Maps recognizes. Used by the
// panel's manual override dropdown when the user wants to force a different
// region than auto-detected.
export const COUNTRY_OPTIONS: CountryHit[] = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'in', name: 'India' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'it', name: 'Italy' },
  { code: 'es', name: 'Spain' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'at', name: 'Austria' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'ie', name: 'Ireland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'pl', name: 'Poland' },
  { code: 'jp', name: 'Japan' },
  { code: 'sg', name: 'Singapore' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'kr', name: 'South Korea' },
  { code: 'cn', name: 'China' },
  { code: 'tw', name: 'Taiwan' },
  { code: 'my', name: 'Malaysia' },
  { code: 'th', name: 'Thailand' },
  { code: 'ph', name: 'Philippines' },
  { code: 'id', name: 'Indonesia' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'il', name: 'Israel' },
  { code: 'za', name: 'South Africa' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'ar', name: 'Argentina' },
];

export function extractDomain(url?: string | null): string | null {
  return extractHostname(url || null);
}
