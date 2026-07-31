# Evals

A tiny harness that runs each JSON case file in `evals/cases/` against the
running dev server and checks the response against a list of expectations.

## Usage

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run eval
```

Exit code is `0` if all cases pass, `1` otherwise — safe to wire into CI.

### Environment overrides

| Variable | Default | Purpose |
|---|---|---|
| `EVAL_BASE_URL` | `http://localhost:3000` | Point the runner at a different host |
| `EVAL_ONLY` | *(empty)* | Substring filter on case names (e.g. `EVAL_ONLY=stripe`) |

## Adding a case

Create a new JSON file under `evals/cases/`:

```json
{
  "name": "kebab-case-id",
  "endpoint": "/api/analyze-business",
  "description": "One line explaining what this case verifies.",
  "input": { "url": "https://example.com" },
  "expectations": [
    { "type": "hasField", "path": "businessName" },
    { "type": "matchField", "path": "businessName", "regex": "example" },
    { "type": "arrayLengthAtLeast", "path": "services", "min": 3 },
    { "type": "equals", "path": "someFlag", "value": true },
    { "type": "notFallback" }
  ]
}
```

### Path syntax

Dot-separated. Numeric segments address array indices.

- `"businessName"` → `response.businessName`
- `"icp.title"` → `response.icp.title`
- `"buyerPersonas.0.role"` → `response.buyerPersonas[0].role`
- `""` (empty) → the whole response (for array-typed endpoints)

### Expectation types

| Type | Behavior |
|---|---|
| `hasField` | Path resolves to something non-null / non-empty |
| `matchField` | Path is a string and matches `regex` (case-insensitive by default; override with `flags`) |
| `arrayLengthAtLeast` | Path is an array with `.length >= min` |
| `equals` | Deep-equals `value` (JSON stringified compare) |
| `notFallback` | `response.isFallback !== true`. Fails when the AI short-circuited to canned data — useful for verifying live API is working. |
| `llmJudge` | Sends the target subtree to `gpt-4o-mini` with a rubric, fires **3 parallel samples at temperature 0.2**, averages the scores, uses the median-sample's reason. Passes if `score >= passingScore`. Useful for subjective quality checks (e.g. "is this outreach angle actually good?"). Requires `OPENAI_API_KEY`; roughly 3× the per-judge cost of a single sample (~$0.001 per llmJudge expectation), traded for a ~5× drop in score variance across runs. Override sample count with `EVAL_JUDGE_SAMPLES=1` (fast, noisy) or `EVAL_JUDGE_SAMPLES=5` (slower, tighter). |

### `llmJudge` example

```json
{
  "type": "llmJudge",
  "path": "buyerPersonas.0.counterNarratives.0",
  "rubric": "A great counter-narrative names a concrete objection, offers a specific reframe, grounds proofPoint in a real analog example, and specifies a moment in the sales conversation. Vague or LLM-boilerplate answers score low.",
  "passingScore": 6
}
```

## What passes / fails today

Without an `ANTHROPIC_API_KEY`, every endpoint returns hand-authored fallback
data with `isFallback: true`. Most shape-based expectations will still **pass**
against fallback data (the fallback is realistic on purpose). Any case with
`notFallback` will **fail** without a key — that's the design.

Add `notFallback` to critical cases once your key is set, so you know when the
live path silently breaks.

## Green vs red — what to expect

Shape-based expectations (`hasField`, `arrayLengthAtLeast`, etc.) should be **100% green**. A red one means either the AI response shape broke or the schema drifted from what the frontend expects.

**Judge-based expectations (`llmJudge`) intentionally have red cases.** They're set to a passing bar (usually 6/10) that's slightly above what a first-pass AI response reliably produces — that's what makes them useful for regression detection. If they were all trivially green, they'd carry no signal.

Interpret judge output as a **prompt-improvement backlog**:

| Judge score | Meaning | Action |
|---|---|---|
| 8-10 | Genuinely good | No action |
| 6-7 | Acceptable | Nice to have; iterate if you have cycles |
| 4-5 | Needs work | Concrete prompt-improvement target |
| 1-3 | Broken | Blocker — the prompt fundamentally isn't delivering |

When a prompt change moves a judge score from 5→8, that's a real quality win. When it moves 8→5, that's a regression you'd have shipped without the harness.

## Interpreting the output

```
▶ Running 4 case(s) against http://localhost:3000

  analyze-business-stripe                  PASS  8/8   1234ms [fallback]
  discover-accounts-saas-icp               PASS  7/7   2100ms [fallback]
  analyze-account-shopify                  PASS 12/12  5321ms [fallback]
  cluster-accounts-mixed                   FAIL  6/8   1800ms [fallback]
      × arrayLengthAtLeast "0.sharedPainPoints" — expected ≥ 2, got 1
      × hasField "0.unifiedValueMessage" — missing or empty

▶ Summary: 3/4 cases passed  (4 served fallback data — set ANTHROPIC_API_KEY for live eval)
```

Each `×` line names the failed expectation and what actually came back.

## Extending

- Add more cases (target: 20 across the 4 endpoints).
- Add a new expectation type by:
  1. Adding a variant to the `Expectation` union in `runner.ts`.
  2. Adding a `case` branch inside `evaluate()`.
  3. Documenting the type here.
- For subjective quality checks (e.g. "is this outreach angle actually good?"), consider adding an LLM-as-judge expectation that calls a second Claude Haiku pass with a rubric.
