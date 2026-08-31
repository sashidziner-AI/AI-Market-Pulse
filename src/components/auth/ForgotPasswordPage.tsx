import React, { useState } from 'react';
import { toast } from 'sonner';
import { Mail, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { AuthLayout, TextField, PrimaryButton } from './AuthLayout';
import { requestPasswordReset } from '../../utils/auth';

interface ForgotPasswordPageProps {
  onSwitchToLogin: () => void;
  onGotoReset: (token: string) => void;
  onGoHome?: () => void;
}

export function ForgotPasswordPage({ onSwitchToLogin, onGotoReset, onGoHome }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const result = requestPasswordReset(email);
      setLoading(false);
      setSentTo(email);
      // Only real accounts get a token back. Unknown emails silently succeed
      // so an attacker can't enumerate registered addresses.
      if (result.token && result.resetUrl) {
        setResetToken(result.token);
        setResetUrl(result.resetUrl);
        // Also mirror to console so devs can grab it during demo.
        console.info('[demo] reset link:', result.resetUrl);
      } else {
        setResetToken(null);
        setResetUrl(null);
      }
    }, 400);
  };

  const copyLink = async () => {
    if (!resetUrl) return;
    try {
      await navigator.clipboard.writeText(resetUrl);
      toast.success('Reset link copied to clipboard');
    } catch {
      toast.error('Copy failed — grab the link from the field manually');
    }
  };

  return (
    <AuthLayout
      eyebrow="Forgot password"
      title={sentTo ? 'Check your inbox' : 'Reset your password'}
      subtitle={
        sentTo
          ? `If ${sentTo} matches an account, we sent a password reset link. Since this is a demo, the link is shown below.`
          : "Enter the email you signed up with. We'll send a reset link that expires in 30 minutes."
      }
      onGoHome={onGoHome}
      footer={
        <button
          onClick={onSwitchToLogin}
          className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </button>
      }
    >
      {!sentTo ? (
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
            required
          />
          <PrimaryButton loading={loading} type="submit">
            Send reset link
          </PrimaryButton>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-400/25">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-[13px] text-emerald-100/90 leading-relaxed">
                <div className="font-semibold text-emerald-200 mb-0.5">Reset link generated</div>
                In a production build, this would arrive by email within a minute. For the demo, use the link below.
              </div>
            </div>
          </div>

          {resetUrl ? (
            <>
              <div>
                <div className="text-[11.5px] font-mono uppercase tracking-[0.13em] text-zinc-400 mb-1.5">
                  Reset link
                </div>
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={resetUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.09] text-[12px] text-zinc-300 font-mono outline-none focus:border-orange-400/60"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-3 rounded-xl bg-white/[0.05] border border-white/[0.09] hover:border-orange-400/50 hover:bg-white/[0.08] text-zinc-300 transition-colors"
                    aria-label="Copy reset link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <PrimaryButton onClick={() => resetToken && onGotoReset(resetToken)}>
                Open reset page
                <ExternalLink className="w-4 h-4" />
              </PrimaryButton>
            </>
          ) : (
            <div className="text-[13px] text-zinc-400 leading-relaxed">
              No account found for that email, but for privacy we always return the same response. Double-check the
              spelling, or{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-orange-400 hover:text-orange-300 font-medium"
              >
                create a new account
              </button>
              .
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setResetUrl(null);
              setResetToken(null);
            }}
            className="w-full text-[12.5px] text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
          >
            Try a different email
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
