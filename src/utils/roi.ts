import { TargetAccount } from '../types';

// Deal-size ROI calculator — turns employee count + industry into a ballpark
// deal size a rep can drop into outreach or a meeting brief. Pure functions,
// no server round-trip. All inputs and outputs are dollars/year.
//
// Formula:
//   annualAcv = employeeCount × perEmployeeAcv × adoptionPct
//   totalDealSize = annualAcv × contractYears
//   low/high band = ±30% around the mid estimate
//
// The benchmarks are order-of-magnitude estimates for B2B SaaS-shaped deals.
// They should be treated as anchors for a conversation, not quotes — the UI
// says so explicitly ("est. deal size", never "quoted").

export type IndustryKey = 'SaaS' | 'Fintech' | 'Manufacturing' | 'AEC' | 'Biotech' | 'Healthcare' | 'General';

interface IndustryBenchmark {
  key: IndustryKey;
  perEmployeeAcv: number;   // annual $ per employee — mid-point of category
  adoptionPct: number;      // 0.0-1.0 — fraction of employees who'd be seat-holders
  matches: RegExp;          // industry-string keywords
}

// Ordered — first matching regex wins. General is the catch-all.
export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  { key: 'Fintech',       perEmployeeAcv: 2000, adoptionPct: 0.30, matches: /\b(fintech|financial|banking|payments|insur|fintec)\b/i },
  { key: 'Biotech',       perEmployeeAcv: 1600, adoptionPct: 0.25, matches: /\b(biotech|pharma|clinical|life\s*sciences|drug|genomics)\b/i },
  { key: 'SaaS',          perEmployeeAcv: 1000, adoptionPct: 0.40, matches: /\b(saas|software|tech|ai|ml|data|platform|api|dev\s*tools|devtools)\b/i },
  { key: 'Healthcare',    perEmployeeAcv: 900,  adoptionPct: 0.30, matches: /\b(health|medical|hospital|provider|payer)\b/i },
  { key: 'AEC',           perEmployeeAcv: 600,  adoptionPct: 0.35, matches: /\b(aec|construct|architect|engineer|building|bim|infrastructur)\b/i },
  { key: 'Manufacturing', perEmployeeAcv: 500,  adoptionPct: 0.50, matches: /\b(manufactur|industrial|factory|supply\s*chain|logistics)\b/i },
  { key: 'General',       perEmployeeAcv: 800,  adoptionPct: 0.35, matches: /.*/ },
];

const DEFAULT_CONTRACT_YEARS = 1;
const BAND_WIDTH = 0.30; // ±30% band around the mid estimate

// If the account has no employee count, we fall back to this rough guess
// tied to the priority index so the ROI tile never renders blank. Marked
// as `isInferredEmployeeCount: true` so the UI can style/label it distinctly.
function inferEmployeeCount(account: TargetAccount): number {
  // Rough tiers based on fit + priority — bigger scores tend to correlate
  // with more established/enriched accounts. Not scientific; a placeholder.
  const priority = account.priorityIndex ?? 50;
  if (priority >= 85) return 800;
  if (priority >= 70) return 400;
  if (priority >= 55) return 200;
  if (priority >= 40) return 100;
  return 50;
}

export interface RoiOverrides {
  perEmployeeAcv?: number;
  adoptionPct?: number;     // 0.0-1.0
  contractYears?: number;
  employeeCount?: number;
  industry?: IndustryKey;   // override the auto-matched industry
}

export interface RoiEstimate {
  low: number;               // total contract value (contractYears × acv), lower band
  mid: number;
  high: number;
  annualAcvMid: number;      // annualized mid — useful for "$X/year" copy
  employeeCount: number;
  isInferredEmployeeCount: boolean;
  matchedIndustry: IndustryKey;
  perEmployeeAcv: number;
  adoptionPct: number;
  contractYears: number;
  // Human-readable one-liners the UI can render as tooltips / footnote.
  notes: string[];
}

function matchIndustry(industry?: string): IndustryBenchmark {
  const raw = (industry ?? '').trim();
  for (const b of INDUSTRY_BENCHMARKS) {
    if (b.matches.test(raw)) return b;
  }
  return INDUSTRY_BENCHMARKS[INDUSTRY_BENCHMARKS.length - 1];
}

export function computeRoi(account: TargetAccount, overrides?: RoiOverrides): RoiEstimate {
  // Start with industry match (either overridden or auto).
  const bench = overrides?.industry
    ? (INDUSTRY_BENCHMARKS.find((b) => b.key === overrides.industry) ?? INDUSTRY_BENCHMARKS[INDUSTRY_BENCHMARKS.length - 1])
    : matchIndustry(account.industry);

  const employeeCount = overrides?.employeeCount ?? account.employeeCount ?? inferEmployeeCount(account);
  const isInferredEmployeeCount = !overrides?.employeeCount && account.employeeCount == null;

  const perEmployeeAcv = overrides?.perEmployeeAcv ?? bench.perEmployeeAcv;
  const adoptionPct = overrides?.adoptionPct ?? bench.adoptionPct;
  const contractYears = overrides?.contractYears ?? DEFAULT_CONTRACT_YEARS;

  const annualAcvMid = employeeCount * perEmployeeAcv * adoptionPct;
  const mid = annualAcvMid * contractYears;
  const low = mid * (1 - BAND_WIDTH);
  const high = mid * (1 + BAND_WIDTH);

  const notes: string[] = [];
  if (isInferredEmployeeCount) {
    notes.push(`Employee count inferred from priority index — override for a tighter estimate.`);
  }
  if (!overrides?.industry) {
    notes.push(`Industry auto-matched to ${bench.key}${account.industry ? ` from "${account.industry}"` : ' (no industry set)'}.`);
  }
  notes.push(`Formula: ${employeeCount.toLocaleString()} employees × $${perEmployeeAcv.toLocaleString()}/emp × ${Math.round(adoptionPct * 100)}% adoption${contractYears > 1 ? ` × ${contractYears}y` : ''}.`);

  return {
    low: Math.round(low),
    mid: Math.round(mid),
    high: Math.round(high),
    annualAcvMid: Math.round(annualAcvMid),
    employeeCount,
    isInferredEmployeeCount,
    matchedIndustry: bench.key,
    perEmployeeAcv,
    adoptionPct,
    contractYears,
    notes,
  };
}

// Format $1,234,567 as "$1.2M" / "$450K" / "$8.5K" — compact for tile display.
export function formatCurrencyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `$${Math.round(n)}`;
}

export function formatCurrencyFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// localStorage overrides so per-account tweaks survive tab switches.
const OVERRIDES_KEY = 'gtm_roi_overrides';

export function loadRoiOverrides(accountId: string): RoiOverrides | null {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, RoiOverrides>;
    return map[accountId] ?? null;
  } catch { return null; }
}

export function saveRoiOverrides(accountId: string, overrides: RoiOverrides | null) {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, RoiOverrides>) : {};
    if (overrides == null) delete map[accountId];
    else map[accountId] = overrides;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}
