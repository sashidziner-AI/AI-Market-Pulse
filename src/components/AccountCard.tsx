import React from 'react';
import { TargetAccount, AccountSignal } from '../types';
import { motion } from 'motion/react';
import { ExternalLink, Eye, Send, Clock, AlertTriangle, Sliders, Trash2, UserCircle2, PhoneCall, CheckCircle2 } from 'lucide-react';

const dicebearUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,ffdfbf,c0aede,d1d4f9&backgroundType=gradientLinear`;
import { Button } from '@/components/ui/button';
import { getCalibratedAccountPriorityInfo, getOrInitializeSignals, SectorModel } from '../utils/calibration';

export { getOrInitializeSignals };
export type { AccountSignal };

export function getAccountPriorityInfo(account: TargetAccount) {
  return getCalibratedAccountPriorityInfo(account, account.forcedSectorModel);
}

interface AccountCardProps {
  key?: string | number;
  account: TargetAccount;
  onClick: (account: TargetAccount) => void;
  targetRoles?: string[];
  onStatusChange?: (status: 'new' | 'viewed' | 'contacted') => void;
  onDelete?: (id: string, event: React.MouseEvent) => void;
  onVoiceCall?: (account: TargetAccount) => void;
  // Vertical Trello-style layout for the narrow (~300-360px) kanban columns.
  // Default (undefined) keeps the horizontal split-rail layout used by the
  // Recommendations grid where columns are 500-700px wide.
  compact?: boolean;
  // Compare mode: when onToggleCompare is passed, a small checkbox appears in
  // the card header. compareSelected controls the visual selected state
  // (ring + tinted background). compareDisabled greys out unchecked cards
  // once the selection cap is hit.
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (account: TargetAccount) => void;
}

type PriorityTier = 'immediate' | 'nurture' | 'standard' | 'reresearch' | 'disqualified';

interface TierTheme {
  tier: PriorityTier;
  border: string;
  railBg: string;
  chipBg: string;
  chipText: string;
  scoreText: string;
  chipLabel: string;
  dotColor?: string;
}

function getTierTheme(account: TargetAccount, info: ReturnType<typeof getAccountPriorityInfo>): TierTheme {
  if (account.isDisqualified) {
    return {
      tier: 'disqualified',
      border: 'border-red-200/70 dark:border-red-900/50 border-dashed',
      railBg: 'bg-red-50/40 dark:bg-red-500/5',
      chipBg: 'bg-red-100/70 dark:bg-red-500/15 border-red-200 dark:border-red-500/25',
      chipText: 'text-red-700 dark:text-red-300',
      scoreText: 'text-red-500 dark:text-red-400',
      chipLabel: 'Do not pursue',
    };
  }
  if (info.reResearchRecommended) {
    return {
      tier: 'reresearch',
      border: 'border-amber-300/70 dark:border-amber-800/50 border-dashed',
      railBg: 'bg-amber-50/40 dark:bg-amber-500/5',
      chipBg: 'bg-amber-100/70 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/25',
      chipText: 'text-amber-700 dark:text-amber-300',
      scoreText: 'text-amber-600 dark:text-amber-300',
      chipLabel: 'Re-research req',
    };
  }
  if (info.priorityFlag === 'Immediate Action Required') {
    return {
      tier: 'immediate',
      border: 'border-rose-300/70 dark:border-rose-800/50 hover:border-rose-400 dark:hover:border-rose-700/60',
      railBg: 'bg-rose-50/40 dark:bg-rose-500/5',
      chipBg: 'bg-rose-100/70 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25',
      chipText: 'text-rose-700 dark:text-rose-300',
      scoreText: 'text-rose-600 dark:text-rose-300',
      chipLabel: 'Immediate',
      dotColor: 'bg-rose-500',
    };
  }
  if (info.priorityFlag === 'Warm Track') {
    return {
      tier: 'nurture',
      border: 'border-teal-300/70 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-700/60',
      railBg: 'bg-teal-50/40 dark:bg-teal-500/5',
      chipBg: 'bg-teal-100/70 dark:bg-teal-500/15 border-teal-200 dark:border-teal-500/25',
      chipText: 'text-teal-700 dark:text-teal-300',
      scoreText: 'text-teal-700 dark:text-teal-300',
      chipLabel: 'Warm Track',
    };
  }
  return {
    tier: 'standard',
    border: 'border-amber-400 dark:border-amber-700/60 hover:border-amber-500 dark:hover:border-amber-600/70',
    railBg: 'bg-amber-50/70 dark:bg-amber-500/10',
    chipBg: 'bg-amber-100 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30',
    chipText: 'text-amber-800 dark:text-amber-300',
    scoreText: 'text-amber-700 dark:text-amber-300',
    chipLabel: 'Standard',
  };
}

export function AccountCard({ account, onClick, targetRoles, onStatusChange, onDelete, onVoiceCall, compact, compareSelected, compareDisabled, onToggleCompare }: AccountCardProps) {
  const info = getAccountPriorityInfo(account);
  const theme = getTierTheme(account, info);

  if (compact) {
    return (
      <CompactAccountCard
        account={account}
        info={info}
        theme={theme}
        onClick={onClick}
        targetRoles={targetRoles}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onVoiceCall={onVoiceCall}
      />
    );
  }

  const rolesToRender = React.useMemo(() => {
    const defaultRoles = ['VP Sales', 'RevOps', 'CEO'];
    const roles = targetRoles && targetRoles.length > 0 ? targetRoles : defaultRoles;
    return roles.slice(0, 3).map(role => {
      const parts = role.split(/\s+/).filter(Boolean);
      const abbrev = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : role.slice(0, 2).toUpperCase();
      return { abbrev, fullName: role };
    });
  }, [targetRoles]);

  const handleStatusUpdate = (e: React.MouseEvent, status: 'new' | 'viewed' | 'contacted') => {
    e.stopPropagation();
    if (onStatusChange) onStatusChange(status);
  };

  const fitTone = account.isDisqualified
    ? 'text-red-600 dark:text-red-300'
    : info.fitScore >= 80 ? 'text-emerald-600 dark:text-emerald-300'
    : info.fitScore >= 60 ? 'text-amber-600 dark:text-amber-300'
    : 'text-slate-500 dark:text-zinc-400';
  const timingTone = account.isDisqualified
    ? 'text-red-600 dark:text-red-300'
    : info.timingScore >= 80 ? 'text-rose-600 dark:text-rose-300'
    : info.timingScore >= 60 ? 'text-amber-600 dark:text-amber-300'
    : 'text-purple-600 dark:text-purple-300';
  const freshnessTone = info.freshnessLabel === 'FRESH'
    ? 'bg-emerald-500'
    : info.freshnessLabel === 'AGING' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative rounded-2xl bg-white dark:bg-[#2A2A2B] border shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-row min-h-[240px] overflow-hidden ${theme.border} ${
        compareSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-stone-50 dark:ring-offset-[#1F1F20]' : ''
      } ${compareDisabled && !compareSelected ? 'opacity-55' : ''}`}
      onClick={() => onClick(account)}
    >
      {/* Compare checkbox — top-LEFT corner, sits over the LEFT RAIL. Only rendered when parent wires onToggleCompare. */}
      {onToggleCompare && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!compareDisabled || compareSelected) onToggleCompare(account);
          }}
          disabled={compareDisabled && !compareSelected}
          title={compareSelected ? 'Remove from comparison' : compareDisabled ? 'Comparison is full (3 max)' : 'Add to comparison'}
          className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
            compareSelected
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
              : compareDisabled
              ? 'bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 cursor-not-allowed'
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
          }`}
        >
          {compareSelected && (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd"/></svg>
          )}
        </button>
      )}

      {/* LEFT RAIL: Priority tier + big score + pipeline action + outreach window */}
      <div className={`w-40 shrink-0 flex flex-col items-center px-3 py-4 border-r border-slate-100 dark:border-white/[0.05] ${theme.railBg}`}>
        {/* Priority chip */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-normal border uppercase ${theme.chipBg} ${theme.chipText}`}>
          {theme.dotColor && (
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${theme.dotColor}`}></span>
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${theme.dotColor}`}></span>
            </span>
          )}
          {theme.chipLabel}
        </span>

        {/* Outreach window — below chip */}
        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-1.5 mb-1">
          <Clock className="w-2.5 h-2.5" />
          <span>{info.outreachWindow}</span>
        </div>

        {/* Big priority number */}
        <div className="flex flex-col items-center gap-0.5 my-3 flex-1 justify-center">
          <div className={`text-5xl font-bold font-mono leading-none ${theme.scoreText}`} style={{ letterSpacing: '-0.03em' }}>
            {account.isDisqualified ? '—' : info.priorityIndex}
          </div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Priority</div>
        </div>

        {/* Target role avatars — above action button */}
        <div className="flex justify-center -space-x-2 mb-2">
          {rolesToRender.map((role, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-[#2A2A2B] overflow-hidden bg-slate-100 dark:bg-slate-700 cursor-help shrink-0"
              title={role.fullName}
            >
              <img
                src={dicebearUrl(role.fullName)}
                alt={role.fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.style.display = 'none';
                  (t.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                }}
              />
              <UserCircle2 className="w-8 h-8 text-slate-400 hidden" strokeWidth={1.2} />
            </div>
          ))}
        </div>

        {/* Pipeline transitions */}
        {onStatusChange && (
          <div className="w-full mb-2">
            {account.status === 'new' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleStatusUpdate(e, 'viewed')}
                className="w-full text-[11px] h-7 px-2 gap-1 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300 border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] cursor-pointer"
              >
                <Eye className="w-3 h-3" /> Review Target
              </Button>
            )}
            {account.status === 'viewed' && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => handleStatusUpdate(e, 'contacted')}
                  className="w-full text-[11px] h-7 px-2 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-[0_1px_2px_rgba(245,130,32,0.35)] cursor-pointer"
                >
                  <Send className="w-3 h-3" /> Outreach
                </Button>
                <button
                  onClick={(e) => handleStatusUpdate(e, 'new')}
                  className="w-full text-[10px] h-5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors font-medium underline cursor-pointer"
                  title="Move back to New"
                >
                  Back to New
                </button>
              </div>
            )}
            {account.status === 'contacted' && (
              <div className="w-full text-[10px] px-1.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-150 dark:border-white/[0.06] flex flex-col items-center gap-0.5">
                <span className={`font-semibold tracking-tight truncate ${
                  ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome || '')
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : account.outreachOutcome === 'No Response'
                    ? 'text-slate-500 dark:text-zinc-400 font-medium'
                    : account.outreachOutcome === 'Deal Lost'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}>
                  {account.outreachOutcome === 'No Response' ? '📭 No Reply' :
                   account.outreachOutcome === 'Positive Reply' ? '💬 Pos Reply' :
                   account.outreachOutcome === 'Meeting Booked' ? '📅 Mtg Booked' :
                   account.outreachOutcome === 'Deal Lost' ? '❌ Deal Lost' :
                   account.outreachOutcome === 'Deal Won' ? '🏆 Deal Won' :
                   '✓ Contacted'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusUpdate(e, 'viewed');
                  }}
                  className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors font-medium underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT BODY */}
      <div className="relative flex-1 min-w-0 flex flex-col p-4">
        {/* Action row — top-right corner */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {onVoiceCall && !account.isDisqualified && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onVoiceCall(account);
              }}
              className={`w-7 h-7 p-0 rounded-md cursor-pointer transition ${
                account.voiceCall?.status === 'completed'
                  ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  : account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status)
                  ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                  : 'text-slate-400 hover:text-orange-600 dark:text-zinc-500 dark:hover:text-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-500/10'
              }`}
              title={
                account.voiceCall?.status === 'completed' ? 'Call completed — review transcript' :
                account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status) ? 'Call in progress' :
                'Place AI voice call'
              }
            >
              {account.voiceCall?.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <PhoneCall className={`w-3.5 h-3.5 ${
                  account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status) ? 'animate-pulse' : ''
                }`} />
              )}
            </Button>
          )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onDelete(account.id, e)}
            className="text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-500/10 w-7 h-7 p-0 rounded-md cursor-pointer"
            title="Remove this account suggestion"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
        </div>
        {/* Identity */}
        <div className="mb-3 pr-8">
          {account.crmSyncedAt && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold uppercase tracking-normal bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 mb-1"
              title={`Synced to CRM${account.crmRecordId != null ? ` · record #${account.crmRecordId}` : ''} on ${new Date(account.crmSyncedAt).toLocaleString()}`}
            >
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              In CRM
            </div>
          )}
          <h3
            className="text-[17px] font-semibold leading-tight text-slate-900 dark:text-zinc-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate"
            style={{ letterSpacing: '-0.015em' }}
            title={account.name}
          >
            {account.name}
          </h3>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] font-mono text-slate-500 dark:text-zinc-500 truncate" title={account.domain}>
            <ExternalLink className="w-3 h-3 shrink-0" />
            {account.domain}
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Fit Score */}
          <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
            account.isDisqualified ? 'border-l-red-400'
            : info.fitScore >= 80 ? 'border-l-emerald-400'
            : info.fitScore >= 60 ? 'border-l-amber-400'
            : 'border-l-slate-300 dark:border-l-zinc-600'
          }`}>
            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Fit</div>
            <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${fitTone}`}>{info.fitScore}%</div>
          </div>
          {/* Timing Score */}
          <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
            account.isDisqualified ? 'border-l-red-400'
            : info.timingScore >= 80 ? 'border-l-rose-400'
            : info.timingScore >= 60 ? 'border-l-amber-400'
            : 'border-l-purple-400'
          }`}>
            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Timing</div>
            <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${timingTone}`}>{info.timingScore}%</div>
          </div>
          {/* Sector multiplier */}
          <div className={`rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
            info.weightedSectorMultiplier > 1.0 ? 'border-l-emerald-400'
            : info.weightedSectorMultiplier < 1.0 ? 'border-l-amber-400'
            : 'border-l-slate-300 dark:border-l-zinc-600'
          }`} title={`Sector model: ${info.appliedSectorModel}`}>
            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Sliders className="w-2.5 h-2.5" />Sector
            </div>
            <div className={`text-[15px] font-semibold font-mono leading-tight mt-0.5 ${
              info.weightedSectorMultiplier > 1.0 ? 'text-emerald-600 dark:text-emerald-300'
              : info.weightedSectorMultiplier < 1.0 ? 'text-amber-600 dark:text-amber-300'
              : 'text-slate-600 dark:text-zinc-300'
            }`}>{info.weightedSectorMultiplier.toFixed(2)}x</div>
          </div>
        </div>

        {/* Freshness bar */}
        {!account.isDisqualified && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
              <div className="flex items-center gap-1.5">
                <span>{info.timingStage}</span>
                <span className="text-slate-300 dark:text-zinc-600">·</span>
                <span>Signal {info.freshnessLabel.toLowerCase()}</span>
              </div>
              <span className="text-slate-600 dark:text-zinc-300 font-semibold">{info.freshnessScore}%</span>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${freshnessTone}`}
                style={{ width: `${info.freshnessScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-[13px] text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed mb-3">
          {account.description || account.fitReason}
        </p>

        {/* Disqualification reasons */}
        {account.isDisqualified && account.disqualificationReasons && account.disqualificationReasons.length > 0 && (
          <div className="bg-red-50/70 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-2.5 rounded-lg mb-3 space-y-1 text-left">
            <div className="text-[10px] font-mono font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Exclusion tripped
            </div>
            <ul className="text-[12px] text-red-700 dark:text-red-200 list-disc pl-4 space-y-0.5">
              {account.disqualificationReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Signal tags */}
        <div className="flex flex-wrap gap-1.5 mb-3 mt-auto">
          {(account.signals || []).slice(0, 3).map((signal, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-150 dark:border-white/[0.05] leading-snug"
            >
              {signal}
            </span>
          ))}
          {(account.signals || []).length > 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/[0.02] text-slate-400 dark:text-zinc-500 font-mono">
              +{(account.signals || []).length - 3}
            </span>
          )}
        </div>

      </div>
    </motion.div>
  );
}

/* Vertical Trello-style card for the GTM Pipeline kanban.
   Same data + colors as the wide card, restacked so each column at ~320px
   still shows priority chip, score, name, stats, freshness, description,
   signals, and the primary action in a comfortable reading order. */
interface CompactCardProps {
  account: TargetAccount;
  info: ReturnType<typeof getAccountPriorityInfo>;
  theme: TierTheme;
  onClick: (account: TargetAccount) => void;
  targetRoles?: string[];
  onStatusChange?: (status: 'new' | 'viewed' | 'contacted') => void;
  onDelete?: (id: string, event: React.MouseEvent) => void;
  onVoiceCall?: (account: TargetAccount) => void;
}

function CompactAccountCard({ account, info, theme, onClick, targetRoles, onStatusChange, onDelete, onVoiceCall }: CompactCardProps) {
  const rolesToRender = React.useMemo(() => {
    const defaultRoles = ['VP Sales', 'RevOps', 'CEO'];
    const roles = targetRoles && targetRoles.length > 0 ? targetRoles : defaultRoles;
    return roles.slice(0, 3).map(role => {
      const parts = role.split(/\s+/).filter(Boolean);
      const abbrev = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : role.slice(0, 2).toUpperCase();
      return { abbrev, fullName: role };
    });
  }, [targetRoles]);

  const handleStatusUpdate = (e: React.MouseEvent, status: 'new' | 'viewed' | 'contacted') => {
    e.stopPropagation();
    if (onStatusChange) onStatusChange(status);
  };

  const fitTone = account.isDisqualified
    ? 'text-red-600 dark:text-red-300'
    : info.fitScore >= 80 ? 'text-emerald-600 dark:text-emerald-300'
    : info.fitScore >= 60 ? 'text-amber-600 dark:text-amber-300'
    : 'text-slate-500 dark:text-zinc-400';
  const timingTone = account.isDisqualified
    ? 'text-red-600 dark:text-red-300'
    : info.timingScore >= 80 ? 'text-rose-600 dark:text-rose-300'
    : info.timingScore >= 60 ? 'text-amber-600 dark:text-amber-300'
    : 'text-purple-600 dark:text-purple-300';
  const freshnessTone = info.freshnessLabel === 'FRESH'
    ? 'bg-emerald-500'
    : info.freshnessLabel === 'AGING' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => onClick(account)}
      className={`relative rounded-xl bg-white dark:bg-[#2A2A2B] border shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col overflow-hidden ${theme.border}`}
    >
      {/* Row 1: priority chip + score + action icons */}
      <div className={`flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100 dark:border-white/[0.05] ${theme.railBg}`}>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-normal border uppercase ${theme.chipBg} ${theme.chipText}`}>
          {theme.dotColor && (
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${theme.dotColor}`}></span>
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${theme.dotColor}`}></span>
            </span>
          )}
          {theme.chipLabel}
        </span>

        <div className="flex items-center gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold font-mono leading-none ${theme.scoreText}`} style={{ letterSpacing: '-0.02em' }}>
              {account.isDisqualified ? '—' : info.priorityIndex}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">pri</span>
          </div>
          {onVoiceCall && !account.isDisqualified && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onVoiceCall(account); }}
              className={`w-6 h-6 p-0 rounded-md cursor-pointer transition ${
                account.voiceCall?.status === 'completed'
                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  : account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status)
                  ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                  : 'text-slate-400 hover:text-orange-600 dark:text-zinc-500 dark:hover:text-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-500/10'
              }`}
              title={
                account.voiceCall?.status === 'completed' ? 'Call completed — review transcript' :
                account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status) ? 'Call in progress' :
                'Place AI voice call'
              }
            >
              {account.voiceCall?.status === 'completed'
                ? <CheckCircle2 className="w-3 h-3" />
                : <PhoneCall className={`w-3 h-3 ${account.voiceCall && ['queued','ringing','in_progress'].includes(account.voiceCall.status) ? 'animate-pulse' : ''}`} />}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onDelete(account.id, e)}
              className="text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-500/10 w-6 h-6 p-0 rounded-md cursor-pointer"
              title="Remove this account suggestion"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: name + domain + outreach window */}
      <div className="px-3 pt-2.5 pb-2">
        {account.crmSyncedAt && (
          <div
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-normal bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 mb-1"
            title={`Synced to CRM${account.crmRecordId != null ? ` · record #${account.crmRecordId}` : ''} on ${new Date(account.crmSyncedAt).toLocaleString()}`}
          >
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            In CRM
          </div>
        )}
        <h3
          className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-zinc-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate"
          style={{ letterSpacing: '-0.015em' }}
          title={account.name}
        >
          {account.name}
        </h3>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-zinc-500 truncate min-w-0" title={account.domain}>
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{account.domain}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 font-mono shrink-0">
            <Clock className="w-2.5 h-2.5" />
            <span>{info.outreachWindow}</span>
          </div>
        </div>
      </div>

      {/* Row 3: stat strip */}
      <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
        <div className={`rounded-md px-2 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
          account.isDisqualified ? 'border-l-red-400'
          : info.fitScore >= 80 ? 'border-l-emerald-400'
          : info.fitScore >= 60 ? 'border-l-amber-400'
          : 'border-l-slate-300 dark:border-l-zinc-600'
        }`}>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Fit</div>
          <div className={`text-[13px] font-semibold font-mono leading-tight ${fitTone}`}>{info.fitScore}%</div>
        </div>
        <div className={`rounded-md px-2 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
          account.isDisqualified ? 'border-l-red-400'
          : info.timingScore >= 80 ? 'border-l-rose-400'
          : info.timingScore >= 60 ? 'border-l-amber-400'
          : 'border-l-purple-400'
        }`}>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">Timing</div>
          <div className={`text-[13px] font-semibold font-mono leading-tight ${timingTone}`}>{info.timingScore}%</div>
        </div>
        <div className={`rounded-md px-2 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] border-l-[3px] ${
          info.weightedSectorMultiplier > 1.0 ? 'border-l-emerald-400'
          : info.weightedSectorMultiplier < 1.0 ? 'border-l-amber-400'
          : 'border-l-slate-300 dark:border-l-zinc-600'
        }`} title={`Sector model: ${info.appliedSectorModel}`}>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
            <Sliders className="w-2.5 h-2.5" />Sector
          </div>
          <div className={`text-[13px] font-semibold font-mono leading-tight ${
            info.weightedSectorMultiplier > 1.0 ? 'text-emerald-600 dark:text-emerald-300'
            : info.weightedSectorMultiplier < 1.0 ? 'text-amber-600 dark:text-amber-300'
            : 'text-slate-600 dark:text-zinc-300'
          }`}>{info.weightedSectorMultiplier.toFixed(2)}x</div>
        </div>
      </div>

      {/* Row 4: freshness bar (skipped when disqualified) */}
      {!account.isDisqualified && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className="truncate">{info.timingStage}</span>
              <span className="text-slate-300 dark:text-zinc-600">·</span>
              <span className="truncate">{info.freshnessLabel.toLowerCase()}</span>
            </div>
            <span className="text-slate-600 dark:text-zinc-300 font-semibold shrink-0">{info.freshnessScore}%</span>
          </div>
          <div className="h-1 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${freshnessTone}`}
              style={{ width: `${info.freshnessScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Row 5: description */}
      <div className="px-3 pb-2">
        <p className="text-[12px] text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
          {account.description || account.fitReason}
        </p>
      </div>

      {/* Row 5b: disqualification reasons if applicable */}
      {account.isDisqualified && account.disqualificationReasons && account.disqualificationReasons.length > 0 && (
        <div className="mx-3 mb-2 bg-red-50/70 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-2 rounded-md space-y-1 text-left">
          <div className="text-[10px] font-mono font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Exclusion tripped
          </div>
          <ul className="text-[11px] text-red-700 dark:text-red-200 list-disc pl-4 space-y-0.5">
            {account.disqualificationReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Row 6: signal tags */}
      {(account.signals || []).length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {(account.signals || []).slice(0, 3).map((signal, idx) => (
            <span
              key={idx}
              className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-150 dark:border-white/[0.05] leading-snug truncate max-w-full"
            >
              {signal}
            </span>
          ))}
          {(account.signals || []).length > 3 && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-white/[0.02] text-slate-400 dark:text-zinc-500 font-mono">
              +{(account.signals || []).length - 3}
            </span>
          )}
        </div>
      )}

      {/* Row 7: footer — avatars + primary action */}
      <div className="mt-auto px-3 py-2 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-2">
        <div className="flex -space-x-2 shrink-0">
          {rolesToRender.map((role, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full border-2 border-white dark:border-[#2A2A2B] overflow-hidden bg-slate-100 dark:bg-slate-700 cursor-help shrink-0"
              title={role.fullName}
            >
              <img
                src={dicebearUrl(role.fullName)}
                alt={role.fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.style.display = 'none';
                  (t.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                }}
              />
              <UserCircle2 className="w-6 h-6 text-slate-400 hidden" strokeWidth={1.2} />
            </div>
          ))}
        </div>

        {onStatusChange && (
          <div className="flex-1 min-w-0">
            {account.status === 'new' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleStatusUpdate(e, 'viewed')}
                className="w-full text-[11px] h-7 px-2 gap-1 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300 border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] cursor-pointer"
              >
                <Eye className="w-3 h-3" /> Review
              </Button>
            )}
            {account.status === 'viewed' && (
              <div className="flex items-center gap-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => handleStatusUpdate(e, 'contacted')}
                  className="flex-1 text-[11px] h-7 px-2 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-[0_1px_2px_rgba(245,130,32,0.35)] cursor-pointer"
                >
                  <Send className="w-3 h-3" /> Outreach
                </Button>
                <button
                  onClick={(e) => handleStatusUpdate(e, 'new')}
                  className="text-[9.5px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors font-medium underline cursor-pointer shrink-0"
                  title="Move back to New"
                >
                  Back
                </button>
              </div>
            )}
            {account.status === 'contacted' && (
              <div className="w-full text-[10px] px-1.5 py-0.5 rounded-md bg-white dark:bg-white/[0.03] border border-slate-150 dark:border-white/[0.06] flex items-center justify-between gap-1">
                <span className={`font-semibold tracking-tight truncate ${
                  ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome || '')
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : account.outreachOutcome === 'No Response'
                    ? 'text-slate-500 dark:text-zinc-400 font-medium'
                    : account.outreachOutcome === 'Deal Lost'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}>
                  {account.outreachOutcome === 'No Response' ? '📭 No Reply' :
                   account.outreachOutcome === 'Positive Reply' ? '💬 Pos Reply' :
                   account.outreachOutcome === 'Meeting Booked' ? '📅 Mtg Booked' :
                   account.outreachOutcome === 'Deal Lost' ? '❌ Deal Lost' :
                   account.outreachOutcome === 'Deal Won' ? '🏆 Deal Won' :
                   '✓ Contacted'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate(e, 'viewed'); }}
                  className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors font-medium underline cursor-pointer shrink-0"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
