/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, Loader2, Ear, EarOff, Copy, Check, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '../utils/apiBase';

type JarvisState = 'idle' | 'wake-listening' | 'listening' | 'thinking' | 'speaking' | 'error';

// Persistence lets a user close/reopen the panel (or refresh) without losing
// the conversation. Kept short (last N turns) so localStorage stays cheap.
const TURNS_STORAGE_KEY = 'gtm_jarvis_turns';
const MAX_PERSISTED_TURNS = 40;

type Turn = {
  role: 'user' | 'jarvis';
  text: string;
  ts: number;                              // epoch ms — enables "3m ago" labels
  action?: { action: string; args?: Record<string, unknown>; label?: string };
};

// Human-readable label for an executed action — used for both the inline
// badge in the transcript and the confirmation toast. Falls back to the raw
// action name when we don't have a handcrafted phrase yet (adding a case is a
// one-liner as the action registry grows).
function describeAction(action: string, args?: Record<string, unknown>): string {
  const a = (args ?? {}) as Record<string, any>;
  switch (action) {
    case 'navigate.home':          return 'Went home';
    case 'navigate.analyze':       return 'Opened Analyze Website';
    case 'navigate.dashboard':     return 'Opened Dashboard';
    case 'navigate.savedReports':  return 'Opened Saved Reports';
    case 'navigate.back':          return 'Went back';
    case 'theme.toggle':           return 'Toggled theme';
    case 'theme.set':              return `Theme → ${String(a.mode ?? 'default')}`;
    case 'analyzeUrl':             return `Analyzing ${String(a.url ?? 'the URL')}`;
    case 'loadReport':             return `Loaded report matching "${String(a.query ?? '')}"`;
    case 'landing.playIntroVideo': return 'Playing intro video';
    case 'landing.pauseIntroVideo':return 'Paused intro video';
    case 'landing.fullscreenIntroVideo': return 'Fullscreen video';
    case 'landing.scrollToWatch':  return 'Scrolled to Watch section';
    case 'landing.scrollToFeatures': return 'Scrolled to Features';
    case 'landing.scrollToCta':    return 'Scrolled to CTA';
    case 'dashboard.tab':          return `Switched to ${String(a.tab ?? 'tab')} tab`;
    case 'dashboard.refresh':      return 'Refreshed discovery';
    case 'dashboard.saveReport':   return 'Saved report';
    case 'dashboard.openAccount':  return `Opened account${a.name ? ` — ${String(a.name)}` : a.index != null ? ` #${a.index}` : ''}`;
    case 'dashboard.closeDetail':  return 'Closed account detail';
    case 'input.setUrl':           return `Set URL: ${String(a.url ?? '')}`;
    case 'input.setCount':         return `Set count: ${String(a.count ?? '')}`;
    case 'input.submit':           return 'Submitted analysis';
    case 'savedReports.load':      return `Loaded report matching "${String(a.query ?? '')}"`;
    case 'savedReports.delete':    return `Deleted report matching "${String(a.query ?? '')}"`;
    case 'scroll.up':              return 'Scrolled up';
    case 'scroll.down':            return 'Scrolled down';
    case 'scroll.top':             return 'Jumped to top';
    case 'scroll.bottom':          return 'Jumped to bottom';
    case 'readCurrentScreen':      return 'Read screen';
    default:                       return action;
  }
}

// Compact relative-time formatter for turn timestamps. Falls back to a
// clock-time string once the message is older than a day so old conversation
// history stays legible.
function formatTs(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 30_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  try {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return new Date(ts).toISOString().slice(0, 16);
  }
}

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
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      const raw = localStorage.getItem(TURNS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_PERSISTED_TURNS).filter((t: any) =>
        t && (t.role === 'user' || t.role === 'jarvis') && typeof t.text === 'string'
      ).map((t: any) => ({ role: t.role, text: t.text, ts: t.ts ?? Date.now(), action: t.action }));
    } catch { return []; }
  });
  // Which turn's copy button just fired (indexes into turns[]). Reset after
  // a beat so the check icon flips back to the copy icon.
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const turnsScrollRef = useRef<HTMLDivElement | null>(null);

  // Persist turns whenever they change. Debounce isn't necessary — new turns
  // land ~once per few seconds at most.
  useEffect(() => {
    try {
      const slim = turns.slice(-MAX_PERSISTED_TURNS);
      localStorage.setItem(TURNS_STORAGE_KEY, JSON.stringify(slim));
    } catch { /* quota — non-critical */ }
  }, [turns]);

  // Auto-scroll to the newest turn whenever the transcript grows or the panel
  // opens. Uses scrollTo so it works even with dynamic content sizes.
  useEffect(() => {
    if (!open) return;
    const el = turnsScrollRef.current;
    if (!el) return;
    // Next tick so the new turn's DOM node is mounted before we scroll.
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [turns, open, state]);

  const copyTurn = useCallback((idx: number, text: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => { setCopiedIndex(null); }, 1400);
    } catch {
      toast.error('Copy failed');
    }
  }, []);

  const clearTurns = useCallback(() => {
    setTurns([]);
    try { localStorage.removeItem(TURNS_STORAGE_KEY); } catch {}
    toast.success('Conversation cleared');
  }, []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported] = useState<boolean>(!!getSpeechRecognitionCtor());
  // Firefox and Safari lack webkitSpeechRecognition, so those users get a
  // MediaRecorder → /api/jarvis/stt (Whisper) tap-to-record flow instead.
  const [supportsMediaRecorder] = useState<boolean>(
    typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined'
  );
  const useWhisperFallback = !supported && supportsMediaRecorder;
  const [whisperRecording, setWhisperRecording] = useState(false);
  // Click-to-talk by default — user must tap the orb to speak. The ear icon
  // is an opt-in toggle for hands-free "Hey Jarvis" wake detection (kept for
  // users who want it, but off on load so the mic isn't hot without consent).
  const [handsFree, setHandsFree] = useState<boolean>(false);

  const commandRecRef = useRef<any>(null);
  const wakeRecRef = useRef<any>(null);
  // Barge-in listener runs concurrently with Jarvis's audio output. When it
  // hears speech, it aborts the current playback and hands the microphone off
  // to a full command capture so the user can interrupt naturally.
  const bargeInRecRef = useRef<any>(null);
  // MediaRecorder plumbing for Whisper fallback (Firefox / Safari).
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  // Voice-activity detector for the Whisper path — polls the input volume
  // and calls stopWhisperCapture() automatically after ~1s of quiet
  // following at least some speech. Removes the "tap again to send" chore.
  const vadCtxRef = useRef<AudioContext | null>(null);
  const vadTimerRef = useRef<number | null>(null);
  // 0-1 live volume level, used to pulse the mic indicator.
  const [vadLevel, setVadLevel] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<JarvisState>('idle');
  const handsFreeRef = useRef<boolean>(handsFree);
  // Cached wake-greeting audio — pre-generated at page load so wake -> greeting
  // is instant (no TTS network round-trip when the user says "Hey Jarvis").
  const greetingUrlRef = useRef<string | null>(null);
  // Pre-cached acknowledgement phrases ("On it", "Sure", ...). One is played
  // the moment the user sends a message so first-audio latency drops from ~2s
  // (LLM + TTS round-trip) to ~50ms (local blob play). The real reply
  // sentences queue behind whichever ack fires.
  const ackAudioUrlsRef = useRef<string[]>([]);
  // Latest turns mirror, read at send-time so history reflects the newest state
  // even when sendToJarvis is invoked from an older closure.
  const turnsRef = useRef<Turn[]>([]);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);

  // Toggle the barge-in listener alongside speaking state so the user can
  // interrupt Jarvis mid-answer just by talking (hands-free mode only).
  useEffect(() => {
    if (state === 'speaking') {
      startBargeInListener();
    } else {
      stopBargeInRec();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // How many prior turns (user + jarvis pairs) to send back as context on
  // each request. 5 pairs = ~10 messages, usually <1500 tokens.
  const HISTORY_TURNS = 5;
  const buildHistory = useCallback((): Array<{ role: 'user' | 'jarvis'; text: string }> => {
    const prev = turnsRef.current;
    // Take the tail up to 2*HISTORY_TURNS entries and drop the greeting-only
    // opening jarvis turn so we don't waste tokens repeating it.
    const tail = prev.slice(-2 * HISTORY_TURNS);
    return tail.map((t) => ({ role: t.role, text: t.text }));
  }, []);

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

  const stopBargeInRec = useCallback(() => {
    const r = bargeInRecRef.current;
    if (!r) return;
    r._stopIntentional = true;
    try { r.stop(); } catch {}
    bargeInRecRef.current = null;
  }, []);

  const stopEverything = useCallback(() => {
    stopCommandRec();
    stopWakeRec();
    stopBargeInRec();
    try { audioRef.current?.pause(); } catch {}
    if (audioRef.current) audioRef.current.currentTime = 0;
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
    setTranscript('');
  }, [stopCommandRec, stopWakeRec, stopBargeInRec]);

  // ---------------------------------------------------------------------------
  // Command listening — captures the actual question after wake, or after click.
  // ---------------------------------------------------------------------------
  const speakText = useCallback(async (text: string) => {
    stateRef.current = 'speaking';
    setState('speaking');
    try {
      const res = await fetch(apiUrl('/api/jarvis/tts'), {
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

  // Runs the streaming /api/jarvis/stream flow: LLM tokens arrive incrementally,
  // sentences are dispatched to TTS in parallel, audio chunks play in sequence.
  // Perceived latency drops ~40–60% vs the old two-step /chat -> /tts flow.
  // Returns true on success, false if streaming failed (caller falls back).
  const runStreamingReply = useCallback(async (clean: string, controller: AbortController) => {
    const context = getContext?.() ?? '';
    const history = buildHistory();
    const res = await fetch(apiUrl('/api/jarvis/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clean, context, history }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream http ${res.status}`);

    // Sequential audio playback chain. Each sentence's TTS fetch starts
    // immediately (parallel), but playback is serialized via .then chaining.
    // Smart ack: instead of always playing an ack, we schedule it 250ms out
    // and cancel if a real sentence arrives first. That way short replies
    // ("Yes.") don't get a redundant "Sure." tacked on the front, while
    // longer replies still get instant first-audio.
    let firstAudioStarted = false;
    const activeUrls: string[] = [];
    let playChain: Promise<void> = Promise.resolve();
    let ackStarted = false;
    let ackTimer: number | null = null;
    const ackUrls = ackAudioUrlsRef.current;
    const scheduleAck = () => {
      if (ackUrls.length === 0 || ackStarted || ackTimer != null) return;
      ackTimer = window.setTimeout(() => {
        ackTimer = null;
        if (controller.signal.aborted) return;
        if (firstAudioStarted) return; // a real sentence already started
        ackStarted = true;
        const ackUrl = ackUrls[Math.floor(Math.random() * ackUrls.length)];
        playChain = playChain.then(async () => {
          if (controller.signal.aborted) return;
          const audio = new Audio(ackUrl);
          audioRef.current = audio;
          firstAudioStarted = true;
          stateRef.current = 'speaking';
          setState('speaking');
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            void audio.play().catch(() => resolve());
          });
        }).catch(() => {});
      }, 250);
    };
    const cancelAck = () => {
      if (ackTimer != null) { clearTimeout(ackTimer); ackTimer = null; }
    };
    scheduleAck();

    const enqueueSentence = (text: string) => {
      const ttsPromise = fetch(apiUrl('/api/jarvis/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'onyx' }),
        signal: controller.signal,
      }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('TTS failed'))));

      playChain = playChain.then(async () => {
        if (controller.signal.aborted) return;
        let blob: Blob;
        try { blob = await ttsPromise; } catch { return; }
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        activeUrls.push(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        if (!firstAudioStarted) {
          firstAudioStarted = true;
          stateRef.current = 'speaking';
          setState('speaking');
        }
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
      }).catch(() => {});
    };

    // Parse SSE frames from the response body.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';
    let finalAction: string | undefined;
    let finalArgs: Record<string, unknown> | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = '';
          let dataStr = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!event || !dataStr) continue;
          let payload: any;
          try { payload = JSON.parse(dataStr); } catch { continue; }
          if (event === 'sentence' && typeof payload.text === 'string' && payload.text.trim()) {
            cancelAck(); // real audio arrived — skip the "On it." ack
            enqueueSentence(payload.text.trim());
          } else if (event === 'final') {
            fullReply = payload.reply || '';
            finalAction = payload.action;
            finalArgs = payload.args;
          } else if (event === 'error') {
            throw new Error(payload.message || 'stream error');
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      cancelAck();
    }

    const label = finalAction && finalAction !== 'none' ? describeAction(finalAction, finalArgs) : undefined;
    if (fullReply) {
      setTurns((prev) => [...prev, {
        role: 'jarvis',
        text: fullReply,
        ts: Date.now(),
        action: finalAction && finalAction !== 'none' ? { action: finalAction, args: finalArgs, label } : undefined,
      }]);
    }
    if (finalAction && finalAction !== 'none') {
      try {
        onAction?.({ action: finalAction, args: finalArgs });
        if (label) toast.success(label, { duration: 2600 });
      } catch (e) { console.warn('Jarvis action failed:', e); }
    }

    // Wait for all queued audio to finish playing.
    await playChain;
    // Belt-and-suspenders: revoke any URLs the chain didn't reach on abort.
    for (const u of activeUrls) { try { URL.revokeObjectURL(u); } catch {} }
  }, [getContext, onAction, buildHistory]);

  const sendToJarvis = useCallback(async (userText: string) => {
    const clean = userText.trim();
    if (!clean) { setState('idle'); return; }
    setOpen(true);
    setTurns((prev) => [...prev, { role: 'user', text: clean, ts: Date.now() }]);
    setState('thinking');
    setTranscript('');
    const controller = new AbortController();
    abortRef.current = controller;

    let streamed = false;
    try {
      await runStreamingReply(clean, controller);
      streamed = true;
    } catch (streamErr: any) {
      if (streamErr?.name === 'AbortError') return;
      console.warn('[jarvis] streaming failed, falling back to /chat:', streamErr?.message);
    }

    if (!streamed) {
      // Fallback: original non-streaming path.
      try {
        const context = getContext?.() ?? '';
        const history = buildHistory();
        const res = await fetch(apiUrl('/api/jarvis/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: clean, context, history }),
          signal: controller.signal,
        });
        const data = await res.json();
        const reply: string = data?.reply || 'I did not get a response.';
        const action: string | undefined = data?.action;
        const args: Record<string, unknown> | undefined = data?.args;
        const nsLabel = action && action !== 'none' ? describeAction(action, args) : undefined;
        setTurns((prev) => [...prev, { role: 'jarvis', text: reply, ts: Date.now(), action: action && action !== 'none' ? { action, args, label: nsLabel } : undefined }]);
        if (action && action !== 'none') {
          try {
            onAction?.({ action, args });
            if (nsLabel) toast.success(nsLabel, { duration: 2600 });
          } catch (e) { console.warn('Jarvis action failed:', e); }
        }
        await speakText(reply);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setErrorMsg(e?.message ?? 'Request failed');
        setState('idle');
        return;
      }
    }

    stateRef.current = 'idle';
    setState('idle');

    // Conversational continuation — in hands-free mode, re-arm wake listener
    // so the user can follow up naturally. In push-to-talk mode, briefly
    // auto-listen for a follow-up without needing to click again.
    if (handsFreeRef.current) {
      startWakeListener();
    } else {
      // Short follow-up window — the user can just keep talking.
      setTimeout(() => {
        if (stateRef.current === 'idle') startCommandListening(true);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getContext, onAction, speakText, runStreamingReply, buildHistory]);

  // Barge-in listener — runs while Jarvis is speaking. Any detected speech
  // aborts the current audio+stream and hands off to a full command capture
  // so the user can interrupt naturally, no click required.
  const startBargeInListener = useCallback(() => {
    if (!handsFreeRef.current) return; // opt-in — same gate as the wake listener
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    stopBargeInRec();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let handoff = false;
    rec.onspeechstart = () => {
      // User started talking — kill Jarvis's audio + in-flight fetches and
      // switch to full command capture. The `handoff` guard prevents onend
      // from double-firing while we're setting up the next listener.
      handoff = true;
      try { audioRef.current?.pause(); } catch {}
      if (audioRef.current) audioRef.current.currentTime = 0;
      abortRef.current?.abort();
      abortRef.current = null;
      try { rec._stopIntentional = true; rec.stop(); } catch {}
      bargeInRecRef.current = null;
      // Small delay so the current SR fully releases before startCommandListening
      // instantiates a fresh one.
      setTimeout(() => startCommandListening(true), 50);
    };
    rec.onerror = () => { /* silent — barge-in is best-effort */ };
    rec.onend = () => {
      if (bargeInRecRef.current === rec) bargeInRecRef.current = null;
      if (handoff) return;
      // Ended before user spoke (Jarvis finished naturally). No-op.
    };
    bargeInRecRef.current = rec;
    try { rec.start(); } catch { bargeInRecRef.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopBargeInRec]);

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
                return [...prev, { role: 'jarvis', text: WAKE_GREETING, ts: Date.now() }];
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
    const fetchAndCache = async (text: string): Promise<string | null> => {
      try {
        const res = await fetch(apiUrl('/api/jarvis/tts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'onyx' }),
        });
        if (!res.ok || cancelled) return null;
        const blob = await res.blob();
        if (cancelled) return null;
        return URL.createObjectURL(blob);
      } catch { return null; }
    };

    (async () => {
      const url = await fetchAndCache(WAKE_GREETING);
      if (url) greetingUrlRef.current = url;
      if (url) console.log('[jarvis] greeting TTS pre-cached');
    })();

    // Short ack phrases fetched in parallel — one plays immediately on every
    // user-turn so first-audio is ~50ms instead of waiting for the LLM stream.
    const ACK_PHRASES = ['On it.', 'Sure.', 'One moment.', 'Let me check.', 'Working on it.'];
    (async () => {
      const results = await Promise.all(ACK_PHRASES.map(fetchAndCache));
      if (cancelled) return;
      ackAudioUrlsRef.current = results.filter((u): u is string => !!u);
      if (ackAudioUrlsRef.current.length > 0) {
        console.log(`[jarvis] ${ackAudioUrlsRef.current.length}/${ACK_PHRASES.length} ack phrases pre-cached`);
      }
    })();

    return () => {
      cancelled = true;
      if (greetingUrlRef.current) {
        URL.revokeObjectURL(greetingUrlRef.current);
        greetingUrlRef.current = null;
      }
      for (const u of ackAudioUrlsRef.current) { try { URL.revokeObjectURL(u); } catch {} }
      ackAudioUrlsRef.current = [];
    };
  }, []);

  // First-visit hint — one-time toast telling the user how to talk to Jarvis.
  useEffect(() => {
    if (!supported && !supportsMediaRecorder) return;
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

  // Whisper capture — Firefox/Safari path. Tap once to record, tap again to
  // stop. On stop, the accumulated blob POSTs to /api/jarvis/stt (Whisper),
  // and the returned transcript feeds into sendToJarvis just like the Chrome
  // webkitSpeechRecognition flow.
  const stopWhisperCapture = useCallback(async () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    // Tear down VAD first so its tick loop stops immediately (before the
    // onstop fires and mediaStreamRef is nulled).
    if (vadTimerRef.current != null) { clearTimeout(vadTimerRef.current); vadTimerRef.current = null; }
    if (vadCtxRef.current) { try { void vadCtxRef.current.close(); } catch {} vadCtxRef.current = null; }
    setVadLevel(0);
    return new Promise<void>((resolve) => {
      rec.onstop = async () => {
        // Release mic tracks so the browser stops showing the "recording" tab
        // indicator immediately.
        for (const t of mediaStreamRef.current?.getTracks() ?? []) { try { t.stop(); } catch {} }
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setWhisperRecording(false);

        const chunks = mediaChunksRef.current.slice();
        mediaChunksRef.current = [];
        if (chunks.length === 0) { setState('idle'); resolve(); return; }
        const mime = rec.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        if (blob.size < 800) { // near-empty capture — treat as no speech
          setState('idle');
          setErrorMsg('I did not hear anything.');
          resolve();
          return;
        }
        setState('thinking');
        try {
          const res = await fetch(apiUrl('/api/jarvis/stt'), {
            method: 'POST',
            headers: { 'Content-Type': mime },
            body: blob,
          });
          const data = await res.json().catch(() => ({}));
          const text = String(data?.text || '').trim();
          if (text) {
            sendToJarvis(text);
          } else {
            setState('idle');
            setErrorMsg('I did not catch that. Try again?');
          }
        } catch (e: any) {
          setState('idle');
          setErrorMsg(`Voice input problem: ${e?.message ?? 'network error'}`);
        }
        resolve();
      };
      try { rec.stop(); } catch { resolve(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendToJarvis]);

  const startWhisperCapture = useCallback(async () => {
    if (whisperRecording) return;
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      // MediaRecorder picks the best-supported mime per browser: WebM/Opus on
      // Chrome+Firefox, MP4/AAC on Safari. Whisper handles both via ffmpeg.
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
      let rec: MediaRecorder | null = null;
      for (const mime of candidates) {
        try {
          rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          break;
        } catch { /* try next */ }
      }
      if (!rec) throw new Error('MediaRecorder unavailable');
      mediaChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data); };
      rec.onstart = () => {
        setState('listening');
        setWhisperRecording(true);
        // Attach a voice-activity detector so the user doesn't have to tap
        // "stop" — captures the natural end of the utterance. Falls back
        // silently to manual stop if AudioContext isn't available.
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          const ctx: AudioContext = new AudioCtx();
          vadCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.6;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const SPEECH_RMS = 0.05;       // above this = speech
          const SILENCE_RMS = 0.025;     // below this = quiet
          const SILENCE_HANGOVER_MS = 1100;
          const HARD_CAP_MS = 15_000;
          const startedAt = Date.now();
          let speechDetected = false;
          let quietSince: number | null = null;
          const tick = () => {
            if (!mediaRecorderRef.current || vadCtxRef.current !== ctx) return;
            analyser.getByteFrequencyData(buf);
            // Simple RMS across freq bins, normalised to 0-1.
            let sum = 0;
            for (let i = 0; i < buf.length; i++) { const v = buf[i] / 255; sum += v * v; }
            const rms = Math.sqrt(sum / buf.length);
            setVadLevel(Math.min(1, rms * 3));
            const now = Date.now();
            if (rms > SPEECH_RMS) { speechDetected = true; quietSince = null; }
            else if (rms < SILENCE_RMS) { if (quietSince == null) quietSince = now; }
            else { quietSince = null; }
            const quietFor = quietSince != null ? now - quietSince : 0;
            const runFor = now - startedAt;
            if ((speechDetected && quietFor > SILENCE_HANGOVER_MS) || runFor > HARD_CAP_MS) {
              // Natural end of utterance or hard cap — auto-submit.
              vadTimerRef.current = null;
              void stopWhisperCapture();
              return;
            }
            vadTimerRef.current = window.setTimeout(tick, 90);
          };
          vadTimerRef.current = window.setTimeout(tick, 200);
        } catch { /* VAD is best-effort — user can still tap to stop */ }
      };
      rec.onerror = (e: any) => {
        setErrorMsg(`Microphone error: ${e?.error?.name ?? 'unknown'}`);
        for (const t of stream.getTracks()) { try { t.stop(); } catch {} }
        setWhisperRecording(false);
        setState('idle');
      };
      mediaRecorderRef.current = rec;
      rec.start(500); // deliver a chunk every 500ms so we can size-check early
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        setErrorMsg('Microphone access denied. Enable it in your browser.');
      } else {
        setErrorMsg(`Voice input problem: ${e?.message ?? 'unknown'}`);
      }
      setState('idle');
    }
  }, [whisperRecording]);

  const handleOrbClick = () => {
    if (!open) setOpen(true);
    if (whisperRecording) { void stopWhisperCapture(); return; }
    if (state === 'listening') {
      try { commandRecRef.current?.stop(); } catch {}
      return;
    }
    if (state === 'speaking' || state === 'thinking') {
      stopEverything();
      return;
    }
    if (useWhisperFallback) { void startWhisperCapture(); return; }
    startCommandListening();
  };

  const statusLabel: Record<JarvisState, string> = {
    idle: handsFree ? 'Say "Hey Jarvis"' : useWhisperFallback ? 'Tap the mic to talk' : 'Tap the mic to talk',
    'wake-listening': 'Waiting for "Hey Jarvis"',
    listening: whisperRecording ? 'Recording · auto-stops when you pause' : 'Listening...',
    thinking: 'Thinking...',
    speaking: handsFree ? 'Speaking · say anything to interrupt' : 'Speaking',
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
              {turns.length > 0 && (
                <button
                  onClick={clearTurns}
                  className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition p-1.5"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Hands-free wake requires webkitSpeechRecognition — hide the
                  toggle on Firefox/Safari where the Whisper fallback path
                  can't support continuous listening. */}
              {supported && (
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
              )}
              <button
                onClick={() => { stopEverything(); setOpen(false); }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition p-1.5"
                aria-label="Close Jarvis"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={turnsScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
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
            {turns.map((t, i) => {
              const isUser = t.role === 'user';
              const showCopy = !isUser && t.text.length > 0;
              return (
                <div key={i} className={`group ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={
                      'inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug break-words whitespace-pre-wrap ' +
                      (isUser
                        ? 'bg-orange-500 text-white rounded-br-sm'
                        : 'bg-stone-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-100 rounded-bl-sm')
                    }
                  >
                    {t.text}
                  </div>
                  {t.action && !isUser && (
                    <div className="mt-1 flex justify-start">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                        <Zap className="w-2.5 h-2.5" />
                        {t.action.label || t.action.action}
                      </span>
                    </div>
                  )}
                  <div className={`mt-0.5 flex items-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider ${isUser ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {showCopy && (
                      <button
                        onClick={() => copyTurn(i, t.text)}
                        className="inline-flex items-center gap-1 hover:text-orange-600 dark:hover:text-orange-400"
                        title="Copy reply"
                      >
                        {copiedIndex === i ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        {copiedIndex === i ? 'Copied' : 'Copy'}
                      </button>
                    )}
                    <span>{formatTs(t.ts)}</span>
                  </div>
                </div>
              );
            })}
            {state === 'listening' && transcript && (
              <div className="text-right">
                <div className="inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug bg-orange-500/50 text-white rounded-br-sm italic">
                  {transcript}
                </div>
              </div>
            )}
            {whisperRecording && (
              <div className="text-right">
                <div className="inline-flex items-center gap-2 max-w-[85%] px-3 py-2 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-800 dark:text-orange-200 text-[12px]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  {/* Live volume-level bar — 10 pips fill in proportion to input RMS.
                      Gives users tactile feedback that the mic is picking them up. */}
                  <span className="inline-flex items-end gap-[2px] h-3">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const active = vadLevel * 10 > i;
                      const h = 3 + i * 1;
                      return (
                        <span
                          key={i}
                          style={{ height: `${h}px` }}
                          className={active ? 'w-[3px] rounded-sm bg-orange-500' : 'w-[3px] rounded-sm bg-orange-500/30'}
                        />
                      );
                    })}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">Recording</span>
                </div>
              </div>
            )}
            {state === 'thinking' && (
              <div className="text-left flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 text-[13px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </div>
                <button
                  onClick={stopEverything}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 px-2 py-1 rounded-md border border-red-500/30 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Cancel this request"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="px-4 py-2 text-[11px] text-red-600 dark:text-red-400 border-t border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
              {errorMsg}
            </div>
          )}
          {!supported && !supportsMediaRecorder && (
            <div className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400 border-t border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
              Voice input isn&apos;t available in this browser. TTS still works.
            </div>
          )}
          {useWhisperFallback && (
            <div className="px-4 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-stone-200 dark:border-white/[0.06]">
              Using Whisper voice input — tap to talk, it auto-sends when you stop speaking.
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
