import React from 'react';
import { Mail, Copy, Check, Sparkles, Info, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiUrl } from '../utils/apiBase';

type Confidence = 'verified' | 'probable' | 'guess' | 'unknown';

interface LearnedPattern {
  pattern: string;
  template: string;
  confidence: Confidence;
  supportingSamples: number;
  totalSamples: number;
  source?: 'user_samples' | 'hunter_stub';
  isFallback?: boolean;
  savedToDb?: boolean;
  companyId?: string;
  companyName?: string;
}

interface Guess {
  email: string;
  pattern: string;
  confidence: Confidence;
  reason: string;
}

// Matches server.ts VerifyResult shape.
interface VerifyResult {
  email: string;
  deliverable: 'valid' | 'risky' | 'invalid';
  score: number;
  checks: {
    syntax: boolean;
    hasMx: boolean;
    isRoleBased: boolean;
    isDisposable: boolean;
    isFreeMailbox: boolean;
    isCatchAll: boolean | 'unknown';
  };
  mxHost?: string;
  reason: string;
}

const CONF_STYLES: Record<Confidence, { label: string; badge: string; dot: string }> = {
  verified: {
    label: 'Verified',
    badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  probable: {
    label: 'Probable',
    badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    dot: 'bg-blue-500',
  },
  guess: {
    label: 'Guess',
    badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  unknown: {
    label: 'Unknown',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

const VERIFY_STYLES = {
  valid:   { label: 'Deliverable', badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60', Icon: ShieldCheck, iconClass: 'text-emerald-600 dark:text-emerald-400' },
  risky:   { label: 'Risky',       badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',       Icon: ShieldAlert, iconClass: 'text-amber-600 dark:text-amber-400' },
  invalid: { label: 'Invalid',     badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',           Icon: ShieldX,     iconClass: 'text-rose-600 dark:text-rose-400' },
} as const;

export function EmailPatternWidget({ domain, companyName }: { domain: string; companyName?: string }) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [pattern, setPattern] = React.useState<LearnedPattern | null>(null);
  const [guess, setGuess] = React.useState<Guess | null>(null);
  const [loading, setLoading] = React.useState<'pattern' | 'guess' | 'verify' | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [verify, setVerify] = React.useState<VerifyResult | null>(null);

  const learnPattern = React.useCallback(async () => {
    if (!domain) return;
    setLoading('pattern');
    try {
      const r = await fetch(apiUrl('/api/learn-email-pattern'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, companyName }),
      });
      const data = (await r.json()) as LearnedPattern;
      setPattern(data);
      if (data.savedToDb) {
        toast.success(`Pattern saved to ${data.companyName ?? domain} — future leads will use it automatically`);
      } else if (data.isFallback) {
        toast.info('Using simulated LinkedIn/Hunter sample data');
      }
    } catch (e: any) {
      toast.error(`Pattern lookup failed: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }, [domain, companyName]);

  const guessEmail = React.useCallback(async () => {
    if (!firstName.trim() || !lastName.trim() || !domain) return;
    setLoading('guess');
    setCopied(false);
    setVerify(null);
    try {
      const r = await fetch(apiUrl('/api/guess-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          domain,
          pattern: pattern?.pattern,
        }),
      });
      const data = (await r.json()) as Guess;
      setGuess(data);
    } catch (e: any) {
      toast.error(`Guess failed: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }, [firstName, lastName, domain, pattern]);

  const verifyEmail = React.useCallback(async () => {
    if (!guess?.email) return;
    setLoading('verify');
    try {
      const r = await fetch(apiUrl('/api/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guess.email }),
      });
      const data = (await r.json()) as VerifyResult;
      setVerify(data);
      if (data.deliverable === 'invalid') {
        toast.error(`Invalid — ${data.reason}`);
      } else if (data.deliverable === 'risky') {
        toast.warning(`Risky — ${data.reason}`);
      } else {
        toast.success(`Deliverable (score ${data.score}/100)`);
      }
    } catch (e: any) {
      toast.error(`Verify failed: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }, [guess?.email]);

  const copy = React.useCallback(() => {
    if (!guess?.email) return;
    // Guard-rail: if verification came back invalid, force a confirm before
    // the rep can copy the address (this is the CRM-quality safety net).
    if (verify?.deliverable === 'invalid') {
      const proceed = window.confirm(
        `Heads up — this address is flagged as INVALID.\n\nReason: ${verify.reason}\n\nCopy anyway?`
      );
      if (!proceed) return;
    }
    navigator.clipboard.writeText(guess.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [guess?.email, verify]);

  // Any time the guess changes (new name typed, re-guess), the previous
  // verification result is stale — clear it so the rep can't rely on it.
  React.useEffect(() => {
    setVerify(null);
  }, [guess?.email]);

  if (!domain) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
          <Mail className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email Pattern</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{domain}</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={learnPattern}
          disabled={loading === 'pattern'}
          className="h-7 text-[11px] gap-1"
        >
          <Sparkles className="w-3 h-3" />
          {loading === 'pattern' ? 'Learning…' : pattern ? 'Re-learn' : 'Learn pattern'}
        </Button>
      </div>

      {pattern && (
        <div className="space-y-1.5">
          <div className={`rounded-md border px-3 py-2 flex items-center gap-2 ${CONF_STYLES[pattern.confidence].badge}`}>
            <span className={`w-2 h-2 rounded-full ${CONF_STYLES[pattern.confidence].dot}`} />
            <span className="text-[11px] font-mono flex-1 truncate">{pattern.template}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold">
              {CONF_STYLES[pattern.confidence].label} · {pattern.supportingSamples}/{pattern.totalSamples}
            </span>
          </div>
          {pattern.savedToDb && (
            <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-700 dark:text-emerald-400 pl-1">
              <Check className="w-3 h-3" />
              <span>Saved to <span className="font-semibold">{pattern.companyName ?? pattern.template}</span> — every new lead here auto-fills an email</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="px-2.5 py-1.5 text-[12px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="px-2.5 py-1.5 text-[12px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
        />
      </div>

      <Button
        size="sm"
        onClick={guessEmail}
        disabled={loading === 'guess' || !firstName.trim() || !lastName.trim()}
        className="w-full h-8 text-[12px]"
      >
        {loading === 'guess' ? 'Generating…' : 'Guess email'}
      </Button>

      {guess?.email && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="flex-1 text-[13px] font-mono text-slate-900 dark:text-slate-100 truncate">{guess.email}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${CONF_STYLES[guess.confidence].badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${CONF_STYLES[guess.confidence].dot}`} />
              {CONF_STYLES[guess.confidence].label}
            </span>
            <button
              onClick={copy}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={verify?.deliverable === 'invalid' ? 'Copy (will warn — flagged invalid)' : 'Copy email'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
            </button>
          </div>
          <div className="flex items-start gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
            <Info className="w-3 h-3 mt-[1px] shrink-0" />
            <span>{guess.reason}</span>
          </div>

          {/* Deliverability verification — runs MX + role-based + disposable checks. */}
          {!verify ? (
            <Button
              size="sm"
              variant="outline"
              onClick={verifyEmail}
              disabled={loading === 'verify'}
              className="w-full h-7 text-[11px] gap-1.5"
            >
              {loading === 'verify' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking MX + deliverability…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3" />
                  Verify deliverability
                </>
              )}
            </Button>
          ) : (
            (() => {
              const style = VERIFY_STYLES[verify.deliverable];
              const { Icon } = style;
              const chip = (label: string, on: boolean, tone: 'good' | 'bad' | 'neutral') => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                    !on
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through opacity-70'
                      : tone === 'good'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                      : tone === 'bad'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                  }`}
                >
                  {label}
                </span>
              );
              return (
                <div className={`rounded-md border p-2.5 space-y-2 ${style.badge}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 shrink-0 ${style.iconClass}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider flex-1">
                      {style.label}
                    </span>
                    <span className="text-[10px] font-mono font-semibold">
                      score {verify.score}/100
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{verify.reason}</p>
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-current/10">
                    {chip('MX', verify.checks.hasMx, 'good')}
                    {chip('syntax', verify.checks.syntax, 'good')}
                    {verify.checks.isRoleBased && chip('role-based', true, 'bad')}
                    {verify.checks.isDisposable && chip('disposable', true, 'bad')}
                    {verify.checks.isFreeMailbox && chip('free-mail', true, 'neutral')}
                    {verify.checks.isCatchAll === true && chip('catch-all', true, 'neutral')}
                    {verify.checks.isCatchAll === 'unknown' && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 italic px-1">
                        catch-all: not probed
                      </span>
                    )}
                  </div>
                  {verify.mxHost && (
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      MX → {verify.mxHost}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
