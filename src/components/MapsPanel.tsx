import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TargetAccount } from '../types';
import { MapPin, X, Phone, Globe, Star, ExternalLink, Loader2, AlertCircle, Users, Plus, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

interface RelatedCompany {
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
  distanceMeters: number | null;
  distanceLabel: string | null;
}

interface PrimaryPlace {
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
}

interface MapsPanelProps {
  account: TargetAccount | null;
  open: boolean;
  onClose: () => void;
  // Bumped by the Dashboard whenever a new discovery / search runs so the
  // panel invalidates any in-flight fetches and re-queries for the current
  // account. Prevents stale results from a previous search.
  searchGeneration: number;
  // Service/industry keyword the panel uses to find nearby similar businesses
  // (e.g. "infusion therapy" for AleraCare). Derived by Dashboard from the
  // account's own industry, the seller's ICP target industry, and description.
  keyword?: string;
  // Optional callback so the user can pull a related company back into the
  // Market Pulse pipeline as a new discovered account.
  onAddToPipeline?: (payload: { name: string; domain?: string; phone?: string; address?: string }) => void;
  // Focuses the selected related company inside AccountDetail (opens the
  // Related tab in the future — for now shows Google Maps details in a tab).
  onViewDetails?: (payload: { name: string; placeId: string | null }) => void;
}

export function MapsPanel({ account, open, onClose, searchGeneration, keyword, onAddToPipeline, onViewDetails }: MapsPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [primary, setPrimary] = React.useState<PrimaryPlace | null>(null);
  const [related, setRelated] = React.useState<RelatedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [missingKey, setMissingKey] = React.useState(false);
  const [activeKeyword, setActiveKeyword] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !account) {
      setPrimary(null);
      setRelated([]);
      setError(null);
      setMissingKey(false);
      setActiveKeyword(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setMissingKey(false);
    setPrimary(null);
    setRelated([]);

    fetch('/api/maps/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: account.name,
        geography: account.geography,
        domain: account.domain,
        keyword: keyword || account.industry || '',
        count: 8,
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
        setPrimary(body?.primary ?? null);
        setRelated(Array.isArray(body?.related) ? body.related : []);
        setActiveKeyword(body?.keyword ?? null);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load related companies');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [open, account?.id, keyword, searchGeneration]);

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
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Related companies near</div>
                <div className="text-sm font-semibold text-zinc-100 truncate" title={account?.name}>
                  {account?.name || 'No account selected'}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
                title="Close Related Companies panel"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {!account ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                  <MapPin className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>Select an account to see similar businesses nearby.</p>
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
                    Finding similar businesses near {account.name}…
                  </div>
                  {[...Array(4)].map((_, i) => (
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
                  {/* Primary anchor summary */}
                  {primary && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Anchor</div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{primary.name}</div>
                          {primary.formattedAddress && (
                            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{primary.formattedAddress}</div>
                          )}
                        </div>
                        {primary.mapsUrl && (
                          <a
                            href={primary.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline shrink-0 inline-flex items-center gap-0.5"
                          >
                            Maps <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search context */}
                  {activeKeyword && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 px-1">
                      <span>Searching for</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{activeKeyword}</span>
                      {primary && <span>near {primary.name}</span>}
                    </div>
                  )}

                  {/* Related companies list */}
                  {related.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No similar businesses found near {primary?.name || account.name}.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                        {related.length} nearby prospect{related.length === 1 ? '' : 's'} · ranked by rating & proximity
                      </div>
                      {related.map((c: RelatedCompany, i: number) => (
                        <React.Fragment key={c.placeId || `${c.name}-${i}`}>
                          <RelatedCompanyCard
                            company={c}
                            onAddToPipeline={onAddToPipeline}
                            onViewDetails={onViewDetails}
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

interface RelatedCompanyCardProps {
  company: RelatedCompany;
  onAddToPipeline?: MapsPanelProps['onAddToPipeline'];
  onViewDetails?: MapsPanelProps['onViewDetails'];
}

function RelatedCompanyCard({ company, onAddToPipeline, onViewDetails }: RelatedCompanyCardProps) {
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
          {company.rating != null && (
            <div className="flex items-center gap-1.5 text-[11.5px] mt-0.5">
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                <Star className="w-3 h-3 fill-current" />
                <span className="font-semibold text-slate-800 dark:text-slate-100">{company.rating.toFixed(1)}</span>
              </span>
              {company.ratingsCount != null && (
                <span className="text-slate-500 dark:text-slate-400">({company.ratingsCount.toLocaleString()})</span>
              )}
              {company.distanceLabel && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">{company.distanceLabel}</span>
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
        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails({ name: company.name, placeId: company.placeId })}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            View details
          </button>
        )}
      </div>
    </div>
  );
}
