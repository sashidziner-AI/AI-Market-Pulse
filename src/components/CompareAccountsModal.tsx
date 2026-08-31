import React from 'react';
import { X, GitCompare, Trophy, Zap, Users, Swords, TrendingUp, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { TargetAccount } from '../types';
import { getAccountPriorityInfo } from './AccountCard';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: TargetAccount[];   // 2 or 3 items — caller enforces the cap
  onOpenAccount?: (id: string) => void;
}

// Side-by-side comparison of 2-3 accounts. Renders parallel columns with the
// same-shaped rows (fit / priority / timing / signals / personas / competitors /
// outreach) plus a "best pick" banner and per-signal gap highlighting so the
// rep can see instantly which of several warm accounts to chase first.
export function CompareAccountsModal({ open, onClose, accounts, onOpenAccount }: Props) {
  if (!open) return null;
  if (accounts.length < 2) {
    return (
      <ModalShell onClose={onClose}>
        <div className="p-10 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">Pick at least 2 accounts to compare.</div>
        </div>
      </ModalShell>
    );
  }

  // Precompute priority info once per account.
  const rows = accounts.map((a) => ({ account: a, info: getAccountPriorityInfo(a) }));

  // Best pick heuristic: priorityIndex first, tiebreak by fitScore.
  const best = [...rows].sort((a, b) => {
    const pi = (b.info.priorityIndex ?? 0) - (a.info.priorityIndex ?? 0);
    if (pi !== 0) return pi;
    return (b.info.fitScore ?? 0) - (a.info.fitScore ?? 0);
  })[0];

  const bestReason = buildBestReason(best);

  // Signal-gap computation: union of all signals across accounts, then per-column marker
  // showing which are present. Case-insensitive dedupe.
  const normalize = (s: string) => s.toLowerCase().trim();
  const allSignals = Array.from(
    new Set(rows.flatMap((r) => (r.account.signals ?? []).map(normalize))),
  );
  const signalDisplay = new Map<string, string>();
  rows.forEach((r) => (r.account.signals ?? []).forEach((s) => { if (!signalDisplay.has(normalize(s))) signalDisplay.set(normalize(s), s); }));

  const columnCount = accounts.length;

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
            <GitCompare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Side-by-side compare</div>
            <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {accounts.map((a) => a.name).join(' vs. ')}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Best pick banner */}
      <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
        <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Best next-touch</div>
          <div className="text-[13px] text-emerald-900 dark:text-emerald-200 leading-tight">
            <b>{best.account.name}</b> — {bestReason}
          </div>
        </div>
        {onOpenAccount && (
          <Button size="sm" onClick={() => onOpenAccount(best.account.id)} className="h-8 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
            Open <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="overflow-auto">
        {/* Column headers — sticky */}
        <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700" style={{ gridTemplateColumns: `180px repeat(${columnCount}, minmax(0, 1fr))` }}>
          <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200 dark:border-slate-700">
            Attribute
          </div>
          {rows.map((r) => (
            <div key={r.account.id} className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 last:border-r-0">
              <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">{r.account.name}</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{r.account.domain}</div>
              {onOpenAccount && (
                <button onClick={() => onOpenAccount(r.account.id)} className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-flex items-center gap-1">
                  Open detail <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Row: Priority Index (big header stat) */}
        <CompareRow label="Priority Index" icon={<Trophy className="w-3.5 h-3.5" />} columnCount={columnCount}>
          {rows.map((r) => {
            const isBest = r.account.id === best.account.id;
            return (
              <Cell key={r.account.id}>
                <div className={`text-3xl font-bold font-mono leading-none ${isBest ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {r.account.isDisqualified ? '—' : r.info.priorityIndex}
                </div>
                {isBest && !r.account.isDisqualified && (
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mt-0.5">Best pick</div>
                )}
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Fit Score with visual bar */}
        <CompareRow label="Fit Score" icon={<span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block" />} columnCount={columnCount}>
          {rows.map((r) => {
            const max = Math.max(...rows.map((x) => x.info.fitScore ?? 0));
            const isMax = (r.info.fitScore ?? 0) === max && max > 0;
            return (
              <Cell key={r.account.id}>
                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold font-mono ${isMax ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {r.info.fitScore}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${isMax ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ width: `${Math.min(100, r.info.fitScore ?? 0)}%` }} />
                  </div>
                </div>
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Timing Score with visual bar */}
        <CompareRow label="Timing Score" icon={<Clock className="w-3.5 h-3.5" />} columnCount={columnCount}>
          {rows.map((r) => {
            const max = Math.max(...rows.map((x) => x.info.timingScore ?? 0));
            const isMax = (r.info.timingScore ?? 0) === max && max > 0;
            return (
              <Cell key={r.account.id}>
                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold font-mono ${isMax ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {r.info.timingScore}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${isMax ? 'bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ width: `${Math.min(100, r.info.timingScore ?? 0)}%` }} />
                  </div>
                </div>
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Priority Flag */}
        <CompareRow label="Priority Flag" icon={<Zap className="w-3.5 h-3.5" />} columnCount={columnCount}>
          {rows.map((r) => (
            <Cell key={r.account.id}>
              <FlagChip flag={r.info.priorityFlag} />
            </Cell>
          ))}
        </CompareRow>

        {/* Row: Timing Stage */}
        <CompareRow label="Timing Stage" icon={<TrendingUp className="w-3.5 h-3.5" />} columnCount={columnCount}>
          {rows.map((r) => (
            <Cell key={r.account.id}>
              <span className="text-[12px] text-slate-700 dark:text-slate-300 leading-snug">{r.account.timingStage ?? '—'}</span>
            </Cell>
          ))}
        </CompareRow>

        {/* Row: Outreach Window */}
        <CompareRow label="Outreach Window" icon={<Clock className="w-3.5 h-3.5" />} columnCount={columnCount}>
          {rows.map((r) => (
            <Cell key={r.account.id}>
              <span className="text-[12px] text-slate-700 dark:text-slate-300 font-mono leading-snug">{r.info.outreachWindow}</span>
            </Cell>
          ))}
        </CompareRow>

        {/* Row: Signals (with gap highlighting) */}
        <CompareRow label="Signals — gaps highlighted" icon={<Zap className="w-3.5 h-3.5" />} columnCount={columnCount} align="top">
          {rows.map((r) => {
            const mySignals = new Set((r.account.signals ?? []).map(normalize));
            return (
              <Cell key={r.account.id} align="top">
                <div className="space-y-1">
                  {allSignals.map((s) => {
                    const has = mySignals.has(s);
                    const uniqueToOne = has && rows.filter((x) => new Set((x.account.signals ?? []).map(normalize)).has(s)).length === 1;
                    return (
                      <div
                        key={s}
                        className={`text-[10.5px] px-1.5 py-0.5 rounded flex items-start gap-1.5 leading-snug ${
                          !has
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 line-through'
                            : uniqueToOne
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className={`shrink-0 mt-[3px] w-1 h-1 rounded-full ${!has ? 'bg-slate-300 dark:bg-slate-600' : uniqueToOne ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        <span className="min-w-0 break-words">{signalDisplay.get(s) ?? s}</span>
                      </div>
                    );
                  })}
                  {allSignals.length === 0 && <span className="text-[11px] text-slate-400 italic">No signals detected.</span>}
                </div>
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Top personas */}
        <CompareRow label="Top personas" icon={<Users className="w-3.5 h-3.5" />} columnCount={columnCount} align="top">
          {rows.map((r) => {
            const personas = r.account.analysis?.buyerPersonas ?? [];
            return (
              <Cell key={r.account.id} align="top">
                {personas.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">Not analyzed yet.</span>
                ) : (
                  <ul className="space-y-1">
                    {personas.slice(0, 3).map((p, i) => (
                      <li key={i} className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-snug">
                        <b className="text-slate-900 dark:text-slate-100">{p.role}</b>
                        {p.valueAngle && <div className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-2">{p.valueAngle}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Competitors */}
        <CompareRow label="Incumbent competitors" icon={<Swords className="w-3.5 h-3.5" />} columnCount={columnCount} align="top">
          {rows.map((r) => {
            const comps = r.account.analysis?.competitors ?? [];
            return (
              <Cell key={r.account.id} align="top">
                {comps.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">Not analyzed yet.</span>
                ) : (
                  <ul className="space-y-1">
                    {comps.slice(0, 3).map((c, i) => (
                      <li key={i} className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-snug flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                        <span>{c.name}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">({c.displacementPotential})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
            );
          })}
        </CompareRow>

        {/* Row: Outreach angle */}
        <CompareRow label="Outreach angle" icon={<TrendingUp className="w-3.5 h-3.5" />} columnCount={columnCount} align="top">
          {rows.map((r) => (
            <Cell key={r.account.id} align="top">
              <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-snug line-clamp-4">{r.account.outreachAngle || '—'}</p>
            </Cell>
          ))}
        </CompareRow>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CompareRow({ label, icon, columnCount, align = 'center', children }: { label: string; icon?: React.ReactNode; columnCount: number; align?: 'center' | 'top'; children: React.ReactNode }) {
  return (
    <div
      className="grid border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
      style={{ gridTemplateColumns: `180px repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      <div className={`px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ${align === 'top' ? 'items-start pt-3' : ''}`}>
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Cell({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'top'; key?: React.Key }) {
  return (
    <div className={`px-4 py-3 border-r border-slate-200 dark:border-slate-700 last:border-r-0 min-w-0 ${align === 'top' ? '' : 'flex items-center'}`}>
      <div className="w-full">{children}</div>
    </div>
  );
}

function FlagChip({ flag }: { flag?: string }) {
  const tone: Record<string, string> = {
    'Immediate Action Required': 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    'Warm Track':                'bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    'Standard Follow-up':        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    'Do Not Pursue':             'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };
  const cls = tone[flag ?? ''] ?? tone['Standard Follow-up'];
  return <span className={`inline-flex text-[10.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>{flag ?? '—'}</span>;
}

function buildBestReason({ account, info }: { account: TargetAccount; info: ReturnType<typeof getAccountPriorityInfo> }): string {
  const bits: string[] = [];
  bits.push(`priority index ${info.priorityIndex}`);
  if ((info.fitScore ?? 0) >= 80) bits.push(`fit ${info.fitScore}`);
  if ((info.timingScore ?? 0) >= 80) bits.push(`timing ${info.timingScore}`);
  if (info.priorityFlag === 'Immediate Action Required') bits.push('flagged Immediate Action');
  if (account.timingStage === 'Urgent Decision') bits.push('in Urgent Decision stage');
  return `${bits.join(' · ')} — chase first before the window closes.`;
}
