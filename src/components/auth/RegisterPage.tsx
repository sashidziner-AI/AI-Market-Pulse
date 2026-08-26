import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { AuthLayout, TextField, PasswordField, PrimaryButton } from './AuthLayout';
import { AuthUser, registerUser } from '../../utils/auth';

interface RegisterPageProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchToLogin: () => void;
  onGoHome?: () => void;
}

function scorePassword(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Empty', color: 'bg-zinc-700' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 4);
  const map = [
    { label: 'Very weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Strong', color: 'bg-emerald-500' },
    { label: 'Very strong', color: 'bg-emerald-400' },
  ];
  return { score: clamped, ...map[clamped] };
}

export function RegisterPage({ onSuccess, onSwitchToLogin, onGoHome }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    setTimeout(() => {
      const result = registerUser(name, email, password);
      setLoading(false);
      if (!result.ok || !result.user) {
        setError(result.error);
        return;
      }
      toast.success(`Account created — welcome, ${result.user.name.split(' ')[0]}`);
      onSuccess(result.user);
    }, 400);
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Get started in 30 seconds"
      subtitle="No credit card. No setup. Your data stays in your browser."
      onGoHome={onGoHome}
      footer={
        <>
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Full name"
          autoComplete="name"
          placeholder="Jordan Rivera"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={User}
          required
        />
        <TextField
          label="Work email"
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
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={Lock}
          error={error}
          hint="Use 10+ characters with a mix of letters, numbers, and symbols for a stronger password."
          required
        />

        {password && (
          <div className="-mt-1.5">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < strength.score ? strength.color : 'bg-white/[0.07]'
                  }`}
                />
              ))}
            </div>
            <div className="mt-1.5 text-[11px] font-mono uppercase tracking-[0.13em] text-zinc-500">
              Strength: <span className="text-zinc-300">{strength.label}</span>
            </div>
          </div>
        )}

        <PrimaryButton loading={loading} type="submit">
          Create account
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed pt-1">
          By creating an account you agree to our terms and acknowledge this is a hackathon demo — accounts live only
          in your browser's local storage.
        </p>
      </form>
    </AuthLayout>
  );
}
