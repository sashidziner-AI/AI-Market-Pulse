import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Phone, PhoneOff, X, Loader2, Mic, MicOff, ShieldCheck,
  MessageSquare, Volume2, CalendarClock, Trash2, Users, UserPlus,
  Smartphone, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type {
  TargetAccount, VoiceCallScript, VoiceCallState, VoiceCallTranscriptLine,
  BusinessAnalysis, ScheduledCall
} from '../types';
import {
  TIMEZONE_OPTIONS, detectBrowserTimezone, defaultScheduleFields,
  formatWallClock, zonedTimeToUtcMs,
} from '../utils/schedule';

interface VoiceCallModalProps {
  account: TargetAccount;
  sellerContext: BusinessAnalysis;
  onClose: () => void;
  onCallCompleted: (accountId: string, call: VoiceCallState) => void;
  // Called when the user picks "Schedule Call". Dashboard persists this and
  // its own poller re-opens the modal (with autoStart=true) at the scheduled
  // instant so the AI initiates the conversation without the user present.
  onSchedule?: (schedule: Omit<ScheduledCall, 'id' | 'status' | 'createdAt'>) => void;
  // Existing pending schedule for THIS account, if any. Shown as a chip so
  // the user can see/cancel what's already queued before scheduling a new one.
  existingSchedule?: ScheduledCall | null;
  onCancelSchedule?: (scheduleId: string) => void;
  // Auto-launch the conversation on mount — set by the Dashboard poller when
  // firing a due scheduled call. The user isn't clicking Start Now; the
  // scheduler is.
  autoStart?: boolean;
  // Seed values for the form state — used by the scheduler to restore the
  // exact script/contact the user picked at schedule time, so the auto-start
  // path uses the same instructions as the queued call.
  initialScript?: VoiceCallScript;
  initialContactName?: string;
  // The rest of the pipeline. When provided, the contact dropdown aggregates
  // personas + stakeholder map contacts from all of these accounts (grouped
  // by account name) so the user can pick a contact from anywhere — useful
  // when the currently-selected account hasn't been analyzed yet.
  pipelineAccounts?: TargetAccount[];
}

type Phase = 'idle' | 'connecting' | 'live' | 'ended' | 'failed';

const SCRIPT_OPTIONS: { value: VoiceCallScript; label: string; description: string }[] = [
  { value: 'discovery', label: 'Discovery call', description: '3 qualifying questions + book a follow-up' },
  { value: 'follow_up', label: 'Follow-up', description: 'Confirm interest from prior outreach' },
  { value: 'demo_booking', label: 'Demo booking', description: 'Offer time slots for a live product tour' },
];

export function VoiceCallModal({
  account, sellerContext, onClose, onCallCompleted,
  onSchedule, existingSchedule, onCancelSchedule, autoStart,
  initialScript, initialContactName, pipelineAccounts,
}: VoiceCallModalProps) {
  const [contactName, setContactName] = useState(initialContactName || 'there');
  const [script, setScript] = useState<VoiceCallScript>(initialScript || 'discovery');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState<VoiceCallTranscriptLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  // Scheduler state — the timezone defaults to the browser's zone, date+time
  // seed a rounded 15-min-from-now slot. Fields stay on the form even after
  // "Start Now" so the user can immediately schedule a follow-up without
  // re-picking a zone.
  const [tz, setTz] = useState<string>(() => detectBrowserTimezone());
  const initialFields = useMemo(() => defaultScheduleFields(tz), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [scheduleDate, setScheduleDate] = useState<string>(initialFields.date);
  const [scheduleTime, setScheduleTime] = useState<string>(initialFields.time);

  // Prepend the detected zone to the dropdown if it isn't already curated —
  // dedupe against the built-in list to avoid double entries.
  const timezoneChoices = useMemo(() => {
    const browserTz = detectBrowserTimezone();
    const list = TIMEZONE_OPTIONS.slice();
    if (browserTz && !list.some(o => o.value === browserTz)) {
      list.unshift({ value: browserTz, label: `${browserTz} (detected)` });
    }
    return list;
  }, []);

  // Contact directory pulled from every pipeline account's analysis + CRM
  // record. Personas & stakeholder-map nodes only carry a `role` label (the
  // AI doesn't fabricate names/phones during analyze-account), so we surface
  // that as the "name" the AI will greet with. A phone number is only shown
  // when the account has been synced to a CRM record that carries one.
  //
  // We aggregate across the whole pipeline (grouped by account) so a call
  // opened for an un-analyzed account can still surface contacts from its
  // neighbors. `account` itself is always ordered first so its contacts
  // appear at the top of the dropdown.
  type ContactOption = {
    id: string;
    name: string;             // what the AI will use to address the contact
    subtitle: string;         // where this option was sourced from
    phone?: string;           // rare — only when CRM has a mobile
    accountId: string;        // origin account (used for optgroup label)
    accountName: string;
    isOwnAccount: boolean;    // belongs to the currently-selected account
    source: 'crm' | 'persona' | 'stakeholder';
  };
  const contactOptions = useMemo<ContactOption[]>(() => {
    const opts: ContactOption[] = [];

    // Build the ordered walk list: focused account first, then the rest of
    // the pipeline (deduped by id).
    const seen = new Set<string>([account.id]);
    const walk: TargetAccount[] = [account];
    for (const a of pipelineAccounts || []) {
      if (a && !seen.has(a.id)) {
        seen.add(a.id);
        walk.push(a);
      }
    }

    for (const a of walk) {
      const isOwn = a.id === account.id;
      const crm = a.crmRecord;
      if (crm && (crm.name || crm.mobile)) {
        opts.push({
          id: `${a.id}:crm:${crm.id}`,
          name: crm.name || 'CRM contact',
          subtitle: `CRM · ${crm.leadStatus}${crm.mobile ? ` · ${crm.mobile}` : ''}`,
          phone: crm.mobile,
          accountId: a.id,
          accountName: a.name,
          isOwnAccount: isOwn,
          source: 'crm',
        });
      }
      (a.analysis?.buyerPersonas || []).forEach((p, i) => {
        if (!p?.role) return;
        opts.push({
          id: `${a.id}:persona:${i}`,
          name: p.role,
          subtitle: 'Buyer persona',
          accountId: a.id,
          accountName: a.name,
          isOwnAccount: isOwn,
          source: 'persona',
        });
      });
      const map = a.analysis?.multiThreadingStrategy;
      if (map) {
        const nodes = [
          map.accessibleEntryPoint,
          map.internalChampion,
          map.economicBuyer,
          map.technicalGatekeeper,
        ];
        nodes.forEach((s, i) => {
          if (!s?.role) return;
          opts.push({
            id: `${a.id}:stake:${i}`,
            name: s.role,
            subtitle: `Stakeholder map · ${s.strategicRole}`,
            accountId: a.id,
            accountName: a.name,
            isOwnAccount: isOwn,
            source: 'stakeholder',
          });
        });
      }
    }
    return opts;
  }, [account, pipelineAccounts]);

  // Which directory entry (if any) the user picked. `null` = "custom name"
  // path: the text input below drives contactName directly, matching the
  // pre-dropdown behavior.
  const [selectedContactId, setSelectedContactId] = useState<string | null>(() => {
    // If we opened auto-start from a schedule that has a contact name matching
    // a directory entry, preselect it — otherwise fall to custom.
    if (initialContactName && initialContactName !== 'there') return null;
    return null;
  });
  const selectedContact = useMemo(
    () => contactOptions.find(c => c.id === selectedContactId) || null,
    [contactOptions, selectedContactId]
  );

  // Delivery mode. Browser = existing WebRTC-to-mic flow. Phone = Vapi dials
  // the entered number and the AI runs the conversation over PSTN.
  const [callMode, setCallMode] = useState<'browser' | 'phone'>('browser');
  // Phone number for Vapi dial. Defaults from the server's DEMO_DEFAULT_PHONE
  // env, falling back to any prior localStorage value.
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    try { return localStorage.getItem('gtm_demo_phone') || ''; } catch { return ''; }
  });
  // Whether the server has Vapi keys wired. Hides the Phone mode option
  // gracefully when the backend isn't configured.
  const [vapiReady, setVapiReady] = useState(false);
  useEffect(() => {
    // Prefer the selected contact's phone (from CRM) when it's populated,
    // otherwise keep whatever the user typed / defaulted to.
    if (selectedContact?.phone && !phoneNumber) {
      setPhoneNumber(selectedContact.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.phone]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice-call/config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cancelled || !cfg) return;
        setVapiReady(!!cfg.vapiReady);
        if (cfg.defaultPhone && !phoneNumber) setPhoneNumber(cfg.defaultPhone);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist phone across sessions so the user doesn't retype for every demo.
  useEffect(() => {
    try {
      if (phoneNumber) localStorage.setItem('gtm_demo_phone', phoneNumber);
    } catch { /* ignore */ }
  }, [phoneNumber]);

  // Live status when a Vapi call is in flight. Populated after a successful
  // POST to /api/voice-call/start; polled every ~3s while active so the UI
  // can reflect ringing → in_progress → completed transitions.
  const [phoneCall, setPhoneCall] = useState<{
    callId: string;
    accessToken: string;
    status: string;
    errorMessage?: string;
  } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  // Buffer partial transcript deltas per role until they're finalized
  const activeUserLineRef = useRef<string>('');
  const activeAiLineRef = useRef<string>('');

  const appendFinalLine = (speaker: 'ai' | 'human', text: string) => {
    if (!text.trim()) return;
    setTranscript(t => [...t, {
      speaker, text: text.trim(),
      timestamp: new Date().toISOString(),
    }]);
  };

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript.length]);

  const cleanup = () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);

  // Auto-launch when the modal is opened by the schedule poller. `autoStart`
  // is only true on the very first render triggered by a due scheduled call;
  // if the user then closes and reopens the modal manually, they land back
  // on the idle form. The modal caller is responsible for passing the same
  // script/contactName captured at schedule time via the initial state seed.
  //
  // Note: phone-mode schedules are dialed directly by the Dashboard poller
  // (no browser modal needed), so this only fires for browser-mode schedules.
  const autoStartFiredRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    // A microtask defer so any state props from a matching scheduled call
    // (e.g. preferred script) are painted before mic acquisition kicks off.
    Promise.resolve().then(() => startConversation());
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const validatePhoneForDial = (): string | null => {
    const cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 8) return null;
    return cleaned;
  };

  const startPhoneCall = async () => {
    setErrorMsg(null);
    const cleaned = validatePhoneForDial();
    if (!cleaned) {
      setErrorMsg('Enter a phone number in E.164 format (e.g. +14155552671).');
      toast.error('Phone must be E.164 format.');
      return;
    }
    setPhase('connecting');
    try {
      const res = await fetch('/api/voice-call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          accountName: account.name,
          contactName,
          phoneNumber: cleaned,
          script,
          fitReason: account.fitReason,
          signals: account.signals,
          industry: account.industry,
          sellerName: sellerContext.businessName,
          sellerValueProp: sellerContext.valueProp,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Dial failed (HTTP ${res.status})`);
      setPhoneCall({ callId: body.callId, accessToken: body.accessToken, status: body.status || 'ringing' });
      setPhase('live');
      toast.success(`Ringing ${cleaned}…`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dial');
      setPhase('failed');
      toast.error(err?.message || 'Failed to dial');
    }
  };

  // Poll Vapi call status while a phone dial is active. Stops when the call
  // reaches a terminal state (completed / failed / no_answer / voicemail).
  useEffect(() => {
    if (!phoneCall || callMode !== 'phone') return;
    const terminal = new Set(['completed', 'failed', 'no_answer', 'voicemail']);
    if (terminal.has(phoneCall.status)) return;
    const int = setInterval(async () => {
      try {
        const r = await fetch(`/api/voice-call/${phoneCall.callId}?token=${encodeURIComponent(phoneCall.accessToken)}`);
        if (!r.ok) return;
        const j = await r.json();
        setPhoneCall(prev => prev ? { ...prev, status: j.status || prev.status, errorMessage: j.errorMessage } : prev);
        if (terminal.has(j.status)) {
          setPhase('ended');
          clearInterval(int);
        }
      } catch { /* transient — keep polling */ }
    }, 3000);
    return () => clearInterval(int);
  }, [phoneCall, callMode]);

  const scheduleCall = () => {
    if (!onSchedule) return;
    const utcMs = zonedTimeToUtcMs(scheduleDate, scheduleTime, tz);
    if (!Number.isFinite(utcMs)) {
      toast.error('Pick a valid date and time.');
      return;
    }
    if (utcMs <= Date.now() + 30_000) {
      // Guard against past / too-soon schedules. The poller only ticks every
      // ~15s so requiring 30s of lead lets the schedule actually persist and
      // hit the next tick.
      toast.error('Schedule at least 30 seconds in the future — use Start Now for an immediate call.');
      return;
    }
    // Phone-mode schedules need a validated number captured at schedule time
    // so the Dashboard poller can dial without reopening the modal.
    let phoneForSchedule: string | undefined;
    if (callMode === 'phone') {
      const cleaned = validatePhoneForDial();
      if (!cleaned) {
        toast.error('Phone must be E.164 format to schedule a phone call.');
        return;
      }
      phoneForSchedule = cleaned;
    }
    const scheduledForIso = new Date(utcMs).toISOString();
    const wallClockLabel = formatWallClock(utcMs, tz);
    onSchedule({
      accountId: account.id,
      accountName: account.name,
      contactName,
      script,
      scheduledFor: scheduledForIso,
      timezone: tz,
      wallClockLabel,
      mode: callMode,
      phoneNumber: phoneForSchedule,
    });
    toast.success(`AI call scheduled — ${wallClockLabel}`);
    onClose();
  };

  const handleClose = () => {
    if (phase === 'live') {
      endConversation(false);
    }
    cleanup();
    onClose();
  };

  const endConversation = (savePermanent: boolean) => {
    setPhase('ended');
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    cleanup();
    if (savePermanent) {
      const finalCall: VoiceCallState = {
        callId: `browser-${Date.now()}`,
        status: 'completed',
        script,
        contactName,
        phoneNumber: 'browser-mic',
        startedAt: new Date(startedAtRef.current).toISOString(),
        endedAt: new Date().toISOString(),
        durationSec,
        transcript,
        summary: transcript.length > 0
          ? `Browser conversation with ${account.name} • ${transcript.length} exchanges`
          : undefined,
      };
      onCallCompleted(account.id, finalCall);
    }
  };

  const startConversation = async () => {
    setErrorMsg(null);
    setTranscript([]);
    setPhase('connecting');
    activeUserLineRef.current = '';
    activeAiLineRef.current = '';

    try {
      // 1. Ask server to mint a Realtime ephemeral session.
      const sessionRes = await fetch('/api/voice-call/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          accountName: account.name,
          contactName,
          script,
          fitReason: account.fitReason,
          signals: account.signals,
          industry: account.industry,
          sellerName: sellerContext.businessName,
          sellerValueProp: sellerContext.valueProp,
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.error || 'Failed to open session');

      const { clientSecret, model } = sessionData;
      if (!clientSecret) throw new Error('No client_secret returned from server');

      // 2. Get microphone access.
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e: any) {
        throw new Error('Microphone permission denied. Grant mic access and try again.');
      }
      micStreamRef.current = micStream;

      // 3. Build the RTCPeerConnection.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio → hidden <audio> element for playback.
      pc.ontrack = (evt) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = evt.streams[0];
          audioElRef.current.play().catch(() => {});
        }
      };

      // Send our mic to OpenAI.
      pc.addTrack(micStream.getTracks()[0], micStream);

      // Data channel for JSON events (transcript, tool calls, status).
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onopen = () => {
        // Notify the AI to speak first (using the system-prompt-defined opener).
        try {
          dc.send(JSON.stringify({
            type: 'response.create',
            response: { modalities: ['audio', 'text'] },
          }));
        } catch {}
      };
      dc.onmessage = (evt) => handleEvent(evt.data);

      // 4. SDP offer → OpenAI Realtime endpoint.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const modelParam = encodeURIComponent(model || 'gpt-realtime');
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${modelParam}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`OpenAI Realtime SDP exchange failed (${sdpRes.status}): ${errText.slice(0, 200)}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // 5. Live! Start duration timer + transition UI.
      setPhase('live');
      startedAtRef.current = Date.now();
      durationTimerRef.current = setInterval(() => {
        setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
      toast.success('Connected. Speak to Ava.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to connect');
      setPhase('failed');
      cleanup();
      toast.error(err?.message || 'Failed to connect');
    }
  };

  const handleEvent = (raw: string) => {
    let evt: any;
    try { evt = JSON.parse(raw); } catch { return; }

    // https://platform.openai.com/docs/api-reference/realtime-server-events
    switch (evt.type) {
      case 'response.audio_transcript.delta':
        activeAiLineRef.current += evt.delta || '';
        break;
      case 'response.audio_transcript.done':
        appendFinalLine('ai', activeAiLineRef.current || evt.transcript || '');
        activeAiLineRef.current = '';
        break;
      case 'conversation.item.input_audio_transcription.delta':
        activeUserLineRef.current += evt.delta || '';
        break;
      case 'conversation.item.input_audio_transcription.completed':
        appendFinalLine('human', activeUserLineRef.current || evt.transcript || '');
        activeUserLineRef.current = '';
        break;
      case 'response.audio.delta':
        setAiSpeaking(true);
        break;
      case 'response.audio.done':
      case 'response.done':
        setAiSpeaking(false);
        break;
      case 'error':
        toast.error(evt.error?.message || 'Realtime error');
        break;
    }
  };

  const toggleMute = () => {
    const stream = micStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach(t => (t.enabled = !next));
    setMuted(next);
  };

  // Two-letter initials for the header avatar. Falls back to the first two
  // characters of the account name if we can't split into words.
  const accountInitials = React.useMemo(() => {
    const words = (account.name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '??';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [account.name]);

  // Compact status descriptor for the header chip — replaces the old
  // in-body status line when the call is live/connecting.
  const statusChip = React.useMemo(() => {
    if (phase === 'live') return { dot: 'bg-emerald-500', label: 'Live', tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' };
    if (phase === 'connecting') return { dot: 'bg-orange-500 animate-pulse', label: 'Connecting', tone: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50' };
    if (phase === 'ended') return { dot: 'bg-slate-400', label: 'Ended', tone: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
    if (phase === 'failed') return { dot: 'bg-rose-500', label: 'Failed', tone: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' };
    if (existingSchedule) return { dot: 'bg-amber-500', label: 'Scheduled', tone: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' };
    return { dot: 'bg-slate-400', label: 'Ready', tone: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  }, [phase, existingSchedule]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-x-4 top-6 md:inset-x-auto md:top-10 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white dark:bg-[#1F1F20] border border-stone-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Hidden audio sink for AI voice */}
        <audio ref={audioElRef} autoPlay className="hidden" />

        {/* Header — account-centric, with a status chip that reflects the
            current phase (Ready → Connecting → Live → Ended / Failed) or the
            queued state (Scheduled) when a pending schedule exists. */}
        <div className="relative px-5 py-4 border-b border-stone-100 dark:border-white/[0.06] bg-gradient-to-br from-stone-50 to-white dark:from-white/[0.02] dark:to-transparent">
          <div className="flex items-center gap-3 pr-8">
            {/* Account avatar */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm text-white font-bold text-sm tracking-tight">
                {accountInitials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-[#1F1F20] flex items-center justify-center">
                <Phone className="w-3 h-3 text-orange-500" />
              </div>
            </div>
            {/* Title + account */}
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-orange-600 dark:text-orange-400/80">
                AI Voice Conversation
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-tight tracking-tight truncate">
                {account.name}
              </h3>
              {account.domain && (
                <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  {account.domain}
                </div>
              )}
            </div>
            {/* Status chip */}
            <div className={`shrink-0 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${statusChip.tone}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusChip.dot}`} />
              {statusChip.label}
              {phase === 'live' && (
                <span className="font-mono normal-case ml-1 opacity-80">
                  {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'idle' || phase === 'failed' ? (
            <div className="p-5 space-y-4">
              {/* Delivery mode selector — swaps between the browser-mic path
                  (existing WebRTC) and Vapi phone dial. The Phone chip is
                  hidden entirely when the backend doesn't have VAPI keys. */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                  How should the AI reach the contact?
                </label>
                <div className={`grid ${vapiReady ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  <button
                    type="button"
                    onClick={() => setCallMode('browser')}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      callMode === 'browser'
                        ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-orange-500/30'
                        : 'border-stone-200 dark:border-white/[0.06] hover:border-stone-300 dark:hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Radio className={`w-3.5 h-3.5 ${callMode === 'browser' ? 'text-orange-600 dark:text-orange-300' : 'text-zinc-400'}`} />
                      <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">Browser mic</span>
                    </div>
                    <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Speak to the AI through this tab
                    </div>
                  </button>
                  {vapiReady && (
                    <button
                      type="button"
                      onClick={() => setCallMode('phone')}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        callMode === 'phone'
                          ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-orange-500/30'
                          : 'border-stone-200 dark:border-white/[0.06] hover:border-stone-300 dark:hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Smartphone className={`w-3.5 h-3.5 ${callMode === 'phone' ? 'text-orange-600 dark:text-orange-300' : 'text-zinc-400'}`} />
                        <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">Phone call</span>
                        <span className="text-[9px] font-mono uppercase tracking-wide text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/30 px-1 py-0.5 rounded">Vapi</span>
                      </div>
                      <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        AI dials a real mobile via Vapi
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {callMode === 'phone' && (
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    Phone number (E.164)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+14155552671"
                    className="w-full h-9 px-3 text-[13px] font-mono rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  />
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Saved to this browser for future demos. Vapi will place an outbound call to this number.
                  </p>
                </div>
              )}

              {existingSchedule && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 text-[12px] text-amber-900 dark:text-amber-200 leading-snug">
                      <div className="font-semibold">Scheduled for {existingSchedule.wallClockLabel}</div>
                      <div className="opacity-80">
                        {existingSchedule.script.replace('_', ' ')} · {existingSchedule.contactName === 'there' ? 'no contact name' : existingSchedule.contactName}
                      </div>
                    </div>
                  </div>
                  {onCancelSchedule && (
                    <button
                      type="button"
                      onClick={() => onCancelSchedule(existingSchedule.id)}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 rounded-md px-2 py-1 cursor-pointer"
                      title="Cancel the scheduled AI call"
                    >
                      <Trash2 className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
              )}

              {/* Two-column layout on md+: left = script + contact, right =
                  scheduler. Stacks on mobile. Reduces the vertical scroll
                  the single-column layout produced. */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* LEFT — script + contact */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                      Call script
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {SCRIPT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setScript(opt.value)}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                            script === opt.value
                              ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-orange-500/30'
                              : 'border-stone-200 dark:border-white/[0.06] hover:border-stone-300 dark:hover:border-white/[0.12] hover:bg-stone-50 dark:hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">{opt.label}</div>
                            {script === opt.value && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{opt.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Contact
                    </label>
                    {/* Directory dropdown built from personas + stakeholder
                        map + CRM record. Empty state falls straight through
                        to the custom-name text input below. */}
                    {contactOptions.length > 0 && (
                      <select
                        value={selectedContactId ?? '__custom__'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            setSelectedContactId(null);
                            // Keep whatever custom name they had before
                            return;
                          }
                          const opt = contactOptions.find(c => c.id === v);
                          if (!opt) return;
                          setSelectedContactId(opt.id);
                          setContactName(opt.name);
                        }}
                        className="w-full h-9 px-2 text-[13px] rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 cursor-pointer"
                      >
                        <option value="__custom__">— Custom name / no directory —</option>
                        {(() => {
                          // Group by origin account so users can see which
                          // account each persona / stakeholder belongs to.
                          // The focused account is always ordered first
                          // (`isOwnAccount` items land in that group).
                          const order: string[] = [];
                          const byAccount = new Map<string, { name: string; isOwn: boolean; items: ContactOption[] }>();
                          for (const c of contactOptions) {
                            let g = byAccount.get(c.accountId);
                            if (!g) {
                              g = { name: c.accountName, isOwn: c.isOwnAccount, items: [] };
                              byAccount.set(c.accountId, g);
                              order.push(c.accountId);
                            }
                            g.items.push(c);
                          }
                          const roleLabel = (s: ContactOption['source']) =>
                            s === 'crm' ? 'CRM' : s === 'persona' ? 'Persona' : 'Stakeholder';
                          return order.map(id => {
                            const g = byAccount.get(id)!;
                            const label = g.isOwn
                              ? `${g.name} (this account)`
                              : `${g.name} (other account)`;
                            return (
                              <optgroup key={id} label={label}>
                                {g.items.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} · {roleLabel(c.source)}{c.phone ? ` · ${c.phone}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          });
                        })()}
                      </select>
                    )}
                    {/* Selected-contact detail card — shows the sourced-from
                        chip and any phone we have. Nothing rendered on the
                        custom path. */}
                    {selectedContact && (
                      <div className="flex items-start gap-2 p-2 rounded-lg border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20">
                        <div className="w-7 h-7 shrink-0 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 flex items-center justify-center text-[10px] font-bold">
                          {selectedContact.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {selectedContact.name}
                          </div>
                          <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                            {selectedContact.subtitle}
                            {!selectedContact.isOwnAccount && (
                              <> · from <span className="text-orange-700 dark:text-orange-300">{selectedContact.accountName}</span></>
                            )}
                          </div>
                          {selectedContact.phone && (
                            <a
                              href={`tel:${selectedContact.phone.replace(/\s+/g, '')}`}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-orange-700 dark:text-orange-300 hover:underline"
                              title="Call this number directly"
                            >
                              <Phone className="w-2.5 h-2.5" /> {selectedContact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Custom name input — visible when no directory entry
                        is selected, OR when there's no directory at all. */}
                    {!selectedContact && (
                      <div className="relative">
                        <UserPlus className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={contactName === 'there' ? '' : contactName}
                          onChange={(e) => setContactName(e.target.value || 'there')}
                          placeholder={contactOptions.length > 0 ? 'Or enter a custom name…' : 'e.g. Sarah Chen'}
                          className="w-full h-9 pl-7 pr-3 text-[13px] rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                        />
                      </div>
                    )}
                    {contactOptions.length === 0 && (
                      <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 leading-snug">
                        Run analyze-account on any pipeline account to populate this dropdown with personas & stakeholder map contacts.
                      </p>
                    )}
                  </div>
                </div>

                {/* RIGHT — scheduler. zonedTimeToUtcMs resolves the wall-clock
                    date/time in the chosen IANA zone to an absolute instant
                    the Dashboard poller matches against Date.now(). */}
                <div className="space-y-3 p-3 rounded-xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/15">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide uppercase text-orange-700 dark:text-orange-300">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schedule AI call
                    <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
                      optional
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full h-9 px-2 text-[13px] rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full h-9 px-2 text-[13px] rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Timezone</label>
                    <select
                      value={tz}
                      onChange={(e) => setTz(e.target.value)}
                      className="w-full h-9 px-2 text-[13px] rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 cursor-pointer"
                    >
                      {timezoneChoices.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-start gap-1.5 text-[10.5px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    <ShieldCheck className="w-3 h-3 mt-0.5 text-emerald-500 shrink-0" />
                    <span>Keep this tab open at the scheduled time — the AI runs in your browser.</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[12.5px] text-rose-900 dark:text-rose-200">
                  {errorMsg}
                </div>
              )}
            </div>
          ) : callMode === 'phone' ? (
            <div className="p-5 space-y-4">
              {/* Phone-mode live view. Vapi runs the conversation over PSTN;
                  we surface the call status and target number here and let the
                  transcript be reviewed on Vapi's dashboard (or later via the
                  /api/voice-call/:callId endpoint which the poller uses to
                  drive `phoneCall.status`). */}
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  {phoneCall && !['completed', 'failed', 'no_answer', 'voicemail'].includes(phoneCall.status) && (
                    <span className="absolute -inset-1 rounded-full border-2 border-orange-400/60 animate-ping" />
                  )}
                </div>
                <div className="text-center space-y-0.5">
                  <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {phoneCall?.status === 'queued' ? 'Queuing call…'
                      : phoneCall?.status === 'ringing' ? `Ringing ${phoneNumber}…`
                      : phoneCall?.status === 'in_progress' ? 'AI is on the line'
                      : phoneCall?.status === 'completed' ? 'Call ended'
                      : phoneCall?.status === 'failed' ? 'Call failed'
                      : phoneCall?.status === 'no_answer' ? 'No answer'
                      : phoneCall?.status === 'voicemail' ? 'Voicemail reached'
                      : 'Preparing dial…'}
                  </div>
                  <div className="text-[11.5px] font-mono text-zinc-500 dark:text-zinc-400">
                    {phoneNumber}
                  </div>
                  {phoneCall?.errorMessage && (
                    <div className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-300">
                      {phoneCall.errorMessage}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Ava is running the {script.replace('_', ' ')} script live. Watch the transcript in the Vapi dashboard, or wait for the summary here when the call ends.
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Connecting spinner — status/duration are already surfaced in
                  the header chip, so we only need the mid-body loader while
                  the WebRTC handshake is in flight. */}
              {phase === 'connecting' && (
                <div className="flex items-center justify-center gap-2 py-4 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  Establishing WebRTC connection to Realtime API…
                </div>
              )}

              {phase === 'live' && aiSpeaking && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 px-2 py-1 rounded-full w-fit mx-auto">
                  <Volume2 className="w-3 h-3" />
                  Ava speaking
                </div>
              )}

              {/* Transcript */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <MessageSquare className="w-3 h-3" /> Live transcript
                </div>
                <div
                  ref={transcriptScrollRef}
                  className="h-72 overflow-y-auto rounded-xl border border-stone-200 dark:border-white/[0.06] bg-stone-50 dark:bg-white/[0.02] p-3 space-y-2 text-[12.5px] leading-relaxed"
                >
                  {transcript.length === 0 ? (
                    <div className="text-zinc-400 italic text-center py-8">
                      Waiting for conversation to begin… <span className="opacity-70">(Ava speaks first)</span>
                    </div>
                  ) : (
                    transcript.map((line, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 ${line.speaker === 'ai' ? '' : 'flex-row-reverse'}`}
                      >
                        <div
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            line.speaker === 'ai'
                              ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                              : 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                          }`}
                        >
                          {line.speaker === 'ai' ? 'AI' : 'YOU'}
                        </div>
                        <div
                          className={`flex-1 px-3 py-2 rounded-xl ${
                            line.speaker === 'ai'
                              ? 'bg-white dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200'
                              : 'bg-sky-50 dark:bg-sky-950/20 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          {line.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer with phase-specific actions. Living outside the
            scrollable body means primary CTAs remain visible when the form or
            transcript grows. */}
        <div className="shrink-0 border-t border-stone-100 dark:border-white/[0.06] bg-white dark:bg-[#1F1F20] px-5 py-3">
          {(phase === 'idle' || phase === 'failed') && (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
              <Button
                onClick={scheduleCall}
                disabled={!onSchedule}
                variant="outline"
                className="h-11 gap-2 border-orange-300 dark:border-orange-800/60 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer"
                title={onSchedule ? 'Queue the AI to launch this call at the scheduled time' : 'Scheduling not available'}
              >
                <CalendarClock className="w-4 h-4" /> Schedule Call
              </Button>
              <Button
                onClick={() => callMode === 'phone' ? startPhoneCall() : startConversation()}
                className="h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold gap-2 shadow-[0_1px_3px_rgba(245,130,32,0.35)] border-0 cursor-pointer"
              >
                {callMode === 'phone' ? <Smartphone className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                {phase === 'failed'
                  ? (callMode === 'phone' ? 'Retry Dial' : 'Retry Now')
                  : (callMode === 'phone' ? 'Dial Now' : 'Start Now')}
              </Button>
            </div>
          )}
          {phase === 'connecting' && (
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full h-11 gap-2"
            >
              <X className="w-4 h-4" /> {callMode === 'phone' ? 'Cancel dial' : 'Cancel connection'}
            </Button>
          )}
          {phase === 'live' && callMode === 'browser' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={toggleMute}
                className="h-11 gap-2 cursor-pointer"
              >
                {muted ? (
                  <><MicOff className="w-4 h-4 text-rose-500" /> Unmute</>
                ) : (
                  <><Mic className="w-4 h-4 text-emerald-500" /> Mute</>
                )}
              </Button>
              <Button
                onClick={() => endConversation(true)}
                className="h-11 gap-2 bg-rose-500 hover:bg-rose-600 text-white cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" /> End Call
              </Button>
            </div>
          )}
          {phase === 'live' && callMode === 'phone' && (
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full h-11 gap-2 cursor-pointer"
            >
              <X className="w-4 h-4" /> Hide (call continues in background)
            </Button>
          )}
          {phase === 'ended' && (
            <Button
              onClick={() => {
                setPhase('idle');
                setTranscript([]);
                setDurationSec(0);
                setPhoneCall(null);
              }}
              variant="outline"
              className="w-full h-11 cursor-pointer"
            >
              Start another conversation
            </Button>
          )}
        </div>
      </motion.div>
    </>
  );
}
