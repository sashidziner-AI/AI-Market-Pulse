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

// AI-picked benchmark for this specific account. Populated by
// /api/estimate-deal and layered underneath the user's manual overrides.
// Precedence at compute time: user override → ai suggestion → industry benchmark.
export interface RoiAiEstimate {
  perEmployeeAcv: number;
  adoptionPct: number;         // 0.0-1.0
  matchedIndustry: IndustryKey;
  reasoning: string;           // 1-2 sentences the tile shows as tooltip
  generatedAt: string;         // ISO for staleness display
  isFallback?: boolean;        // AI unavailable — fell back to industry benchmark
}

export interface RoiOverrides {
  perEmployeeAcv?: number;
  adoptionPct?: number;     // 0.0-1.0
  contractYears?: number;
  employeeCount?: number;
  industry?: IndustryKey;   // override the auto-matched industry
  // AI-picked defaults for perEmployeeAcv + adoptionPct. Does not participate
  // in "hasOverrides" (user hasn't customised anything, only AI has).
  ai?: RoiAiEstimate;
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
  // Provenance of perEmployeeAcv + adoptionPct so the UI can badge accordingly.
  // 'user'      — either value was manually overridden
  // 'ai'        — AI-picked (RoiOverrides.ai) is providing at least one value
  // 'benchmark' — falling back to the static INDUSTRY_BENCHMARKS table
  source: 'user' | 'ai' | 'benchmark';
  aiReasoning?: string;      // present when source === 'ai'
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
  // Start with industry match. Precedence: user industry override > AI-suggested
  // industry > auto-match from account.industry string.
  const industryKey = overrides?.industry ?? overrides?.ai?.matchedIndustry;
  const bench = industryKey
    ? (INDUSTRY_BENCHMARKS.find((b) => b.key === industryKey) ?? INDUSTRY_BENCHMARKS[INDUSTRY_BENCHMARKS.length - 1])
    : matchIndustry(account.industry);

  const employeeCount = overrides?.employeeCount ?? account.employeeCount ?? inferEmployeeCount(account);
  const isInferredEmployeeCount = !overrides?.employeeCount && account.employeeCount == null;

  // 3-tier precedence: user manual override → AI-picked estimate → static benchmark.
  const perEmployeeAcv = overrides?.perEmployeeAcv ?? overrides?.ai?.perEmployeeAcv ?? bench.perEmployeeAcv;
  const adoptionPct = overrides?.adoptionPct ?? overrides?.ai?.adoptionPct ?? bench.adoptionPct;
  const contractYears = overrides?.contractYears ?? DEFAULT_CONTRACT_YEARS;

  // Decide provenance for the UI badge. Any user field wins; else if AI supplied
  // either input, mark 'ai'; else 'benchmark'.
  const userTouchedRates = overrides?.perEmployeeAcv != null || overrides?.adoptionPct != null;
  const aiSupplied = overrides?.ai?.perEmployeeAcv != null || overrides?.ai?.adoptionPct != null;
  const source: RoiEstimate['source'] = userTouchedRates ? 'user' : aiSupplied ? 'ai' : 'benchmark';

  const annualAcvMid = employeeCount * perEmployeeAcv * adoptionPct;
  const mid = annualAcvMid * contractYears;
  const low = mid * (1 - BAND_WIDTH);
  const high = mid * (1 + BAND_WIDTH);

  const notes: string[] = [];
  if (isInferredEmployeeCount) {
    notes.push(`Employee count inferred from priority index — override for a tighter estimate.`);
  }
  if (!overrides?.industry) {
    notes.push(`Industry ${overrides?.ai ? 'AI-picked' : 'auto-matched'} as ${bench.key}${account.industry ? ` from "${account.industry}"` : ' (no industry set)'}.`);
  }
  if (source === 'ai' && overrides?.ai?.reasoning) {
    notes.push(`AI reasoning: ${overrides.ai.reasoning}`);
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
    source,
    aiReasoning: source === 'ai' ? overrides?.ai?.reasoning : undefined,
    notes,
  };
}

// Fetch an AI-tuned per-account estimate. Cached in RoiOverrides.ai so a
// second render of the same account (or a tab-switch) doesn't refire the call.
export interface FetchAiEstimateArgs {
  account: TargetAccount;
  sellerContext?: { businessName?: string; valueProp?: string };
  signal?: AbortSignal;
}

export async function fetchAiEstimate({ account, sellerContext, signal }: FetchAiEstimateArgs): Promise<RoiAiEstimate | null> {
  try {
    const { apiUrl } = await import('./apiBase');
    const res = await fetch(apiUrl('/api/estimate-deal'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountName: account.name,
        accountDomain: account.domain,
        industry: account.industry,
        employeeCount: account.employeeCount,
        priorityIndex: account.priorityIndex,
        // Best-effort signal harvest — server tolerates missing fields.
        techStack: (account as any).technicalStack ?? (account as any).techStack ?? [],
        growthSignals: (account as any).growthSignals ?? [],
        sellerContext,
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.perEmployeeAcv !== 'number' || typeof data.adoptionPct !== 'number') return null;
    return {
      perEmployeeAcv: data.perEmployeeAcv,
      adoptionPct: data.adoptionPct,
      matchedIndustry: data.matchedIndustry,
      reasoning: data.reasoning ?? '',
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      isFallback: !!data.isFallback,
    };
  } catch {
    return null;
  }
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
