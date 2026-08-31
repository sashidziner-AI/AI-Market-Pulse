import React from 'react';
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon, CalendarDays, Zap } from 'lucide-react';
import { TargetAccount } from '../types';
import { getAccountTrend, AccountTrendPoint, AccountTrendSummary, relativeTime } from '../utils/snapshots';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts';

// Per-account historical trend view. Reads the localStorage snapshot history
// written by App.tsx (auto-captured once per 24h) and renders fit score +
// signal count over time, with priority-flag transitions as reference dots.
export function AccountTrendChart({ account }: { account: TargetAccount }) {
  const summary = React.useMemo<AccountTrendSummary>(
    () => getAccountTrend(account.id, {
      fitScore: account.fitScore,
      priorityFlag: account.priorityFlag,
      timingStage: account.timingStage,
      signals: account.signals,
    }),
    [account.id, account.fitScore, account.priorityFlag, account.timingStage, account.signals],
  );

  const { direction, fitDelta, signalDelta, weeksTracked, points, latestSnapshotAt, earliestSnapshotAt } = summary;

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-8 text-center">
        <LineChartIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Trend history is still warming up</div>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
          Snapshots are captured once every 24 hours. This account has {points.length === 1 ? '1 snapshot' : 'no snapshots'} so far — you&apos;ll see a trend line once there are at least two.
        </p>
        {points.length === 1 && (
          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-2 font-mono">
            First snapshot: {relativeTime(points[0].takenAt)}
          </p>
        )}
      </div>
    );
  }

  // Reference dots for priority-flag transitions — marks WHERE on the fit
  // score line the flag changed. Only mark actual transitions, not repeats.
  const flagColors: Record<NonNullable<AccountTrendPoint['priorityFlag']>, string> = {
    'Immediate Action Required': '#e11d48',
    'Warm Track':                '#0d9488',
    'Standard Follow-up':        '#64748b',
    'Do Not Pursue':             '#94a3b8',
  };
  const flagTransitions: { i: number; p: AccountTrendPoint }[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].priorityFlag !== points[i - 1].priorityFlag && points[i].priorityFlag) {
      flagTransitions.push({ i, p: points[i] });
    }
  }

  const dirMeta = {
    up:      { Icon: TrendingUp,   label: 'Trending up',   colorClass: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'border-emerald-200 dark:border-emerald-800/60' },
    down:    { Icon: TrendingDown, label: 'Cooling',       colorClass: 'text-orange-700 dark:text-orange-300',   bg: 'bg-orange-50 dark:bg-orange-950/40',     ring: 'border-orange-200 dark:border-orange-800/60' },
    flat:    { Icon: Minus,        label: 'Steady',        colorClass: 'text-slate-700 dark:text-slate-300',     bg: 'bg-slate-100 dark:bg-slate-800',         ring: 'border-slate-200 dark:border-slate-700' },
    unknown: { Icon: Minus,        label: 'Not enough data', colorClass: 'text-slate-500 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800',         ring: 'border-slate-200 dark:border-slate-700' },
  }[direction];
  const DirIcon = dirMeta.Icon;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Direction"
          value={dirMeta.label}
          hint={weeksTracked > 0 ? `over ${weeksTracked}w` : 'since first snapshot'}
          tone={direction === 'up' ? 'emerald' : direction === 'down' ? 'orange' : 'slate'}
          Icon={DirIcon}
        />
        <SummaryTile
          label="Fit delta"
          value={`${fitDelta > 0 ? '+' : ''}${fitDelta}`}
          hint={`${points[0].fitScore} → ${points[points.length - 1].fitScore}`}
          tone={fitDelta > 0 ? 'emerald' : fitDelta < 0 ? 'orange' : 'slate'}
        />
        <SummaryTile
          label="Signal delta"
          value={`${signalDelta > 0 ? '+' : ''}${signalDelta}`}
          hint={`${points[0].signalCount} → ${points[points.length - 1].signalCount} signals`}
          tone={signalDelta > 0 ? 'amber' : signalDelta < 0 ? 'slate' : 'slate'}
        />
        <SummaryTile
          label="Snapshots"
          value={`${points.length}`}
          hint={earliestSnapshotAt ? `first ${relativeTime(earliestSnapshotAt)}` : ''}
          tone="indigo"
        />
      </div>

      {/* Chart */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <LineChartIcon className="w-3 h-3 text-indigo-500" />
              Fit Score & Signal Volume Over Time
            </div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5">
              Snapshot cadence: once per 24h · {latestSnapshotAt ? `latest ${relativeTime(latestSnapshotAt)}` : ''}
            </div>
          </div>
          {flagTransitions.length > 0 && (
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hidden md:flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full`} style={{ background: '#e11d48' }} />
              <span>= priority flag transition</span>
            </div>
          )}
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="fitScoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} className="dark:stroke-slate-800" />
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="fit"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                width={30}
                label={{ value: 'Fit', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' }, offset: 12 }}
              />
              <YAxis
                yAxisId="signals"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#f59e0b' }}
                axisLine={{ stroke: '#fde68a' }}
                tickLine={false}
                width={28}
                label={{ value: 'Signals', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#f59e0b' }, offset: 8 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                iconSize={9}
              />
              <Area
                yAxisId="fit"
                type="monotone"
                dataKey="fitScore"
                stroke="#6366f1"
                fill="url(#fitScoreFill)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                name="Fit score"
              />
              <Line
                yAxisId="signals"
                type="monotone"
                dataKey="signalCount"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={{ r: 2.5, fill: '#f59e0b' }}
                name="Signal count"
              />
              {flagTransitions.map(({ i, p }) => (
                <ReferenceDot
                  key={i}
                  x={p.dayLabel}
                  y={p.fitScore}
                  yAxisId="fit"
                  r={6}
                  fill={flagColors[p.priorityFlag!] ?? '#94a3b8'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isFront
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority-flag timeline strip */}
      {flagTransitions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-rose-500" />
            Priority Flag Timeline
          </div>
          <ol className="space-y-1.5">
            {flagTransitions.map(({ i, p }) => (
              <li key={i} className="flex items-center gap-2.5 text-[12px]">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: flagColors[p.priorityFlag!] ?? '#94a3b8' }}
                />
                <span className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500 w-24 shrink-0">
                  {new Date(p.takenAt).toLocaleDateString()}
                </span>
                <span className="text-slate-700 dark:text-slate-200 leading-snug">
                  Flag changed to <b className="font-semibold">{p.priorityFlag}</b>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AccountTrendPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2 text-[11px]">
      <div className="font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
        <CalendarDays className="w-3 h-3" />
        {new Date(p.takenAt).toLocaleString()}
      </div>
      <div className="text-slate-800 dark:text-slate-100">
        <div><span className="font-semibold">Fit:</span> {p.fitScore}</div>
        <div><span className="font-semibold">Signals:</span> {p.signalCount}</div>
        {p.timingStage && <div><span className="font-semibold">Timing:</span> {p.timingStage}</div>}
        {p.priorityFlag && <div><span className="font-semibold">Flag:</span> {p.priorityFlag}</div>}
      </div>
    </div>
  );
}

function SummaryTile({
  label, value, hint, tone, Icon,
}: {
  label: string; value: string; hint: string; tone: 'emerald' | 'orange' | 'amber' | 'slate' | 'indigo'; Icon?: React.ComponentType<{ className?: string }>
}) {
  const toneClasses: Record<string, { bg: string; ring: string; text: string; hint: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40',  ring: 'border-emerald-200 dark:border-emerald-800/60', text: 'text-emerald-700 dark:text-emerald-300', hint: 'text-emerald-800/70 dark:text-emerald-400/80' },
    orange:  { bg: 'bg-orange-50 dark:bg-orange-950/40',    ring: 'border-orange-200 dark:border-orange-800/60',   text: 'text-orange-700 dark:text-orange-300',   hint: 'text-orange-800/70 dark:text-orange-400/80' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-950/40',      ring: 'border-amber-200 dark:border-amber-800/60',     text: 'text-amber-700 dark:text-amber-300',     hint: 'text-amber-800/70 dark:text-amber-400/80' },
    slate:   { bg: 'bg-slate-50 dark:bg-slate-800/60',      ring: 'border-slate-200 dark:border-slate-700',        text: 'text-slate-700 dark:text-slate-300',     hint: 'text-slate-500 dark:text-slate-400' },
    indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-950/40',    ring: 'border-indigo-200 dark:border-indigo-800/60',   text: 'text-indigo-700 dark:text-indigo-300',   hint: 'text-indigo-800/70 dark:text-indigo-400/80' },
  };
  const t = toneClasses[tone];
  return (
    <div className={`rounded-xl border ${t.bg} ${t.ring} p-3`}>
      <div className={`text-[9.5px] font-bold uppercase tracking-wider ${t.text} opacity-80 flex items-center gap-1.5`}>
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-[17px] font-bold font-mono ${t.text} leading-tight mt-1`}>{value}</div>
      <div className={`text-[10.5px] ${t.hint} mt-0.5 font-mono truncate`}>{hint}</div>
    </div>
  );
}
