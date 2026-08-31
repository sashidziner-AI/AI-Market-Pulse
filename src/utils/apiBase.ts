// Subpath-aware URL builder for every browser -> server fetch.
//
// In dev and root-domain deploys, import.meta.env.BASE_URL is '/', so
// apiUrl('/api/foo') returns '/api/foo' unchanged.
//
// In the ai.prospectaccel.com production build (see .env.production →
// VITE_BASE_PATH=/micro-saas/ai-market-pulse/), BASE_URL becomes
// '/micro-saas/ai-market-pulse/', so the same call returns
// '/micro-saas/ai-market-pulse/api/foo'. Nginx strips the prefix before
// forwarding to Node, so server.ts keeps seeing /api/* — no server changes.

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function apiUrl(pathOrQuery: string): string {
  if (!pathOrQuery) return BASE || '/';
  // Absolute URLs pass through unchanged — some callers hit third-party APIs.
  if (/^https?:\/\//i.test(pathOrQuery)) return pathOrQuery;
  const p = pathOrQuery.startsWith('/') ? pathOrQuery : `/${pathOrQuery}`;
  return `${BASE}${p}`;
}

// Prefix for static files served from public/. Vite's static asset resolution
// only rewrites imported modules — raw <img src="/foo.png"> strings hit the
// domain root, which breaks on subpath deploys. Use this helper for any
// hardcoded reference to a file in public/.
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`;
}
