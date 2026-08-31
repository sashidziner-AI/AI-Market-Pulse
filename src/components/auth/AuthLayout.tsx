import React, { ReactNode, useEffect, useRef, useId, useState } from 'react';
import type { ComponentType, ChangeEvent, MouseEvent } from 'react';
import { Sparkles, ShieldCheck, Zap, LineChart, ArrowLeft } from 'lucide-react';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onGoHome?: () => void;
}

// Split-screen auth shell. Left panel is a dark branded canvas with an
// ambient rotating gradient orb (pure CSS, no JS runtime cost). Right panel
// hosts the actual form. Both panels stack on mobile.
export function AuthLayout({ eyebrow, title, subtitle, children, footer, onGoHome }: AuthLayoutProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Subtle mount fade so screen transitions between auth pages feel connected.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    el.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    );
  }, [title]);

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[5fr_6fr] bg-[#0b0b0d] text-zinc-100">
      {/* Left: brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r border-white/[0.06]">
        {/* Ambient orb */}
        <div
          className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full opacity-70 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(249,115,22,0.55), rgba(234,88,12,0.25) 55%, transparent 75%)',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-24 w-[420px] h-[420px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(59,130,246,0.35), rgba(29,78,216,0.18) 60%, transparent 78%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/vee-technologies-logo.png"
            alt="Vee Technologies"
            className="w-11 h-11 object-contain select-none"
          />
          <div className="flex flex-col leading-none">
            <span className="font-normal text-[18px] tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>
              <span className="text-orange-400">AI</span> Market Pulse
            </span>
            <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.16em] text-orange-400/90">
              by Vee Technologies
            </span>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative z-10 max-w-md space-y-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.09] text-[10px] font-mono uppercase tracking-[0.14em] text-orange-300 mb-6">
              <Sparkles className="w-3 h-3" />
              GTM intelligence for revenue teams
            </div>
            <h2 className="text-4xl font-normal leading-[1.1] tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>
              Map your market.
              <br />
              <span className="text-orange-400">Discover the accounts</span>
              <br />
              worth your quarter.
            </h2>
            <p className="mt-5 text-sm text-zinc-400 leading-relaxed">
              From website URL to prioritized target accounts with buyer personas, competitor displacement, and
              multi-thread strategy — in under two minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: Zap, label: 'AI-powered account discovery' },
              { icon: LineChart, label: 'Real-time market intelligence' },
              { icon: ShieldCheck, label: 'Enterprise-grade citations' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/25 to-orange-500/5 border border-orange-400/25 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-orange-300" />
                </div>
                <span className="text-[13px] text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">
          © {new Date().getFullYear()} · Hackathon 2026
        </div>
      </aside>

      {/* Right: form panel */}
      <main className="relative flex flex-col items-center justify-center p-6 sm:p-10 bg-[#0f0f11]">
        {/* Compact mobile brand mark */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2.5">
          <img src="/vee-technologies-logo.png" alt="" className="w-9 h-9 object-contain" />
          <span className="font-normal text-[15px] tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>
            <span className="text-orange-400">AI</span> Market Pulse
          </span>
        </div>

        {/* Back-to-home escape hatch — always available so a visitor who
            landed on an auth screen by mistake can bail out without needing
            the browser back button. */}
        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            className="absolute top-6 right-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-400 hover:text-orange-300 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </button>
        )}

        <div ref={cardRef} className="w-full max-w-[420px]" style={{ opacity: 0 }}>
          <div className="mb-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-orange-400 mb-3">{eyebrow}</div>
            <h1 className="text-[28px] font-normal tracking-tight text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-[13.5px] text-zinc-400 leading-relaxed">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-[13px] text-zinc-400 text-center">{footer}</div>}
        </div>

        <div className="mt-10 text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-600">
          Secure · Private · Local demo
        </div>
      </main>
    </div>
  );
}

// ---------------- Shared form primitives ----------------

interface TextFieldProps {
  label: string;
  error?: string;
  icon?: ComponentType<{ className?: string }>;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function TextField({
  label,
  error,
  icon: Icon,
  type = 'text',
  autoComplete,
  placeholder,
  value,
  onChange,
  required,
  readOnly,
  className,
}: TextFieldProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="block text-[11.5px] font-mono uppercase tracking-[0.13em] text-zinc-400 mb-1.5">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        )}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          readOnly={readOnly}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3.5'} pr-3.5 py-2.5 rounded-xl bg-white/[0.04] border ${
            error ? 'border-red-400/60' : 'border-white/[0.09]'
          } text-[14px] text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-orange-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-orange-400/15 ${className ?? ''}`}
        />
      </div>
      {error && <span className="block mt-1.5 text-[12px] text-red-300">{error}</span>}
    </label>
  );
}

interface PasswordFieldProps {
  label: string;
  error?: string;
  icon?: ComponentType<{ className?: string }>;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  hint?: string;
  className?: string;
}

export function PasswordField({
  label,
  error,
  icon: Icon,
  autoComplete,
  placeholder,
  value,
  onChange,
  required,
  hint,
  className,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <label htmlFor={id} className="block">
      <span className="block text-[11.5px] font-mono uppercase tracking-[0.13em] text-zinc-400 mb-1.5">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        )}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3.5'} pr-11 py-2.5 rounded-xl bg-white/[0.04] border ${
            error ? 'border-red-400/60' : 'border-white/[0.09]'
          } text-[14px] text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-orange-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-orange-400/15 ${className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10.5px] font-mono uppercase tracking-[0.14em] text-zinc-400 hover:text-orange-300 hover:bg-white/[0.05] transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && !error && <span className="block mt-1.5 text-[11.5px] text-zinc-500">{hint}</span>}
      {error && <span className="block mt-1.5 text-[12px] text-red-300">{error}</span>}
    </label>
  );
}

interface PrimaryButtonProps {
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
}

export function PrimaryButton({
  loading,
  disabled,
  type = 'button',
  onClick,
  className,
  children,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`relative w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-[14px] font-semibold shadow-[0_8px_24px_-8px_rgba(249,115,22,0.6)] transition-all disabled:opacity-60 disabled:cursor-not-allowed active:translate-y-[1px] ${
        className ?? ''
      }`}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          <span>Please wait…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
