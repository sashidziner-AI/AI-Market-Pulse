/**
 * inspect.ts — reads logs/ai-calls.jsonl and prints per-endpoint aggregates:
 *   count, success rate, p50/p95 latency, mean tokens in/out, cache hit rate,
 *   web search usage, and estimated USD spend at published Anthropic pricing.
 *
 * Usage:
 *   npm run inspect                       # summarize all entries
 *   npm run inspect -- --since 1h         # last 1 hour
 *   npm run inspect -- --route /api/discover-accounts
 *   npm run inspect -- --tail             # dump raw log lines
 *
 * The pricing table below is a rough public-list-price estimate — use it for
 * relative comparison, not billing. Update if Anthropic changes list price.
 */
import fs from "node:fs";
import path from "node:path";

interface AiCallLog {
  ts: string;
  endpoint?: string;
  subCall?: string;
  model: string;
  attempt: number;
  status: "ok" | "error";
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  webSearchCount?: number;
  webSearchEnabled: boolean;
  errorClass?: string;
  errorSnippet?: string;
}

// USD per 1M tokens — rough public list prices at time of writing.
// Cache reads land at ~10% of the base input rate for supported models.
const PRICING: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-4-7": { in: 15, out: 75, cacheRead: 1.5 },
  "claude-sonnet-4-6": { in: 3, out: 15, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5, cacheRead: 0.1 },
};
const WEB_SEARCH_USD_PER_1000 = 10; // ~$0.01 per search

const LOG_FILE = path.join(process.cwd(), "logs", "ai-calls.jsonl");

function parseArgs(argv: string[]) {
  const opts: { since?: number; route?: string; tail?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--since") {
      const val = argv[++i] ?? "";
      const m = /^(\d+)([smhd])$/.exec(val);
      if (m) {
        const n = parseInt(m[1], 10);
        const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2] as "s" | "m" | "h" | "d"];
        opts.since = Date.now() - n * mult;
      }
    } else if (a === "--route") {
      opts.route = argv[++i];
    } else if (a === "--tail") {
      opts.tail = true;
    }
  }
  return opts;
}

function loadEntries(): AiCallLog[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs
    .readFileSync(LOG_FILE, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as AiCallLog;
      } catch {
        return null;
      }
    })
    .filter((x): x is AiCallLog => x !== null);
}

function estimateCostUsd(e: AiCallLog): number {
  const p = PRICING[e.model];
  if (!p) return 0;
  const inTokens = e.inputTokens ?? 0;
  const outTokens = e.outputTokens ?? 0;
  const cacheReadTokens = e.cacheReadTokens ?? 0;
  const searches = e.webSearchCount ?? 0;
  return (
    (inTokens * p.in) / 1_000_000 +
    (outTokens * p.out) / 1_000_000 +
    (cacheReadTokens * p.cacheRead) / 1_000_000 +
    (searches * WEB_SEARCH_USD_PER_1000) / 1000
  );
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${(n * 100).toFixed(3)}¢`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let entries = loadEntries();

  if (!entries.length) {
    console.log(`\nNo entries found in ${LOG_FILE}\n`);
    console.log(`Run the dev server + fire a few /api/* requests, then rerun this.\n`);
    process.exit(0);
  }

  if (opts.since) {
    entries = entries.filter((e) => new Date(e.ts).getTime() >= opts.since!);
  }
  if (opts.route) {
    entries = entries.filter((e) => e.endpoint === opts.route);
  }

  if (opts.tail) {
    for (const e of entries.slice(-20)) {
      console.log(JSON.stringify(e));
    }
    return;
  }

  const byRoute = new Map<string, AiCallLog[]>();
  for (const e of entries) {
    const key = e.endpoint ?? "(untagged)";
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key)!.push(e);
  }

  console.log(
    `\n▶ Inspecting ${entries.length} AI call(s) from ${LOG_FILE}${opts.since ? ` (since ${new Date(opts.since).toISOString()})` : ""}\n`
  );

  const HEADERS = ["route", "n", "ok%", "dur p50", "dur p95", "in tok/call", "out tok/call", "cache%", "web/call", "cost/call", "total cost"];
  const WIDTHS = [30, 5, 5, 8, 8, 12, 12, 6, 8, 10, 12];
  console.log(HEADERS.map((h, i) => (i === 0 ? pad(h, WIDTHS[i]) : padLeft(h, WIDTHS[i]))).join(" | "));
  console.log(WIDTHS.map((w) => "-".repeat(w)).join("-+-"));

  let grandCost = 0;
  for (const [route, list] of Array.from(byRoute.entries()).sort()) {
    const okList = list.filter((e) => e.status === "ok");
    const durations = list.map((e) => e.durationMs);
    const inTokens = okList.map((e) => e.inputTokens ?? 0);
    const outTokens = okList.map((e) => e.outputTokens ?? 0);
    const cacheReads = okList.map((e) => e.cacheReadTokens ?? 0);
    const cacheHitRatio =
      inTokens.reduce((s, v) => s + v, 0) === 0
        ? 0
        : cacheReads.reduce((s, v) => s + v, 0) / (inTokens.reduce((s, v) => s + v, 0) + cacheReads.reduce((s, v) => s + v, 0));
    const webSearches = okList.map((e) => e.webSearchCount ?? 0);
    const costs = list.map(estimateCostUsd);
    const totalCost = costs.reduce((s, v) => s + v, 0);
    grandCost += totalCost;

    const row = [
      pad(route, WIDTHS[0]),
      padLeft(String(list.length), WIDTHS[1]),
      padLeft(`${Math.round((okList.length / list.length) * 100)}%`, WIDTHS[2]),
      padLeft(`${percentile(durations, 50)}ms`, WIDTHS[3]),
      padLeft(`${percentile(durations, 95)}ms`, WIDTHS[4]),
      padLeft(fmtInt(inTokens.reduce((s, v) => s + v, 0) / (okList.length || 1)), WIDTHS[5]),
      padLeft(fmtInt(outTokens.reduce((s, v) => s + v, 0) / (okList.length || 1)), WIDTHS[6]),
      padLeft(`${Math.round(cacheHitRatio * 100)}%`, WIDTHS[7]),
      padLeft((webSearches.reduce((s, v) => s + v, 0) / (okList.length || 1)).toFixed(1), WIDTHS[8]),
      padLeft(fmtUsd(totalCost / list.length), WIDTHS[9]),
      padLeft(fmtUsd(totalCost), WIDTHS[10]),
    ];
    console.log(row.join(" | "));
  }

  console.log("");
  console.log(`▶ Grand total estimated cost: ${fmtUsd(grandCost)}`);

  const errors = entries.filter((e) => e.status === "error");
  if (errors.length) {
    const byClass = new Map<string, number>();
    for (const e of errors) byClass.set(e.errorClass ?? "other", (byClass.get(e.errorClass ?? "other") ?? 0) + 1);
    console.log(`▶ Errors: ${errors.length} — ${Array.from(byClass.entries()).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  console.log("");
}

main();
