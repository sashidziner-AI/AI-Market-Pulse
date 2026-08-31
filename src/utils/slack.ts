import { SignalChange } from '../types';
import { apiUrl } from './apiBase';

// localStorage keys.
const WEBHOOK_KEY = 'gtm_slack_webhook';
const NOTIFIED_IDS_KEY = 'gtm_slack_notified_ids';
const RECENT_SENDS_KEY = 'gtm_slack_recent_sends'; // ISO timestamps for rate limiting

// At most this many messages per rolling hour. Prevents a bulk re-analysis
// from spamming a channel.
const MAX_PER_HOUR = 5;

// Only these change kinds trigger a Slack notification. Everything else stays
// in-app (bell + digest). Keeps the channel signal-to-noise high.
const HIGH_IMPACT_KINDS = new Set<SignalChange['kind']>([
  'moved_to_immediate',
  'timing_advanced',
  'fit_score_up',
]);

export function getWebhookUrl(): string | null {
  try {
    return localStorage.getItem(WEBHOOK_KEY);
  } catch {
    return null;
  }
}

export function setWebhookUrl(url: string) {
  try {
    localStorage.setItem(WEBHOOK_KEY, url);
  } catch { /* noop */ }
}

export function clearWebhookUrl() {
  try {
    localStorage.removeItem(WEBHOOK_KEY);
  } catch { /* noop */ }
}

export function isValidSlackUrl(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]+$/i.test(url.trim());
}

function loadNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveNotifiedIds(ids: Set<string>) {
  try {
    // Cap at 500 to bound growth.
    localStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch { /* noop */ }
}

function loadRecentSends(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_SENDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch { return []; }
}

function saveRecentSends(times: number[]) {
  try { localStorage.setItem(RECENT_SENDS_KEY, JSON.stringify(times.slice(-50))); } catch { /* noop */ }
}

function recordSend() {
  const now = Date.now();
  const cutoff = now - 3_600_000;
  const kept = loadRecentSends().filter((t) => t >= cutoff);
  kept.push(now);
  saveRecentSends(kept);
}

function underRateLimit(): boolean {
  const cutoff = Date.now() - 3_600_000;
  const recent = loadRecentSends().filter((t) => t >= cutoff);
  return recent.length < MAX_PER_HOUR;
}

interface SendResult { ok: boolean; error?: string }

// Low-level send — hits the server proxy. Returns { ok, error }.
async function postToSlack(webhookUrl: string, text: string, blocks?: unknown[]): Promise<SendResult> {
  try {
    const r = await fetch(apiUrl('/api/slack/notify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, text, blocks }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data?.error ?? `HTTP ${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network error' };
  }
}

// Public: send a manual test message. Never rate-limited or dedup-tracked.
export async function sendTestMessage(webhookUrl: string): Promise<SendResult> {
  return postToSlack(
    webhookUrl,
    'AI Market Pulse — Slack connection test',
    [
      { type: 'header', text: { type: 'plain_text', text: 'AI Market Pulse connected' } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "You'll get a message here when an account moves into *Immediate Action Required*, when timing advances to *Urgent Decision*, or when fit score jumps ≥15 points.",
        },
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Test sent from AI Market Pulse • ${new Date().toISOString()}_` }] },
    ],
  );
}

// Convert a SignalChange into Slack Block Kit blocks. Kept minimal — one
// header line + one context line so it renders nicely in a channel.
function buildBlocksForChange(c: SignalChange) {
  const kindLabel: Record<SignalChange['kind'], string> = {
    moved_to_immediate:     ':rotating_light: Immediate Action Required',
    moved_out_of_immediate: 'Cooled off',
    new_signal:             ':sparkles: New signal',
    lost_signal:            'Signal dropped',
    fit_score_up:           ':chart_with_upwards_trend: Fit score rose',
    fit_score_down:         'Fit score fell',
    timing_advanced:        ':stopwatch: Timing advanced',
    new_account:            ':new: New account',
  };
  return [
    { type: 'header', text: { type: 'plain_text', text: kindLabel[c.kind] } },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${c.accountName}* (${c.accountDomain})\n${c.summary}` },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Impact: *${c.impact.toUpperCase()}*` },
        { type: 'mrkdwn', text: `Detected: ${new Date(c.detectedAt).toLocaleString()}` },
      ],
    },
  ];
}

interface NotifyOutcome { sent: number; skippedAlreadyNotified: number; skippedRateLimit: number; failures: number }

// Public: given a fresh list of changes (as produced by loadChangesWithinDigestWindow),
// send Slack messages for any high-impact changes that haven't been notified yet
// and are within the rate limit. Silent for non-eligible changes.
export async function notifyNewChanges(changes: SignalChange[]): Promise<NotifyOutcome> {
  const webhookUrl = getWebhookUrl();
  const outcome: NotifyOutcome = { sent: 0, skippedAlreadyNotified: 0, skippedRateLimit: 0, failures: 0 };
  if (!webhookUrl) return outcome;

  const notified = loadNotifiedIds();
  const eligible = changes.filter((c) => HIGH_IMPACT_KINDS.has(c.kind));

  for (const c of eligible) {
    if (notified.has(c.id)) { outcome.skippedAlreadyNotified++; continue; }
    if (!underRateLimit()) { outcome.skippedRateLimit++; continue; }
    const result = await postToSlack(webhookUrl, `${c.accountName}: ${c.summary}`, buildBlocksForChange(c));
    if (result.ok) {
      notified.add(c.id);
      recordSend();
      outcome.sent++;
    } else {
      outcome.failures++;
    }
  }
  saveNotifiedIds(notified);
  return outcome;
}
