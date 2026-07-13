import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Phone, PhoneOff, X, Loader2, Mic, MicOff, ShieldCheck,
  MessageSquare, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type {
  TargetAccount, VoiceCallScript, VoiceCallState, VoiceCallTranscriptLine,
  BusinessAnalysis
} from '../types';

interface VoiceCallModalProps {
  account: TargetAccount;
  sellerContext: BusinessAnalysis;
  onClose: () => void;
  onCallCompleted: (accountId: string, call: VoiceCallState) => void;
}

type Phase = 'idle' | 'connecting' | 'live' | 'ended' | 'failed';

const SCRIPT_OPTIONS: { value: VoiceCallScript; label: string; description: string }[] = [
  { value: 'discovery', label: 'Discovery call', description: '3 qualifying questions + book a follow-up' },
  { value: 'follow_up', label: 'Follow-up', description: 'Confirm interest from prior outreach' },
  { value: 'demo_booking', label: 'Demo booking', description: 'Offer time slots for a live product tour' },
];

export function VoiceCallModal({ account, sellerContext, onClose, onCallCompleted }: VoiceCallModalProps) {
  const [contactName, setContactName] = useState('there');
  const [script, setScript] = useState<VoiceCallScript>('discovery');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState<VoiceCallTranscriptLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);

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
        className="fixed inset-x-4 top-8 md:inset-x-auto md:top-16 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white dark:bg-[#1F1F20] border border-stone-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col"
      >
        {/* Hidden audio sink for AI voice */}
        <audio ref={audioElRef} autoPlay className="hidden" />

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-100 dark:border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base tracking-tight">
                AI Voice Conversation
              </h3>
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-snug">
              Target: <span className="font-medium text-zinc-700 dark:text-zinc-300">{account.name}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'idle' || phase === 'failed' ? (
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[12px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <div className="font-semibold mb-0.5">Browser conversation — no phone call is placed.</div>
                  You'll speak to the AI SDR through your mic and speakers. The AI has full account context (fit reason, signals, industry) and will roleplay a discovery call.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                  Contact name (optional)
                </label>
                <input
                  type="text"
                  value={contactName === 'there' ? '' : contactName}
                  onChange={(e) => setContactName(e.target.value || 'there')}
                  placeholder="e.g. Sarah Chen (leave blank for generic 'there')"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                  Call script
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {SCRIPT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setScript(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        script === opt.value
                          ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 ring-1 ring-orange-500/20'
                          : 'border-stone-200 dark:border-white/[0.06] hover:bg-stone-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{opt.label}</div>
                      <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[12.5px] text-rose-900 dark:text-rose-200">
                  {errorMsg}
                </div>
              )}

              <Button
                onClick={startConversation}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold gap-2 shadow-[0_1px_3px_rgba(245,130,32,0.35)] border-0"
              >
                <Phone className="w-4 h-4" /> {phase === 'failed' ? 'Retry' : 'Start conversation'}
              </Button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Live status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {phase === 'connecting' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  ) : phase === 'live' ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                  ) : (
                    <PhoneOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                    {phase === 'connecting' ? 'Connecting…' : phase === 'live' ? 'Live conversation' : 'Ended'}
                  </span>
                  {aiSpeaking && phase === 'live' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded">
                      <Volume2 className="w-2.5 h-2.5" /> Ava speaking
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, '0')}
                </div>
              </div>

              {/* Transcript */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <MessageSquare className="w-3 h-3" /> Live transcript
                </div>
                <div
                  ref={transcriptScrollRef}
                  className="max-h-64 overflow-y-auto rounded-xl border border-stone-200 dark:border-white/[0.06] bg-stone-50 dark:bg-white/[0.02] p-3 space-y-2 text-[12.5px] leading-relaxed"
                >
                  {transcript.length === 0 ? (
                    <div className="text-zinc-400 italic text-center py-4">
                      Waiting for conversation to begin… (Ava will speak first)
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

              {/* Controls */}
              {phase === 'live' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={toggleMute}
                    className="flex-1 gap-2"
                  >
                    {muted ? (
                      <><MicOff className="w-4 h-4 text-rose-500" /> Unmute</>
                    ) : (
                      <><Mic className="w-4 h-4 text-emerald-500" /> Mute</>
                    )}
                  </Button>
                  <Button
                    onClick={() => endConversation(true)}
                    className="flex-1 gap-2 bg-rose-500 hover:bg-rose-600 text-white"
                  >
                    <PhoneOff className="w-4 h-4" /> End
                  </Button>
                </div>
              )}

              {phase === 'ended' && (
                <Button
                  onClick={() => { setPhase('idle'); setTranscript([]); setDurationSec(0); }}
                  variant="outline"
                  className="w-full"
                >
                  Start another conversation
                </Button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
