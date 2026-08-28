import React from 'react';
import { DollarSign, Sliders, X, RotateCcw, Info } from 'lucide-react';
import { TargetAccount } from '../types';
import {
  computeRoi, formatCurrencyCompact, formatCurrencyFull,
  loadRoiOverrides, saveRoiOverrides,
  RoiOverrides, INDUSTRY_BENCHMARKS, IndustryKey,
} from '../utils/roi';
import { Button } from '@/components/ui/button';

// Compact ROI tile for the sticky sidebar. Shows the mid deal-size estimate
// with the low/high band + a formula summary. "Adjust" opens a modal that lets
// the rep override per-employee ACV, adoption %, contract length, employee
// count, and industry. Overrides persist in localStorage keyed by account id.
export function RoiTile({ account }: { account: TargetAccount }) {
  const [overrides, setOverrides] = React.useState<RoiOverrides | null>(() => loadRoiOverrides(account.id));
  const [adjustOpen, setAdjustOpen] = React.useState(false);

  // Reset the local state when switching between accounts.
  React.useEffect(() => {
    setOverrides(loadRoiOverrides(account.id));
  }, [account.id]);

  const roi = React.useMemo(() => computeRoi(account, overrides ?? undefined), [account, overrides]);
  const hasOverrides = overrides != null && Object.keys(overrides).length > 0;

  const applyOverrides = (next: RoiOverrides) => {
    setOverrides(next);
    saveRoiOverrides(account.id, next);
  };
  const clearOverrides = () => {
    setOverrides(null);
    saveRoiOverrides(account.id, null);
  };

  return (
    <>
      <section className="bg-emerald-50/60 dark:bg-emerald-950/25 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <h3 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Estimated Deal Size
            {hasOverrides && (
              <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 px-1 py-[1px] rounded">
                CUSTOM
              </span>
            )}
          </h3>
          <button
            onClick={() => setAdjustOpen(true)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 rounded p-1 transition-colors"
            title="Adjust assumptions"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[24px] font-bold font-mono text-emerald-800 dark:text-emerald-200 leading-none">
          {formatCurrencyCompact(roi.mid)}
          {roi.contractYears > 1 && (
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 ml-1.5 font-semibold">/{roi.contractYears}y</span>
          )}
        </div>

        {/* Low - High band */}
        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-emerald-700/85 dark:text-emerald-400/80 font-mono">
          <span>{formatCurrencyCompact(roi.low)}</span>
          <div className="flex-1 h-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-[15%] right-[15%] bg-emerald-500/70 rounded-full" />
            <div className="absolute inset-y-[-2px] left-[calc(50%-1px)] w-[2px] bg-emerald-700 dark:bg-emerald-300" />
          </div>
          <span>{formatCurrencyCompact(roi.high)}</span>
        </div>

        {/* Compact formula strip */}
        <div className="text-[10.5px] text-emerald-800/80 dark:text-emerald-300/85 leading-snug mt-2.5 pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/50 font-mono">
          {roi.employeeCount.toLocaleString()}{roi.isInferredEmployeeCount && '*'} × ${roi.perEmployeeAcv.toLocaleString()}/emp × {Math.round(roi.adoptionPct * 100)}%
          {roi.contractYears > 1 && ` × ${roi.contractYears}y`}
        </div>
        <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60 mt-1">
          Industry: <b>{roi.matchedIndustry}</b>{roi.isInferredEmployeeCount && ' · * employee count inferred'}
        </div>
      </section>

      {adjustOpen && (
        <AdjustModal
          account={account}
          overrides={overrides ?? {}}
          computed={roi}
          onApply={(o) => { applyOverrides(o); setAdjustOpen(false); }}
          onReset={() => { clearOverrides(); setAdjustOpen(false); }}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </>
  );
}

function AdjustModal({
  account, overrides, computed, onApply, onReset, onClose,
}: {
  account: TargetAccount;
  overrides: RoiOverrides;
  computed: ReturnType<typeof computeRoi>;
  onApply: (o: RoiOverrides) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // Work off local state so slider drags don't spam localStorage.
  const [employeeCount, setEmployeeCount] = React.useState<number>(overrides.employeeCount ?? computed.employeeCount);
  const [perEmployeeAcv, setPerEmployeeAcv] = React.useState<number>(overrides.perEmployeeAcv ?? computed.perEmployeeAcv);
  const [adoptionPct, setAdoptionPct] = React.useState<number>(overrides.adoptionPct ?? computed.adoptionPct);
  const [contractYears, setContractYears] = React.useState<number>(overrides.contractYears ?? computed.contractYears);
  const [industry, setIndustry] = React.useState<IndustryKey>(overrides.industry ?? computed.matchedIndustry);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live-compute the preview with the pending local values.
  const preview = React.useMemo(
    () => computeRoi(account, { employeeCount, perEmployeeAcv, adoptionPct, contractYears, industry }),
    [account, employeeCount, perEmployeeAcv, adoptionPct, contractYears, industry],
  );

  const handleApply = () => {
    const bench = INDUSTRY_BENCHMARKS.find((b) => b.key === industry);
    // Only send fields the user actually customized (so future benchmark
    // tweaks flow through automatically).
    const out: RoiOverrides = {};
    if (employeeCount !== (account.employeeCount ?? computed.employeeCount)) out.employeeCount = employeeCount;
    if (bench && perEmployeeAcv !== bench.perEmployeeAcv) out.perEmployeeAcv = perEmployeeAcv;
    if (bench && Math.abs(adoptionPct - bench.adoptionPct) > 0.001) out.adoptionPct = adoptionPct;
    if (contractYears !== 1) out.contractYears = contractYears;
    if (industry !== computed.matchedIndustry) out.industry = industry;
    onApply(out);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Adjust deal-size assumptions</div>
              <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">{account.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Live preview */}
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Preview (total contract)</div>
            <div className="text-[26px] font-bold font-mono text-emerald-800 dark:text-emerald-200 leading-none mt-1">
              {formatCurrencyCompact(preview.mid)}
              {preview.contractYears > 1 && <span className="text-[12px] text-emerald-600 dark:text-emerald-400 ml-1.5 font-semibold">/{preview.contractYears}y</span>}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
              {formatCurrencyFull(preview.low)} — {formatCurrencyFull(preview.high)}
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              Annual: {formatCurrencyCompact(preview.annualAcvMid)}
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Industry</label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRY_BENCHMARKS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => {
                    setIndustry(b.key);
                    // When the user picks a new industry, snap ACV+adoption
                    // to that industry's defaults so they see the impact
                    // immediately. They can still tweak individual sliders.
                    setPerEmployeeAcv(b.perEmployeeAcv);
                    setAdoptionPct(b.adoptionPct);
                  }}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                    industry === b.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                  }`}
                >
                  {b.key}
                </button>
              ))}
            </div>
          </div>

          {/* Employee count */}
          <NumberField
            label="Employee count"
            value={employeeCount}
            onChange={setEmployeeCount}
            step={10}
            min={1}
            hint={account.employeeCount == null ? 'Original: inferred from priority index' : `Original: ${account.employeeCount.toLocaleString()}`}
          />

          {/* Per-employee ACV */}
          <NumberField
            label="Per-employee ACV ($/year)"
            value={perEmployeeAcv}
            onChange={setPerEmployeeAcv}
            step={50}
            min={0}
            prefix="$"
            hint={`Industry default: $${(INDUSTRY_BENCHMARKS.find((b) => b.key === industry)?.perEmployeeAcv ?? 0).toLocaleString()}`}
          />

          {/* Adoption slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Adoption %</label>
              <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">{Math.round(adoptionPct * 100)}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(adoptionPct * 100)}
              onChange={(e) => setAdoptionPct(Number(e.target.value) / 100)}
              className="w-full accent-emerald-600"
            />
            <div className="text-[10px] text-slate-400 mt-0.5">Fraction of employees who become seat-holders.</div>
          </div>

          {/* Contract years */}
          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">Contract length</label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((y) => (
                <button
                  key={y}
                  onClick={() => setContractYears(y)}
                  className={`flex-1 text-[12px] font-semibold py-1.5 rounded-md border transition-colors ${
                    contractYears === y
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                  }`}
                >
                  {y} year{y > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
            <Info className="w-3 h-3 mt-[1px] shrink-0" />
            <span>Estimates are order-of-magnitude anchors for conversation, not quotes. ±30% band around the mid figure.</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Button variant="ghost" size="sm" onClick={onReset} className="text-[11px] gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 h-8">
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-[11px] h-8 px-3">Cancel</Button>
            <Button size="sm" onClick={handleApply} className="text-[11px] h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white">Apply</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step, min, prefix, hint }: {
  label: string; value: number; onChange: (n: number) => void; step: number; min: number; prefix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">{label}</label>
      <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-emerald-500 overflow-hidden">
        {prefix && <span className="pl-2.5 text-[12px] text-slate-500 dark:text-slate-400 font-mono">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
          step={step}
          min={min}
          className="flex-1 px-2 py-1.5 text-[12px] font-mono bg-transparent outline-none text-slate-900 dark:text-slate-100 w-full"
        />
      </div>
      {hint && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}
