import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import {
  Rocket, ArrowRight, Sparkles, Globe, Target, Users, Phone,
  BarChart2, MapPin, Zap, ShieldCheck, Layers, Play, Pause,
  Brain, Compass, MessageSquare, TrendingUp, Clock, Menu, X,
  MousePointer2, DollarSign, LineChart, Award, Building2, Check,
  Film, Volume2, VolumeX, Maximize2,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

interface LandingPageProps {
  onEnter: () => void;
  onOpenLibrary: () => void;
  hasSavedReports: boolean;
}

// Cinematic GSAP-driven marketing landing. Sits in front of BusinessInput;
// the only outputs are the two routing callbacks. All scroll choreography is
// built inside one gsap.context so unmount reverts every tween/ScrollTrigger.
export function LandingPage({ onEnter, onOpenLibrary, hasSavedReports }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const outlineWord1Ref = useRef<HTMLSpanElement>(null);
  const outlineWord2Ref = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLElement>(null);
  const howTrackRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Exit transition: an ember veil sweeps up to cover the screen, then the
  // parent swaps in the workspace. The veil dies with the unmount, so the new
  // screen is revealed the instant the cover completes.
  const leaveTo = (destination: 'app' | 'library') => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const done = () => (destination === 'app' ? onEnter() : onOpenLibrary());
    const veil = veilRef.current;
    if (!veil || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    veil.style.pointerEvents = 'auto';
    gsap.timeline({ onComplete: done })
      .to(veil, { yPercent: -100, duration: 0.55, ease: 'power3.inOut' })
      .fromTo(
        veil.querySelector('.veil-logo'),
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
        '-=0.25'
      )
      .to({}, { duration: 0.15 });
  };

  const scrollToId = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    closeMenu();
    gsap.to(window, { scrollTo: { y: id, offsetY: 64 }, duration: 1, ease: 'power3.inOut' });
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce) {
        // Static page: reveal everything, skip all motion.
        gsap.set('.hero-underline', { scaleX: 1 });
        gsap.set('.gauge-arc', { strokeDashoffset: 0.38 });
        return;
      }

      /* ---------------- Intro timeline (page load) ---------------- */
      const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
      intro
        .fromTo('.land-header', { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0)
        .fromTo('.hero-outline', { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
        .fromTo('.core-stage', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, 0.1)
        .fromTo('.hero-eyebrow', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.25)
        .fromTo(
          '.hw',
          { yPercent: 120, rotateX: -45, opacity: 0 },
          { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.05, stagger: 0.07 },
          0.35
        )
        .fromTo('.hero-underline', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, 1.1)
        .fromTo('.hero-sub', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.85)
        .fromTo('.hero-cta', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08 }, 1.0)
        .fromTo('.hero-ticker', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.25)
        .fromTo('.hero-scrollhint', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.5);

      /* ---------------- Ambient loops ---------------- */
      gsap.to('.ring-a', { rotation: 360, duration: 36, repeat: -1, ease: 'none' });
      gsap.to('.ring-b', { rotation: -360, duration: 52, repeat: -1, ease: 'none' });
      gsap.to('.ring-c', { rotation: 360, duration: 74, repeat: -1, ease: 'none' });
      gsap.to('.core-glow', {
        scale: 1.18, opacity: 0.85, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
      gsap.utils.toArray<HTMLElement>('.float-dot').forEach((dot, i) => {
        gsap.to(dot, {
          y: () => gsap.utils.random(-26, 26),
          x: () => gsap.utils.random(-18, 18),
          duration: () => gsap.utils.random(3, 5.5),
          repeat: -1,
          yoyo: true,
          repeatRefresh: true,
          ease: 'sine.inOut',
          delay: i * 0.3,
        });
      });
      gsap.to('.scrollhint-dot', {
        y: 14, opacity: 0, duration: 1.4, repeat: -1, ease: 'power2.in',
      });

      /* ------------ Outline text — smooth colour-cycle + breathe ----------- */
      // GSAP can't tween WebkitTextStroke directly, so we animate a CSS custom
      // property on each element and update the stroke in onUpdate.
      const STROKE_COLORS = [
        { r: 245, g: 130, b: 32  },   // amber-orange (brand)
        { r: 251, g: 113, b: 133 },   // rose
        { r: 167, g: 139, b: 250 },   // violet
        { r: 56,  g: 189, b: 248 },   // sky
        { r: 52,  g: 211, b: 153 },   // emerald
        { r: 251, g: 191, b: 36  },   // amber-yellow
        { r: 245, g: 130, b: 32  },   // back to brand
      ];

      const animateStroke = (el: HTMLSpanElement, baseOpacity: number, phaseOffset: number) => {
        const proxy = { t: 0, breathe: baseOpacity };
        // Color cycle
        gsap.to(proxy, {
          t: STROKE_COLORS.length - 1,
          duration: (STROKE_COLORS.length - 1) * 3.2,
          delay: phaseOffset,
          repeat: -1,
          ease: 'none',
          onUpdate() { applyStroke(); },
        });
        // Breathe (opacity pulse)
        gsap.to(proxy, {
          breathe: baseOpacity + 0.14,
          duration: 2.8,
          delay: phaseOffset,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          onUpdate() { applyStroke(); },
        });
        function applyStroke() {
          const idx = proxy.t;
          const lo = Math.floor(idx) % (STROKE_COLORS.length - 1);
          const hi = (lo + 1) % (STROKE_COLORS.length - 1);
          const frac = idx - Math.floor(idx);
          const r = Math.round(STROKE_COLORS[lo].r + (STROKE_COLORS[hi].r - STROKE_COLORS[lo].r) * frac);
          const g = Math.round(STROKE_COLORS[lo].g + (STROKE_COLORS[hi].g - STROKE_COLORS[lo].g) * frac);
          const b = Math.round(STROKE_COLORS[lo].b + (STROKE_COLORS[hi].b - STROKE_COLORS[lo].b) * frac);
          (el.style as any).WebkitTextStroke = `1.8px rgba(${r},${g},${b},${proxy.breathe.toFixed(3)})`;
        }
      };

      const w1 = outlineWord1Ref.current;
      const w2 = outlineWord2Ref.current;
      if (w1) animateStroke(w1, 0.18, 0);
      if (w2) animateStroke(w2, 0.12, 1.6);

      /* ---------------- Global scroll progress bar ---------------- */
      gsap.to('.scroll-progress', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
      });

      /* ---------------- Hero exit on scroll (cinematic pull-back) -------- */
      gsap.to('.hero-inner', {
        yPercent: -12,
        opacity: 0.12,
        scale: 0.95,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom 30%', scrub: true },
      });
      gsap.to('.hero-outline', {
        yPercent: -36,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.to('.core-stage', {
        yPercent: 22,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom 45%', scrub: true },
      });

      /* ---------------- 3D dashboard preview (laptop-lid scrub) ---------- */
      gsap.fromTo(
        previewCardRef.current,
        { rotateX: 34, scale: 0.88, y: 90 },
        {
          rotateX: 0, scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: previewRef.current, start: 'top 95%', end: 'top 35%', scrub: 0.5 },
        }
      );
      // Mini-chart draws once the card is mostly leveled.
      const chartST = { trigger: previewRef.current, start: 'top 60%', once: true } as const;
      gsap.fromTo('.pb-bar', { scaleY: 0 }, {
        scaleY: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out',
        transformOrigin: 'bottom', scrollTrigger: chartST,
      });
      gsap.fromTo('.gauge-arc', { strokeDashoffset: 1 }, {
        strokeDashoffset: 0.38, duration: 1.2, ease: 'power2.out', scrollTrigger: chartST,
      });
      gsap.fromTo('.sb-seg', { scaleX: 0 }, {
        scaleX: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
        transformOrigin: 'left', scrollTrigger: chartST,
      });

      /* ---------------- Generic reveals ---------------- */
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 42, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          }
        );
      });
      ScrollTrigger.batch('.feature-card', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 48, opacity: 0, rotateX: -12 },
            { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.09, ease: 'power3.out' }
          ),
      });

      /* ---------------- Count-up stats ---------------- */
      gsap.utils.toArray<HTMLElement>('.stat-num').forEach((el) => {
        const target = Number(el.dataset.target || '0');
        const suffix = el.dataset.suffix || '';
        const counter = { v: 0 };
        gsap.to(counter, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          onUpdate: () => { el.textContent = `${Math.round(counter.v)}${suffix}`; },
        });
      });

      /* ---------------- Infinite marquee ---------------- */
      gsap.to('.marquee-track', { xPercent: -50, repeat: -1, duration: 30, ease: 'none' });

      /* ---------------- Pinned horizontal pipeline (desktop only) -------- */
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const track = howTrackRef.current;
        const section = howRef.current;
        if (!track || !section) return;
        const distance = () => track.scrollWidth - window.innerWidth;
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        gsap.to('.how-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 0.3,
            invalidateOnRefresh: true,
          },
        });
      });
      mm.add('(max-width: 1023px)', () => {
        gsap.utils.toArray<HTMLElement>('.how-panel').forEach((el) => {
          gsap.fromTo(
            el,
            { y: 48, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
              scrollTrigger: { trigger: el, start: 'top 86%', once: true },
            }
          );
        });
      });

      /* ---------------- Hero cursor spotlight ---------------- */
      const spot = spotRef.current;
      const hero = heroRef.current;
      if (spot && hero && window.matchMedia('(pointer: fine)').matches) {
        const qx = gsap.quickTo(spot, 'x', { duration: 0.6, ease: 'power3' });
        const qy = gsap.quickTo(spot, 'y', { duration: 0.6, ease: 'power3' });
        const onMove = (e: MouseEvent) => {
          const rect = hero.getBoundingClientRect();
          qx(e.clientX - rect.left - 300);
          qy(e.clientY - rect.top - 300);
        };
        hero.addEventListener('mousemove', onMove, { passive: true });
        return () => hero.removeEventListener('mousemove', onMove);
      }
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen bg-stone-50 dark:bg-[#1F1F20] text-zinc-900 dark:text-zinc-100 font-sans overflow-x-clip"
    >
      {/* Film grain — sits above everything, purely atmospheric */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05] dark:opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Scroll progress bar */}
      <div
        aria-hidden
        className="scroll-progress fixed top-0 left-0 right-0 h-[2.5px] z-[70] origin-left scale-x-0 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
      />

      {/* Exit veil — slides up over the page on Get Started */}
      <div
        ref={veilRef}
        aria-hidden
        className="fixed inset-0 z-[90] pointer-events-none translate-y-full bg-[#141415] flex items-center justify-center"
        style={{
          backgroundImage:
            'radial-gradient(700px circle at 50% 40%, rgba(245,130,32,0.28), transparent 65%)',
        }}
      >
        <div className="veil-logo flex flex-col items-center gap-3 opacity-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 flex items-center justify-center shadow-[0_8px_32px_rgba(245,130,32,0.5)]">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <span className="text-[12px] font-mono uppercase tracking-[0.3em] text-orange-300">
            Launching workspace
          </span>
        </div>
      </div>

      {/* ------------------------------ HEADER ------------------------------ */}
      <header className="land-header w-full bg-stone-50/85 dark:bg-[#1F1F20]/85 backdrop-blur-md border-b border-stone-200/60 dark:border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/vee-technologies-logo.png"
              alt="Vee Technologies"
              className="w-12 h-12 object-contain select-none"
            />
            <div className="flex flex-col leading-none select-none">
              <span
                className="font-normal text-[18px] tracking-tight text-zinc-900 dark:text-zinc-100"
                style={{ letterSpacing: '-0.02em' }}
              >
                <span className="text-white">AI</span> Market Pulse
              </span>
              <span className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">
                by Vee Technologies
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center ml-2 px-1.5 py-0.5 rounded-md text-[9.5px] font-mono uppercase tracking-wider text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/30">
              beta
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            <a href="#watch" onClick={(e) => scrollToId(e, '#watch')} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Watch</a>
            <a href="#features" onClick={(e) => scrollToId(e, '#features')} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Features</a>
            <a href="#how" onClick={(e) => scrollToId(e, '#how')} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">How it works</a>
            <a href="#capabilities" onClick={(e) => scrollToId(e, '#capabilities')} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Capabilities</a>
            <a href="#market" onClick={(e) => scrollToId(e, '#market')} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">Market</a>
          </nav>
          <div className="flex items-center gap-2">
            {hasSavedReports && (
              <button
                onClick={() => leaveTo('library')}
                className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.05] cursor-pointer transition-all"
              >
                Saved reports
              </button>
            )}
            <ThemeToggle />
            <button
              onClick={() => leaveTo('app')}
              className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-[0_1px_3px_rgba(245,130,32,0.45)] cursor-pointer transition-all"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              {menuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer — CSS grid-rows trick for smooth height animation */}
        <div
          className={`sm:hidden grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            menuOpen ? 'grid-rows-[1fr] opacity-100 border-t border-stone-200/60 dark:border-white/[0.06]' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <nav className="overflow-hidden flex flex-col px-6 min-h-0">
            <div className="py-4 flex flex-col gap-1">
              {[
                { href: '#watch', label: 'Watch' },
                { href: '#features', label: 'Features' },
                { href: '#how', label: 'How it works' },
                { href: '#capabilities', label: 'Capabilities' },
                { href: '#market', label: 'Market' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => scrollToId(e, href)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[14px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.05] hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                >
                  {label}
                </a>
              ))}
              <div className="my-2 border-t border-stone-200/60 dark:border-white/[0.06]" />
              {hasSavedReports && (
                <button
                  onClick={() => { closeMenu(); leaveTo('library'); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[14px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.05] transition-all text-left w-full cursor-pointer"
                >
                  Saved reports
                </button>
              )}
              <button
                onClick={() => { closeMenu(); leaveTo('app'); }}
                className="flex items-center justify-center gap-2 mt-1 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-[0_1px_4px_rgba(245,130,32,0.4)] cursor-pointer transition-all"
              >
                Get started <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ------------------------------- HERO ------------------------------- */}
      <section ref={heroRef} className="relative min-h-[94svh] flex flex-col justify-center overflow-hidden pt-10 pb-24">
        {/* Cursor spotlight */}
        <div
          ref={spotRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-70 dark:opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(245,130,32,0.16), transparent 62%)' }}
        />

        {/* Ghost display typography — cinematic backdrop layer */}
        <div
          aria-hidden
          className="hero-outline pointer-events-none absolute inset-x-0 top-[4%] flex flex-col items-center select-none leading-none"
        >
          <span
            ref={outlineWord1Ref}
            className="outline-word font-bold uppercase text-[18vw] tracking-[0.02em] text-transparent"
            style={{ WebkitTextStroke: '1.5px rgba(245,130,32,0.14)' }}
          >
            Market
          </span>
          <span
            ref={outlineWord2Ref}
            className="outline-word font-bold uppercase text-[18vw] tracking-[0.02em] text-transparent -mt-[4vw]"
            style={{ WebkitTextStroke: '1.5px rgba(245,130,32,0.09)' }}
          >
            Pulse
          </span>
        </div>

        {/* Grid backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(120,113,108,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120,113,108,0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        {/* 3D pulse core — tilted rotating ring stack behind the headline */}
        <div
          aria-hidden
          className="core-stage pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2"
          style={{ perspective: 1100 }}
        >
          <div
            className="relative w-[78vw] max-w-[680px] aspect-square"
            style={{ transform: 'rotateX(70deg)', transformStyle: 'preserve-3d' }}
          >
            <div className="ring-a absolute inset-0 rounded-full border-2 border-orange-500/30">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_16px_rgba(245,130,32,0.9)]" />
            </div>
            <div className="ring-b absolute inset-[14%] rounded-full border border-amber-400/35 border-dashed">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
            </div>
            <div className="ring-c absolute inset-[30%] rounded-full border border-rose-400/30">
              <span className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]" />
            </div>
          </div>
          {/* Core glow */}
          <div
            className="core-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full opacity-60"
            style={{ background: 'radial-gradient(circle, rgba(245,130,32,0.5) 0%, rgba(245,130,32,0) 70%)', filter: 'blur(20px)' }}
          />
        </div>

        {/* Floating particles */}
        {[
          { top: '22%', left: '12%', size: 6, cls: 'bg-orange-400/70' },
          { top: '30%', left: '85%', size: 5, cls: 'bg-amber-400/70' },
          { top: '64%', left: '8%', size: 4, cls: 'bg-rose-400/60' },
          { top: '70%', left: '90%', size: 6, cls: 'bg-orange-500/60' },
          { top: '15%', left: '58%', size: 4, cls: 'bg-amber-300/70' },
        ].map((p, i) => (
          <span
            key={i}
            aria-hidden
            className={`float-dot pointer-events-none absolute rounded-full ${p.cls}`}
            style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
          />
        ))}

        {/* Hero content */}
        <div className="hero-inner relative z-10 max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="hero-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.05] border border-orange-200 dark:border-orange-500/25 text-[11px] font-mono uppercase tracking-wider text-orange-700 dark:text-orange-300 shadow-sm backdrop-blur">
            <Sparkles className="w-3 h-3" />
            AI-native GTM intelligence
          </div>

          <h1
            className="mt-7 text-4xl sm:text-5xl md:text-6xl lg:text-[76px] font-bold leading-[1.02] tracking-tight max-w-4xl"
            style={{ letterSpacing: '-0.035em', perspective: 800 }}
          >
            <span className="block">
              {['From', 'one', 'URL', 'to', 'a'].map((w, i) => (
                <span key={i} className="inline-block overflow-hidden align-bottom pb-1">
                  <span className="hw inline-block will-change-transform">{w}&nbsp;</span>
                </span>
              ))}
            </span>
            <span className="block relative">
              {['revenue-ready', 'pipeline.'].map((w, i) => (
                <span key={i} className="inline-block overflow-hidden align-bottom pb-2">
                  <span className="hw inline-block will-change-transform bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                    {w}&nbsp;
                  </span>
                </span>
              ))}
              <span
                aria-hidden
                className="hero-underline absolute -bottom-1 left-[8%] right-[8%] h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 origin-left scale-x-0"
              />
            </span>
          </h1>

          <p className="hero-sub mt-6 max-w-2xl text-[15px] sm:text-base md:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            AI Market Pulse turns your website into a live ICP, discovers high-intent accounts across
            the globe, maps buying committees, and even dials the phone — all inside one workspace.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
            <MagneticButton
              className="hero-cta group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-sm shadow-[0_6px_24px_rgba(245,130,32,0.4)] hover:shadow-[0_10px_32px_rgba(245,130,32,0.5)] transition-shadow cursor-pointer"
              onClick={() => leaveTo('app')}
            >
              <Play className="w-4 h-4" fill="currentColor" />
              Analyze my website
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
            <a
              href="#how"
              onClick={(e) => scrollToId(e, '#how')}
              className="hero-cta inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-stone-300 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.03] text-zinc-800 dark:text-zinc-200 font-semibold text-sm hover:bg-white dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              See how it works
            </a>
          </div>

          <div className="hero-ticker mt-11 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Live web search</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-orange-500" /> Claude + GPT-4o</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-rose-500" /> Vapi telephony</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-500" /> Google Maps</span>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="hero-scrollhint absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500">
          <div className="w-[22px] h-[36px] rounded-full border-2 border-current flex justify-center pt-1.5">
            <span className="scrollhint-dot w-1 h-2 rounded-full bg-current" />
          </div>
          <span className="text-[9.5px] font-mono uppercase tracking-[0.25em]">Scroll</span>
        </div>
      </section>

      {/* -------------------------- 3D PREVIEW CARD ------------------------- */}
      <section ref={previewRef} className="relative pb-24 md:pb-32 -mt-6">
        <div className="max-w-5xl mx-auto px-6" style={{ perspective: 1400 }}>
          <div
            ref={previewCardRef}
            className="preview-stage relative rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-2xl will-change-transform"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl border-b border-stone-200 dark:border-white/[0.06] bg-stone-50/70 dark:bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                app.aimarketpulse.io / discovery
              </span>
            </div>
            <div className="p-6 md:p-8 grid md:grid-cols-3 gap-4">
              <PreviewCard
                tone="rose"
                icon={<TrendingUp className="w-4 h-4" />}
                label="Immediate Action"
                primary="12"
                secondary="/ 40 high-intent"
                chart={<PulseBars tone="rose" />}
              />
              <PreviewCard
                tone="teal"
                icon={<Clock className="w-4 h-4" />}
                label="Warm Track"
                primary="18"
                secondary="nurture over 30d"
                chart={<Gauge tone="teal" />}
              />
              <PreviewCard
                tone="amber"
                icon={<Compass className="w-4 h-4" />}
                label="Total Pipeline"
                primary="40"
                secondary="accounts scored"
                chart={<StackBars />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- WATCH VIDEO --------------------------- */}
      <WatchSection />

      {/* ------------------------- STATS + MARQUEE -------------------------- */}
      <section className="relative py-14 border-y border-stone-200/60 dark:border-white/[0.06] bg-gradient-to-b from-transparent via-white/40 dark:via-white/[0.02] to-transparent overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="reveal flex flex-col items-center text-center">
              <span
                className="stat-num text-4xl md:text-5xl font-bold font-mono bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                data-target={s.value}
                data-suffix={s.suffix}
                style={{ letterSpacing: '-0.04em' }}
              >
                0{s.suffix}
              </span>
              <span className="mt-2 text-[11.5px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Marquee */}
        <div className="mt-12 relative overflow-hidden" aria-hidden>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-stone-50 dark:from-[#1F1F20] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-stone-50 dark:from-[#1F1F20] to-transparent" />
          <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- FEATURES ----------------------------- */}
      <section id="features" className="relative pt-20 md:pt-28 pb-2 md:pb-3">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal">
            <SectionEyebrow>01 — What you get</SectionEyebrow>
            <SectionHeadline>
              A full go-to-market{' '}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">operating system</span>.
            </SectionHeadline>
            <SectionSubhead>
              Every layer of the seller's day, unified. No stitching CSVs across five tools.
            </SectionSubhead>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: 1000 }}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* --------------------- HOW IT WORKS (pinned scrub) ------------------ */}
      <section ref={howRef} id="how" className="relative overflow-hidden">
        <div className="lg:h-screen flex flex-col justify-center pt-6 pb-4 lg:py-0">
          <div className="max-w-6xl mx-auto px-6 w-full">
            <div className="reveal">
              <SectionEyebrow>02 — Pipeline</SectionEyebrow>
              <SectionHeadline>
                One URL in.{' '}
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Four stages out.</span>
              </SectionHeadline>
              <SectionSubhead>
                Every stage streams live status, so you watch the AI think instead of staring at a spinner.
              </SectionSubhead>
            </div>
          </div>

          <div
            ref={howTrackRef}
            className="mt-12 lg:mt-16 flex flex-col lg:flex-row gap-6 lg:gap-8 px-6 lg:px-[8vw] max-w-6xl lg:max-w-none mx-auto lg:mx-0 will-change-transform"
          >
            {STEPS.map((s, i) => (
              <HowPanel key={s.title} step={s} index={i} />
            ))}
          </div>

          {/* Scrub progress (desktop) */}
          <div className="hidden lg:block max-w-6xl mx-auto w-full px-6 mt-14">
            <div className="h-[3px] rounded-full bg-stone-200 dark:bg-white/[0.07] overflow-hidden">
              <div className="how-progress h-full w-full origin-left scale-x-0 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full" />
            </div>
            <div className="mt-3 flex justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <span>Analyze</span><span>Discover</span><span>Deep-dive</span><span>Act</span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- CAPABILITIES --------------------------- */}
      <section id="capabilities" className="relative pt-6 md:pt-8 pb-4 md:pb-6 bg-gradient-to-b from-transparent via-white/40 dark:via-white/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal">
            <SectionEyebrow>03 — Under the hood</SectionEyebrow>
            <SectionHeadline>
              Built on the{' '}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">strongest models</span>{' '}
              available today.
            </SectionHeadline>
            <SectionSubhead>
              Claude, GPT-4o, ElevenLabs, and Vapi wired end-to-end. Prompt caching and retries built-in.
            </SectionSubhead>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-4">
            {CAPABILITIES.map((c) => (
              <div
                key={c.title}
                className="reveal group flex items-start gap-4 p-4 rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] hover:border-orange-300 dark:hover:border-orange-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-orange-500/15 dark:to-amber-500/10 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-300 group-hover:scale-105 transition-transform">
                  <c.icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      {c.title}
                    </div>
                    <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25">
                      {c.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- MARKET OPPORTUNITY --------------------------- */}
      <MarketOpportunitySection />

      {/* ----------------------------- FINAL CTA ----------------------------- */}
      <CtaSection onEnter={() => leaveTo('app')} onLibrary={() => leaveTo('library')} hasSavedReports={hasSavedReports} />

      {/* ------------------------------ FOOTER ------------------------------ */}
      <footer className="border-t border-stone-200/60 dark:border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <img
              src="/vee-technologies-logo.png"
              alt="Vee Technologies"
              className="w-12 h-12 object-contain"
            />
            <span className="font-normal text-[18px] text-zinc-700 dark:text-zinc-300"><span className="text-white">AI</span> Market Pulse</span>
            <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">by Vee Technologies</span>
            <span className="opacity-60">— Hackathon 2026 build</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" onClick={(e) => scrollToId(e, '#features')} className="hover:text-orange-600 dark:hover:text-orange-400">Features</a>
            <a href="#how" onClick={(e) => scrollToId(e, '#how')} className="hover:text-orange-600 dark:hover:text-orange-400">Pipeline</a>
            <a href="#capabilities" onClick={(e) => scrollToId(e, '#capabilities')} className="hover:text-orange-600 dark:hover:text-orange-400">Stack</a>
            <a href="#market" onClick={(e) => scrollToId(e, '#market')} className="hover:text-orange-600 dark:hover:text-orange-400">Market</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Watch section — inline product intro video with custom play overlay.
   The video is streamed from /public and only fetches metadata on load so
   the 138 MB file does not download until the user actually hits play.
   -------------------------------------------------------------------------- */

function WatchSection() {
  const secRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  useLayoutEffect(() => {
    const sec = secRef.current;
    if (!sec) return;
    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        stageRef.current,
        { rotateX: 18, scale: 0.94, y: 60, opacity: 0.4 },
        {
          rotateX: 0, scale: 1, y: 0, opacity: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sec, start: 'top 85%', end: 'top 30%', scrub: 0.6,
          },
        }
      );
      gsap.to('.watch-halo', {
        opacity: 0.9, scale: 1.08, duration: 2.4,
        repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
    }, sec);
    return () => ctx.revert();
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setStarted(true);
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const goFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    // Auto-play + unmute when entering fullscreen — expected UX for a "watch
    // in fullscreen" gesture. If the user hasn't started yet, this doubles
    // as the play action too.
    if (v.paused) {
      v.muted = false;
      setMuted(false);
      void v.play();
      setStarted(true);
    }
    // Standard, then Safari (both desktop and iOS), then MS legacy.
    const anyV = v as any;
    if (v.requestFullscreen) {
      void v.requestFullscreen().catch(() => {
        if (typeof anyV.webkitEnterFullscreen === 'function') anyV.webkitEnterFullscreen();
      });
    } else if (typeof anyV.webkitEnterFullscreen === 'function') {
      anyV.webkitEnterFullscreen();
    } else if (typeof anyV.webkitRequestFullscreen === 'function') {
      anyV.webkitRequestFullscreen();
    } else if (typeof anyV.msRequestFullscreen === 'function') {
      anyV.msRequestFullscreen();
    }
  };

  // Jarvis voice bridge — listen for landing-scoped action events and route
  // them to the appropriate section behavior. Voice commands like "play the
  // intro video" or "scroll to features" reach us via this listener.
  useEffect(() => {
    function handleJarvis(evt: Event) {
      const detail = (evt as CustomEvent).detail as { action: string } | undefined;
      const action = detail?.action;
      if (!action) return;
      const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (action === 'landing.playIntroVideo') {
        scrollTo('watch');
        // Give the scroll a moment before starting playback for a smoother feel.
        setTimeout(() => {
          const v = videoRef.current;
          if (!v) return;
          // Unmute for the intentional voice-triggered play (browser autoplay
          // policy allows because this is a user-initiated gesture chain).
          v.muted = false;
          setMuted(false);
          void v.play();
          setStarted(true);
        }, 500);
      } else if (action === 'landing.pauseIntroVideo') {
        const v = videoRef.current;
        if (v && !v.paused) v.pause();
      } else if (action === 'landing.fullscreenIntroVideo') {
        scrollTo('watch');
        setTimeout(() => { goFullscreen(); }, 400);
      } else if (action === 'landing.scrollToWatch') {
        scrollTo('watch');
      } else if (action === 'landing.scrollToFeatures') {
        scrollTo('features');
      } else if (action === 'landing.scrollToCta') {
        scrollTo('cta');
      }
    }
    window.addEventListener('jarvis:landing', handleJarvis);
    return () => window.removeEventListener('jarvis:landing', handleJarvis);
  }, []);

  return (
    <section
      ref={secRef}
      id="watch"
      className="relative py-20 md:py-28 overflow-hidden"
    >
      {/* Ambient halo behind the video */}
      <div
        aria-hidden
        className="watch-halo pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[900px] aspect-video rounded-[40px] opacity-70"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(245,130,32,0.28), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6">
        <div className="reveal text-center">
          <SectionEyebrow>
            <Film className="w-3 h-3" />
            <span className="ml-1">Product tour</span>
          </SectionEyebrow>
          <SectionHeadline>
            See{' '}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              AI Market Pulse
            </span>{' '}
            in motion.
          </SectionHeadline>
          <p className="mt-3 mx-auto max-w-2xl text-[15px] md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            A 2-minute walk-through of the full pipeline — from URL to buying committee to phone dial.
          </p>
        </div>

        {/* Video stage with browser-chrome frame */}
        <div
          className="mt-12 md:mt-14 mx-auto"
          style={{ perspective: 1400 }}
        >
          <div
            ref={stageRef}
            className="relative rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] will-change-transform overflow-hidden"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-stone-200 dark:border-white/[0.06] bg-stone-50/70 dark:bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                app.aimarketpulse.io / demo
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-orange-600 dark:text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Live demo
              </span>
            </div>

            {/* Video */}
            <div className="relative bg-black">
              <video
                ref={videoRef}
                src="/intro-video.mp4"
                preload="metadata"
                playsInline
                muted={muted}
                className="w-full aspect-video object-cover cursor-pointer"
                onClick={togglePlay}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />

              {/* Play overlay — visible until the user has started the video */}
              {!started && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-black/30 via-black/40 to-black/60">
                  <button
                    onClick={togglePlay}
                    aria-label="Play intro video"
                    className="group flex flex-col items-center gap-4 cursor-pointer"
                  >
                    <span className="relative flex items-center justify-center">
                      <span className="absolute w-24 h-24 rounded-full bg-orange-500/30 blur-2xl group-hover:bg-orange-500/50 transition-all" />
                      <span className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_8px_32px_rgba(245,130,32,0.55)] group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                      </span>
                    </span>
                    <span className="text-white text-sm font-semibold tracking-wide drop-shadow">
                      Watch the 2-minute tour
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goFullscreen(); }}
                    aria-label="Watch fullscreen"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white/90 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                  </button>
                </div>
              )}

              {/* Always-visible fullscreen shortcut — top-right corner of the frame.
                  Complements the hover-only controls bar so fullscreen is reachable
                  the moment playback starts, no matter where the cursor is. */}
              {started && (
                <button
                  onClick={goFullscreen}
                  aria-label="Fullscreen"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors opacity-70 hover:opacity-100"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}

              {/* Custom controls bar — only shown once playback starts */}
              {started && (
                <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 px-4 py-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
                  >
                    {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <div className="ml-auto">
                    <button
                      onClick={goFullscreen}
                      aria-label="Fullscreen"
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Caption ticker below the frame */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-orange-500" /> Live product footage</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" /> No signup required</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Recorded on real data</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Final CTA — cinematic full-bleed dark stage
   -------------------------------------------------------------------------- */

const CTA_CHIPS = [
  { icon: TrendingUp, label: '40+ accounts', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' },
  { icon: Zap,        label: '~40s analysis', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  { icon: Brain,      label: 'Claude-powered', color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/30' },
  { icon: Phone,      label: 'Dial-ready', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  { icon: Globe,      label: 'Live web search', color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/30' },
  { icon: ShieldCheck, label: 'No credit card', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' },
];

const TYPED_URLS = [
  'yourcompany.com',
  'acmecorp.io',
  'startupname.ai',
  'enterprise-sales.com',
];

function CtaSection({
  onEnter, onLibrary, hasSavedReports,
}: {
  onEnter: () => void;
  onLibrary: () => void;
  hasSavedReports: boolean;
}) {
  const secRef = useRef<HTMLElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const sec = secRef.current;
    if (!sec) return;

    // Native setTimeout / setInterval ids started inside the typewriter — the
    // gsap.context() cleanup below only unwinds gsap timers, not these.
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(['.cta-chip', '.cta-headline', '.cta-sub', '.cta-btns', '.cta-input-row'], { opacity: 1 });
        return;
      }

      // Section reveal timeline, triggered when it scrolls in
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: 'top 72%', once: true },
        defaults: { ease: 'power3.out' },
      });
      tl
        .fromTo('.cta-headline', { y: 56, opacity: 0, rotateX: -28 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.9 }, 0)
        .fromTo('.cta-sub',      { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.2)
        .fromTo('.cta-input-row', { y: 28, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.7 }, 0.38)
        .fromTo('.cta-btns',     { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.52)
        .fromTo('.cta-chip',     { y: 24, opacity: 0, scale: 0.85 }, {
          y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.07,
        }, 0.6);

      // Concentric ring pulses: each ring scales up and fades on a staggered loop
      ['.orbit-r1', '.orbit-r2', '.orbit-r3', '.orbit-r4'].forEach((sel, i) => {
        gsap.fromTo(
          sel,
          { scale: 0.6, opacity: 0.7 },
          {
            scale: 2.4, opacity: 0,
            duration: 3.6,
            delay: i * 0.9,
            repeat: -1,
            ease: 'power1.out',
          }
        );
      });

      // Slow spin on the dashed orbit circle
      gsap.to('.orbit-spin', { rotation: 360, duration: 28, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });

      // Typewriter on the mock URL field.
      // Every native timer we start here is tracked in `timers` so the outer
      // useLayoutEffect cleanup can kill them on unmount — gsap.context()
      // handles gsap timers but NOT plain setInterval/setTimeout, so without
      // this the typewriter kept writing textContent to a detached node.
      const typedEl = typeRef.current;
      if (!typedEl) return;
      let idx = 0;
      const type = () => {
        const url = TYPED_URLS[idx % TYPED_URLS.length];
        let charPos = 0;
        const interval = setInterval(() => {
          typedEl.textContent = url.slice(0, charPos + 1);
          charPos++;
          if (charPos >= url.length) {
            clearInterval(interval);
            timers.delete(interval);
            const pause = setTimeout(() => {
              timers.delete(pause);
              const eraseInterval = setInterval(() => {
                typedEl.textContent = (typedEl.textContent || '').slice(0, -1);
                if (!typedEl.textContent) {
                  clearInterval(eraseInterval);
                  timers.delete(eraseInterval);
                  idx++;
                  const nextRun = setTimeout(type, 320);
                  timers.add(nextRun);
                }
              }, 35);
              timers.add(eraseInterval);
            }, 1800);
            timers.add(pause);
          }
        }, 55);
        timers.add(interval);
      };
      // Start typewriter after the input row animates in
      gsap.delayedCall(1.1, type);

      // CTA button breathing glow
      gsap.to('.cta-glow', {
        boxShadow: '0 0 60px 20px rgba(245,130,32,0.45), 0 0 120px 50px rgba(245,130,32,0.2)',
        duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });

      // Cursor-follow on dark section
      const orbit = orbitRef.current;
      if (orbit && window.matchMedia('(pointer: fine)').matches) {
        const qx = gsap.quickTo('.cta-spotlight', 'x', { duration: 0.7, ease: 'power3' });
        const qy = gsap.quickTo('.cta-spotlight', 'y', { duration: 0.7, ease: 'power3' });
        const onMove = (e: MouseEvent) => {
          const rect = orbit.getBoundingClientRect();
          qx(e.clientX - rect.left - 350);
          qy(e.clientY - rect.top - 350);
        };
        sec.addEventListener('mousemove', onMove, { passive: true });
        return () => sec.removeEventListener('mousemove', onMove);
      }
    }, sec);

    return () => {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t as any);
      }
      timers.clear();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={secRef}
      id="cta"
      className="relative overflow-hidden bg-[#0e0e0f] text-white"
      style={{ minHeight: '88svh' }}
    >
      {/* Cursor spotlight */}
      <div
        className="cta-spotlight pointer-events-none absolute top-0 left-0 w-[700px] h-[700px] rounded-full opacity-40"
        aria-hidden
        style={{ background: 'radial-gradient(circle, rgba(245,130,32,0.22), transparent 60%)' }}
      />

      {/* Mesh grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(245,130,32,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(245,130,32,0.25) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
        }}
      />

      {/* Concentric pulse rings centered behind the headline */}
      <div
        ref={orbitRef}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2"
      >
        {['orbit-r1', 'orbit-r2', 'orbit-r3', 'orbit-r4'].map((cls) => (
          <div
            key={cls}
            className={`${cls} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full border border-orange-500/40`}
          />
        ))}
        {/* Slow dashed orbit ring */}
        <div className="orbit-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-dashed border-orange-500/20 flex items-start justify-center">
          <span className="w-2 h-2 -mt-1 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(245,130,32,0.9)]" />
        </div>
        <div className="orbit-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-dashed border-amber-500/12" style={{ animationDelay: '-14s' }}>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
        </div>
      </div>

      {/* Section content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center min-h-[88svh] px-6 py-20 text-center"
        style={{ perspective: 900 }}
      >
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-[11px] font-mono uppercase tracking-[0.2em] text-orange-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Your market is waiting
        </div>

        {/* Headline */}
        <h2
          className="cta-headline text-4xl sm:text-5xl md:text-[68px] font-bold leading-[1.02] max-w-5xl whitespace-nowrap"
          style={{ letterSpacing: '-0.035em', fontSize: 'clamp(1.75rem, 4.5vw, 4.25rem)' }}
        >
          Ready to see it on{' '}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              your market
            </span>
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-400"
            />
          </span>
          ?
        </h2>

        {/* Sub */}
        <p className="cta-sub mt-5 max-w-xl text-[15px] md:text-base text-zinc-400 leading-relaxed">
          Paste your URL. Watch the AI build a full revenue pipeline in real time.
          No credit card. No signup. Just signal.
        </p>

        {/* Mock URL input — shows typewriter then triggers enter */}
        <div className="cta-input-row mt-10 w-full max-w-lg">
          <div className="relative flex items-center gap-0 rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm p-1.5 shadow-[0_2px_24px_rgba(0,0,0,0.4)] hover:border-orange-500/40 transition-colors">
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5">
              <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-[14px] text-zinc-300 font-mono">
                https://&nbsp;
                <span ref={typeRef} className="text-orange-300" />
                <span className="inline-block w-[2px] h-4 bg-orange-400 animate-pulse align-middle ml-0.5" />
              </span>
            </div>
            <button
              onClick={onEnter}
              className="cta-glow shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-[13px] shadow-[0_4px_20px_rgba(245,130,32,0.4)] cursor-pointer transition-all"
            >
              Analyze <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-2.5 text-[11px] font-mono uppercase tracking-wider text-zinc-600 text-center">
            Press Enter to run
          </p>
        </div>

        {/* CTA buttons */}
        <div className="cta-btns mt-7 flex flex-col sm:flex-row items-center gap-3">
          <MagneticButton
            onClick={onEnter}
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm shadow-[0_6px_28px_rgba(245,130,32,0.45)] cursor-pointer transition-all"
          >
            <Rocket className="w-4 h-4" />
            Launch workspace
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </MagneticButton>
          {hasSavedReports && (
            <button
              onClick={onLibrary}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/[0.12] bg-white/[0.04] text-zinc-300 font-semibold text-sm hover:bg-white/[0.07] hover:border-white/20 cursor-pointer transition-all"
            >
              Open a saved report
            </button>
          )}
        </div>

        {/* Floating feature chips */}
        <div className="mt-14 flex flex-wrap justify-center gap-2.5 max-w-2xl">
          {CTA_CHIPS.map(({ icon: Icon, label, color, bg }) => (
            <div
              key={label}
              className={`cta-chip inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${bg} text-[11.5px] font-mono tracking-wide`}
            >
              <Icon className={`w-3 h-3 ${color}`} />
              <span className="text-zinc-300">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Content
   -------------------------------------------------------------------------- */

type FeatureSpec = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: 'orange' | 'sky' | 'emerald' | 'rose';
};

const FEATURES: FeatureSpec[] = [
  {
    icon: Globe,
    title: 'ICP auto-build',
    body: 'Scrape your site and reverse-engineer the buyer profile, painpoints, and value angle in under a minute.',
    tone: 'orange',
  },
  {
    icon: Target,
    title: 'Intent discovery',
    body: 'Surface 10–100 target accounts scored on fit, timing, and priority — with live citations for every claim.',
    tone: 'sky',
  },
  {
    icon: Users,
    title: 'Stakeholder maps',
    body: 'Personas, economic buyers, technical gatekeepers — with counter-narrative playbooks for each objection.',
    tone: 'emerald',
  },
  {
    icon: Phone,
    title: 'AI voice conversations',
    body: 'Schedule or dial live — Vapi + ElevenLabs runs discovery calls to real mobile numbers on your behalf.',
    tone: 'rose',
  },
];

type StepSpec = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  detail: string;
};

const STEPS: StepSpec[] = [
  {
    icon: Compass,
    title: 'Map the seller',
    body: 'Paste any URL. The AI reads your site + live web to build an ICP blueprint you can edit.',
    detail: '~40s',
  },
  {
    icon: Layers,
    title: 'Discover accounts',
    body: 'Get 10–100 high-signal companies ranked by fit and timing, with citations to public evidence.',
    detail: '~90s',
  },
  {
    icon: Brain,
    title: 'Deep-dive intel',
    body: 'One-click account teardown: personas, competitors, displacement scores, multi-threading strategy.',
    detail: '~60s / account',
  },
  {
    icon: MessageSquare,
    title: 'Act on it',
    body: 'Export CSV, sync CRM, schedule AI voice calls, or trigger outbound campaigns straight from the board.',
    detail: 'live',
  },
];

type CapabilitySpec = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tag: string;
};

const CAPABILITIES: CapabilitySpec[] = [
  {
    icon: Sparkles,
    title: 'Model-agnostic core',
    body: 'Anthropic Claude and OpenAI GPT-4o wired behind a single helper with retries, prompt caching, and JSON-schema outputs.',
    tag: 'Reliability',
  },
  {
    icon: Zap,
    title: 'Streaming everything',
    body: 'Every long-running call streams status + citations over NDJSON so the UI never sits on a blank spinner.',
    tag: 'UX',
  },
  {
    icon: MapPin,
    title: 'Global Google Maps lead-gen',
    body: 'Related-company discovery pulls fresh matches from any market with client-side country filtering.',
    tag: 'Discovery',
  },
  {
    icon: Phone,
    title: 'Real telephony',
    body: 'Vapi + Twilio + ElevenLabs bridge to place outbound PSTN calls with a natural-sounding AI agent.',
    tag: 'Voice',
  },
  {
    icon: BarChart2,
    title: 'Fit + timing + priority scoring',
    body: 'Custom calibration engine lets you re-weight scores per channel partner without touching code.',
    tag: 'Scoring',
  },
  {
    icon: ShieldCheck,
    title: 'Fallback data everywhere',
    body: 'Every endpoint has hand-authored seed data, so demos never break when a key is missing or a quota hits.',
    tag: 'Resilience',
  },
];

const STATS = [
  { value: 40, suffix: '+', label: 'accounts per run' },
  { value: 4, suffix: '', label: 'stages, one workspace' },
  { value: 60, suffix: 's', label: 'per deep-dive teardown' },
  { value: 100, suffix: '%', label: 'demo uptime via fallbacks' },
];

const MARQUEE = [
  'Live web search', 'Claude + GPT-4o', 'Vapi telephony', 'Google Maps discovery',
  'CRM sync', 'CSV import / export', 'PDF reports', 'Prompt caching',
  'NDJSON streaming', 'ElevenLabs voice', 'Citation tiering', 'Priority waves',
];

/* --------------------------------------------------------------------------
   Building blocks
   -------------------------------------------------------------------------- */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-[10.5px] font-mono uppercase tracking-wider text-orange-700 dark:text-orange-300">
      {children}
    </div>
  );
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.08]"
      style={{ letterSpacing: '-0.03em' }}
    >
      {children}
    </h2>
  );
}

function SectionSubhead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-2xl text-[15px] md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
      {children}
    </p>
  );
}

// GSAP-powered magnetic hover: the button leans toward the cursor and snaps
// back with an elastic release.
function MagneticButton({
  children, className, onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      qx((e.clientX - rect.left - rect.width / 2) * 0.3);
      qy((e.clientY - rect.top - rect.height / 2) * 0.4);
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    };
    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <button ref={ref} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

const TONE_STYLES: Record<FeatureSpec['tone'], { icon: string; ring: string; glow: string }> = {
  orange: {
    icon: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
    ring: 'ring-orange-500/25',
    glow: 'from-orange-400/25 to-transparent',
  },
  sky: {
    icon: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-500/25',
    glow: 'from-sky-400/25 to-transparent',
  },
  emerald: {
    icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    ring: 'ring-emerald-500/25',
    glow: 'from-emerald-400/25 to-transparent',
  },
  rose: {
    icon: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    ring: 'ring-rose-500/25',
    glow: 'from-rose-400/25 to-transparent',
  },
};

// 3D mouse-tracking tilt via gsap.quickTo — glides instead of snapping.
const FeatureCard: React.FC<{ feature: FeatureSpec }> = ({ feature }) => {
  const styles = TONE_STYLES[feature.tone];
  const Icon = feature.icon;
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      ry(px * 12);
      rx(-py * 12);
    };
    const onLeave = () => { rx(0); ry(0); };
    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      style={{ transformStyle: 'preserve-3d' }}
      className={`feature-card relative group h-full p-5 rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm hover:ring-1 ${styles.ring} hover:shadow-xl transition-shadow overflow-hidden will-change-transform`}
    >
      <div
        aria-hidden
        className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${styles.glow} opacity-0 group-hover:opacity-100 transition-opacity blur-xl`}
      />
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${styles.icon} mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight tracking-tight">
        {feature.title}
      </div>
      <p className="mt-1.5 text-[12.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {feature.body}
      </p>
    </div>
  );
};

// Wide cinematic panel for the pinned horizontal pipeline scrub.
const HowPanel: React.FC<{ step: StepSpec; index: number }> = ({ step, index }) => {
  const Icon = step.icon;
  return (
    <div className="how-panel relative shrink-0 w-full lg:w-[52vw] lg:max-w-[720px]">
      <div className="relative h-full rounded-3xl border border-stone-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] backdrop-blur-sm p-7 md:p-10 overflow-hidden hover:border-orange-300/70 dark:hover:border-orange-500/30 transition-colors">
        {/* Ghost number */}
        <span
          aria-hidden
          className="absolute -top-6 right-2 text-[140px] md:text-[180px] font-bold leading-none text-transparent select-none"
          style={{ WebkitTextStroke: '1.5px rgba(245,130,32,0.16)' }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="relative flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 rotate-3 blur-md opacity-60" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 flex items-center justify-center shadow-[0_6px_18px_rgba(245,130,32,0.35)] text-white">
              <Icon className="w-6 h-6" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">
              Stage {index + 1} · {step.detail}
            </div>
            <div className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100" style={{ letterSpacing: '-0.02em' }}>
              {step.title}
            </div>
          </div>
        </div>

        <p className="relative mt-5 text-[14px] md:text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg">
          {step.body}
        </p>

        <div className="relative mt-6 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          <MousePointer2 className="w-3.5 h-3.5" />
          {index < 3 ? 'Keep scrolling' : 'Then it’s yours to run'}
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------------
   Hero preview widgets — hand-drawn miniatures echoing the real Dashboard
   KPI cards. Charts animate via GSAP classes (.pb-bar, .gauge-arc, .sb-seg)
   wired in the main context.
   -------------------------------------------------------------------------- */

type Tone = 'rose' | 'teal' | 'amber';

const PREVIEW_TONE: Record<Tone, { border: string; bg: string; text: string; dot: string }> = {
  rose:  { border: 'border-rose-300 dark:border-rose-800/50',   bg: 'from-rose-100 to-rose-50 dark:from-rose-900/25 dark:to-rose-950/15',   text: 'text-rose-600 dark:text-rose-300',   dot: 'bg-rose-500' },
  teal:  { border: 'border-teal-300 dark:border-teal-800/50',   bg: 'from-teal-100 to-teal-50 dark:from-teal-900/25 dark:to-teal-950/15',   text: 'text-teal-600 dark:text-teal-300',   dot: 'bg-teal-500' },
  amber: { border: 'border-amber-300 dark:border-amber-800/50', bg: 'from-amber-100 to-amber-50 dark:from-amber-900/25 dark:to-amber-950/15', text: 'text-amber-600 dark:text-amber-300', dot: 'bg-amber-500' },
};

function PreviewCard({
  tone, icon, label, primary, secondary, chart,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
  chart: React.ReactNode;
}) {
  const t = PREVIEW_TONE[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${t.border} bg-gradient-to-br ${t.bg} p-4 shadow-lg hover:scale-[1.03] hover:-rotate-[0.5deg] transition-transform duration-300`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 ${t.text}`}>
          {icon}
          <span className="text-[12px] font-semibold tracking-tight">{label}</span>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={`text-4xl font-mono font-semibold ${t.text}`} style={{ letterSpacing: '-0.04em' }}>
          {primary}
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">{secondary}</span>
      </div>
      <div className="mt-3">{chart}</div>
    </div>
  );
}

function PulseBars({ tone }: { tone: Tone }) {
  const t = PREVIEW_TONE[tone];
  const heights = [40, 65, 30, 80, 55, 90, 50, 70];
  return (
    <div className="flex items-end gap-1 h-10">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`pb-bar flex-1 rounded-sm ${t.dot} opacity-70`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function Gauge({ tone }: { tone: Tone }) {
  const t = PREVIEW_TONE[tone];
  const cx = 60, cy = 42, r = 34;
  return (
    <svg viewBox="0 0 120 50" className="w-full h-10">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        className="text-zinc-200 dark:text-white/[0.08]"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        className={`gauge-arc ${t.text}`}
      />
    </svg>
  );
}

function StackBars() {
  const segments = [
    { w: 30, cls: 'bg-rose-500' },
    { w: 45, cls: 'bg-teal-500' },
    { w: 25, cls: 'bg-slate-400 dark:bg-slate-500' },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-white/[0.05]">
        {segments.map((s, i) => (
          <div key={i} className={`sb-seg ${s.cls}`} style={{ width: `${s.w}%` }} />
        ))}
      </div>
      <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Immediate</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" />Warm</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />Standard</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Market Opportunity — TAM/SAM/SOM, competitor grid, revenue projection
   -------------------------------------------------------------------------- */

const MARKET_SIZES = [
  {
    tier: 'TAM',
    label: 'Total Addressable Market',
    value: 32,
    prefix: '$',
    suffix: 'B',
    caption: 'Global sales-tech + intelligence spend by 2027',
    accent: 'from-amber-400 to-orange-500',
    ring: 'ring-orange-500/30',
  },
  {
    tier: 'SAM',
    label: 'Serviceable Available',
    value: 5,
    prefix: '$',
    suffix: 'B',
    caption: 'English-speaking SMB & mid-market · ≤500 employees',
    accent: 'from-rose-400 to-pink-500',
    ring: 'ring-rose-500/30',
  },
  {
    tier: 'SOM',
    label: 'Realistic 3-Year Capture',
    value: 75,
    prefix: '$',
    suffix: 'M',
    caption: '~1.5% of SAM — comparable to Clay & Apollo year 3',
    accent: 'from-violet-400 to-indigo-500',
    ring: 'ring-violet-500/30',
  },
];

const COMPETITORS = [
  { name: 'Apollo.io',        strength: 'Massive contact DB (275M)',         gap: 'No AI reasoning, no persona narratives',    us: 'Reasoning + cited web evidence' },
  { name: 'Clay',             strength: 'Best-in-class enrichment workflows', gap: 'Complex setup, credit management',          us: 'Zero-setup, one URL in'         },
  { name: '6sense / Demandbase', strength: 'Enterprise intent signals',       gap: '$80K+ contracts, weeks to onboard',          us: 'Self-serve, <1 min to insight'  },
  { name: '11x / AiSDR',      strength: 'AI SDR outbound agents',            gap: 'Send-first, understand-later',              us: 'Understand accounts, then act'  },
  { name: 'Regie.ai / Lavender', strength: 'AI copywriting layer',            gap: 'Narrow — message layer only',                us: 'Full GTM pipeline in one place' },
  { name: 'ZoomInfo',         strength: 'Deepest B2B data graph',             gap: 'Legacy UX, no generative synthesis',        us: 'AI-native from day one'         },
];

const REVENUE_YEARS = [
  { year: 'Y1', arr: 0.4,  customers: '300',    label: 'Land',       height: 8  },
  { year: 'Y2', arr: 3.4,  customers: '2,000',  label: 'PMF',        height: 22 },
  { year: 'Y3', arr: 15,   customers: '7,000',  label: 'Scale',      height: 44 },
  { year: 'Y4', arr: 35,   customers: '15,000', label: 'Expand',     height: 70 },
  { year: 'Y5', arr: 80,   customers: '28,000', label: 'Category',   height: 100 },
];

const PRICING_TIERS = [
  { name: 'Starter',  price: 29,  target: 'Solo founders'      },
  { name: 'Pro',      price: 99,  target: 'Small sales teams'  },
  { name: 'Team',     price: 299, target: 'Scaling GTM'        },
  { name: 'Business', price: 799, target: 'Mid-market'         },
];

function MarketOpportunitySection() {
  return (
    <section id="market" className="relative pt-20 md:pt-28 pb-16 md:pb-20 overflow-hidden">
      {/* subtle backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245,130,32,0.06), transparent 60%), radial-gradient(ellipse 40% 30% at 80% 80%, rgba(167,139,250,0.05), transparent 60%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="reveal">
          <SectionEyebrow>04 — Market Opportunity</SectionEyebrow>
          <SectionHeadline>
            A{' '}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">$32B market</span>.{' '}
            A clear path to <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">$80M ARR</span>.
          </SectionHeadline>
          <SectionSubhead>
            Where AI Market Pulse fits in the go-to-market stack, and how the unit economics play out over five years.
          </SectionSubhead>
        </div>

        {/* --- TAM / SAM / SOM cards --- */}
        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {MARKET_SIZES.map((m) => (
            <div
              key={m.tier}
              className="reveal group relative rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-6 hover:-translate-y-1 hover:shadow-xl transition-all overflow-hidden"
            >
              <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${m.accent} opacity-10 dark:opacity-15 blur-2xl group-hover:opacity-25 transition-opacity`} />
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ${m.ring} bg-white/60 dark:bg-white/[0.04] text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-300`}>
                {m.tier}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[13px] font-mono text-zinc-500 dark:text-zinc-400">{m.prefix}</span>
                <span
                  className={`stat-num text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br ${m.accent} bg-clip-text text-transparent`}
                  data-target={m.value}
                  data-suffix={m.suffix}
                >
                  0{m.suffix}
                </span>
              </div>
              <div className="mt-1 text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">{m.label}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{m.caption}</div>
            </div>
          ))}
        </div>

        {/* --- Market gap callout --- */}
        <div className="reveal mt-14 grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-300">
              <Target className="w-4 h-4" />
              <span className="text-[11px] font-mono uppercase tracking-wider">The gap we close</span>
            </div>
            <div className="mt-3 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
              5–7 tools stitched. 2–6 weeks to first list. $30–80K/yr to run.
            </div>
            <p className="mt-2 text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Sales teams patch together ZoomInfo, Clay, 6sense, Gong, Outreach, and Salesforce. AI Market Pulse collapses that into a single URL → live pipeline in ~40 seconds — priced for solo founders and 1–20 person GTM teams.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 dark:border-orange-500/25 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/[0.08] dark:to-amber-500/[0.06] p-6">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-mono uppercase tracking-wider">Why we win</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                'Speed-of-first-value: 40 seconds vs. 6 weeks',
                'Bundled reasoning across ICP, personas, and intent',
                'Self-serve pricing: $29–$799/mo (10× cheaper than incumbents)',
                'AI-dialer built in — insight to conversation in one flow',
              ].map((line) => (
                <div key={line} className="flex items-start gap-2 text-[13px] text-zinc-700 dark:text-zinc-200">
                  <Check className="w-3.5 h-3.5 mt-[3px] text-orange-600 dark:text-orange-300 shrink-0" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Competitor grid --- */}
        <div className="reveal mt-16">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Competitive landscape</div>
              <div className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Where we differentiate</div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-wider text-orange-600 dark:text-orange-300">
              <Award className="w-3.5 h-3.5" /> 6 direct competitors
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] overflow-hidden">
            {/* header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-stone-200 dark:border-white/[0.06] text-[10.5px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 bg-stone-50/60 dark:bg-white/[0.02]">
              <div className="col-span-3">Player</div>
              <div className="col-span-3">Their strength</div>
              <div className="col-span-3">Their gap</div>
              <div className="col-span-3 text-orange-600 dark:text-orange-300">Where we win</div>
            </div>
            {COMPETITORS.map((c, i) => (
              <div
                key={c.name}
                className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 text-[13px] items-start ${i < COMPETITORS.length - 1 ? 'border-b border-stone-200/70 dark:border-white/[0.05]' : ''} hover:bg-orange-50/40 dark:hover:bg-orange-500/[0.04] transition-colors`}
              >
                <div className="md:col-span-3 flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-white/[0.08] dark:to-white/[0.03] border border-stone-200 dark:border-white/[0.08] flex items-center justify-center">
                    <Building2 className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  {c.name}
                </div>
                <div className="md:col-span-3 text-zinc-600 dark:text-zinc-400">{c.strength}</div>
                <div className="md:col-span-3 text-zinc-500 dark:text-zinc-500 italic">{c.gap}</div>
                <div className="md:col-span-3 flex items-start gap-1.5 text-orange-700 dark:text-orange-300 font-medium">
                  <Sparkles className="w-3 h-3 mt-1 shrink-0" />
                  <span>{c.us}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Revenue projection chart --- */}
        <div className="reveal mt-16 grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <LineChart className="w-3.5 h-3.5" /> 5-year ARR trajectory
                </div>
                <div className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  $0.4M → $80M ARR
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Blended margin</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">87%</div>
              </div>
            </div>

            <div className="mt-8 flex items-end gap-3">
              {REVENUE_YEARS.map((y, i) => {
                const gradients = [
                  'from-amber-400 to-orange-500',
                  'from-orange-400 to-rose-500',
                  'from-rose-400 to-pink-500',
                  'from-pink-400 to-violet-500',
                  'from-violet-400 to-indigo-500',
                ];
                return (
                  <div key={y.year} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      ${y.arr}M
                    </div>
                    <div className="w-full h-52 flex items-end rounded-md bg-stone-100/40 dark:bg-white/[0.02] overflow-hidden">
                      <div
                        className={`w-full rounded-t-md bg-gradient-to-t ${gradients[i]} shadow-lg transition-all origin-bottom hover:brightness-110`}
                        style={{ height: `${y.height}%`, minHeight: 8 }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-[11.5px] font-semibold text-zinc-900 dark:text-zinc-100">{y.year}</div>
                      <div className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{y.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-stone-200 dark:border-white/[0.06] grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Y5 customers</div>
                <div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">28K</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">LTV : CAC</div>
                <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">5.5 : 1</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Investor ROI</div>
                <div className="mt-1 text-lg font-bold text-orange-600 dark:text-orange-400">30–40×</div>
              </div>
            </div>
          </div>

          {/* Pricing ladder */}
          <div className="lg:col-span-2 rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <DollarSign className="w-3.5 h-3.5" /> Pricing ladder
            </div>
            <div className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Blended ARPU <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">~$180/mo</span>
            </div>
            <div className="mt-5 space-y-2">
              {PRICING_TIERS.map((t, i) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between rounded-lg border border-stone-200/70 dark:border-white/[0.05] bg-white/60 dark:bg-white/[0.02] px-3 py-2.5 hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/25 text-orange-600 dark:text-orange-300 text-[10px] font-mono font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{t.name}</div>
                      <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400">{t.target}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">${t.price}</div>
                    <div className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">/ mo</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              65% Starter · 20% Pro · 12% Team · 3% Business
            </div>
          </div>
        </div>

        {/* --- Risks strip --- */}
        <div className="reveal mt-12 rounded-2xl border border-stone-200 dark:border-white/[0.06] bg-stone-50/60 dark:bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Risks we watch
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-[12.5px]">
            {[
              { title: 'AI cost gravity', body: 'Margin assumes model prices keep falling. Hedge: multi-provider routing + prompt caching (already live).' },
              { title: 'Thin data moat',  body: 'Apollo/ZoomInfo could bolt on an "AI ICP wizard." Hedge: own the reasoning + workflow layer, not just data.' },
              { title: 'PLG distribution', body: 'Model depends on LinkedIn/Reddit virality. Hedge: agency & founder-community partnerships as backstop.' },
            ].map((r) => (
              <div key={r.title}>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</div>
                <div className="mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
