import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BusinessAnalysis } from '../types';
import { MapPin, X, Phone, Globe, Star, ExternalLink, Loader2, AlertCircle, Compass, Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { extractDomain } from '../utils/geography';

interface DiscoveredCompany {
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingsCount: number | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  mapsUrl: string | null;
  matchedKeyword: string | null;
  country: string | null;
}

interface MapsPanelProps {
  // The seller's own analyzed business — the panel uses its `services` and
  // `targetIndustries` to build an industry-wide Google Maps search rather
  // than anchoring on a specific selected account. The seller's own name +
  // domain are sent so we can filter their own entry from the results.
  analysis: BusinessAnalysis | null;
  // The URL the user originally submitted for analysis. Used only to derive
  // the seller's own domain so we can filter it out of the results. Country
  // is NOT scoped at query time — searches always run globally and the user
  // narrows client-side via the country chip filter below the results.
  analyzedUrl?: string;
  open: boolean;
  onClose: () => void;
  // Bumped by the Dashboard whenever the pipeline reruns so the panel
  // invalidates any in-flight fetches and re-queries with the fresh analysis.
  searchGeneration: number;
  // Number of businesses to surface (server clamps to 3-25, default 12).
  count?: number;
  // Optional callback so the user can pull a discovered company into the
  // Market Pulse pipeline as a new discovered account.
  onAddToPipeline?: (payload: { name: string; domain?: string; phone?: string; address?: string }) => void;
}

export function MapsPanel({
  analysis,
  analyzedUrl,
  open,
  onClose,
  searchGeneration,
  count,
  onAddToPipeline,
}: MapsPanelProps) {
  const sellerDomain = React.useMemo(
    () => extractDomain(analyzedUrl) || undefined,
    [analyzedUrl]
  );
  const [loading, setLoading] = React.useState(false);
  const [matches, setMatches] = React.useState<DiscoveredCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [missingKey, setMissingKey] = React.useState(false);
  const [activeKeywords, setActiveKeywords] = React.useState<string[]>([]);
  // Client-side country narrower. Empty set = show all countries (default).
  // Filtering never triggers a re-fetch — it works purely on the returned
  // `matches` list via the visibleMatches memo below.
  const [selectedCountries, setSelectedCountries] = React.useState<Set<string>>(() => new Set());

  const servicesSig = (analysis?.services || []).slice(0, 3).join('|');
  const industriesSig = (analysis?.targetIndustries || []).slice(0, 3).join('|');

  // Reset the country filter whenever we're about to load a new result set —
  // the previous countries won't apply to the new business's results.
  React.useEffect(() => {
    setSelectedCountries(new Set());
  }, [analysis?.businessName, servicesSig, industriesSig, searchGeneration]);

  React.useEffect(() => {
    if (!open || !analysis) {
      setMatches([]);
      setError(null);
      setMissingKey(false);
      setActiveKeywords([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setMissingKey(false);
    setMatches([]);

    fetch('/api/maps/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: analysis.businessName,
        services: (analysis.services || []).slice(0, 6),
        industries: (analysis.targetIndustries || []).slice(0, 6),
        domain: sellerDomain,
        // Always run the discovery unscoped — country selection is a
        // client-side narrower, not a query modifier. This gives the user a
        // complete cross-country view first, then optional filtering.
        geography: '',
        count: count ?? 12,
      }),
      signal: ctrl.signal,
    })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (res.status === 503 && body?.missingKey) {
          setMissingKey(true);
          return;
        }
        if (!res.ok) {
          throw new Error(body?.error || `Maps lookup failed (HTTP ${res.status})`);
        }
        setMatches(Array.isArray(body?.matches) ? body.matches : []);
        setActiveKeywords(Array.isArray(body?.keywords) ? body.keywords : []);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load industry matches');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [open, analysis?.businessName, servicesSig, industriesSig, sellerDomain, count, searchGeneration]);

  const primaryIndustry = analysis?.targetIndustries?.[0] || analysis?.services?.[0] || '';

  // Unique countries present in the current result set, ordered by frequency
  // (most-represented first) so the user's most useful filter chips lead.
  const countryFacets = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) {
      const c = (m.country || '').trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [matches]);

  const visibleMatches = React.useMemo(() => {
    if (selectedCountries.size === 0) return matches;
    return matches.filter(m => m.country && selectedCountries.has(m.country));
  }, [matches, selectedCountries]);

  const toggleCountry = (name: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const clearCountryFilter = () => setSelectedCountries(new Set());

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Sticky header */}
            <header className="sticky top-0 z-10 bg-[#2A2A2B] border-b border-white/[0.06] px-4 py-3 flex items-center gap-2 shrink-0">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300">
                <Compass className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <span>Industry Discovery</span>
                  <span
                    className="inline-flex items-center gap-1 text-[9.5px] font-mono normal-case tracking-normal text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded"
                    title="Results include companies from all countries Google surfaces. Use the country filter below to narrow."
                  >
                    <Globe className="w-2.5 h-2.5" />
                    {selectedCountries.size === 0
                      ? 'Global'
                      : selectedCountries.size === 1
                        ? Array.from(selectedCountries)[0]
                        : `${selectedCountries.size} countries`}
                  </span>
                </div>
                <div className="text-sm font-semibold text-zinc-100 truncate" title={primaryIndustry || analysis?.businessName}>
                  {primaryIndustry
                    ? `Companies matching ${primaryIndustry}`
                    : analysis?.businessName
                      ? `${analysis.businessName}'s industry`
                      : 'Google Maps industry search'}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
                title="Close Industry Discovery panel"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {!analysis ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                  <MapPin className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>Analyze a business first to discover matching companies on Google Maps.</p>
                </div>
              ) : missingKey ? (
                <div className="p-6 text-center space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Google Maps API key missing
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Add <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code> to your <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.env</code> and restart the server to enable this panel.
                  </p>
                </div>
              ) : loading ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scanning Google Maps for companies matching your industry & services…
                  </div>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-6 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lookup failed</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* Search context — the actual queries we ran */}
                  {activeKeywords.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Search terms · derived from analyzed website
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeKeywords.slice(0, 8).map((kw, i) => (
                          <span
                            key={`${kw}-${i}`}
                            className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                            title={kw}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional country filter — client-side narrower over the
                      globally fetched result set. No new search is triggered
                      when the user toggles a chip; we filter `matches` in
                      memory via `visibleMatches`. */}
                  {countryFacets.length > 1 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          Filter by country {selectedCountries.size > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 normal-case tracking-normal">
                              · {selectedCountries.size} selected
                            </span>
                          )}
                        </label>
                        {selectedCountries.size > 0 && (
                          <button
                            type="button"
                            onClick={clearCountryFilter}
                            className="text-[10.5px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Show all
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {countryFacets.map(([name, n]) => {
                          const active = selectedCountries.has(name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleCountry(name)}
                              className={`text-[10.5px] font-mono px-1.5 py-0.5 rounded border transition cursor-pointer inline-flex items-center gap-1 ${
                                active
                                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400 dark:hover:border-emerald-500'
                              }`}
                              title={active ? `Remove ${name} filter` : `Show only ${name}`}
                            >
                              {name}
                              <span className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                                {n}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Default is all countries. Selecting chips narrows the list without a new search.
                      </p>
                    </div>
                  )}

                  {/* Results list */}
                  {matches.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No companies found on Google Maps matching this industry & service mix. Try broadening the analyzed services.
                    </div>
                  ) : visibleMatches.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                      <p>No results in the selected countries.</p>
                      <button
                        type="button"
                        onClick={clearCountryFilter}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Clear country filter to see all {matches.length} results
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                        {selectedCountries.size === 0
                          ? `${visibleMatches.length} industry match${visibleMatches.length === 1 ? '' : 'es'} · ranked by rating & review volume`
                          : `${visibleMatches.length} of ${matches.length} shown · filtered by country`}
                      </div>
                      {visibleMatches.map((c, i) => (
                        <React.Fragment key={c.placeId || `${c.name}-${i}`}>
                          <DiscoveredCompanyCard
                            company={c}
                            onAddToPipeline={onAddToPipeline}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface DiscoveredCompanyCardProps {
  company: DiscoveredCompany;
  onAddToPipeline?: MapsPanelProps['onAddToPipeline'];
}

function DiscoveredCompanyCard({ company, onAddToPipeline }: DiscoveredCompanyCardProps) {
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    if (!onAddToPipeline) return;
    const domain = company.website
      ? company.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      : undefined;
    onAddToPipeline({
      name: company.name,
      domain,
      phone: company.phone || undefined,
      address: company.formattedAddress || undefined,
    });
    setAdded(true);
    toast.success(`${company.name} added to your pipeline.`);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
      {/* Header: name + rating */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
            {company.name}
          </div>
          {(company.rating != null || company.matchedKeyword) && (
            <div className="flex items-center gap-1.5 text-[11.5px] mt-0.5 flex-wrap">
              {company.rating != null && (
                <>
                  <span className="inline-flex items-center gap-0.5 text-amber-500">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{company.rating.toFixed(1)}</span>
                  </span>
                  {company.ratingsCount != null && (
                    <span className="text-slate-500 dark:text-slate-400">({company.ratingsCount.toLocaleString()})</span>
                  )}
                </>
              )}
              {company.matchedKeyword && (
                <>
                  {company.rating != null && <span className="text-slate-300 dark:text-slate-600">·</span>}
                  <span
                    className="text-[10.5px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded"
                    title={`Surfaced by search: ${company.matchedKeyword}`}
                  >
                    {company.matchedKeyword}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Address / phone / website */}
      <div className="space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
        {company.formattedAddress && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
            <span className="break-words leading-snug">{company.formattedAddress}</span>
          </div>
        )}
        {company.phone && (
          <a href={`tel:${company.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Phone className="w-3 h-3 text-slate-400" />
            <span>{company.phone}</span>
          </a>
        )}
        {company.website && (
          <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Globe className="w-3 h-3 text-slate-400" />
            <span className="truncate">{company.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {company.mapsUrl && (
          <a
            href={company.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/60"
          >
            <ExternalLink className="w-3 h-3" />
            Open in Maps
          </a>
        )}
        {onAddToPipeline && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={added}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border transition ${
              added
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 cursor-default'
                : 'text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
            }`}
          >
            <Plus className="w-3 h-3" />
            {added ? 'Added to pipeline' : 'Add to pipeline'}
          </button>
        )}
      </div>
    </div>
  );
}
