/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, Loader2, Ear, EarOff } from 'lucide-react';
import { toast } from 'sonner';

type JarvisState = 'idle' | 'wake-listening' | 'listening' | 'thinking' | 'speaking' | 'error';

type Turn = { role: 'user' | 'jarvis'; text: string };

export type JarvisAction = {
  action: string;
  args?: Record<string, unknown>;
};

type SR = any;
function getSpeechRecognitionCtor(): SR | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Wake patterns — Chrome's cloud STT frequently mistranscribes "Jarvis" as
// "Charles", "Chavez", "service", "javis", "jervis", "j reeves" depending on
// accent. To keep false-positives low we require an addressing word ("hey",
// "hi", "ok", "okay") before the loose variants; a bare "jarvis" only fires
// when clearly transcribed.
const WAKE_PATTERNS = [
  /\bhey\s+jarvi[sz]?\b/i,
  /\bhi\s+jarvi[sz]?\b/i,
  /\bok(?:ay)?\s+jarvi[sz]?\b/i,
  /\bjarvi[sz]?\b/i,
  // Common misheard variants — require a wake-cue word to reduce false positives.
  /\b(?:hey|hi|okay|ok)\s+(?:charles|chavez|service|jervis|javis|jarvez|j[a-z]{0,3}v[ei]s|garvez|drivers)\b/i,
  /\b(?:hey|hi|okay|ok)\s+j[a-z]{1,6}\b(?=.{0,20}$)/i, // "hey J-something" near end of utterance
];

const WAKE_GREETING = "Good day, Sasi. This is Jarvis, your AI Market Pulse Assistant. I'm ready. How may I assist you?";

interface Props {
  /**
   * Short summary of current app state injected into the model prompt so
   * Jarvis can answer questions about what the user is looking at.
   */
  getContext?: () => string;
  /**
   * Called when Jarvis returns an action to execute in the browser.
   * The parent decides how to route: App-level navigation vs component-scoped
   * window events.
   */
  onAction?: (action: JarvisAction) => void;
}

export function JarvisOrb({ getContext, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<JarvisState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastHeard, setLastHeard] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported] = useState<boolean>(!!getSpeechRecognitionCtor());
  // Click-to-talk by default — user must tap the orb to speak. The ear icon
  // is an opt-in toggle for hands-free "Hey Jarvis" wake detection (kept for
  // users who want it, but off on load so the mic isn't hot without consent).
  const [handsFree, setHandsFree] = useState<boolean>(false);

  const commandRecRef = useRef<any>(null);
  const wakeRecRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<JarvisState>('idle');
  const handsFreeRef = useRef<boolean>(handsFree);
  // Cached wake-greeting audio — pre-generated at page load so wake -> greeting
  // is instant (no TTS network round-trip when the user says "Hey Jarvis").
  const greetingUrlRef = useRef<string | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  const stopWakeRec = useCallback(() => {
    const r = wakeRecRef.current;
    if (!r) return;
    r._stopIntentional = true;
    try { r.stop(); } catch {}
    wakeRecRef.current = null;
  }, []);

  const stopCommandRec = useCallback(() => {
    const r = commandRecRef.current;
    if (!r) return;
    r._stopIntentional = true;
    try { r.stop(); } catch {}
    commandRecRef.current = null;
  }, []);

  const stopEverything = useCallback(() => {
    stopCommandRec();
    stopWakeRec();
    try { audioRef.current?.pause(); } catch {}
    if (audioRef.current) audioRef.current.currentTime = 0;
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
    setTranscript('');
  }, [stopCommandRec, stopWakeRec]);

  // ---------------------------------------------------------------------------
  // Command listening — captures the actual question after wake, or after click.
  // ---------------------------------------------------------------------------
  const speakText = useCallback(async (text: string) => {
    stateRef.current = 'speaking';
    setState('speaking');
    try {
      const res = await fetch('/api/jarvis/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'onyx' }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        void audio.play().catch(() => resolve());
      });
    } catch {
      // Swallow — falling back to just showing text is fine
    }
    // Sync-update stateRef alongside setState. Otherwise the caller (which
    // resumes in the same microtask) sees stale 'speaking' in stateRef and
    // any guard that reads it will reject the wake-listener restart.
    stateRef.current = 'idle';
    setState('idle');
  }, []);

  // Fast-path greeting playback — uses the pre-cached Blob URL so wake -> speak
  // is instant. Falls back to the full speakText path if pre-cache missed.
  const playGreetingFast = useCallback(async () => {
    // Concurrent-call guard. If we're already speaking (greeting in flight),
    // return the existing playback rather than starting a second Audio.
    if (stateRef.current === 'speaking') return;
    const url = greetingUrlRef.current;
    if (!url) {
      await speakText(WAKE_GREETING);
      return;
    }
    stateRef.current = 'speaking';
    setState('speaking');
    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    } catch {}
    stateRef.current = 'idle';
    setState('idle');
  }, [speakText]);

  const sendToJarvis = useCallback(async (userText: string) => {
    const clean = userText.trim();
    if (!clean) { setState('idle'); return; }
    setOpen(true);
    setTurns((prev) => [...prev, { role: 'user', text: clean }]);
    setState('thinking');
    setTranscript('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const context = getContext?.() ?? '';
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, context }),
        signal: controller.signal,
      });
      const data = await res.json();
      const reply: string = data?.reply || 'I did not get a response.';
      const action: string | undefined = data?.action;
      const args: Record<string, unknown> | undefined = data?.args;
      setTurns((prev) => [...prev, { role: 'jarvis', text: reply }]);

      if (action && action !== 'none') {
        try { onAction?.({ action, args }); } catch (e) { console.warn('Jarvis action failed:', e); }
      }

      await speakText(reply);

      // Conversational continuation — in hands-free mode, re-arm wake listener
      // so the user can follow up naturally. In push-to-talk mode, briefly
      // auto-listen for a follow-up without needing to click again.
      if (handsFreeRef.current) {
        startWakeListener();
      } else {
        // Short 6s follow-up window — the user can just keep talking.
        setTimeout(() => {
          if (stateRef.current === 'idle') startCommandListening(true);
        }, 300);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setErrorMsg(e?.message ?? 'Request failed');
      setState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getContext, onAction, speakText]);

  const startCommandListening = useCallback((softFollowup = false) => {
    setErrorMsg(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setErrorMsg('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    // Stop wake listener while capturing a real command — one SR at a time.
    stopWakeRec();
    try { audioRef.current?.pause(); } catch {}

    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    let anySpeech = false;
    rec.onstart = () => setState('listening');
    rec.onspeechstart = () => { anySpeech = true; };
    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r.isFinal) interim += r[0].transcript;
      }
      setTranscript(finalText || interim);
    };
    rec.onerror = (event: any) => {
      const intentional = rec._stopIntentional;
      if (event.error === 'no-speech') {
        if (!softFollowup) setErrorMsg('I did not hear anything.');
      } else if (event.error === 'aborted') {
        // benign — usually a state transition
      } else if (event.error === 'not-allowed') {
        setErrorMsg('Microphone access denied. Enable it in your browser.');
      } else if (!intentional) {
        setErrorMsg(`Voice input problem: ${event.error}`);
      }
      setState('idle');
    };
    rec.onend = () => {
      const said = (finalText || transcript || '').trim();
      commandRecRef.current = null;
      if (said && anySpeech) {
        sendToJarvis(said);
      } else {
        setState('idle');
        // On a soft follow-up with no speech, quietly resume wake listener if hands-free
        if (handsFreeRef.current) startWakeListener();
      }
    };
    commandRecRef.current = rec;
    try { rec.start(); } catch {
      setState('idle');
    }
  }, [sendToJarvis, stopWakeRec, transcript]);

  // ---------------------------------------------------------------------------
  // Wake-word listener — passive continuous listening for "hey jarvis" etc.
  // Runs when hands-free is on and Jarvis is idle. Restarts itself on end.
  // ---------------------------------------------------------------------------
  const startWakeListener = useCallback(() => {
    if (!handsFreeRef.current) return;
    // Only block starting while an actual command is in flight. If we're
    // already in 'wake-listening' or 'idle', it's safe to (re)start — the
    // ref guard below still prevents duplicate SpeechRecognition instances.
    if (stateRef.current === 'listening' || stateRef.current === 'thinking' || stateRef.current === 'speaking') return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setErrorMsg('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (wakeRecRef.current) return;

    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    // Local single-fire guard. Chrome fires onresult multiple times per
    // utterance (interim -> final refinements), and BOTH events will match
    // the wake pattern for the same phrase. Without this flag the greeting
    // gets pushed & played multiple times.
    let matched = false;

    rec.onstart = () => {
      console.log('[jarvis] wake listener started');
      setErrorMsg(null);
      setLastHeard('');
      setState('wake-listening');
    };
    rec.onspeechstart = () => {
      console.log('[jarvis] speech detected (pre-match)');
    };
    rec.onresult = (event: any) => {
      if (matched) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text: string = r[0]?.transcript || '';
        if (text.trim()) setLastHeard(text.trim().slice(0, 80));
        for (const pattern of WAKE_PATTERNS) {
          if (pattern.test(text)) {
            matched = true;
            console.log('[jarvis] wake word matched:', text);
            const stripped = text.replace(pattern, '').trim();
            stopWakeRec();
            if (stripped) {
              sendToJarvis(stripped);
            } else {
              setOpen(true);
              setTurns((prev) => {
                // Also guard against a duplicate greeting turn already
                // sitting at the end of the list — belt & suspenders.
                if (prev.length > 0 && prev[prev.length - 1].role === 'jarvis' && prev[prev.length - 1].text === WAKE_GREETING) {
                  return prev;
                }
                return [...prev, { role: 'jarvis', text: WAKE_GREETING }];
              });
              void playGreetingFast().then(() => {
                if (stateRef.current === 'idle') startCommandListening();
              });
            }
            return;
          }
        }
      }
    };
    rec.onerror = (event: any) => {
      const intentional = rec._stopIntentional;
      console.warn('[jarvis] wake listener error:', event.error, 'intentional=', !!intentional);
      if (intentional) return;
      // Surface *actionable* errors to the user. Transient ones auto-recover
      // via onend restart.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorMsg('Microphone access is blocked. Click the 🔒 icon in the address bar and set Microphone to Allow.');
        setOpen(true);
      } else if (event.error === 'network') {
        setErrorMsg('Chrome speech service is offline. Check your internet connection.');
        setOpen(true);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[jarvis] non-fatal wake error, will retry:', event.error);
      }
    };
    rec.onend = () => {
      const wasIntentional = rec._stopIntentional;
      console.log('[jarvis] wake listener ended, intentional=', !!wasIntentional);
      wakeRecRef.current = null;
      if (wasIntentional) {
        if (stateRef.current === 'wake-listening') setState('idle');
        return;
      }
      // Auto-restart while hands-free AND no command in flight. Reset state
      // to idle FIRST so the guard in startWakeListener passes.
      if (handsFreeRef.current
          && stateRef.current !== 'listening'
          && stateRef.current !== 'thinking'
          && stateRef.current !== 'speaking') {
        if (stateRef.current === 'wake-listening') setState('idle');
        setTimeout(() => startWakeListener(), 80);
      } else if (stateRef.current === 'wake-listening') {
        setState('idle');
      }
    };
    wakeRecRef.current = rec;
    try {
      rec.start();
      console.log('[jarvis] wake listener .start() called');
    } catch (e: any) {
      console.error('[jarvis] wake listener .start() threw:', e);
      wakeRecRef.current = null;
      // Chrome throws "InvalidStateError: recognition has already started"
      // if we race a previous instance. Retry in a moment.
      setTimeout(() => startWakeListener(), 800);
    }
  }, [sendToJarvis, startCommandListening, stopWakeRec, playGreetingFast]);

  // Toggle hands-free ↔ push-to-talk
  useEffect(() => {
    if (handsFree) {
      // Fast path: if the mic permission was granted in a previous session
      // (Permissions API says 'granted'), start the wake listener IMMEDIATELY
      // without waiting for a fresh getUserMedia round-trip. This eliminates
      // the ~500ms delay that caused the first "Hey Jarvis" to be missed.
      const startNow = () => {
        console.log('[jarvis] mic permission already granted, starting wake listener');
        startWakeListener();
      };
      const requestAndStart = () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          setErrorMsg('This browser cannot access microphones. Try Chrome or Edge.');
          setOpen(true);
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((t) => t.stop());
            console.log('[jarvis] mic permission granted (fresh)');
            startWakeListener();
          })
          .catch((err) => {
            console.error('[jarvis] mic permission denied:', err?.name);
            setOpen(true);
            setErrorMsg(
              err?.name === 'NotAllowedError'
                ? 'Microphone access is blocked. Click the 🔒 in the address bar and set Microphone to Allow, then reload.'
                : `Cannot access microphone: ${err?.name || 'unknown error'}`
            );
          });
      };
      // Check permission state without triggering a prompt.
      if ((navigator as any).permissions?.query) {
        (navigator as any).permissions.query({ name: 'microphone' })
          .then((result: any) => {
            if (result.state === 'granted') startNow();
            else requestAndStart();
          })
          .catch(() => requestAndStart());
      } else {
        requestAndStart();
      }
    } else {
      stopWakeRec();
      if (state === 'wake-listening') setState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree]);

  // Cleanup on unmount
  useEffect(() => () => { stopEverything(); }, [stopEverything]);

  // Safety net: whenever we return to idle in hands-free mode and no wake
  // listener is running, re-arm one. This catches any code path that finished
  // an interaction (reply, greeting, error) but forgot to restart the wake
  // listener. Prevents the "second Hey Jarvis is dead" class of bugs.
  useEffect(() => {
    if (state !== 'idle') return;
    if (!handsFree) return;
    if (wakeRecRef.current) return;
    const t = setTimeout(() => {
      if (stateRef.current === 'idle' && handsFreeRef.current && !wakeRecRef.current) {
        console.log('[jarvis] safety-net re-arming wake listener');
        startWakeListener();
      }
    }, 120);
    return () => clearTimeout(t);
  }, [state, handsFree, startWakeListener]);

  // Autoplay policies in Chrome/Edge block Audio.play() until the page has
  // received at least one user gesture. To make the wake-greeting playable
  // on cold visits (user says "Hey Jarvis" without ever clicking), we prime
  // the audio subsystem the moment ANY interaction occurs — a silent 1-sample
  // WAV played once, then listeners are torn down.
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        // 1-sample silent WAV (data URL) — cheap unlock.
        const a = new Audio(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
        );
        a.volume = 0;
        void a.play().catch(() => {});
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Pre-generate the wake-greeting audio on mount and cache the Blob URL.
  // Since the greeting text never changes, we don't need to hit the TTS API
  // at wake time — makes the "Hey Jarvis" -> greeting flow instant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/jarvis/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: WAKE_GREETING, voice: 'onyx' }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        greetingUrlRef.current = URL.createObjectURL(blob);
        console.log('[jarvis] greeting TTS pre-cached');
      } catch (e) {
        console.warn('[jarvis] greeting pre-cache failed:', e);
      }
    })();
    return () => {
      cancelled = true;
      if (greetingUrlRef.current) {
        URL.revokeObjectURL(greetingUrlRef.current);
        greetingUrlRef.current = null;
      }
    };
  }, []);

  // First-visit hint — one-time toast telling the user how to talk to Jarvis.
  useEffect(() => {
    if (!supported) return;
    try {
      if (localStorage.getItem('jarvis_intro_shown') === 'true') return;
      localStorage.setItem('jarvis_intro_shown', 'true');
    } catch { return; }
    setTimeout(() => {
      toast('Talk to Jarvis', {
        description: 'Tap the orb (bottom-right) to speak. Enable the ear icon for hands-free "Hey Jarvis".',
        duration: 6000,
      });
    }, 800);
  }, [supported]);

  const handleOrbClick = () => {
    if (!open) setOpen(true);
    if (state === 'listening') {
      try { commandRecRef.current?.stop(); } catch {}
      return;
    }
    if (state === 'speaking' || state === 'thinking') {
      stopEverything();
      return;
    }
    startCommandListening();
  };

  const statusLabel: Record<JarvisState, string> = {
    idle: handsFree ? 'Say "Hey Jarvis"' : 'Tap the mic to talk',
    'wake-listening': 'Waiting for "Hey Jarvis"',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking',
    error: 'Something went wrong',
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none">
      {open && (
        <div className="pointer-events-auto w-[340px] max-h-[460px] rounded-2xl border border-orange-500/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-orange-500/10 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
            <div className="flex items-center gap-2 min-w-0">
              <div className={
                'w-2 h-2 rounded-full ' +
                (state === 'wake-listening' ? 'bg-orange-400 animate-pulse'
                : state === 'listening' ? 'bg-red-500 animate-pulse'
                : state === 'speaking' ? 'bg-emerald-500 animate-pulse'
                : state === 'thinking' ? 'bg-amber-500 animate-pulse'
                : 'bg-orange-500')
              } />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Jarvis</span>
              <span className="text-[10px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-mono truncate">
                {statusLabel[state]}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHandsFree((v) => !v)}
                className={
                  'p-1.5 rounded-md transition ' +
                  (handsFree
                    ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200')
                }
                title={handsFree ? 'Hands-free ON — listening for "Hey Jarvis"' : 'Enable hands-free wake word'}
                aria-label="Toggle hands-free"
              >
                {handsFree ? <Ear className="w-4 h-4" /> : <EarOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { stopEverything(); setOpen(false); }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition p-1.5"
                aria-label="Close Jarvis"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
            {turns.length === 0 && !transcript && (
              <div className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed space-y-2">
                <p>
                  I can answer project questions and control the app by voice. Try:
                </p>
                <ul className="space-y-1 list-none pl-0">
                  <li>&ldquo;Hey Jarvis, play the intro video.&rdquo;</li>
                  <li>&ldquo;What does this app do?&rdquo;</li>
                  <li>&ldquo;Explain the ICP.&rdquo;</li>
                  <li>&ldquo;Show the leads tab.&rdquo;</li>
                  <li>&ldquo;Go home.&rdquo;</li>
                </ul>
                <p className="text-[10px] opacity-70">
                  Enable the ear icon for hands-free wake word.
                </p>
              </div>
            )}
            {state === 'wake-listening' && lastHeard && (
              <div className="text-left">
                <div className="inline-block max-w-full px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/40 text-[11px] text-orange-800 dark:text-orange-200 leading-snug">
                  <span className="opacity-70 font-mono uppercase tracking-wider text-[9px]">Heard: </span>
                  <span className="italic">&ldquo;{lastHeard}&rdquo;</span>
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={
                    'inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug ' +
                    (t.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-stone-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-100 rounded-bl-sm')
                  }
                >
                  {t.text}
                </div>
              </div>
            ))}
            {state === 'listening' && transcript && (
              <div className="text-right">
                <div className="inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug bg-orange-500/50 text-white rounded-br-sm italic">
                  {transcript}
                </div>
              </div>
            )}
            {state === 'thinking' && (
              <div className="text-left">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 text-[13px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="px-4 py-2 text-[11px] text-red-600 dark:text-red-400 border-t border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
              {errorMsg}
            </div>
          )}
          {!supported && (
            <div className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400 border-t border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
              Voice input needs Chrome or Edge. TTS still works.
            </div>
          )}
        </div>
      )}

      {/* Persistent listening indicator — sits next to the orb whenever the
          wake listener is armed and the panel is closed. Also shows the
          latest transcript so users can see if their voice is being picked
          up, and whether "Jarvis" is being misheard. */}
      {!open && handsFree && state === 'wake-listening' && (
        <div className="pointer-events-none absolute right-16 bottom-2 flex flex-col items-end gap-1 max-w-[260px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 dark:bg-white/10 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium whitespace-nowrap shadow-lg">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-orange-500" />
            </span>
            Say &ldquo;Hey Jarvis&rdquo;
          </div>
          {lastHeard && (
            <div className="px-2.5 py-1 rounded-lg bg-orange-500/90 backdrop-blur text-white text-[10px] italic whitespace-nowrap overflow-hidden text-ellipsis max-w-full shadow">
              heard: &ldquo;{lastHeard}&rdquo;
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleOrbClick}
        aria-label="Jarvis voice assistant"
        className={
          'pointer-events-auto relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95 ' +
          (state === 'listening'
            ? 'bg-gradient-to-br from-red-500 to-orange-600'
            : state === 'thinking'
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : state === 'speaking'
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : state === 'wake-listening'
            ? 'bg-gradient-to-br from-orange-400 to-amber-500'
            : 'bg-gradient-to-br from-orange-500 to-amber-500')
        }
      >
        <span
          className={
            'absolute inset-0 rounded-full ' +
            (state === 'listening' || state === 'speaking' || state === 'wake-listening'
              ? 'animate-ping bg-current opacity-30'
              : 'opacity-0')
          }
        />
        {state === 'listening' ? (
          <MicOff className="w-6 h-6 relative" />
        ) : state === 'thinking' ? (
          <Loader2 className="w-6 h-6 relative animate-spin" />
        ) : state === 'speaking' ? (
          <Volume2 className="w-6 h-6 relative" />
        ) : state === 'wake-listening' ? (
          <Ear className="w-6 h-6 relative" />
        ) : (
          <Mic className="w-6 h-6 relative" />
        )}
      </button>
    </div>
  );
}
