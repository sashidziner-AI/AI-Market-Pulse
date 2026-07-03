import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';

export function BusinessInput({
  onAnalyze,
  isLoading,
}: {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
}) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onAnalyze(url.startsWith('http') ? url : `https://${url}`);
  };

  return (
    <div className="relative min-h-[85vh] w-full overflow-hidden bg-stone-50 dark:bg-[#1F1F20]">
      {/* Subtle radial glow behind hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(245, 130, 32, 0.14), transparent 60%)',
        }}
      />
      {/* Grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(120,124,140,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,124,140,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 60% 55% at 50% 30%, black 30%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 55% at 50% 30%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative flex flex-col items-center justify-center min-h-[85vh] px-6 py-16 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl space-y-10"
        >
          {/* Micro-badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-3 py-1 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
              </span>
              <span className="text-[11px] font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                AI Market Pulse · Live
              </span>
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-5 text-center">
            <h1
              className="text-[44px] md:text-[56px] leading-[1.05] font-semibold text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: '-0.028em' }}
            >
              Activate your
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                revenue engine
              </span>
            </h1>
            <p
              className="mx-auto max-w-md text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400"
              style={{ letterSpacing: '-0.005em' }}
            >
              Drop your company URL. We'll build your ICP, surface high-intent
              accounts, and map the shortest path to revenue.
            </p>
          </div>

          {/* Input pill */}
          <form onSubmit={handleSubmit} className="relative">
            <div className="group relative rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-within:border-orange-400/60 dark:focus-within:border-orange-500/50 focus-within:shadow-[0_0_0_4px_rgba(245,130,32,0.12)] transition-all">
              <div className="flex items-center gap-2 pl-4 pr-2 h-14">
                <span className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500 select-none">
                  https://
                </span>
                <input
                  type="text"
                  placeholder="yourcompany.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-transparent outline-none text-[15px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono"
                  style={{ letterSpacing: '-0.01em' }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !url}
                  className="group/btn inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-medium tracking-tight hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_1px_2px_rgba(0,0,0,0.15)] cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-400 dark:text-zinc-600 font-mono">
              Press <kbd className="px-1 py-[1px] rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400">Enter</kbd> to run
            </p>
          </form>

          {/* Capability chips */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
            {[
              { label: 'Live web search', color: 'bg-emerald-500' },
              { label: 'Evidence-backed', color: 'bg-sky-500' },
              { label: 'Zero hallucination', color: 'bg-orange-500' },
              { label: 'AI sales pilot', color: 'bg-amber-500' },
            ].map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-zinc-500 dark:text-zinc-400"
              >
                <span className={`w-1 h-1 rounded-full ${chip.color}`} />
                {chip.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer meta */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-600">
            <span>v2</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>gpt-4o · hunter.io</span>
          </div>
        </div>
      </div>
    </div>
  );
}
