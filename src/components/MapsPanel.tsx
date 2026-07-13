import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TargetAccount } from '../types';
import { MapPin, X, Phone, Globe, Star, Clock, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Place {
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingsCount: number | null;
  openNow: boolean | null;
  weekdayHours: string[] | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  mapEmbedUrl: string | null;
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
}

export function MapsPanel({ account, open, onClose, searchGeneration }: MapsPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [place, setPlace] = React.useState<Place | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [missingKey, setMissingKey] = React.useState(false);

  // Fetch Places data whenever the selected account or the search generation
  // changes. AbortController cancels stale in-flight requests when the user
  // clicks through accounts rapidly, guaranteeing the panel reflects the
  // CURRENT selection instead of whichever request happened to finish last.
  React.useEffect(() => {
    if (!open || !account) {
      setPlace(null);
      setError(null);
      setMissingKey(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setMissingKey(false);
    setPlace(null);

    fetch('/api/maps/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: account.name,
        geography: account.geography,
        domain: account.domain,
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
        setPlace(body?.place ?? null);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load map data');
      })
      .finally(() => {
        // Only clear loading if this fetch wasn't cancelled — the newer one
        // will handle its own state.
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [open, account?.id, searchGeneration]);

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
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Sticky header */}
            <header className="sticky top-0 z-10 bg-[#2A2A2B] border-b border-white/[0.06] px-4 py-3 flex items-center gap-2 shrink-0">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Google Maps</div>
                <div className="text-sm font-semibold text-zinc-100 truncate" title={account?.name}>
                  {account?.name || 'No account selected'}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
                title="Close Maps panel"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {!account ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                  <MapPin className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>Select an account to see its Google Maps profile.</p>
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
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching Google Maps for {account.name}…
                  </div>
                  <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ) : error ? (
                <div className="p-6 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Maps lookup failed</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      // Bump local retry via re-render trick: nudging state.
                      setError(null);
                      setLoading(true);
                      fetch('/api/maps/places', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: account.name, geography: account.geography, domain: account.domain }),
                      })
                        .then(async r => {
                          const b = await r.json().catch(() => ({}));
                          if (!r.ok) throw new Error(b?.error || `HTTP ${r.status}`);
                          setPlace(b?.place ?? null);
                        })
                        .catch(e => setError(e.message))
                        .finally(() => setLoading(false));
                    }}
                    className="mt-2 text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    Retry
                  </button>
                </div>
              ) : !place ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                  <MapPin className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No Google Maps result for {account.name}.</p>
                  {account.geography && (
                    <p className="text-xs">Tried searching within: <span className="font-mono">{account.geography}</span></p>
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Map */}
                  {place.mapEmbedUrl ? (
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-56">
                      <iframe
                        key={place.placeId || place.name}
                        src={place.mapEmbedUrl}
                        title={`Map of ${place.name}`}
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                      />
                    </div>
                  ) : place.lat != null && place.lng != null ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                      Coordinates: {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </div>
                  ) : null}

                  {/* Name + rating */}
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {place.name}
                    </div>
                    {place.rating != null && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{place.rating.toFixed(1)}</span>
                        </span>
                        {place.ratingsCount != null && (
                          <span className="text-slate-500 dark:text-slate-400">
                            ({place.ratingsCount.toLocaleString()} review{place.ratingsCount === 1 ? '' : 's'})
                          </span>
                        )}
                        {place.openNow != null && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className={place.openNow ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                              {place.openNow ? 'Open now' : 'Closed'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contact rows */}
                  <div className="space-y-2 text-[13px]">
                    {place.formattedAddress && (
                      <ContactRow icon={<MapPin className="w-3.5 h-3.5" />} label={place.formattedAddress} onCopy={() => copy(place.formattedAddress!)} />
                    )}
                    {place.phone && (
                      <ContactRow icon={<Phone className="w-3.5 h-3.5" />} label={place.phone} href={`tel:${place.phone.replace(/\s+/g, '')}`} onCopy={() => copy(place.phone!)} />
                    )}
                    {place.website && (
                      <ContactRow icon={<Globe className="w-3.5 h-3.5" />} label={place.website} href={place.website} onCopy={() => copy(place.website!)} />
                    )}
                    {place.mapsUrl && (
                      <a
                        href={place.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open in Google Maps
                      </a>
                    )}
                  </div>

                  {/* Hours */}
                  {place.weekdayHours && place.weekdayHours.length > 0 && (
                    <details className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 select-none">
                        <Clock className="w-3.5 h-3.5" />
                        Opening hours
                      </summary>
                      <ul className="px-3 pb-2 space-y-0.5 text-[11.5px] font-mono text-slate-600 dark:text-slate-300">
                        {place.weekdayHours.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </details>
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

function ContactRow({
  icon,
  label,
  href,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onCopy?: () => void;
}) {
  const content = (
    <span className="text-slate-700 dark:text-slate-200 break-words leading-snug flex-1 min-w-0">{label}</span>
  );
  return (
    <div className="flex items-start gap-2 group">
      <span className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">{icon}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="flex-1 min-w-0 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          {content}
        </a>
      ) : (
        content
      )}
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
          title="Copy"
        >
          Copy
        </button>
      )}
    </div>
  );
}

function copy(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied.'),
    () => toast.error('Copy failed.')
  );
}
