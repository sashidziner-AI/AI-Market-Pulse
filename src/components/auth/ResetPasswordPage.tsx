import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthLayout, PasswordField, PrimaryButton } from './AuthLayout';
import { resetPassword, verifyResetToken } from '../../utils/auth';

interface ResetPasswordPageProps {
  token: string;
  onSwitchToLogin: () => void;
  onGoHome?: () => void;
}

export function ResetPasswordPage({ token, onSwitchToLogin, onGoHome }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const verification = useMemo(() => verifyResetToken(token), [token]);

  // Auto-bounce to login after a successful reset so the user finishes on a
  // familiar screen rather than staring at a confirmation forever.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onSwitchToLogin, 2500);
    return () => clearTimeout(t);
  }, [done, onSwitchToLogin]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = resetPassword(token, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Password updated — you can now sign in');
      setDone(true);
    }, 400);
  };

  if (!verification.ok) {
    return (
      <AuthLayout
        eyebrow="Reset password"
        title="Link expired or invalid"
        subtitle={verification.error ?? 'This reset link is no longer valid.'}
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
        <div className="p-4 rounded-xl bg-red-500/[0.08] border border-red-400/25 text-[13px] text-red-200/90 leading-relaxed">
          Reset links expire after 30 minutes and can only be used once. Request a new link from the sign-in page.
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        eyebrow="Reset password"
        title="Password updated"
        subtitle={`Signing you back in shortly, ${verification.email ?? ''}…`}
        onGoHome={onGoHome}
      >
        <div className="flex items-center justify-center py-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300" />
          </div>
        </div>
        <PrimaryButton onClick={onSwitchToLogin}>Go to sign in now</PrimaryButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Set a new password"
      subtitle={verification.email ? `Resetting password for ${verification.email}.` : undefined}
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
      <form onSubmit={submit} className="space-y-4">
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={Lock}
          required
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          icon={Lock}
          error={error}
          required
        />
        <PrimaryButton loading={loading} type="submit">
          Update password
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
