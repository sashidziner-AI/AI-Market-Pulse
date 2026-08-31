import React from 'react';
import { Check, X, Loader2, ExternalLink, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getWebhookUrl, setWebhookUrl, clearWebhookUrl, sendTestMessage, isValidSlackUrl } from '../utils/slack';

export function SlackSettings({ variant = 'default' }: {
  // 'onDark' forces visible-on-black-bar colors for the always-dark Dashboard
  // header. 'default' keeps the theme-aware landing-header styling.
  variant?: 'default' | 'onDark';
} = {}) {
  const [open, setOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(!!getWebhookUrl());
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleConnected = () => setConnected(!!getWebhookUrl());

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          variant === 'onDark'
            ? 'hover:bg-white/[0.08]'
            : 'hover:bg-stone-200/70 dark:hover:bg-white/[0.06]'
        }`}
        aria-label={`Slack notifications ${connected ? '(connected)' : '(not connected)'}`}
        title={connected ? 'Slack notifications: connected' : 'Connect Slack notifications'}
      >
        <img
          src={`${import.meta.env.BASE_URL}slack-icon.png`}
          alt=""
          aria-hidden="true"
          className={`w-[22px] h-[22px] object-contain ${connected ? '' : 'opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all'}`}
        />
        {connected && (
          <span className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ${
            variant === 'onDark' ? 'ring-[#2A2A2B]' : 'ring-stone-50 dark:ring-[#1F1F20]'
          }`} />
        )}
      </button>

      {open && (
        <SlackPanel connected={connected} onChange={handleConnected} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function SlackPanel({ connected, onChange, onClose }: { connected: boolean; onChange: () => void; onClose: () => void }) {
  const [url, setUrl] = React.useState('');
  const [testing, setTesting] = React.useState(false);
  const currentUrl = getWebhookUrl();

  const doTest = async () => {
    // Test the URL in the input if present, otherwise the saved one.
    const candidate = (url.trim() || currentUrl || '').trim();
    if (!candidate) { toast.error('Paste a webhook URL first'); return; }
    if (!isValidSlackUrl(candidate)) {
      toast.error('Not a valid Slack webhook URL (must be https://hooks.slack.com/services/...)');
      return;
    }
    setTesting(true);
    try {
      const result = await sendTestMessage(candidate);
      if (result.ok) {
        toast.success('Test message delivered — check your Slack channel');
      } else {
        toast.error(`Slack rejected the message: ${result.error}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const doSave = () => {
    const trimmed = url.trim();
    if (!isValidSlackUrl(trimmed)) {
      toast.error('Not a valid Slack webhook URL');
      return;
    }
    setWebhookUrl(trimmed);
    onChange();
    setUrl('');
    toast.success('Slack webhook saved — high-impact signals will notify this channel');
  };

  const doDisconnect = () => {
    clearWebhookUrl();
    onChange();
    setUrl('');
    toast.info('Slack disconnected');
  };

  // Mask the middle of the URL for display so it's not fully visible.
  const maskedUrl = currentUrl ? currentUrl.replace(/\/services\/([^/]+)\/([^/]+)\/([^/]+)$/, (_m, a, _b, c) => `/services/${a}/••••••/${c.slice(-4)}`) : '';

  return (
    <div className="absolute right-0 mt-2 w-[400px] rounded-2xl bg-white dark:bg-[#161618] border border-stone-200/70 dark:border-white/[0.08] shadow-2xl overflow-hidden z-50">
      <div className="px-4 py-3 border-b border-stone-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}slack-icon.png`}
            alt=""
            aria-hidden="true"
            className="w-5 h-5 object-contain"
          />
          <span className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">Slack Notifications</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {connected ? (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-200">Connected</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono break-all leading-relaxed">
              {maskedUrl}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={doTest} disabled={testing} className="flex-1 h-8 text-[11px] gap-1.5">
                {testing ? <><Loader2 className="w-3 h-3 animate-spin" />Sending…</> : <><Send className="w-3 h-3" />Send test</>}
              </Button>
              <Button size="sm" variant="outline" onClick={doDisconnect} className="flex-1 h-8 text-[11px] gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <Trash2 className="w-3 h-3" />Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1.5">
                Incoming Webhook URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00.../B00.../..."
                className="w-full px-2.5 py-2 text-[12px] rounded-md border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#0d0d0e] text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-500 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={doTest} disabled={testing || !url.trim()} className="flex-1 h-8 text-[11px] gap-1.5">
                {testing ? <><Loader2 className="w-3 h-3 animate-spin" />Sending…</> : <><Send className="w-3 h-3" />Test first</>}
              </Button>
              <Button size="sm" onClick={doSave} disabled={!url.trim()} className="flex-1 h-8 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
                <Check className="w-3 h-3" />Save
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-stone-200/70 dark:border-white/[0.06] bg-stone-50/50 dark:bg-white/[0.02] space-y-2">
        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Notifies your channel when an account moves into <span className="font-semibold text-zinc-800 dark:text-zinc-200">Immediate Action</span>, timing advances to <span className="font-semibold text-zinc-800 dark:text-zinc-200">Urgent Decision</span>, or fit score jumps ≥15 points.
        </div>
        <a
          href="https://api.slack.com/messaging/webhooks"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[10.5px] text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
        >
          Get a webhook URL from Slack <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
