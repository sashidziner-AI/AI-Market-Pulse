import React from 'react';
import { Bell, TrendingUp, TrendingDown, Zap, PlusCircle, MinusCircle, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { TargetAccount, SignalChange, SignalChangeKind } from '../types';
import {
  loadChangesWithinDigestWindow,
  loadReadChangeIds,
  markChangesRead,
  relativeTime,
} from '../utils/snapshots';

const KIND_META: Record<SignalChangeKind, { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  moved_to_immediate:     { Icon: Zap,           color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-950/40' },
  moved_out_of_immediate: { Icon: MinusCircle,   color: 'text-slate-500 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-800' },
  new_signal:             { Icon: Sparkles,      color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40' },
  lost_signal:            { Icon: MinusCircle,   color: 'text-slate-500 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-800' },
  fit_score_up:           { Icon: TrendingUp,    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  fit_score_down:         { Icon: TrendingDown,  color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-950/40' },
  timing_advanced:        { Icon: Clock,         color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  new_account:            { Icon: PlusCircle,    color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-950/40' },
};

const IMPACT_DOT: Record<SignalChange['impact'], string> = {
  high:   'bg-rose-500',
  medium: 'bg-amber-500',
  low:    'bg-slate-400',
};

export function SignalChangesBell({
  accounts,
  onOpenAccount,
}: {
  accounts: TargetAccount[];
  onOpenAccount?: (accountId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [changes, setChanges] = React.useState<SignalChange[]>([]);
  const [readIds, setReadIds] = React.useState<Set<string>>(() => loadReadChangeIds());
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Recompute whenever accounts change, when the dropdown opens, or on a
  // storage event (fires when captureSnapshot runs elsewhere in the app).
  const recompute = React.useCallback(() => {
    setChanges(loadChangesWithinDigestWindow(accounts));
  }, [accounts]);

  React.useEffect(() => { recompute(); }, [recompute]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gtm_account_snapshots' || e.key === 'gtm_accounts') recompute();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [recompute]);

  // Click-outside to close.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = changes.filter((c) => !readIds.has(c.id));
  const unreadCount = unread.length;

  const handleToggle = () => {
    setOpen((v) => {
      // Opening: mark all currently-shown changes read after a short delay
      // (gives the user a moment to see the "new" badge).
      if (!v && unreadCount > 0) {
        window.setTimeout(() => {
          const ids = changes.map((c) => c.id);
          markChangesRead(ids);
          setReadIds(loadReadChangeIds());
        }, 800);
      }
      return !v;
    });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-stone-200/70 dark:hover:bg-white/[0.06] transition-colors"
        aria-label={`Signal changes${unreadCount > 0 ? ` — ${unreadCount} new` : ''}`}
        title={unreadCount > 0 ? `${unreadCount} new signal change${unreadCount === 1 ? '' : 's'}` : 'Signal changes'}
      >
        <Bell className="w-[18px] h-[18px] text-zinc-700 dark:text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none ring-2 ring-stone-50 dark:ring-[#1F1F20]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-h-[520px] rounded-2xl bg-white dark:bg-[#161618] border border-stone-200/70 dark:border-white/[0.08] shadow-2xl overflow-hidden z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-stone-200/70 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">Signal changes</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Last 7 days · {changes.length} total</div>
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                {unreadCount} NEW
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {changes.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  No signal changes yet.<br />
                  Snapshots are captured once every 24h — check back tomorrow.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-white/[0.04]">
                {changes.slice(0, 30).map((c) => {
                  const meta = KIND_META[c.kind];
                  const { Icon } = meta;
                  const isNew = !readIds.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          if (onOpenAccount) onOpenAccount(c.accountId);
                          setOpen(false);
                        }}
                        className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-stone-50 dark:hover:bg-white/[0.03] transition-colors ${isNew ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}
                      >
                        <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[12.5px] text-zinc-800 dark:text-zinc-200 leading-snug break-words">
                              {c.summary}
                            </div>
                            {isNew && <span className={`w-1.5 h-1.5 rounded-full ${IMPACT_DOT[c.impact]} shrink-0 mt-1.5`} />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider">{c.impact}</span>
                            <span className="text-[10px] text-zinc-300 dark:text-zinc-600">•</span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{relativeTime(c.detectedAt)}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-300 dark:text-zinc-600 ml-auto" />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {changes.length > 30 && (
            <div className="px-4 py-2 text-[10.5px] text-center text-zinc-400 dark:text-zinc-500 border-t border-stone-200/70 dark:border-white/[0.06]">
              Showing 30 of {changes.length} — see Weekly Digest for the full list
            </div>
          )}
        </div>
      )}
    </div>
  );
}
