/**
 * Eval runner — POSTs each case in evals/cases/*.json at the running dev server
 * (default http://localhost:3000), checks the response against declared expectations,
 * and prints a pass/fail table + summary.
 *
 * Usage:
 *   npm run dev            # in one terminal — must be running
 *   npm run eval           # in another
 *
 * Environment:
 *   EVAL_BASE_URL  override the target host (default http://localhost:3000)
 *   EVAL_ONLY      substring filter on case names, e.g. EVAL_ONLY=stripe
 *
 * Exit code: 0 if all pass, 1 if any fail. Suitable for CI gating.
 */
import fs from "node:fs";
import path from "node:path";

type Expectation =
  | { type: "hasField"; path: string }
  | { type: "matchField"; path: string; regex: string; flags?: string }
  | { type: "arrayLengthAtLeast"; path: string; min: number }
  | { type: "equals"; path: string; value: unknown }
  | { type: "notFallback" };

interface EvalCase {
  name: string;
  endpoint: string;
  description?: string;
  input: unknown;
  expectations: Expectation[];
}

interface ExpectationResult {
  ok: boolean;
  detail: string;
}

interface CaseResult {
  name: string;
  endpoint: string;
  durationMs: number;
  isFallback: boolean;
  passed: number;
  total: number;
  failures: ExpectationResult[];
  transportError?: string;
}

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";
const FILTER = process.env.EVAL_ONLY || "";

function resolvePath(obj: unknown, dotPath: string): unknown {
  if (dotPath === "") return obj;
  const segments = dotPath.split(".");
  let cur: any = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    // Numeric segment addresses array index; otherwise object key.
    if (/^\d+$/.test(seg) && Array.isArray(cur)) {
      cur = cur[Number(seg)];
    } else {
      cur = cur[seg];
    }
  }
  return cur;
}

function evaluate(expectation: Expectation, response: unknown): ExpectationResult {
  switch (expectation.type) {
    case "hasField": {
      const value = resolvePath(response, expectation.path);
      const ok = value !== undefined && value !== null && value !== "";
      return {
        ok,
        detail: ok
          ? `hasField "${expectation.path}" ✓`
          : `hasField "${expectation.path}" — missing or empty`,
      };
    }
    case "matchField": {
      const value = resolvePath(response, expectation.path);
      if (typeof value !== "string") {
        return { ok: false, detail: `matchField "${expectation.path}" — not a string (got ${typeof value})` };
      }
      const re = new RegExp(expectation.regex, expectation.flags ?? "i");
      const ok = re.test(value);
      return {
        ok,
        detail: ok
          ? `matchField "${expectation.path}" ~ /${expectation.regex}/ ✓`
          : `matchField "${expectation.path}" — value "${value.slice(0, 60)}" failed /${expectation.regex}/`,
      };
    }
    case "arrayLengthAtLeast": {
      const value = resolvePath(response, expectation.path);
      if (!Array.isArray(value)) {
        return { ok: false, detail: `arrayLengthAtLeast "${expectation.path}" — not an array (got ${typeof value})` };
      }
      const ok = value.length >= expectation.min;
      return {
        ok,
        detail: ok
          ? `arrayLengthAtLeast "${expectation.path}" ≥ ${expectation.min} (actual ${value.length}) ✓`
          : `arrayLengthAtLeast "${expectation.path}" — expected ≥ ${expectation.min}, got ${value.length}`,
      };
    }
    case "equals": {
      const value = resolvePath(response, expectation.path);
      const ok = JSON.stringify(value) === JSON.stringify(expectation.value);
      return {
        ok,
        detail: ok
          ? `equals "${expectation.path}" ✓`
          : `equals "${expectation.path}" — expected ${JSON.stringify(expectation.value)}, got ${JSON.stringify(value)}`,
      };
    }
    case "notFallback": {
      const flag = (response as any)?.isFallback === true || (response as any)?.[0]?.isFallback === true;
      const ok = !flag;
      return {
        ok,
        detail: ok
          ? `notFallback ✓ (live AI)`
          : `notFallback — response came from hand-authored fallback data`,
      };
    }
  }
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  const url = new URL(c.endpoint, BASE_URL).toString();

  let json: any = null;
  let transportError: string | undefined;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c.input),
    });
    if (!res.ok) {
      transportError = `HTTP ${res.status}`;
    } else {
      json = await res.json();
    }
  } catch (err: any) {
    transportError = err?.message || String(err);
  }

  const durationMs = Date.now() - started;

  if (transportError) {
    return {
      name: c.name,
      endpoint: c.endpoint,
      durationMs,
      isFallback: false,
      passed: 0,
      total: c.expectations.length,
      failures: [{ ok: false, detail: `Transport: ${transportError}` }],
      transportError,
    };
  }

  const results = c.expectations.map((e) => evaluate(e, json));
  const failures = results.filter((r) => !r.ok);
  const passed = results.length - failures.length;

  const isFallback = json?.isFallback === true || json?.[0]?.isFallback === true;

  return {
    name: c.name,
    endpoint: c.endpoint,
    durationMs,
    isFallback,
    passed,
    total: c.expectations.length,
    failures,
  };
}

function loadCases(): EvalCase[] {
  const dir = path.join(process.cwd(), "evals", "cases");
  if (!fs.existsSync(dir)) {
    console.error(`No cases directory found at ${dir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      return JSON.parse(raw) as EvalCase;
    })
    .filter((c) => (FILTER ? c.name.includes(FILTER) : true));
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  const cases = loadCases();
  if (cases.length === 0) {
    console.error("No matching eval cases found.");
    process.exit(1);
  }

  console.log(`\n▶ Running ${cases.length} case(s) against ${BASE_URL}\n`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${pad(c.name, 40)} `);
    const r = await runCase(c);
    results.push(r);
    const badge = r.transportError
      ? "TRANSPORT_FAIL"
      : r.passed === r.total
        ? "PASS"
        : "FAIL";
    const flag = r.isFallback ? " [fallback]" : "";
    console.log(`${badge}  ${r.passed}/${r.total}  ${r.durationMs}ms${flag}`);
    for (const f of r.failures) {
      console.log(`      × ${f.detail}`);
    }
  }

  const totalPassed = results.filter((r) => r.passed === r.total && !r.transportError).length;
  const fallbackCount = results.filter((r) => r.isFallback).length;

  console.log(
    `\n▶ Summary: ${totalPassed}/${results.length} cases passed` +
      (fallbackCount > 0 ? `  (${fallbackCount} served fallback data — set ANTHROPIC_API_KEY for live eval)` : "") +
      `\n`
  );

  process.exit(totalPassed === results.length ? 0 : 1);
}

main();
