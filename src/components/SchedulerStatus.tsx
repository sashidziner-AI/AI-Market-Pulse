import React from 'react';
import { Clock, RefreshCw, Zap, Play, CheckCircle2, AlertCircle, Users, Mail, Activity, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type JobId = 'lead-health' | 'email-pattern-refresh' | 'persona-discovery';

interface JobResult {
  jobId: JobId;
  ranAt: string;
  durationMs: number;
  scanned: number;
  processed: number;
  changed: number;
  errors: number;
  note: string;
  trigger: 'cron' | 'manual';
}

interface JobHistoryEntry {
  ranAt: string;
  processed: number;
  changed: number;
  errors: number;
  trigger: 'cron' | 'manual';
}

interface Job {
  id: JobId;
  label: string;
  description: string;
  cron: string;
  schedule: string;
  enabled: boolean;
  running: boolean;
  lastResult: JobResult | null;
  history: JobHistoryEntry[];
  nextRunAt: string | null;
}

interface StatusPayload {
  enabled: boolean;
  serverTime: string;
  jobs: Job[];
}

const JOB_ICONS: Record<JobId, React.FC<{ className?: string }>> = {
  'lead-health': Users,
  'email-pattern-refresh': Mail,
  'persona-discovery': Sparkles,
};

const JOB_ACCENTS: Record<JobId, { ring: string; bg: string; text: string; dot: string }> = {
  'lead-health': {
    ring: 'ring-orange-500/20 dark:ring-orange-400/20',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  'email-pattern-refresh': {
    ring: 'ring-blue-500/20 dark:ring-blue-400/20',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  'persona-discovery': {
    ring: 'ring-emerald-500/20 dark:ring-emerald-400/20',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
};

function formatAgo(iso: string, now: number): string {
  const delta = now - new Date(iso).getTime();
  if (delta < 0) return 'just now';
  if (delta < 60_000) return 'just now';
  const min = Math.floor(delta / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function formatCountdown(iso: string | null, now: number): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'any moment';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function Sparkline({ history }: { history: JobHistoryEntry[] }) {
  if (history.length === 0) {
    return <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">No runs yet</div>;
  }
  // Bar height reflects `changed` count (0-max scaled to 6 tiers).
  const max = Math.max(1, ...history.map((h) => h.changed));
  const bars = Array.from({ length: 8 }, (_, i) => history[history.length - 8 + i] ?? null);
  return (
    <div className="flex items-end gap-[2px] h-3.5" title="Last 8 runs — bar height = # changed">
      {bars.map((h, i) => {
        if (!h) return <div key={i} className="w-1.5 h-[2px] rounded-full bg-slate-200 dark:bg-slate-700" />;
        const tier = Math.max(1, Math.round((h.changed / max) * 6));
        const color = h.errors > 0 ? 'bg-amber-400 dark:bg-amber-500' : h.changed > 0 ? 'bg-orange-500 dark:bg-orange-400' : 'bg-emerald-400 dark:bg-emerald-500';
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full ${color}`}
            style={{ height: `${(tier / 6) * 100}%`, minHeight: 2 }}
          />
        );
      })}
    </div>
  );
}

export function SchedulerStatus({ onLeadsRefreshed }: { onLeadsRefreshed?: () => void } = {}) {
  const [payload, setPayload] = React.useState<StatusPayload | null>(null);
  const [runningManual, setRunningManual] = React.useState<JobId | null>(null);
  const [now, setNow] = React.useState(Date.now());

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/status');
      if (!res.ok) return;
      const data = (await res.json()) as StatusPayload;
      setPayload(data);
    } catch {
      // silent — widget is best-effort
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    const status = setInterval(fetchStatus, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(status);
      clearInterval(tick);
    };
  }, [fetchStatus]);

  async function runNow(id: JobId, label: string) {
    setRunningManual(id);
    try {
      const res = await fetch(`/api/scheduler/run/${id}`, { method: 'POST' });
      const data = (await res.json()) as JobResult;
      toast.success(`${label}: ${data.note}`);
      await fetchStatus();
      if (id === 'lead-health' && onLeadsRefreshed) onLeadsRefreshed();
    } catch (e: any) {
      toast.error(`Job failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setRunningManual(null);
    }
  }

  if (!payload) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50/60 dark:from-slate-900/60 dark:to-slate-950/60 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-orange-500" />
            {payload.enabled && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">Scheduled re-runs</h3>
          <span className="text-[10.5px] text-slate-400 dark:text-slate-500">·</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
            {payload.jobs.length} job{payload.jobs.length === 1 ? '' : 's'}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
            payload.enabled
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/60'
              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700'
          }`}
          title={
            payload.enabled
              ? 'Cron is armed. Jobs fire on the schedule below.'
              : 'Cron is disabled. Set ENABLE_SCHEDULER=true in .env to arm. Manual runs still work.'
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${payload.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {payload.enabled ? 'Cron armed' : 'Cron off'}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {payload.jobs.map((job) => {
          const Icon = JOB_ICONS[job.id];
          const accent = JOB_ACCENTS[job.id];
          const busy = runningManual === job.id || job.running;
          const last = job.lastResult;
          const countdown = formatCountdown(job.nextRunAt, now);
          const errorRun = last && last.errors > 0;

          return (
            <div
              key={job.id}
              className={`group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3.5 ring-1 ring-transparent hover:ring-2 ${accent.ring} transition-shadow`}
            >
              {/* Row 1: icon + name + countdown */}
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`relative w-7 h-7 rounded-lg ${accent.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${accent.text}`} />
                    {busy && (
                      <span className={`absolute inset-0 rounded-lg ring-2 ${accent.ring} animate-ping`} />
                    )}
                    {!busy && job.enabled && (
                      <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${accent.dot} ring-2 ring-white dark:ring-slate-900`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">{job.label}</div>
                    <div className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="truncate">{job.schedule}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">
                    {job.enabled ? 'Next in' : 'Cron off'}
                  </div>
                  <div className={`text-[13px] font-bold tabular-nums leading-tight mt-0.5 ${job.enabled ? accent.text : 'text-slate-400 dark:text-slate-600'}`}>
                    {job.enabled ? countdown : '—'}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mb-2.5">{job.description}</p>

              {/* Divider */}
              <div className="h-px bg-slate-100 dark:bg-slate-800 mb-2.5" />

              {/* Row 2: last-run metrics + Run button */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {last ? (
                    <>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 dark:text-slate-300 mb-1">
                        {errorRun ? (
                          <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-medium">Last run {formatAgo(last.ranAt, now)}</span>
                        <span className="text-slate-400 dark:text-slate-500">·</span>
                        <span className="uppercase text-[9.5px] tracking-wider text-slate-400 dark:text-slate-500">{last.trigger}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10.5px] tabular-nums">
                        <MetricPill label="scanned" value={last.scanned} tone="neutral" />
                        <MetricPill label="changed" value={last.changed} tone={last.changed > 0 ? 'accent' : 'neutral'} />
                        <MetricPill label="errors" value={last.errors} tone={last.errors > 0 ? 'warn' : 'neutral'} />
                      </div>
                    </>
                  ) : (
                    <div className="text-[10.5px] text-slate-400 dark:text-slate-500 italic">Not run yet in this session.</div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => runNow(job.id, job.label)}
                  className={`h-7 px-2.5 text-[10.5px] shrink-0 border-slate-200 dark:border-slate-700 ${accent.text} hover:${accent.bg}`}
                >
                  {busy ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-3 h-3 mr-1 fill-current" />
                      Run now
                    </>
                  )}
                </Button>
              </div>

              {/* Row 3: history sparkline */}
              <div className="flex items-end justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                  <span className="text-[9.5px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Recent activity
                  </span>
                </div>
                <Sparkline history={job.history} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'accent' | 'warn' }) {
  const toneClass =
    tone === 'accent'
      ? 'text-orange-700 dark:text-orange-300'
      : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-slate-600 dark:text-slate-400';
  return (
    <span className="flex items-baseline gap-1">
      <span className={`font-semibold ${toneClass}`}>{value}</span>
      <span className="text-[9.5px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
    </span>
  );
}
