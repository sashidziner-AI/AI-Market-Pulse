# AI Market Pulse — Project Overview

## 1. What this tool is

**AI Market Pulse** is a GTM (Go-To-Market) intelligence web app that turns a single company URL into a prioritized account-outreach playbook. You give it your website; it returns:

1. Your business profile + ideal customer profile (ICP)
2. A ranked list of target accounts to pursue
3. Deep account intel (buyer personas, competitors, multi-threading map)
4. Clusters of similar accounts for coordinated outreach

Under the hood it is a single-process **Express + Vite + React** app on port `3000`, powered by **OpenAI (`gpt-4o-mini` → `gpt-4o` fallback)**, with hand-authored fallback data so the UI keeps working even when the AI quota is exhausted.

---

## 2. Why use this tool

| Problem it solves | How AI Market Pulse addresses it |
|---|---|
| Sales/marketing spend hours manually researching accounts | Auto-generates ICP + fit/timing/priority scores from a URL |
| Generic outreach → low reply rates | Produces persona-specific hooks, objection counter-narratives, competitor displacement angles |
| No visibility into "who to talk to first" inside an account | Multi-threading strategy names Entry Point / Champion / Economic Buyer / Technical Gatekeeper with sequencing |
| Reps chase unreachable logos | Pathway engine classifies each account as Direct / Channel Partner / Integration / Mutual Connection |
| Territory feels random | Cluster tab groups accounts by shared traits with a unified value message |
| AI outages break demos | Fallback layer returns realistic seed data with `isFallback: true` so the UI never breaks |

---

## 3. Who benefits

| Persona | Value |
|---|---|
| **Founders / early-stage sales** | Quick, structured GTM plan without hiring a research analyst |
| **AEs / SDRs** | Priority waves + persona-level hooks reduce prep time per account |
| **RevOps / GTM leaders** | Priority scoring + cluster view for territory carving and campaign design |
| **Channel / partnership teams** | Pathway assessment surfaces channel-partner and warm-intro routes |
| **Marketing** | Cluster-level messaging + shared pain points feed ABM campaigns |
| **Hackathon judges / demos** | Fallback data guarantees the app always tells a coherent story |

---

## 4. Architecture (at a glance)

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React 19 + Tailwind v4 + shadcn/ui)            │
│  ├─ BusinessInput  ── first screen (URL entry)           │
│  └─ Dashboard      ── tabs: recommendations / pipeline / │
│                       clusters / partner-pathways        │
└──────────────────────┬───────────────────────────────────┘
                       │ fetch /api/*
┌──────────────────────▼───────────────────────────────────┐
│  server.ts  (Express, port 3000, Vite as middleware)     │
│  ├─ POST /api/analyze-business   → BusinessAnalysis      │
│  ├─ POST /api/discover-accounts  → TargetAccount[]       │
│  ├─ POST /api/analyze-account    → DetailedAnalysis      │
│  └─ POST /api/cluster-accounts   → AccountCluster[]      │
│      │                                                   │
│      ▼ generateStructuredData(prompt, schema)            │
│         gpt-4o-mini ──(fail)──▶ gpt-4o ──(fail)──▶       │
│         hand-authored fallback (isFallback: true)        │
└──────────────────────────────────────────────────────────┘
```

Key traits:
- **Single port, single process** — no separate frontend server.
- **In-memory caches** to avoid burning OpenAI quota during a session.
- **Class-based dark mode** — `ThemeToggle` flips `.dark` on `<html>`, persisted via `localStorage`.
- **State persistence** — analysis, accounts, saved reports all live in `localStorage` under `gtm_*` keys.

---

## 5. Step-by-step: how to understand and use it

### A. First-time setup
1. Ensure `OPENAI_API_KEY` is in `.env` (without it, every endpoint returns fallback data — still usable, but the AI is off).
2. `npm install`
3. `npm run dev` → open `http://localhost:3000`.

### B. End-to-end user flow
1. **Enter your company URL** on the landing screen (`BusinessInput`). The app calls `/api/analyze-business`.
2. **Business + ICP appears**, and the pipeline auto-chains into `/api/discover-accounts` to produce a target list.
3. **Recommendations tab** — accounts ranked by priority waves (Immediate / Standard / Nurture / Do Not Pursue). Filter by wave.
4. **Open any account card** → `/api/analyze-account` fires lazily and returns:
   - Buyer personas + counter-narratives to expected objections
   - Competitors with displacement scoring
   - Multi-threading stakeholder map
   - Citations tiered Primary / Secondary / Tertiary
5. **Pipeline tab** — bulk view for stage tracking, outcome tagging.
6. **Clusters tab** → `/api/cluster-accounts` groups the list into segments with a unified value message.
7. **Partner Pathways tab** — configure your channel partners; the scorer re-weights accounts and surfaces channel/warm-intro routes.
8. **Save the report** — persisted under `gtm_saved_reports`; reload later from the library.
9. **Toggle dark mode** via the sun/moon icon in the header.

### C. How to read the scores
- **Fit Score** — how well the account matches your ICP.
- **Timing Score / Stage** — how ready they are to buy right now.
- **Priority Index / Flag** — the composite that drives wave grouping.
- **Channel Score** (partner pathways) — likelihood of a partner-assisted deal.

### D. When the AI is down
- The endpoints still return `200 OK` with `isFallback: true`.
- The UI shows a banner ("simulated data") but every feature keeps working.
- **Never** convert these to 5xx — the UX contract depends on 200-with-fallback.

### E. Extending the tool (for developers)
1. **Change a prompt** → edit the relevant handler in `server.ts` and update its fallback in `getXxxFallback(...)`.
2. **Change a response shape** → update `src/types.ts` and the matching fallback data at the same time.
3. **UI edit** → `src/components/Dashboard.tsx` is the post-analysis screen controller; `AccountDetail.tsx` renders one account.
4. **Bulk restyle** → use the four idempotent sweep scripts in `scripts/*.mjs` (dark variants, contrast, opacity collisions, font-size bumps).
5. **New endpoint** → route it through `generateStructuredData`, add a cache map, add a fallback function, wire it into `App.tsx` or `Dashboard.tsx`.

### F. Subagents available
- **`frontend-agent`** — scoped to `src/**`, forbidden from touching backend.
- **`backend-agent`** — scoped to `server.ts` + `/api/*` contracts, forbidden from touching UI.
- Use them for isolated changes so one side never accidentally breaks the other.

---

## 6. TL;DR

> **AI Market Pulse takes a URL and returns an actionable, prioritized GTM plan — target accounts, buyer personas, competitor angles, cluster-level messaging, and partner pathways — with a fallback layer that guarantees the demo never breaks.**
