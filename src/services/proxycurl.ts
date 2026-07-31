/**
 * Proxycurl LinkedIn verification service — Phase P1.
 *
 * Two modes, transparent to callers:
 *   - Real: when `PROXYCURL_API_KEY` is set, fetch nubela.co/proxycurl/api/v2/linkedin.
 *   - Stub: no key → return a deterministic no-op profile so the demo runs.
 *
 * The response is normalized to a small internal shape so the DB layer never
 * has to think about Proxycurl-specific fields. Swap this file for a different
 * vendor (Bright Data, PhantomBuster) by only editing `callProxycurl()` —
 * everything downstream is portable.
 */

interface ProxycurlExperience {
  company?: string | null;
  company_linkedin_profile_url?: string | null;
  title?: string | null;
  starts_at?: { day?: number; month?: number; year?: number } | null;
  ends_at?: { day?: number; month?: number; year?: number } | null;
  description?: string | null;
}

interface ProxycurlProfile {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  headline?: string | null;
  occupation?: string | null;
  experiences?: ProxycurlExperience[];
  country_full_name?: string | null;
  public_identifier?: string | null;
}

export interface LinkedinVerifyResult {
  firstName: string;
  lastName: string;
  currentRole: string;
  currentCompany: string;
  currentCompanyDomain: string | null;
  seniority: 'executive' | 'senior' | 'manager' | 'ic';
  reachable: boolean;
  source: 'proxycurl' | 'stub';
  raw?: unknown;
}

const PROXYCURL_ENDPOINT = 'https://nubela.co/proxycurl/api/v2/linkedin';

function inferSeniority(title: string): LinkedinVerifyResult['seniority'] {
  const t = title.toLowerCase();
  if (/(^c[a-z]{2}$|chief |ceo|cto|cfo|coo|cmo|cro|cpo|founder|owner|president|evp|svp)/.test(t)) return 'executive';
  if (/(vp |vice president|head of|director)/.test(t)) return 'senior';
  if (/(manager|lead|principal)/.test(t)) return 'manager';
  return 'ic';
}

function normalizeCompanyDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    // Proxycurl gives you a linkedin.com/company/<slug> URL, not the real
    // company domain. Extract the slug and treat it as a fallback identifier.
    const m = url.match(/linkedin\.com\/company\/([^\/?#]+)/i);
    if (m) return `${m[1].toLowerCase()}.com`;
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Pick the current job from Proxycurl's `experiences` array.
 * Proxycurl returns experiences with `ends_at: null` for the current role.
 * There can be multiple concurrent positions — take the most recent start.
 */
function pickCurrentExperience(exps: ProxycurlExperience[]): ProxycurlExperience | null {
  const current = exps.filter((e) => !e.ends_at);
  if (current.length === 0) return exps[0] ?? null;
  return current.sort((a, b) => {
    const ya = a.starts_at?.year ?? 0;
    const yb = b.starts_at?.year ?? 0;
    return yb - ya;
  })[0];
}

async function callProxycurl(url: string, apiKey: string): Promise<ProxycurlProfile> {
  const params = new URLSearchParams({ url, use_cache: 'if-recent' });
  const res = await fetch(`${PROXYCURL_ENDPOINT}?${params}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Proxycurl ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ProxycurlProfile;
}

/**
 * Deterministic stub. Uses the LinkedIn slug to fabricate a name (matches
 * whatever we seeded) and returns "reachable: true" so the caller can proceed
 * with the merge logic. The stub does NOT invent role changes — it echoes
 * whatever the caller last knew, so the diff is empty and the lead's status
 * flips to `fresh` on refresh. That's honest: without a real key, we're just
 * bumping the verification timestamp.
 */
function stubVerify(linkedinUrl: string, priorHint: Partial<LinkedinVerifyResult>): LinkedinVerifyResult {
  const slugMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/?#]+)/i);
  const slug = slugMatch ? slugMatch[1] : 'unknown-person';
  const parts = slug.split('-');
  const firstName = priorHint.firstName ?? (parts[0]?.charAt(0).toUpperCase() ?? '') + (parts[0]?.slice(1) ?? '');
  const lastName  = priorHint.lastName  ?? (parts[1]?.charAt(0).toUpperCase() ?? '') + (parts[1]?.slice(1) ?? '');

  return {
    firstName: firstName || 'Unknown',
    lastName: lastName || 'Person',
    currentRole: priorHint.currentRole ?? 'Unknown',
    currentCompany: priorHint.currentCompany ?? 'Unknown',
    currentCompanyDomain: priorHint.currentCompanyDomain ?? null,
    seniority: priorHint.seniority ?? 'ic',
    reachable: true,
    source: 'stub',
  };
}

/**
 * Verify a LinkedIn profile URL. Returns normalized profile data.
 *
 * `priorHint` is what we already know from the DB — used by the stub so
 * unauthenticated refresh cycles don't accidentally rewrite good data with
 * URL-slug guesses. Real Proxycurl responses ignore it.
 */
export async function verifyLinkedinProfile(
  linkedinUrl: string,
  priorHint: Partial<LinkedinVerifyResult> = {},
): Promise<LinkedinVerifyResult> {
  const key = process.env.PROXYCURL_API_KEY;

  if (!key) {
    return stubVerify(linkedinUrl, priorHint);
  }

  try {
    // Retry once on transient 5xx / rate-limit (429). Matches the pattern in
    // generateStructuredData() for AI calls.
    let profile: ProxycurlProfile | null = null;
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        profile = await callProxycurl(linkedinUrl, key);
        break;
      } catch (e: any) {
        lastErr = e;
        const msg = e.message || '';
        if (/40[13]|401|403/.test(msg)) throw e; // auth issues — don't retry
        if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (!profile) throw lastErr ?? new Error('Proxycurl returned no profile');

    const current = pickCurrentExperience(profile.experiences ?? []);
    const role = current?.title || profile.occupation || profile.headline || priorHint.currentRole || 'Unknown';
    const company = current?.company || priorHint.currentCompany || 'Unknown';
    const domain = normalizeCompanyDomain(current?.company_linkedin_profile_url) ?? priorHint.currentCompanyDomain ?? null;

    return {
      firstName: profile.first_name || priorHint.firstName || 'Unknown',
      lastName: profile.last_name || priorHint.lastName || 'Person',
      currentRole: role,
      currentCompany: company,
      currentCompanyDomain: domain,
      seniority: inferSeniority(role),
      reachable: true,
      source: 'proxycurl',
      raw: profile,
    };
  } catch (e: any) {
    console.warn(`[Proxycurl] ${e.message || 'unknown error'} — falling back to stub for ${linkedinUrl}`);
    return { ...stubVerify(linkedinUrl, priorHint), reachable: false };
  }
}
