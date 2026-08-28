import React from 'react';
import { CalendarDays, TrendingUp, TrendingDown, Zap, PlusCircle, MinusCircle, Sparkles, Clock, ArrowRight, Bell } from 'lucide-react';
import { TargetAccount, SignalChange, SignalChangeKind } from '../types';
import { loadChangesWithinDigestWindow, loadSnapshots, relativeTime } from '../utils/snapshots';

const KIND_META: Record<SignalChangeKind, { Icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  moved_to_immediate:     { Icon: Zap,          tone: 'rose',    label: 'Moved to Immediate Action' },
  moved_out_of_immediate: { Icon: MinusCircle,  tone: 'slate',   label: 'Cooled off' },
  new_signal:             { Icon: Sparkles,     tone: 'amber',   label: 'New signal detected' },
  lost_signal:            { Icon: MinusCircle,  tone: 'slate',   label: 'Signal dropped' },
  fit_score_up:           { Icon: TrendingUp,   tone: 'emerald', label: 'Fit score rose' },
  fit_score_down:         { Icon: TrendingDown, tone: 'orange',  label: 'Fit score fell' },
  timing_advanced:        { Icon: Clock,        tone: 'indigo',  label: 'Timing advanced' },
  new_account:            { Icon: PlusCircle,   tone: 'blue',    label: 'New account' },
};

const TONE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  rose:    { bg: 'bg-rose-50 dark:bg-rose-950/40',       text: 'text-rose-700 dark:text-rose-300',       ring: 'border-rose-200 dark:border-rose-800/60' },
  slate:   { bg: 'bg-slate-100 dark:bg-slate-800',        text: 'text-slate-700 dark:text-slate-300',     ring: 'border-slate-200 dark:border-slate-700' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-950/40',      text: 'text-amber-700 dark:text-amber-300',     ring: 'border-amber-200 dark:border-amber-800/60' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40',  text: 'text-emerald-700 dark:text-emerald-300', ring: 'border-emerald-200 dark:border-emerald-800/60' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-950/40',    text: 'text-orange-700 dark:text-orange-300',   ring: 'border-orange-200 dark:border-orange-800/60' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-950/40',    text: 'text-indigo-700 dark:text-indigo-300',   ring: 'border-indigo-200 dark:border-indigo-800/60' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-950/40',        text: 'text-blue-700 dark:text-blue-300',       ring: 'border-blue-200 dark:border-blue-800/60' },
};

const IMPACT_PILL: Record<SignalChange['impact'], string> = {
  high:   'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300',
  medium: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300',
  low:    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
};

export function WeeklyDigest({
  accounts,
  onOpenAccount,
}: {
  accounts: TargetAccount[];
  onOpenAccount?: (accountId: string) => void;
}) {
  const changes = React.useMemo(() => loadChangesWithinDigestWindow(accounts), [accounts]);
  const snapshots = React.useMemo(() => loadSnapshots(), []);

  // Group by day for the digest layout.
  const grouped = React.useMemo(() => {
    const buckets = new Map<string, SignalChange[]>();
    for (const c of changes) {
      const day = new Date(c.detectedAt).toDateString();
      const arr = buckets.get(day) ?? [];
      arr.push(c);
      buckets.set(day, arr);
    }
    return Array.from(buckets.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [changes]);

  const totals = React.useMemo(() => {
    const t = { high: 0, medium: 0, low: 0 };
    for (const c of changes) t[c.impact]++;
    return t;
  }, [changes]);

  return (
    <div className="space-y-6">
      {/* Header banner — motivates the tab. */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden shadow-xs border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/30 via-transparent to-slate-900 opacity-80" />
        <div className="relative flex items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[12px] font-bold uppercase tracking-normal border border-amber-500/30">
              <CalendarDays className="w-3" />
              <span>7-Day Signal Digest</span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-white font-sans">What changed while you were away</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
              Snapshots run once every 24h. This digest compares each snapshot to its predecessor and highlights accounts whose fit, timing, priority, or signals have moved — so you know where to focus Monday morning without re-reading every account.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <DigestStat label="High-impact" value={totals.high} tone="rose" />
            <DigestStat label="Medium" value={totals.medium} tone="amber" />
            <DigestStat label="Low" value={totals.low} tone="slate" />
          </div>
        </div>
      </div>

      {/* Snapshot state summary. */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 p-4 flex items-center gap-3 text-[12px] text-slate-600 dark:text-slate-300">
        <CalendarDays className="w-4 h-4 text-slate-400" />
        <span>
          {snapshots.length === 0
            ? 'No snapshots captured yet. Your first snapshot will be taken shortly — check back in 24h to see what moved.'
            : snapshots.length === 1
            ? `1 snapshot captured (${relativeTime(snapshots[0].takenAt)}). Second snapshot needed before the digest can compute deltas.`
            : `${snapshots.length} snapshots captured. Oldest: ${relativeTime(snapshots[0].takenAt)} · Newest: ${relativeTime(snapshots[snapshots.length - 1].takenAt)}`}
        </span>
      </div>

      {/* Empty state. */}
      {changes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-205 dark:border-slate-700 rounded-3xl">
          <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">No signal changes in the last 7 days</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed font-sans">
            {snapshots.length < 2
              ? 'Digest becomes active once you have at least two snapshots. Come back tomorrow.'
              : 'Your account fit, timing, and signals are steady across the last week. Try re-running analysis on stale accounts to refresh their signals.'}
          </p>
        </div>
      ) : (
        /* Grouped-by-day list. */
        <div className="space-y-5">
          {grouped.map(([day, dayChanges]) => (
            <section key={day} className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                <span>{day}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>{dayChanges.length} change{dayChanges.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="space-y-2">
                {dayChanges.map((c) => {
                  const meta = KIND_META[c.kind];
                  const tone = TONE_STYLES[meta.tone];
                  const { Icon } = meta;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpenAccount?.(c.accountId)}
                        className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 p-4 flex items-start gap-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all group"
                      >
                        <div className={`w-9 h-9 rounded-xl ${tone.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${tone.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tone.text} ${tone.bg} ${tone.ring}`}>
                                  {meta.label}
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${IMPACT_PILL[c.impact]}`}>
                                  {c.impact}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">{relativeTime(c.detectedAt)}</span>
                              </div>
                              <div className="text-[13.5px] text-slate-800 dark:text-slate-200 leading-snug break-words">
                                {c.summary}
                              </div>
                              {(c.from !== undefined || c.to !== undefined) && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                                  {String(c.from ?? '—')} <ArrowRight className="w-3 h-3 inline mx-1 mb-0.5" /> {String(c.to ?? '—')}
                                </div>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 shrink-0 transition-colors" />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DigestStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const t = TONE_STYLES[tone];
  return (
    <div className={`text-center rounded-xl border px-3 py-2 min-w-[72px] ${t.bg} ${t.ring}`}>
      <div className={`text-lg font-bold font-mono ${t.text}`}>{value}</div>
      <div className={`text-[9px] uppercase tracking-wider font-semibold ${t.text} opacity-70`}>{label}</div>
    </div>
  );
}
