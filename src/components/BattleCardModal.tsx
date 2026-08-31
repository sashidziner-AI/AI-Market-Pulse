import React from 'react';
import { X, Swords, Download, RefreshCw, AlertTriangle, TrendingUp, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BattleCard as BattleCardType, BusinessAnalysis } from '../types';
import { apiUrl } from '../utils/apiBase';
import { BattleCardPrintable } from './BattleCard';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  competitorName: string;
  competitorCategory?: string;
  accountDomain?: string;
  sellerContext?: Pick<BusinessAnalysis, 'businessName' | 'valueProp'> | null;
}

// Client-side cache so re-opening the same competitor within a session is
// instant. Server has its own cache too, but this saves the network round-trip.
const clientCache = new Map<string, BattleCardType>();

export function BattleCardModal({ open, onClose, competitorName, competitorCategory, accountDomain, sellerContext }: Props) {
  const [card, setCard] = React.useState<BattleCardType | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const printRef = React.useRef<HTMLDivElement | null>(null);

  const cacheKey = `${competitorName.toLowerCase()}::${(accountDomain ?? '').toLowerCase()}`;

  const fetchCard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl('/api/battle-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorName, competitorCategory, accountDomain, sellerContext }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as BattleCardType;
      setCard(data);
      clientCache.set(cacheKey, data);
      if (data.isFallback) toast.info('Using simulated battle card data (AI unavailable).');
    } catch (e: any) {
      setError(e?.message ?? 'unknown error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorName, competitorCategory, accountDomain, sellerContext]);

  // Load on open — use client cache first.
  React.useEffect(() => {
    if (!open) return;
    const cached = clientCache.get(cacheKey);
    if (cached) { setCard(cached); return; }
    fetchCard();
  }, [open, cacheKey, fetchCard]);

  // Reset when the modal closes so re-opening a different competitor
  // doesn't briefly flash the previous one.
  React.useEffect(() => {
    if (!open) {
      setCard(null); setError(null);
    }
  }, [open]);

  const handleDownload = async () => {
    const node = printRef.current;
    if (!node || !card) { toast.error('Battle card not ready.'); return; }
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas-pro'),
      ]);
      const canvas = await html2canvas(node, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
        width: 794, windowWidth: 794,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      // 1-page design — just fit the whole canvas.
      const imgHeightOnPage = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, Math.min(imgHeightOnPage, pageHeight), undefined, 'FAST');
      const safe = card.competitorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      pdf.save(`battle-card-vs-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Battle card downloaded.');
    } catch (e: any) {
      toast.error(`Export failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleRegenerate = () => {
    clientCache.delete(cacheKey);
    fetchCard();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-rose-50 dark:from-indigo-950/40 dark:to-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
              <Swords className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Battle Card</div>
              <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {sellerContext?.businessName || 'Us'} <span className="text-slate-400 font-normal">vs.</span> {competitorName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {card && !loading && (
              <>
                <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={loading} className="h-8 text-[11px] gap-1.5">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={exporting} className="h-8 text-[11px] gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white">
                  {exporting ? <><Loader2 className="w-3 h-3 animate-spin" />Exporting…</> : <><Download className="w-3 h-3" />Download PDF</>}
                </Button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Grounding battle intel…</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                Searching G2 reviews, changelogs, and switching stories for {competitorName}. Usually 10–20 seconds.
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
              <div className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Failed to load battle card</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{error}</div>
              <Button size="sm" variant="outline" onClick={fetchCard} className="mt-2 h-8 text-[11px]">Retry</Button>
            </div>
          ) : card ? (
            <BattleCardInteractive card={card} />
          ) : null}
        </div>

        {/* Off-screen printable — only rendered when card is present so it can be rasterized. */}
        {card && <BattleCardPrintable ref={printRef} card={card} sellerName={sellerContext?.businessName} />}
      </div>
    </div>
  );
}

// Interactive rendering of the same data — richer than the print view, uses
// dark-mode + shadow / hover states / scrolling that the printable can't rely on.
function BattleCardInteractive({ card }: { card: BattleCardType }) {
  return (
    <div className="p-5 space-y-5">
      {/* Tagline banner */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">How they position themselves</div>
        <div className="text-[13px] italic text-slate-700 dark:text-slate-300 leading-relaxed">
          {card.competitorTagline}
        </div>
      </div>

      {/* Strengths + Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Where They Win (honest baseline)
          </div>
          <ul className="space-y-1.5">
            {card.theirStrengths.map((s, i) => (
              <li key={i} className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-snug flex gap-2">
                <span className="w-1 h-1 rounded-full bg-slate-400 mt-2 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Their Weaknesses — exploit these
          </div>
          <div className="space-y-3">
            {card.theirWeaknesses.map((w, i) => (
              <div key={i} className={i > 0 ? 'pt-3 border-t border-rose-200/60 dark:border-rose-800/40' : ''}>
                <div className="text-[13px] font-bold text-rose-900 dark:text-rose-200 leading-snug">{w.weakness}</div>
                <div className="text-[11.5px] text-rose-800/90 dark:text-rose-300/85 leading-snug mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mr-1">Evidence:</span>
                  {w.evidence}
                </div>
                <div className="text-[11.5px] text-slate-900 dark:text-slate-100 leading-snug mt-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-md p-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mr-1">Ask:</span>
                  {w.howToExploit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Differentiators */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> Where We Win — our differentiators
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {card.ourDifferentiators.map((d, i) => (
            <div key={i} className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 p-3.5">
              <div className="text-[12.5px] font-bold text-indigo-900 dark:text-indigo-200 leading-snug">{d.claim}</div>
              <div className="text-[11.5px] text-indigo-800 dark:text-indigo-300/85 leading-snug mt-1.5">{d.proofPoint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Objection responses */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" /> Objection Library — {card.objectionResponses.length} rehearsed
        </div>
        <div className="space-y-2">
          {card.objectionResponses.map((o, i) => (
            <div key={i} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-l-4 border-l-amber-500 p-3.5">
              <div className="text-[12.5px] italic text-amber-900 dark:text-amber-200 leading-snug">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mr-1 not-italic">They say:</span>
                "{o.theySay}"
              </div>
              <div className="text-[12.5px] text-slate-800 dark:text-slate-200 leading-snug mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mr-1">We say:</span>
                {o.weSay}
              </div>
              {o.evidence && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mr-1">Evidence:</span>
                  {o.evidence}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Switching stories */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
          Recent Switchers — proof it works
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {card.switchingStories.map((s, i) => (
            <div key={i} className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3.5">
              <div className="text-[12px] font-bold text-emerald-900 dark:text-emerald-200 leading-snug">{s.customerName}</div>
              <div className="text-[10.5px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-1">{s.whenSwitched}</div>
              <div className="text-[11.5px] text-emerald-900 dark:text-emerald-200/90 leading-snug mt-2">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mr-1">Why:</span>
                {s.reason}
              </div>
              <div className="text-[11.5px] text-slate-900 dark:text-slate-100 leading-snug mt-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mr-1">Outcome:</span>
                {s.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
