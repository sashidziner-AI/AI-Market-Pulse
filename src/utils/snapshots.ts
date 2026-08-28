import { TargetAccount, AccountSnapshot, SignalChange, SignalChangeKind } from '../types';

// localStorage keys — kept together so we can grep for them from one place.
const SNAPSHOTS_KEY = 'gtm_account_snapshots';
const READ_CHANGE_IDS_KEY = 'gtm_read_change_ids';

// How many snapshots to retain. Snapshots are captured no more than once per
// 24h (see shouldCaptureSnapshot), so 12 = ~12 weeks of history for the
// Weekly Digest tab. Old entries are trimmed FIFO.
const SNAPSHOT_MAX_KEEP = 12;

// Minimum hours between snapshots. Prevents Dashboard remounts from flooding
// localStorage with near-identical entries.
const SNAPSHOT_MIN_INTERVAL_HOURS = 24;

// A fitScore change smaller than this is treated as noise and suppressed.
// Scores are 0-100; a 5-point move is meaningful, sub-5 is often re-scoring drift.
const FIT_SCORE_DELTA = 5;

// Weekly Digest window (days). Changes older than this are excluded from
// both the digest tab and the bell dropdown.
const DIGEST_WINDOW_DAYS = 7;

const TIMING_RANK: Record<NonNullable<TargetAccount['timingStage']>, number> = {
  'Early Awareness': 1,
  'Active Evaluation': 2,
  'Urgent Decision': 3,
};

export function loadSnapshots(): AccountSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snaps: AccountSnapshot[]) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(-SNAPSHOT_MAX_KEEP)));
  } catch {
    // localStorage full — silently drop. The bell will show fewer changes but
    // the rest of the app is unaffected.
  }
}

export function shouldCaptureSnapshot(): boolean {
  const snaps = loadSnapshots();
  if (snaps.length === 0) return true;
  const last = snaps[snaps.length - 1];
  const ageHours = (Date.now() - new Date(last.takenAt).getTime()) / 3_600_000;
  return ageHours >= SNAPSHOT_MIN_INTERVAL_HOURS;
}

export function captureSnapshot(accounts: TargetAccount[]): AccountSnapshot | null {
  // Skip empty account lists — capturing a snapshot with 0 accounts would
  // cause every account to look "new" on the next real capture.
  if (accounts.length === 0) return null;
  const snap: AccountSnapshot = {
    takenAt: new Date().toISOString(),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      fitScore: a.fitScore,
      priorityFlag: a.priorityFlag,
      timingStage: a.timingStage,
      signals: [...(a.signals ?? [])],
    })),
  };
  const existing = loadSnapshots();
  saveSnapshots([...existing, snap]);
  return snap;
}

// Compare `current` (the live accounts) against `previous` (the most recent
// prior snapshot) and emit a list of SignalChanges. Deterministic — same
// inputs → same outputs → stable ids for read-state tracking.
export function computeChanges(
  current: TargetAccount[],
  previous: AccountSnapshot | null,
): SignalChange[] {
  if (!previous) return [];
  const out: SignalChange[] = [];
  const detectedAt = new Date().toISOString();
  const prevById = new Map(previous.accounts.map((a) => [a.id, a]));
  const currentIds = new Set(current.map((a) => a.id));

  for (const a of current) {
    const p = prevById.get(a.id);

    // Brand-new account since last snapshot.
    if (!p) {
      out.push({
        id: `${a.id}::new_account::${previous.takenAt}`,
        accountId: a.id,
        accountName: a.name,
        accountDomain: a.domain,
        kind: 'new_account',
        impact: 'medium',
        detectedAt,
        summary: `New account discovered: ${a.name} (fit ${a.fitScore})`,
      });
      continue;
    }

    // Priority wave transitions.
    const wasImmediate = p.priorityFlag === 'Immediate Action Required';
    const nowImmediate = a.priorityFlag === 'Immediate Action Required';
    if (!wasImmediate && nowImmediate) {
      out.push({
        id: `${a.id}::moved_to_immediate::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'moved_to_immediate', impact: 'high', detectedAt,
        from: p.priorityFlag ?? '—',
        to: a.priorityFlag ?? '—',
        summary: `${a.name} moved into Immediate Action`,
      });
    } else if (wasImmediate && !nowImmediate) {
      out.push({
        id: `${a.id}::moved_out_of_immediate::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'moved_out_of_immediate', impact: 'low', detectedAt,
        from: p.priorityFlag ?? '—',
        to: a.priorityFlag ?? '—',
        summary: `${a.name} cooled off — now ${a.priorityFlag ?? 'un-flagged'}`,
      });
    }

    // Fit score deltas.
    const scoreDelta = a.fitScore - p.fitScore;
    if (scoreDelta >= FIT_SCORE_DELTA) {
      out.push({
        id: `${a.id}::fit_score_up::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'fit_score_up',
        impact: scoreDelta >= 15 ? 'high' : 'medium',
        detectedAt, from: p.fitScore, to: a.fitScore,
        summary: `${a.name} fit score rose ${p.fitScore} → ${a.fitScore} (+${scoreDelta})`,
      });
    } else if (scoreDelta <= -FIT_SCORE_DELTA) {
      out.push({
        id: `${a.id}::fit_score_down::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'fit_score_down',
        impact: scoreDelta <= -15 ? 'medium' : 'low',
        detectedAt, from: p.fitScore, to: a.fitScore,
        summary: `${a.name} fit score dropped ${p.fitScore} → ${a.fitScore} (${scoreDelta})`,
      });
    }

    // Timing stage progression (only "up" is meaningful — regressions are usually re-analysis noise).
    if (p.timingStage && a.timingStage) {
      const prevRank = TIMING_RANK[p.timingStage];
      const nowRank = TIMING_RANK[a.timingStage];
      if (nowRank > prevRank) {
        out.push({
          id: `${a.id}::timing_advanced::${previous.takenAt}`,
          accountId: a.id, accountName: a.name, accountDomain: a.domain,
          kind: 'timing_advanced', impact: nowRank === 3 ? 'high' : 'medium',
          detectedAt, from: p.timingStage, to: a.timingStage,
          summary: `${a.name} timing advanced: ${p.timingStage} → ${a.timingStage}`,
        });
      }
    }

    // New / lost signals. Compare as string sets (case-insensitive).
    const prevSet = new Set((p.signals ?? []).map((s) => s.toLowerCase().trim()));
    const currSet = new Set((a.signals ?? []).map((s) => s.toLowerCase().trim()));
    const addedSignals = (a.signals ?? []).filter((s) => !prevSet.has(s.toLowerCase().trim()));
    const lostSignals = (p.signals ?? []).filter((s) => !currSet.has(s.toLowerCase().trim()));

    for (const signal of addedSignals) {
      out.push({
        id: `${a.id}::new_signal::${signal.slice(0, 40)}::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'new_signal', impact: 'medium',
        detectedAt, signal,
        summary: `${a.name}: new signal — ${signal}`,
      });
    }
    for (const signal of lostSignals) {
      out.push({
        id: `${a.id}::lost_signal::${signal.slice(0, 40)}::${previous.takenAt}`,
        accountId: a.id, accountName: a.name, accountDomain: a.domain,
        kind: 'lost_signal', impact: 'low',
        detectedAt, signal,
        summary: `${a.name}: signal dropped — ${signal}`,
      });
    }
  }

  // Sort: high-impact first, then most recently detected.
  const impactRank: Record<SignalChange['impact'], number> = { high: 3, medium: 2, low: 1 };
  out.sort((a, b) => impactRank[b.impact] - impactRank[a.impact]);

  // Suppress: warn if a completely wiped account list produced an avalanche
  // of new_account entries (typically means user cleared then re-ran).
  if (previous.accounts.length === 0 && current.length > 3) {
    return out.filter((c) => c.kind !== 'new_account');
  }

  return out;
}

// Convenience: returns all changes across the last DIGEST_WINDOW_DAYS
// (comparing each snapshot to its predecessor). Powers the Weekly Digest tab.
export function loadChangesWithinDigestWindow(current: TargetAccount[]): SignalChange[] {
  const snaps = loadSnapshots();
  if (snaps.length === 0) return [];
  const cutoff = Date.now() - DIGEST_WINDOW_DAYS * 86_400_000;
  const relevant = snaps.filter((s) => new Date(s.takenAt).getTime() >= cutoff);
  if (relevant.length === 0) return [];

  const allChanges: SignalChange[] = [];
  // Diff each snapshot against its predecessor.
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const nextTs = new Date(snaps[i].takenAt).getTime();
    if (nextTs < cutoff) continue;
    // Rebuild "current-shape" pseudo-accounts from snapshot i for the diff util.
    const pseudo: TargetAccount[] = snaps[i].accounts.map((a) => ({
      id: a.id, name: a.name, domain: a.domain,
      description: '', fitReason: '', signals: a.signals,
      fitScore: a.fitScore, priorityFlag: a.priorityFlag, timingStage: a.timingStage,
      outreachAngle: '', status: 'new',
    }));
    const changes = computeChanges(pseudo, prev);
    // Overwrite detectedAt with the actual snapshot time so digest ordering is real.
    for (const c of changes) c.detectedAt = snaps[i].takenAt;
    allChanges.push(...changes);
  }
  // Then diff the newest snapshot against `current` (the live workspace) so
  // in-session changes since the last capture also show up.
  const changesSinceLast = computeChanges(current, snaps[snaps.length - 1]);
  allChanges.push(...changesSinceLast);

  // De-dupe by change id (same diff can surface across the two loops above).
  const seen = new Set<string>();
  return allChanges.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

// Read-state tracking for the bell badge. Stored as a Set<string> of change
// ids the user has viewed. Kept bounded so stale ids from wiped accounts
// don't bloat localStorage forever.
export function loadReadChangeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_CHANGE_IDS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function markChangesRead(ids: string[]) {
  const s = loadReadChangeIds();
  for (const id of ids) s.add(id);
  // Cap at 500 to bound growth over months of use.
  const arr = Array.from(s).slice(-500);
  try {
    localStorage.setItem(READ_CHANGE_IDS_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

// One row in the Historical Trend chart: how a single account looked at the
// moment a snapshot was captured. Snapshots that predate the account's
// discovery are excluded (see getAccountTrend below).
export interface AccountTrendPoint {
  takenAt: string;                                   // ISO
  dayLabel: string;                                  // "Mar 12" — used as X axis tick
  fitScore: number;
  timingStage?: 'Early Awareness' | 'Active Evaluation' | 'Urgent Decision';
  timingRank: 0 | 1 | 2 | 3;                         // 0 = unknown; used for secondary chart axis
  priorityFlag?: 'Immediate Action Required' | 'Warm Track' | 'Standard Follow-up' | 'Do Not Pursue';
  signalCount: number;
}

export interface AccountTrendSummary {
  direction: 'up' | 'down' | 'flat' | 'unknown';
  fitDelta: number;                                  // fitScore(latest) - fitScore(earliest); 0 if <2 points
  signalDelta: number;
  weeksTracked: number;                              // rounded to nearest 0.5
  latestSnapshotAt?: string;
  earliestSnapshotAt?: string;
  points: AccountTrendPoint[];
}

// Build the trend series for one account across all snapshots. Snapshots
// without this account are skipped (they belong to a different workspace
// state — usually the account was discovered later).
export function getAccountTrend(
  accountId: string,
  currentAccount?: {
    fitScore: number;
    priorityFlag?: AccountTrendPoint['priorityFlag'];
    timingStage?: AccountTrendPoint['timingStage'];
    signals?: string[];
  } | null,
): AccountTrendSummary {
  const snaps = loadSnapshots();
  const timingRankOf = (stage?: string): 0 | 1 | 2 | 3 => {
    if (!stage) return 0;
    return (TIMING_RANK[stage as keyof typeof TIMING_RANK] as 1 | 2 | 3) ?? 0;
  };

  const points: AccountTrendPoint[] = [];
  for (const s of snaps) {
    const a = s.accounts.find((x) => x.id === accountId);
    if (!a) continue;
    const d = new Date(s.takenAt);
    points.push({
      takenAt: s.takenAt,
      dayLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      fitScore: a.fitScore,
      timingStage: a.timingStage,
      timingRank: timingRankOf(a.timingStage),
      priorityFlag: a.priorityFlag,
      signalCount: (a.signals ?? []).length,
    });
  }

  // Append a synthetic "now" point from the live account so the trend line
  // extends up to the present without waiting 24h for the next snapshot.
  if (currentAccount) {
    const now = new Date();
    const lastAt = points.length > 0 ? new Date(points[points.length - 1].takenAt).getTime() : 0;
    const hoursSinceLast = (now.getTime() - lastAt) / 3_600_000;
    // Only inject "now" if the live values differ or it's been >2h since last snap
    // (avoids a redundant point when Dashboard just captured one).
    const last = points[points.length - 1];
    const differs = !last
      || last.fitScore !== currentAccount.fitScore
      || last.priorityFlag !== currentAccount.priorityFlag
      || last.timingStage !== currentAccount.timingStage
      || last.signalCount !== (currentAccount.signals ?? []).length;
    if (differs || hoursSinceLast > 2) {
      points.push({
        takenAt: now.toISOString(),
        dayLabel: 'Now',
        fitScore: currentAccount.fitScore,
        timingStage: currentAccount.timingStage,
        timingRank: timingRankOf(currentAccount.timingStage),
        priorityFlag: currentAccount.priorityFlag,
        signalCount: (currentAccount.signals ?? []).length,
      });
    }
  }

  const fitDelta = points.length >= 2 ? points[points.length - 1].fitScore - points[0].fitScore : 0;
  const signalDelta = points.length >= 2 ? points[points.length - 1].signalCount - points[0].signalCount : 0;
  const direction: AccountTrendSummary['direction'] =
    points.length < 2 ? 'unknown'
      : fitDelta >= 5 ? 'up'
      : fitDelta <= -5 ? 'down'
      : 'flat';

  const spanMs = points.length >= 2
    ? new Date(points[points.length - 1].takenAt).getTime() - new Date(points[0].takenAt).getTime()
    : 0;
  const weeksTracked = Math.round((spanMs / (7 * 86_400_000)) * 2) / 2; // nearest 0.5

  return {
    direction,
    fitDelta,
    signalDelta,
    weeksTracked,
    latestSnapshotAt: points[points.length - 1]?.takenAt,
    earliestSnapshotAt: points[0]?.takenAt,
    points,
  };
}

// Human-readable "12 min ago" / "3 days ago" for change timestamps.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - then) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
