import React from 'react';
import { Mail, Copy, Check, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

export function EmailPatternWidget({ domain, companyName }: { domain: string; companyName?: string }) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [pattern, setPattern] = React.useState<LearnedPattern | null>(null);
  const [guess, setGuess] = React.useState<Guess | null>(null);
  const [loading, setLoading] = React.useState<'pattern' | 'guess' | null>(null);
  const [copied, setCopied] = React.useState(false);

  const learnPattern = React.useCallback(async () => {
    if (!domain) return;
    setLoading('pattern');
    try {
      const r = await fetch('/api/learn-email-pattern', {
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
    try {
      const r = await fetch('/api/guess-email', {
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

  const copy = React.useCallback(() => {
    if (!guess?.email) return;
    navigator.clipboard.writeText(guess.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
              title="Copy email"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
            </button>
          </div>
          <div className="flex items-start gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
            <Info className="w-3 h-3 mt-[1px] shrink-0" />
            <span>{guess.reason}</span>
          </div>
        </div>
      )}
    </div>
  );
}
