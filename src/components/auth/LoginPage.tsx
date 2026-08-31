import React, { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, Sparkles, Copy } from 'lucide-react';
import { AuthLayout, TextField, PasswordField, PrimaryButton } from './AuthLayout';
import { AuthUser, DEMO_CREDENTIALS, loginUser } from '../../utils/auth';

interface LoginPageProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onGoHome?: () => void;
}

export function LoginPage({ onSuccess, onSwitchToRegister, onSwitchToForgot, onGoHome }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    // Small artificial delay so the spinner reads as a real network round-trip.
    setTimeout(() => {
      const result = loginUser(email, password);
      setLoading(false);
      if (!result.ok || !result.user) {
        setError(result.error);
        return;
      }
      toast.success(`Welcome back, ${result.user.name.split(' ')[0]}`);
      onSuccess(result.user);
    }, 350);
  };

  // One-click autofill for the demo credentials chip. Fills both fields and
  // clears any prior error so the user only needs to press Sign in.
  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError(undefined);
  };

  const copyDemo = async () => {
    try {
      await navigator.clipboard.writeText(
        `${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`,
      );
      toast.success('Demo credentials copied');
    } catch {
      toast.error('Copy failed — please type them manually');
    }
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Continue mapping accounts and running your GTM pipeline."
      onGoHome={onGoHome}
      footer={
        <>
          New here?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
          >
            Create an account
          </button>
        </>
      }
    >
      {/* Demo credentials card — one-click autofill so evaluators can sign
          in without registering. Sits above the form so it's the first thing
          seen after the heading. */}
      <div className="mb-5 rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-500/[0.10] to-orange-500/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-orange-300" />
          </div>
          <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-orange-300">
            Try the demo account
          </span>
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-zinc-500 w-16 shrink-0">Email</span>
            <span className="text-[12.5px] text-zinc-200 font-mono">{DEMO_CREDENTIALS.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-zinc-500 w-16 shrink-0">Password</span>
            <span className="text-[12.5px] text-zinc-200 font-mono">{DEMO_CREDENTIALS.password}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fillDemo}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-orange-400/50 text-[12px] font-medium text-zinc-200 transition-all cursor-pointer"
          >
            Fill for me
          </button>
          <button
            type="button"
            onClick={copyDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-orange-400/50 text-[12px] font-medium text-zinc-300 transition-all cursor-pointer"
            aria-label="Copy demo credentials"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

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
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={Lock}
          error={error}
          required
        />
        <div className="flex items-center justify-end -mt-1">
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-[12px] text-zinc-400 hover:text-orange-300 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <PrimaryButton loading={loading} type="submit">
          Sign in
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
