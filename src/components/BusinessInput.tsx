import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Loader2, Search, Target, Users, Zap, BarChart2, Globe } from 'lucide-react';

const LOADING_STEPS = [
  { icon: Globe,   label: 'Scanning your website…',         duration: 4000 },
  { icon: Search,  label: 'Building ICP from live web data…', duration: 7000 },
  { icon: Target,  label: 'Mapping buyer personas & signals…', duration: 6000 },
  { icon: Users,   label: 'Discovering high-intent accounts…', duration: 99999 },
];

const FEATURE_PILLS = [
  { icon: Search,   label: 'Live web search',    color: 'text-emerald-500' },
  { icon: BarChart2, label: 'Signal scoring',    color: 'text-sky-500' },
  { icon: Target,   label: 'ICP auto-build',     color: 'text-orange-500' },
  { icon: Zap,      label: 'Outreach ready',     color: 'text-amber-500' },
];

const ACCOUNT_COUNT_PRESETS = [5, 10, 15, 25] as const;

export function BusinessInput({
  onAnalyze,
  isLoading,
}: {
  onAnalyze: (url: string, accountCount: number) => void;
  isLoading: boolean;
}) {
  const [url, setUrl] = useState('');
  const [accountCount, setAccountCount] = useState<number>(10);
  const [stepIndex, setStepIndex] = useState(0);

  // Advance through loading steps on a timer while isLoading is true
  useEffect(() => {
    if (!isLoading) { setStepIndex(0); return; }
    setStepIndex(0);
    let current = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (let i = 0; i < LOADING_STEPS.length - 1; i++) {
      elapsed += LOADING_STEPS[i].duration;
      const idx = i + 1;
      timers.push(setTimeout(() => setStepIndex(idx), elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && !isLoading) {
      onAnalyze(url.startsWith('http') ? url : `https://${url}`, accountCount);
    }
  };

  // Jarvis voice bridge — commands like "set the URL to acme.com", "make it
  // twenty accounts", and "start the analysis" arrive here.
  useEffect(() => {
    function handleJarvis(evt: Event) {
      const detail = (evt as CustomEvent).detail as { action: string; args?: any } | undefined;
      if (!detail) return;
      if (detail.action === 'input.setUrl' && typeof detail.args?.url === 'string') {
        setUrl(detail.args.url.trim());
      } else if (detail.action === 'input.setCount') {
        const raw = detail.args?.count;
        const n = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
        if (!Number.isNaN(n) && n > 0 && n <= 50) setAccountCount(n);
      } else if (detail.action === 'input.submit') {
        // Fire a submit only if we have a URL AND we're not already loading.
        if (url && !isLoading) {
          onAnalyze(url.startsWith('http') ? url : `https://${url}`, accountCount);
        }
      }
    }
    window.addEventListener('jarvis:input', handleJarvis);
    return () => window.removeEventListener('jarvis:input', handleJarvis);
  }, [url, accountCount, isLoading, onAnalyze]);

  const currentStep = LOADING_STEPS[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-stone-50 dark:bg-[#1F1F20]">
      {/* Aurora gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute rounded-full mix-blend-multiply dark:mix-blend-screen"
          style={{ width: 620, height: 620, top: '-10%', left: '5%', background: 'radial-gradient(circle, rgba(245,130,32,0.55) 0%, rgba(245,130,32,0) 65%)', filter: 'blur(60px)' }}
          animate={{ x: [0, 90, -40, 0], y: [0, 40, -30, 0], scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute rounded-full mix-blend-multiply dark:mix-blend-screen"
          style={{ width: 560, height: 560, top: '5%', right: '2%', background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0) 65%)', filter: 'blur(70px)' }}
          animate={{ x: [0, -80, 50, 0], y: [0, 60, -20, 0], scale: [1, 0.9, 1.15, 1] }}
          transition={{ duration: 26, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute rounded-full mix-blend-multiply dark:mix-blend-screen"
          style={{ width: 500, height: 500, bottom: '-8%', left: '30%', background: 'radial-gradient(circle, rgba(244,63,94,0.35) 0%, rgba(244,63,94,0) 65%)', filter: 'blur(80px)' }}
          animate={{ x: [0, 70, -60, 0], y: [0, -50, 30, 0], scale: [1, 1.08, 0.92, 1] }}
          transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>

      {/* Static radial glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(245,130,32,0.10), transparent 60%)' }} />

      {/* Grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(120,124,140,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,124,140,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 60% 55% at 50% 30%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 30%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative flex flex-col items-center justify-center h-full px-6 py-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl space-y-10"
        >
          {/* Live badge */}
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
            <div className={`group relative rounded-xl border bg-white/70 dark:bg-white/[0.03] backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] transition-all ${isLoading ? 'border-orange-300/60 dark:border-orange-500/40' : 'border-stone-200 dark:border-white/[0.08] focus-within:border-orange-400/60 dark:focus-within:border-orange-500/50 focus-within:shadow-[0_0_0_4px_rgba(245,130,32,0.12)]'}`}>
              <div className="flex items-center gap-2 pl-4 pr-2 h-14">
                <span className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500 select-none">https://</span>
                <input
                  type="text"
                  placeholder="yourcompany.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-transparent outline-none text-[15px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono disabled:opacity-50"
                  style={{ letterSpacing: '-0.01em' }}
                  autoFocus
                />
                {/* Count picker — how many accounts the AI should discover.
                    Higher = slower & more OpenAI tokens; lower = quicker demo. */}
                <label className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono select-none pl-2 border-l border-orange-300/60 dark:border-orange-500/40">
                  <span className="uppercase tracking-wider text-[10px] text-orange-500 dark:text-orange-400 font-semibold">Accounts</span>
                  <select
                    value={accountCount}
                    onChange={(e) => setAccountCount(Number(e.target.value))}
                    disabled={isLoading}
                    className="bg-transparent outline-none font-mono text-[13px] text-orange-600 dark:text-orange-400 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="How many target accounts to discover"
                  >
                    {ACCOUNT_COUNT_PRESETS.map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">{n}</option>
                    ))}
                  </select>
                </label>
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

            {/* Step-by-step loading feedback */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 flex flex-col items-center gap-3"
                >
                  {/* Step label */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stepIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2 text-[13px] font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      <StepIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      {currentStep.label}
                    </motion.div>
                  </AnimatePresence>

                  {/* Step progress dots */}
                  <div className="flex items-center gap-1.5">
                    {LOADING_STEPS.map((_, i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: i <= stepIndex ? 1 : 0.25, scale: i === stepIndex ? 1.3 : 1 }}
                        transition={{ duration: 0.3 }}
                        className={`block rounded-full ${i === stepIndex ? 'w-3 h-1.5 bg-orange-500' : 'w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700'}`}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-center text-[11px] text-zinc-400 dark:text-zinc-600 font-mono"
                >
                  Press <kbd className="px-1 py-[1px] rounded border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400">Enter</kbd> to run
                </motion.p>
              )}
            </AnimatePresence>
          </form>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
            {FEATURE_PILLS.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-zinc-500 dark:text-zinc-400">
                <Icon className={`w-3 h-3 ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-600">
            <span>v2</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>OpenAI GPT-4o</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>YouTube API</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>Hunter.io</span>
          </div>
        </div>
      </div>
    </div>
  );
}
