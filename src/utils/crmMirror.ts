/**
 * crmMirror — client-side simulation of a CRM read/search/update surface.
 *
 * Backed by localStorage today. The exported functions form a stable seam
 * (`search`, `getById`, `upsert`, `patch`, `refresh`) so that when Prospect
 * Accel (or any real CRM) exposes matching endpoints, only the bodies of
 * these functions need to change — callers stay the same.
 *
 * The mirror stores whatever we push, plus mock enrichment fields (owner,
 * leadStatus, opportunityStage, activities) so the UI can render a realistic
 * "existing CRM record" panel and drive the update-vs-create flow.
 */

import type { CRMRecord, CRMActivity, CRMLeadStatus, CRMOpportunityStage, TargetAccount } from '../types';

const STORAGE_KEY = 'gtm_crm_mirror_v1';
const DEFAULT_PROVIDER = 'prospectaccel';

// Rotating mock owners so hydrated records don't all show the same person.
const MOCK_OWNERS = [
  'Priya Menon',
  'Arjun Rao',
  'Sasha Patel',
  'Diego Alvarez',
  'Ines Novak',
];

const LEAD_STATUS_POOL: CRMLeadStatus[] = [
  'New',
  'Contacted',
  'Working',
  'Nurturing',
  'Qualified',
];

const OPP_STAGE_POOL: CRMOpportunityStage[] = [
  'None',
  'Prospecting',
  'Qualification',
  'Proposal',
];

function loadStore(): Record<string, CRMRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, CRMRecord>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private-mode failures are non-fatal — the mirror just resets.
  }
}

function normalizeDomain(d?: string): string {
  if (!d) return '';
  return d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function normalizeName(n?: string): string {
  if (!n) return '';
  return n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function emailDomain(e?: string): string {
  if (!e || !e.includes('@')) return '';
  return normalizeDomain(e.split('@')[1]);
}

function pickBySeed<T>(pool: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

function generateActivities(recordId: string | number, createdAt: string): CRMActivity[] {
  const created = new Date(createdAt);
  return [
    {
      id: `${recordId}-a1`,
      type: 'sync',
      summary: 'Record created via AI Market Pulse push',
      at: createdAt,
      actor: 'AI Market Pulse',
    },
    {
      id: `${recordId}-a2`,
      type: 'note',
      summary: 'Initial research attached from Market Pulse',
      at: new Date(created.getTime() + 60_000).toISOString(),
      actor: 'System',
    },
  ];
}

export interface MatchQuery {
  name?: string;
  domain?: string;
  email?: string;
  linkedin?: string;
}

/**
 * Look up a record by any of the identifiers. Returns the first strong match.
 * Match precedence: exact domain > email domain > normalized-name > linkedin URL.
 */
export function findMatch(q: MatchQuery): CRMRecord | null {
  const store = loadStore();
  const records = Object.values(store);
  if (records.length === 0) return null;

  const qDomain = normalizeDomain(q.domain);
  const qEmailDomain = emailDomain(q.email);
  const qName = normalizeName(q.name);
  const qLinkedin = q.linkedin ? q.linkedin.trim().toLowerCase() : '';

  if (qDomain) {
    const hit = records.find(r => normalizeDomain(r.domain) === qDomain);
    if (hit) return hit;
  }
  if (qEmailDomain) {
    const hit = records.find(r => {
      const rd = normalizeDomain(r.domain);
      const re = emailDomain(r.email);
      return (rd && rd === qEmailDomain) || (re && re === qEmailDomain);
    });
    if (hit) return hit;
  }
  if (qName) {
    const hit = records.find(r => normalizeName(r.name) === qName);
    if (hit) return hit;
  }
  if (qLinkedin) {
    const hit = records.find(r => (r.linkedin || '').trim().toLowerCase() === qLinkedin);
    if (hit) return hit;
  }
  return null;
}

export function search(q: MatchQuery): CRMRecord[] {
  const match = findMatch(q);
  return match ? [match] : [];
}

export function getById(id: string | number): CRMRecord | null {
  const store = loadStore();
  return store[String(id)] ?? null;
}

export interface UpsertInput {
  id?: string | number;
  provider?: string;
  name: string;
  domain?: string;
  email?: string;
  mobile?: string;
  linkedin?: string;
  course?: string;
}

/**
 * Create-or-update. If `id` is provided or a match is found, updates in place;
 * otherwise inserts a new record with mock enrichment.
 */
export function upsert(input: UpsertInput): CRMRecord {
  const store = loadStore();
  const now = new Date().toISOString();

  const existing =
    (input.id && store[String(input.id)]) ||
    findMatch({ name: input.name, domain: input.domain, email: input.email, linkedin: input.linkedin });

  if (existing) {
    const updated: CRMRecord = {
      ...existing,
      name: input.name || existing.name,
      domain: input.domain ?? existing.domain,
      email: input.email ?? existing.email,
      mobile: input.mobile ?? existing.mobile,
      linkedin: input.linkedin ?? existing.linkedin,
      course: input.course ?? existing.course,
      updatedAt: now,
      lastActivityAt: now,
      activities: [
        ...existing.activities,
        {
          id: `${existing.id}-u${existing.activities.length + 1}`,
          type: 'note',
          summary: 'Record updated from AI Market Pulse research',
          at: now,
          actor: 'AI Market Pulse',
        },
      ],
    };
    store[String(existing.id)] = updated;
    saveStore(store);
    return updated;
  }

  const id = input.id ?? `PA-${Date.now().toString(36).toUpperCase()}`;
  const seed = normalizeName(input.name) || String(id);
  const record: CRMRecord = {
    id,
    provider: input.provider ?? DEFAULT_PROVIDER,
    name: input.name,
    domain: input.domain,
    email: input.email,
    mobile: input.mobile,
    linkedin: input.linkedin,
    course: input.course,
    owner: pickBySeed(MOCK_OWNERS, seed),
    leadStatus: pickBySeed(LEAD_STATUS_POOL, seed + 'ls'),
    opportunityStage: pickBySeed(OPP_STAGE_POOL, seed + 'op'),
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    activities: generateActivities(id, now),
  };
  store[String(id)] = record;
  saveStore(store);
  return record;
}

/**
 * Partial update of an existing record. Returns the updated record or null if
 * the id doesn't exist.
 */
export function patch(id: string | number, changes: Partial<UpsertInput>): CRMRecord | null {
  const store = loadStore();
  const existing = store[String(id)];
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: CRMRecord = {
    ...existing,
    ...changes,
    id: existing.id,
    provider: existing.provider,
    updatedAt: now,
    lastActivityAt: now,
    activities: [
      ...existing.activities,
      {
        id: `${existing.id}-p${existing.activities.length + 1}`,
        type: 'note',
        summary: 'Fields patched from AI Market Pulse',
        at: now,
        actor: 'AI Market Pulse',
      },
    ],
  };
  store[String(id)] = updated;
  saveStore(store);
  return updated;
}

/**
 * Re-fetch a record. In this mirror it's just getById, but keeping the seam
 * so callers can wire a real network call later without changing shape.
 */
export function refresh(id: string | number): CRMRecord | null {
  return getById(id);
}

/**
 * Given a TargetAccount + its cached CRM record, return the fields where the
 * research disagrees with the CRM. Used to power the "Update CRM" prompt.
 */
export interface FieldDiff {
  field: string;
  crmValue: string | undefined;
  researchValue: string | undefined;
}

export function diffAccount(account: TargetAccount, record: CRMRecord): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const push = (field: string, crm: string | undefined, research: string | undefined) => {
    const a = (crm ?? '').trim();
    const b = (research ?? '').trim();
    if (b && a !== b) diffs.push({ field, crmValue: crm, researchValue: research });
  };
  push('name', record.name, account.name);
  push('domain', record.domain, account.domain);
  const researchCourse = (account.industry || account.fitReason || '').slice(0, 99);
  push('course', record.course, researchCourse);
  return diffs;
}

export function toUpsertInput(account: TargetAccount): UpsertInput {
  return {
    id: account.crmRecordId,
    provider: account.crmProvider ?? DEFAULT_PROVIDER,
    name: account.name,
    domain: account.domain,
    course: (account.industry || account.fitReason || '').slice(0, 99),
  };
}
