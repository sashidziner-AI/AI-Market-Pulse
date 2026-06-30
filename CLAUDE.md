# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — starts the combined frontend + backend on http://localhost:3000 via `tsx server.ts`. Vite is mounted as Express middleware (single port, no separate frontend dev server).
- `npm run build` — emits `dist/` with `vite build` for the SPA and `esbuild` bundles `server.ts` → `dist/server.cjs`.
- `npm start` — runs the production build (`node dist/server.cjs`). Set `NODE_ENV=production` so the server serves `dist/` statically instead of Vite middleware.
- `npm run lint` — `tsc --noEmit`. There is no test suite.

`OPENAI_API_KEY` must be set in `.env` for live AI responses. Without it, every `/api/*` endpoint silently returns rich hand-authored fallback data (see "Fallback Strategy" below) — the UI still works but every response will be marked `isFallback: true` and the frontend will show a banner.

Set `DISABLE_HMR=true` to turn off Vite HMR and file watching (used by hosted AI Studio environments to avoid flicker during agent edits).

## Architecture

### Single-process server

`server.ts` is the entire backend: an Express app that hosts four `/api/*` endpoints and, in dev, mounts the Vite dev server as middleware (`createViteServer({ middlewareMode: true })`). In production it serves `dist/` and falls back to `index.html` for SPA routes. The port (`3000`) is hardcoded.

### `/api/*` endpoints

Each is POST + JSON. They form a 4-stage pipeline:

1. `POST /api/analyze-business` — `{ url }` → `BusinessAnalysis` (ICP, overview, services).
2. `POST /api/discover-accounts` — `{ businessContext, icp }` → `TargetAccount[]` with fit/timing/priority scores.
3. `POST /api/analyze-account` — `{ domain, businessContext }` → `DetailedAnalysis` (buyer personas, competitors, multi-threading strategy, citations).
4. `POST /api/cluster-accounts` — `{ accounts, businessContext }` → `AccountCluster[]` (segments shared characteristics across accounts).

### `generateStructuredData(prompt, schema)`

All four endpoints go through this single helper. It:

- Tries `gpt-4o-mini`, then `gpt-4o` if the first model exhausts retries.
- Retries transient errors (5xx, ECONNRESET, timeout) with exponential backoff (1s → 2s → 4s, 3 attempts per model).
- On `401/403` or `429`/quota errors it short-circuits immediately (no retries, no fallback model) and the route handler then returns the canned fallback data.
- Uses OpenAI `response_format: { type: "json_object" }`. Because that mode forces an object wrapper, if the schema expects an array the helper unwraps the single array property the model returns (e.g. `{ items: [...] }`).
- All log lines run through `sanitizeString()` which rewrites tokens like `error`, `fail`, `exception` to neutral synonyms so logs don't trigger build-system alerting rules.

### Fallback strategy

Each endpoint has a `getXxxFallback(...)` function that returns realistic, hand-authored seed data (different sets for AEC/construction vs general SaaS) with `isFallback: true` flags. Whenever the OpenAI call throws (typically quota/permission), the catch block calls the fallback and returns 200 — the frontend treats the data identically and surfaces a toast saying simulated data was loaded. **Do not** change endpoints to return 5xx on AI failure — the UX assumes a successful response with `isFallback: true`.

### In-memory caches

`businessCache`, `discoveryCache`, `accountAnalysisCache`, `clustersCache` are `Map`s keyed by request inputs. They exist purely to avoid burning OpenAI quota during repeated UI clicks within a single server lifetime. They are not persistent.

### Frontend orchestration (`src/App.tsx`)

`App.tsx` owns the top-level state: `analysis`, `accounts`, `savedReports`, `activeReportId`, plus the loading flags. Each is initialized from `localStorage` and synced back on change via `useEffect`. There are two top-level screens:

- `BusinessInput` — shown when `analysis` is `null`.
- `Dashboard` — shown otherwise.

The pipeline is driven from App: `analyzeBusiness()` calls `/api/analyze-business`, then auto-chains into `discoverAccounts()`. `analyzeAccountDetail()` is triggered lazily from `AccountDetail` when the user opens a card.

### `localStorage` keys

- `gtm_analysis` — current `BusinessAnalysis`
- `gtm_accounts` — `TargetAccount[]` with embedded `DetailedAnalysis` once expanded
- `gtm_saved_reports` — array of `{ id, name, timestamp, analysis, accounts }`
- `gtm_active_report_id` — pointer to the currently loaded saved report
- `gtm_channel_partners` — Dashboard's partner pathway configuration (see `utils/calibration.ts`)
- `gtm_theme` — `'light' | 'dark'` (read by `ThemeToggle`)

### `src/components/Dashboard.tsx` (~3200 lines)

This file is intentionally monolithic — it owns the pipeline UI, priority-wave filtering, ICP exclusion engine, CRM connection modal, save/load workflow, channel partner sliders, CSV import/run, and report renaming. The tabs `recommendations | pipeline | clusters | partner-pathways` are local state inside this component. Channel partner state lives in this component and is persisted separately. Treat it as the screen-level controller for the post-analysis view.

### `src/components/AccountDetail.tsx` (~1600 lines)

Renders one `DetailedAnalysis` (buyer personas with counter-narratives, competitors with displacement scoring, multi-threading stakeholder map, citations). Heavy use of `IntelCitation` rendering. All citation tiering (`Primary | Secondary | Tertiary`) and confidence display logic lives here.

### `src/utils/calibration.ts`

Pure functions for scoring: `computeWeightsRecalibration` adjusts fit/timing weights based on user-edited partner data; `computePathwayAssessment` decides whether an account is reachable via Direct / Channel Partner / Integration / Mutual Connection and produces `PathwayAssessment`. Default partner list lives here as `DEFAULT_CHANNEL_PARTNERS`.

## Styling

- Tailwind v4 (oxide) — `@import "tailwindcss"` in `src/index.css`. No `tailwind.config.*` — tokens are declared inline via `@theme` blocks.
- The custom `--color-indigo-*` palette in `src/index.css` is actually **orange shades** (the original Google AI Studio palette). The shadcn `.dark`/`:root` variables (`--background`, `--card`, etc.) are a separate slate-tinted neutral scale.
- shadcn/ui components are under `src/components/ui/*` (`components.json` is configured). They use the CSS-variable theme, so they respond to `.dark` automatically.
- Dark mode is class-based: `ThemeToggle` adds/removes `.dark` on `<html>` and persists to `localStorage`. Initial value respects `prefers-color-scheme`.
- Path alias: `@/*` → `./src/*` (configured in `tsconfig.json` and `vite.config.ts`). Use it for imports inside `src/components/ui/*`.

## `scripts/*.mjs` codebase-wide sweepers

The Node scripts under `scripts/` apply idempotent regex-anchored transforms across the panel files. They were used to add dark-mode variants and bump tiny font sizes:

- `add-dark-variants.mjs` — appends `dark:` siblings to hardcoded slate/colored Tailwind classes.
- `fix-dark-contrast.mjs` — corrects contrast-reducing mappings (e.g. `text-slate-400 dark:text-slate-500` is *darker* in dark mode) and adds accent text-color dark variants.
- `fix-opacity-collision.mjs` — repairs the `bg-X-50 dark:bg-X-950/40/20` pattern that arises when a sweep regex matches a class that already had an `/N` opacity modifier. The fix moves the original opacity back onto the light class.
- `bump-text-sizes.mjs` — maps `text-[Npx]` arbitrary sizes ≤11.5px up to a readable minimum (8 → 10, 9 → 11, 10 → 12, 11 → 13).

All four use the same anchored regex pattern: `(^|[\s"'\`{(])<token>(?![\w-])`, which avoids matching `slate-50` inside `slate-500`. Re-running any of them is safe — they check the surrounding class string and skip if the target dark variant or replacement is already present. Keep them around when bulk-restyling new components.
