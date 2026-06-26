import React from 'react';
import { TargetAccount, AccountSignal } from '../types';
import { motion } from 'motion/react';
import { ExternalLink, ChevronRight, Eye, Send, RotateCcw, Clock, AlertTriangle, HelpCircle, Calendar, Sparkles, Sliders, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
}

export function AccountCard({ account, onClick, targetRoles, onStatusChange, onDelete }: AccountCardProps) {
  const info = getAccountPriorityInfo(account);

  const scoreColor = account.isDisqualified
    ? 'text-red-700 bg-red-50 border-red-150'
    : info.fitScore >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 
                    info.fitScore >= 60 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-600 bg-slate-50 border-slate-100';

  const timingColor = account.isDisqualified
    ? 'text-red-700 bg-red-50 border-red-150'
    : info.timingScore >= 80 ? 'text-rose-700 bg-rose-50 border-rose-100' :
                     info.timingScore >= 60 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-purple-700 bg-purple-50 border-purple-100';

  const priorityColor = account.isDisqualified
    ? 'text-red-700 bg-red-50 border-red-200'
    : info.priorityIndex >= 80 ? 'text-indigo-700 bg-indigo-50 border-indigo-150' :
                        info.priorityIndex >= 60 ? 'text-slate-700 bg-slate-100 border-slate-200' : 'text-slate-500 bg-slate-50 border-slate-100';

  // Card Outer Style depending on Priority Flag
  let cardBorderClass = 'border-slate-200 shadow-sm hover:shadow-md';
  let badgeHeader = null;

  if (account.isDisqualified) {
    cardBorderClass = 'border-red-200 bg-red-50/10 hover:border-red-300 shadow-xs opacity-90 hover:opacity-100 transition-all border-dashed';
    badgeHeader = (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-red-700 bg-red-100 border border-red-200 uppercase">
        ⚠️ DO NOT PURSUE
      </span>
    );
  } else if (info.reResearchRecommended) {
    cardBorderClass = 'border-amber-300 bg-amber-50/10 shadow-xs hover:border-amber-400 border-dashed';
    badgeHeader = (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider text-amber-700 bg-amber-100 border border-amber-200 uppercase">
        🔍 RE-RESEARCH REQ
      </span>
    );
  } else if (info.priorityFlag === 'Immediate Action Required') {
    cardBorderClass = 'border-rose-250 bg-rose-50/10 shadow-sm hover:shadow-md ring-1 ring-rose-100/30';
    badgeHeader = (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-rose-700 bg-rose-100 animate-pulse border border-rose-200">
        🚨 IMMEDIATE ACTION REQUIRED
      </span>
    );
  } else if (info.priorityFlag === 'Nurture Queue') {
    cardBorderClass = 'border-teal-250 bg-teal-50/10 shadow-sm hover:shadow-md ring-1 ring-teal-100/30';
    badgeHeader = (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-teal-700 bg-teal-100 border border-teal-200">
        ⏳ NURTURE QUEUE
      </span>
    );
  } else {
    badgeHeader = (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200">
        🎯 STANDARD FOLLOW-UP
      </span>
    );
  }

  // Compute initials for target roles dynamicaly to display as buyer personas
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
    if (onStatusChange) {
      onStatusChange(status);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`p-5 rounded-2xl bg-white border transition-all cursor-pointer group flex flex-col justify-between h-full min-h-[355px] ${cardBorderClass}`}
      onClick={() => onClick(account)}
    >
      <div className="flex-1 flex flex-col">
        {/* Dynamic Priority Flag Banner */}
        <div className="mb-3 flex justify-between items-center">
          {badgeHeader}
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono font-medium">
            <Clock className="w-3 h-3 text-indigo-500" />
            <span>{info.outreachWindow}</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate text-base" title={account.name}>
              {account.name}
            </h3>
            <div className="flex items-center text-xs text-slate-500 gap-1 truncate" title={account.domain}>
              <ExternalLink className="w-3 h-3 shrink-0" />
              {account.domain}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${priorityColor}`} title="Priority Index">
              {account.isDisqualified ? 'EXCLUDED' : `${info.priorityIndex} PRIORITY`}
            </div>
          </div>
        </div>

        {/* Industry Calibration Segment */}
        {!account.isDisqualified && (
          <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-[10px] text-left">
            <div className="flex items-center gap-1 font-semibold text-indigo-950">
              <Sliders className="w-3.5 h-3.5 text-indigo-650" />
              <span>Model: <strong className="font-bold text-slate-800">{info.appliedSectorModel}</strong></span>
            </div>
            <div className="flex items-center gap-1 font-mono font-extrabold">
              {info.weightedSectorMultiplier > 1.0 ? (
                <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                  {info.weightedSectorMultiplier.toFixed(2)}x Boost
                </span>
              ) : info.weightedSectorMultiplier < 1.0 ? (
                <span className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">
                  {info.weightedSectorMultiplier.toFixed(2)}x Disc
                </span>
              ) : (
                <span className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">
                  1.00x Base
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-105 shadow-2xs">
          <div className="text-center">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">ICP FIT SCORE</div>
            <div className={`text-xs font-bold font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded border ${scoreColor}`}>{info.fitScore}%</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Timing Score</div>
            <div className={`text-xs font-bold font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded border ${timingColor}`}>{info.timingScore}%</div>
          </div>
        </div>

        {/* Signal Freshness Meter */}
        {!account.isDisqualified && (
          <div className="mb-3.5 bg-indigo-50/25 p-2.5 rounded-xl border border-indigo-100/50 space-y-1.5 text-left transition-all hover:bg-indigo-50/40">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-extrabold uppercase text-slate-450 tracking-wider flex items-center gap-1">
                <Clock className={`w-3.5 h-3.5 ${
                  info.freshnessLabel === 'FRESH' ? 'text-emerald-500' :
                  info.freshnessLabel === 'AGING' ? 'text-amber-500 animate-pulse' : 'text-slate-400'
                }`} />
                Signal Freshness
              </span>
              <span className={`font-black tracking-wider text-[9px] px-1.5 py-0.5 rounded ${
                info.freshnessLabel === 'FRESH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                info.freshnessLabel === 'AGING' ? 'bg-amber-50/50 text-amber-700 border border-amber-100' :
                'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {info.freshnessLabel} : {info.freshnessScore}%
              </span>
            </div>
            
            {/* ProgressBar */}
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  info.freshnessLabel === 'FRESH' ? 'bg-emerald-500' :
                  info.freshnessLabel === 'AGING' ? 'bg-amber-500' : 'bg-slate-400'
                }`}
                style={{ width: `${info.freshnessScore}%` }}
              />
            </div>

            {info.reResearchRecommended ? (
              <div className="flex items-start gap-1 pb-0.5 bg-amber-50/60 border border-amber-205 px-2 py-1.5 rounded-lg text-left">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[9.5px] leading-snug font-extrabold text-amber-800">
                  ⚠️ Action Paused: Re-research recommended before executing outbound sequence.
                </span>
              </div>
            ) : info.decayApplied ? (
              <p className="text-[9px] text-amber-600 font-bold tracking-tight italic">
                💡 Progressive signal weight decay applied ({100 - info.freshnessScore}% penalty).
              </p>
            ) : (
              <p className="text-[9px] text-emerald-600 font-bold tracking-tight italic">
                ✓ Perfect corroboration: All monitoring signals fully active.
              </p>
            )}
          </div>
        )}

        {/* Stage Indicator */}
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400">Signal Velocity:</span>
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
            account.isDisqualified ? 'bg-red-100 text-red-800' :
            info.reResearchRecommended ? 'bg-amber-100 text-amber-800 border border-amber-200' :
            info.timingStage === 'Urgent Decision' ? 'bg-rose-105 text-rose-800' :
            info.timingStage === 'Active Evaluation' ? 'bg-amber-100 text-amber-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {account.isDisqualified ? 'DISQUALIFIED' : info.timingStage}
          </span>
        </div>

        {/* Content */}
        <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
          {account.description || account.fitReason}
        </p>

        {/* Live Disqualification Reasons */}
        {account.isDisqualified && account.disqualificationReasons && account.disqualificationReasons.length > 0 && (
          <div className="bg-red-50/80 border border-red-150 p-3 rounded-xl mb-4 space-y-1.5 text-left text-[11px] leading-relaxed">
            <div className="font-extrabold text-[9px] text-red-800 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              Exclusion Signal Tripped:
            </div>
            <ul className="list-disc pl-3.5 space-y-1 font-medium text-red-750">
              {account.disqualificationReasons.map((reason, idx) => (
                <li key={idx} className="marker:text-red-500">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Signals */}
        <div className="flex flex-col gap-1.5 mb-4 mt-auto">
          {(account.signals || []).slice(0, 2).map((signal, idx) => (
            <Badge 
              key={idx} 
              variant="secondary" 
              className="text-[9px] uppercase tracking-wider font-semibold px-2.5 py-1.5 h-auto! min-h-5 w-full justify-start items-start whitespace-normal text-left leading-normal bg-slate-100 text-slate-655 border-none rounded-lg!"
            >
              {signal}
            </Badge>
          ))}
          {(account.signals || []).length > 2 && (
            <span className="text-[10px] text-slate-400 font-medium pl-1">
              +{(account.signals || []).length - 2} more
            </span>
          )}
        </div>
      </div>

      {/* Footer / Meta Actions */}
      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
        {/* Personas & View Details */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {rolesToRender.map((role, i) => (
              <div 
                key={i} 
                className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden cursor-help" 
                title={role.fullName}
              >
                 <div className="w-full h-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[8px] font-bold">
                   {role.abbrev}
                 </div>
               </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => onDelete(account.id, e)}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50/60 w-8 h-8 p-0 rounded-lg cursor-pointer"
                title="Remove this account suggestion"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 h-8 text-xs gap-1">
              View Intel <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Pipeline Stage Transitions if onStatusChange is provided */}
        {onStatusChange && (
          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-50">
            {account.status === 'new' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => handleStatusUpdate(e, 'viewed')}
                className="text-[10px] h-7 px-2.5 gap-1 text-slate-600 hover:text-indigo-600 border-slate-205"
              >
                <Eye className="w-3 h-3" /> Review Target
              </Button>
            )}
            {account.status === 'viewed' && (
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => handleStatusUpdate(e, 'new')}
                  className="text-[10px] h-7 px-2 gap-1 text-slate-400 hover:text-slate-650"
                  title="Move back to New"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={(e) => handleStatusUpdate(e, 'contacted')}
                  className="text-[10px] h-7 px-2.5 gap-1 bg-indigo-600 hover:bg-indigo-700 font-semibold"
                >
                  <Send className="w-3 h-3" /> Outreach Sent
                </Button>
              </div>
            )}
            {account.status === 'contacted' && (
              <div className="flex gap-1 w-full justify-between items-center text-[10.5px] px-2 py-1 rounded border bg-slate-50 border-slate-205">
                <span className={`font-extrabold tracking-tight ${
                  ['Positive Reply', 'Meeting Booked', 'Deal Won'].includes(account.outreachOutcome || '')
                    ? 'text-emerald-700'
                    : account.outreachOutcome === 'No Response'
                    ? 'text-slate-500 font-medium'
                    : account.outreachOutcome === 'Deal Lost'
                    ? 'text-rose-700 font-extrabold'
                    : 'text-emerald-600'
                }`}>
                  {account.outreachOutcome === 'No Response' ? '📭 No Response' :
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
                  className="text-slate-400 hover:text-slate-600 transition-colors font-medium underline text-[9.5px] cursor-pointer"
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
