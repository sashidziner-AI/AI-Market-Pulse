// Helpers for the AI Call Scheduler.
//
// The main pain point is converting a user's "wall clock" date+time in an
// arbitrary IANA timezone (e.g. "2026-07-14 15:30 in Asia/Kolkata") into an
// absolute UTC instant, so that the client-side poller can compare it against
// `Date.now()` regardless of the user's own timezone.
//
// We avoid a full-fat tz library by leaning on Intl.DateTimeFormat to query
// the offset of a target zone at a given instant.

// Given an instant, return how far ahead the target zone is from UTC at that
// instant (in ms). Positive for zones east of UTC (Asia/Kolkata → +19800000).
function tzOffsetMsAt(tz: string, instant: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(instant).reduce<Record<string, string>>((a, p) => {
    if (p.type !== 'literal') a[p.type] = p.value;
    return a;
  }, {});
  // Intl uses "24" for midnight on some engines — normalize.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

// Turn a wall-clock date (YYYY-MM-DD) + time (HH:mm) in the given IANA zone
// into a UTC epoch ms. Handles DST correctly by asking the zone what its own
// offset was at that wall time.
export function zonedTimeToUtcMs(dateStr: string, timeStr: string, tz: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) {
    return Number.NaN;
  }
  // First guess: interpret the wall clock as if it were already UTC. That's
  // wrong by exactly the zone's offset, so subtract the offset at that
  // instant. (The offset at the *guess* is close enough to the offset at the
  // *true* instant even across DST switches — errors would only occur inside
  // the ~1h non-existent-hour gap, which we accept.)
  const guessUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMsAt(tz, new Date(guessUtc));
  return guessUtc - offset;
}

// Return the browser's detected IANA timezone. Falls back to UTC if the
// runtime doesn't expose it (very old browsers).
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Curated shortlist of commonly used timezones for the scheduler dropdown.
// The user's detected zone is always prepended (deduped) by the component so
// this list is deliberately compact — extend as needed.
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Denver',      label: 'Denver (MT)' },
  { value: 'America/Chicago',     label: 'Chicago (CT)' },
  { value: 'America/New_York',    label: 'New York (ET)' },
  { value: 'America/Sao_Paulo',   label: 'São Paulo (BRT)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin',       label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Paris',        label: 'Paris (CET/CEST)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
  { value: 'Asia/Dubai',          label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata',        label: 'Mumbai / Kolkata (IST)' },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)' },
  { value: 'Asia/Shanghai',       label: 'Shanghai (CST)' },
  { value: 'Asia/Tokyo',          label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEDT/AEST)' },
  { value: 'UTC',                 label: 'UTC' },
];

// Human-readable label for the schedule — used in toasts, the pending-call
// list, and audit fields. Formatted in the *target* zone (not the viewer's)
// so users always see the same clock they picked.
export function formatWallClock(scheduledForMs: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'short', day: '2-digit',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(scheduledForMs));
  } catch {
    return new Date(scheduledForMs).toISOString();
  }
}

// Default date+time initializer for the scheduler form — 15 minutes from
// "now" in the given zone, rounded to the next 5-minute mark. Returns the
// pair of strings that native <input type="date"> and <input type="time">
// consume ("YYYY-MM-DD" / "HH:mm") formatted in the target zone.
export function defaultScheduleFields(tz: string): { date: string; time: string } {
  const soon = new Date(Date.now() + 15 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(soon).reduce<Record<string, string>>((a, p) => {
    if (p.type !== 'literal') a[p.type] = p.value;
    return a;
  }, {});
  const hh = parts.hour === '24' ? '00' : parts.hour;
  // Round minutes up to nearest 5.
  const m = Number(parts.minute);
  const rounded = Math.min(55, Math.ceil(m / 5) * 5);
  const mm = String(rounded).padStart(2, '0');
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hh}:${mm}`,
  };
}
