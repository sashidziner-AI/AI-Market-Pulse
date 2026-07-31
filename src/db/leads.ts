/**
 * Lead-tracking store — Phase A foundation (JSON-file variant).
 *
 * Persists to `./data/leads.json`. Chosen over SQLite for hackathon speed
 * (no native compilation on Windows). The public API here is identical to
 * what a SQL-backed store would expose, so swapping to Postgres/Supabase
 * later means changing this file only — server.ts and the UI don't move.
 *
 * The `linkedin_url` field is the dedup key. All writes go through
 * `upsertLead()` — never bare push — so re-ingesting the same person from
 * a CSV, CRM, or account playbook merges instead of duplicating.
 *
 * Not designed for 100k+ rows in the JSON variant (whole file is
 * re-serialized on every write). Fine for the hackathon demo; production
 * swap is a Postgres migration + connection-string change.
 */

import fs from 'node:fs';
import path from 'node:path';
import { applyPattern, type EmailPatternKey } from '../utils/emailPattern';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'leads.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ─── Types ─────────────────────────────────────────────────────────────────

export type LeadStatus = 'fresh' | 'role_changed' | 'left_company' | 'stale' | 'unreachable';
export type EmailConfidence = 'verified' | 'probable' | 'guess' | 'unknown';
export type Seniority = 'executive' | 'senior' | 'manager' | 'ic';
export type LeadSource = 'seed' | 'auto' | 'csv' | 'manual';

export interface CompanyRow {
  id: string;
  domain: string;
  name: string;
  email_pattern: string | null;
  pattern_confidence: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  current_role: string;
  previous_role: string | null;
  company_id: string;
  previous_company: string | null;
  linkedin_url: string;
  email_guess: string | null;
  email_confidence: EmailConfidence;
  seniority: Seniority;
  status: LeadStatus;
  source: LeadSource;
  last_verified_at: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface LeadEventRow {
  id: string;
  lead_id: string;
  event_type: string;
  detail: string;
  source: string;
  at: string;
}

export interface LeadWithCompany extends LeadRow {
  company_name: string;
  company_domain: string;
  events?: LeadEventRow[];
}

interface StoreShape {
  companies: CompanyRow[];
  leads: LeadRow[];
  events: LeadEventRow[];
}

// ─── Persistence primitives ────────────────────────────────────────────────

function loadStore(): StoreShape {
  if (!fs.existsSync(DB_PATH)) return { companies: [], leads: [], events: [] };
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    // Backfill: pre-source rows on disk are treated as seed-origin so the
    // UI can still color-code them without a manual migration step.
    const leads = (parsed.leads ?? []).map((l) => ({
      ...l,
      source: (l as any).source ?? ('seed' as LeadSource),
    })) as LeadRow[];
    return {
      companies: parsed.companies ?? [],
      leads,
      events: parsed.events ?? [],
    };
  } catch {
    return { companies: [], leads: [], events: [] };
  }
}

function saveStore(store: StoreShape): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

let cache: StoreShape | null = null;

function getStore(): StoreShape {
  if (!cache) cache = loadStore();
  return cache;
}

function commit(): void {
  if (cache) saveStore(cache);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uuid(): string {
  return (globalThis.crypto as any)?.randomUUID?.() ??
    `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Company operations ────────────────────────────────────────────────────

export function upsertCompany(input: { domain: string; name: string }): CompanyRow {
  const store = getStore();
  const domain = input.domain.trim().toLowerCase();
  const existing = store.companies.find((c) => c.domain === domain);
  if (existing) {
    if (existing.name !== input.name) {
      existing.name = input.name;
      existing.updated_at = nowIso();
      commit();
    }
    return existing;
  }
  const row: CompanyRow = {
    id: uuid(),
    domain,
    name: input.name,
    email_pattern: null,
    pattern_confidence: null,
    last_verified_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  store.companies.push(row);
  commit();
  return row;
}

export function setCompanyEmailPattern(companyId: string, pattern: string, confidence: string): void {
  const store = getStore();
  const c = store.companies.find((x) => x.id === companyId);
  if (!c) return;
  c.email_pattern = pattern;
  c.pattern_confidence = confidence;
  c.last_verified_at = nowIso();
  c.updated_at = nowIso();
  commit();
}

export function getCompanyByDomain(domain: string): CompanyRow | null {
  const store = getStore();
  const d = domain.trim().toLowerCase();
  return store.companies.find((c) => c.domain === d) ?? null;
}

export function listCompanies(): CompanyRow[] {
  return getStore().companies.slice();
}

// ─── Lead operations ───────────────────────────────────────────────────────

export interface UpsertLeadInput {
  firstName: string;
  lastName: string;
  currentRole: string;
  previousRole?: string;
  companyName: string;
  companyDomain: string;
  previousCompany?: string;
  linkedinUrl: string;
  emailGuess?: string;
  emailConfidence?: EmailConfidence;
  seniority?: Seniority;
  status?: LeadStatus;
  source?: LeadSource;
}

export interface UpsertResult {
  lead: LeadRow;
  wasCreated: boolean;
  eventsWritten: number;
}

export function writeEvent(leadId: string, type: string, detail: string, source = 'system'): void {
  const store = getStore();
  store.events.push({
    id: uuid(),
    lead_id: leadId,
    event_type: type,
    detail,
    source,
    at: nowIso(),
  });
  commit();
}

/**
 * Insert or merge a lead by linkedin_url. If the lead exists and any core
 * fields changed (role, company, email), we write a `lead_events` entry and
 * flip status accordingly (`role_changed` / `left_company`).
 */
export function upsertLead(input: UpsertLeadInput): UpsertResult {
  const store = getStore();
  const company = upsertCompany({ domain: input.companyDomain, name: input.companyName });
  const linkedin = input.linkedinUrl.trim();
  const existing = store.leads.find((l) => l.linkedin_url === linkedin);
  const now = nowIso();
  let eventsWritten = 0;

  // If caller didn't provide an email guess but we have a learned pattern for
  // this company, auto-generate one — this is where Phase B (pattern engine)
  // and Phase A (leads store) close the loop.
  let derivedEmailGuess: string | null = input.emailGuess ?? null;
  let derivedConfidence: EmailConfidence = input.emailConfidence ?? 'unknown';
  if (!derivedEmailGuess && company.email_pattern) {
    const applied = applyPattern(
      company.email_pattern as EmailPatternKey,
      input.firstName,
      input.lastName,
      company.domain,
    );
    if (applied.email) {
      derivedEmailGuess = applied.email;
      // Propagate the pattern's confidence to the email guess: a verified
      // pattern yields a "probable" guess (still not SMTP-verified).
      derivedConfidence = company.pattern_confidence === 'verified' ? 'probable' : 'guess';
    }
  }

  if (!existing) {
    const row: LeadRow = {
      id: uuid(),
      first_name: input.firstName,
      last_name: input.lastName,
      current_role: input.currentRole,
      previous_role: input.previousRole ?? null,
      company_id: company.id,
      previous_company: input.previousCompany ?? null,
      linkedin_url: linkedin,
      email_guess: derivedEmailGuess,
      email_confidence: derivedConfidence,
      seniority: input.seniority ?? 'ic',
      status: input.status ?? 'fresh',
      source: input.source ?? 'manual',
      last_verified_at: now,
      first_seen_at: now,
      updated_at: now,
    };
    store.leads.push(row);
    commit();
    writeEvent(row.id, 'created', `Added ${input.firstName} ${input.lastName} — ${input.currentRole} at ${input.companyName}`, 'ingest');
    if (derivedEmailGuess && !input.emailGuess) {
      writeEvent(row.id, 'email_derived', `Auto-generated ${derivedEmailGuess} from learned pattern for ${company.domain}`, 'pattern_engine');
    }
    return { lead: row, wasCreated: true, eventsWritten: derivedEmailGuess && !input.emailGuess ? 2 : 1 };
  }

  const changes: string[] = [];
  let newStatus: LeadStatus = existing.status;

  if (input.currentRole && input.currentRole !== existing.current_role) {
    writeEvent(existing.id, 'role_changed', `${existing.current_role} → ${input.currentRole}`, 'linkedin');
    existing.previous_role = existing.current_role;
    existing.current_role = input.currentRole;
    changes.push('current_role');
    newStatus = 'role_changed';
    eventsWritten++;
  }
  if (input.companyDomain && company.id !== existing.company_id) {
    const prevCompany = store.companies.find((c) => c.id === existing.company_id);
    writeEvent(existing.id, 'company_changed', `${prevCompany?.name ?? 'prev'} → ${company.name}`, 'linkedin');
    existing.previous_company = prevCompany?.name ?? existing.previous_company;
    existing.company_id = company.id;
    changes.push('company_id');
    newStatus = 'left_company';
    eventsWritten++;
  }
  if (input.emailGuess && input.emailGuess !== existing.email_guess) {
    existing.email_guess = input.emailGuess;
    existing.email_confidence = input.emailConfidence ?? existing.email_confidence;
    changes.push('email_guess');
  } else if (!existing.email_guess && derivedEmailGuess) {
    // Backfill: existing lead had no email, but we now have a company pattern.
    existing.email_guess = derivedEmailGuess;
    existing.email_confidence = derivedConfidence;
    writeEvent(existing.id, 'email_derived', `Backfilled ${derivedEmailGuess} from learned pattern for ${company.domain}`, 'pattern_engine');
    changes.push('email_guess');
    eventsWritten++;
  }

  if (changes.length === 0) {
    existing.last_verified_at = now;
    existing.updated_at = now;
    existing.status = 'fresh';
    commit();
    writeEvent(existing.id, 'verified', 'Role + company unchanged', 'linkedin');
    return { lead: existing, wasCreated: false, eventsWritten: 1 };
  }

  if (input.firstName) existing.first_name = input.firstName;
  if (input.lastName) existing.last_name = input.lastName;
  if (input.seniority) existing.seniority = input.seniority;
  existing.status = newStatus;
  existing.last_verified_at = now;
  existing.updated_at = now;
  commit();

  return { lead: existing, wasCreated: false, eventsWritten };
}

export interface ListLeadsQuery {
  limit?: number;
  offset?: number;
  status?: LeadStatus | 'all';
  emailConfidence?: EmailConfidence | 'all';
  companyId?: string;
  search?: string;
}

export interface ListLeadsResult {
  leads: LeadWithCompany[];
  total: number;
  hasMore: boolean;
}

const STATUS_SORT: Record<LeadStatus, number> = {
  role_changed: 0,
  left_company: 1,
  stale:        2,
  unreachable:  3,
  fresh:        4,
};

export function listLeads(q: ListLeadsQuery = {}): ListLeadsResult {
  const store = getStore();
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
  const offset = Math.max(q.offset ?? 0, 0);
  const search = q.search?.trim().toLowerCase() ?? '';

  let filtered = store.leads.slice();

  if (q.status && q.status !== 'all') filtered = filtered.filter((l) => l.status === q.status);
  if (q.emailConfidence && q.emailConfidence !== 'all') filtered = filtered.filter((l) => l.email_confidence === q.emailConfidence);
  if (q.companyId) filtered = filtered.filter((l) => l.company_id === q.companyId);
  if (search) {
    filtered = filtered.filter((l) => {
      const company = store.companies.find((c) => c.id === l.company_id);
      return (
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(search) ||
        l.current_role.toLowerCase().includes(search) ||
        (company?.name ?? '').toLowerCase().includes(search) ||
        (l.email_guess ?? '').toLowerCase().includes(search)
      );
    });
  }

  filtered.sort((a, b) => {
    const s = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
    if (s !== 0) return s;
    const aTime = new Date(a.last_verified_at ?? a.first_seen_at).getTime();
    const bTime = new Date(b.last_verified_at ?? b.first_seen_at).getTime();
    return bTime - aTime;
  });

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const enriched: LeadWithCompany[] = page.map((l) => {
    const c = store.companies.find((x) => x.id === l.company_id);
    return {
      ...l,
      company_name: c?.name ?? 'Unknown',
      company_domain: c?.domain ?? '',
      events: store.events
        .filter((e) => e.lead_id === l.id)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 5),
    };
  });

  return { leads: enriched, total, hasMore: offset + page.length < total };
}

export function getLead(id: string): LeadWithCompany | null {
  const store = getStore();
  const l = store.leads.find((x) => x.id === id);
  if (!l) return null;
  const c = store.companies.find((x) => x.id === l.company_id);
  return {
    ...l,
    company_name: c?.name ?? 'Unknown',
    company_domain: c?.domain ?? '',
    events: store.events
      .filter((e) => e.lead_id === id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  };
}

export function countLeads(): number {
  return getStore().leads.length;
}

// ─── Seeding ───────────────────────────────────────────────────────────────

export function seedIfEmpty(): { seeded: boolean; count: number } {
  if (countLeads() > 0) return { seeded: false, count: countLeads() };

  const seeds: UpsertLeadInput[] = [
    {
      firstName: 'Priya', lastName: 'Iyer',
      currentRole: 'Chief Technology Officer', previousRole: 'VP Engineering',
      companyName: 'Acme Construction', companyDomain: 'acme-construction.com',
      linkedinUrl: 'https://www.linkedin.com/in/priya-iyer-cto/',
      emailGuess: 'priya.iyer@acme-construction.com', emailConfidence: 'verified',
      seniority: 'executive', status: 'role_changed',
    },
    {
      firstName: 'Ram', lastName: 'Kumar',
      currentRole: 'Head of BIM',
      companyName: 'BuildSmart AEC', companyDomain: 'buildsmart.co',
      linkedinUrl: 'https://www.linkedin.com/in/ram-kumar-bim/',
      emailGuess: 'r.kumar@buildsmart.co', emailConfidence: 'probable',
      seniority: 'senior', status: 'fresh',
    },
    {
      firstName: 'Anita', lastName: 'Rao',
      currentRole: 'Director of Design Technology',
      companyName: 'Meridian Architects', companyDomain: 'meridian-arch.com',
      previousCompany: 'Skyline Design Group',
      linkedinUrl: 'https://www.linkedin.com/in/anita-rao-design/',
      emailGuess: 'anita.rao@meridian-arch.com', emailConfidence: 'guess',
      seniority: 'senior', status: 'left_company',
    },
    {
      firstName: 'Vikram', lastName: 'Shah',
      currentRole: 'Senior Project Engineer',
      companyName: 'Acme Construction', companyDomain: 'acme-construction.com',
      linkedinUrl: 'https://www.linkedin.com/in/vikram-shah-pe/',
      emailGuess: 'vikram.shah@acme-construction.com', emailConfidence: 'verified',
      seniority: 'senior', status: 'fresh',
    },
    {
      firstName: 'Neha', lastName: 'Patel',
      currentRole: 'VP of Preconstruction',
      companyName: 'Northgate Builders', companyDomain: 'northgate.build',
      linkedinUrl: 'https://www.linkedin.com/in/neha-patel-precon/',
      emailGuess: 'npatel@northgate.build', emailConfidence: 'probable',
      seniority: 'executive', status: 'stale',
    },
    {
      firstName: 'Arjun', lastName: 'Nair',
      currentRole: 'Operations Manager',
      companyName: 'BuildSmart AEC', companyDomain: 'buildsmart.co',
      linkedinUrl: 'https://www.linkedin.com/in/arjun-nair-ops/',
      emailGuess: 'a.nair@buildsmart.co', emailConfidence: 'probable',
      seniority: 'manager', status: 'fresh',
    },
  ];

  for (const s of seeds) upsertLead({ ...s, source: 'seed' });
  return { seeded: true, count: seeds.length };
}
