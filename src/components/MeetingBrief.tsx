import React from 'react';
import { TargetAccount } from '../types';
import { getAccountPriorityInfo } from './AccountCard';
import { computeRoi, loadRoiOverrides, formatCurrencyCompact, formatCurrencyFull } from '../utils/roi';

// A print-optimized 2-page brief for a rep about to walk into a discovery call.
// Rendered off-screen by AccountDetail and rasterized to a 2-page portrait
// A4 PDF via html2canvas-pro + jspdf. Keep the DOM shallow, avoid shadows
// / gradients / dark-mode conditionals here — html2canvas-pro handles solid
// colors most reliably.
export const MeetingBrief = React.forwardRef<HTMLDivElement, { account: TargetAccount }>(
  function MeetingBrief({ account }, ref) {
    const analysis = account.analysis;
    const info = getAccountPriorityInfo(account);
    const dateStamp = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const roi = computeRoi(account, loadRoiOverrides(account.id) ?? undefined);

    const topPersonas = (analysis?.buyerPersonas ?? []).slice(0, 3);
    const topCompetitors = (analysis?.competitors ?? []).slice(0, 3);
    const stakeholders = analysis?.multiThreadingStrategy;

    // Distilled talking points — pull the strongest one from each persona.
    const talkingPoints: string[] = [];
    if (analysis?.rationale) {
      talkingPoints.push(`Fit rationale: ${analysis.rationale.split('.').slice(0, 1).join('.').trim()}.`);
    }
    topPersonas.forEach((p) => {
      if (p.valueAngle) talkingPoints.push(`For ${p.role}: ${p.valueAngle}`);
    });
    if (analysis?.hiringSignal?.status && !analysis.hiringSignal.status.toLowerCase().includes('no ')) {
      talkingPoints.push(`Hiring signal: ${analysis.hiringSignal.status}${
        analysis.hiringSignal.openRolesCount ? ` (${analysis.hiringSignal.openRolesCount} open roles)` : ''
      }.`);
    }
    if (analysis?.fundingSignal?.latestRound && analysis.fundingSignal.latestRound !== 'No recent funding') {
      talkingPoints.push(`Funding signal: ${analysis.fundingSignal.latestRound}${
        analysis.fundingSignal.amount ? ` — ${analysis.fundingSignal.amount}` : ''
      }.`);
    }

    // 4-slot agenda derived from the account context. Deliberately generic-but-tuned
    // so the rep sees a scaffold, not a script.
    const industry = account.industry || 'target industry';
    const agenda: Array<{ minutes: string; block: string; goal: string }> = [
      { minutes: '0–5',   block: 'Opening + credibility', goal: `Anchor on the signal that opened this door (${info.priorityFlag}). Confirm the person's role and current top-3 priorities in ${industry}.` },
      { minutes: '5–20',  block: 'Discovery',            goal: `Explore pain points across ${topPersonas.map(p => p.role).slice(0,2).join(' and ') || 'the buying committee'}. Listen for language that matches the counter-narratives below.` },
      { minutes: '20–35', block: 'Value framing',        goal: `Land 1–2 talking points from page 1. Bring in the competitor displacement pitch only if they name an incumbent.` },
      { minutes: '35–45', block: 'Next step + threading', goal: `Ask for the multi-threading intro (see page 2). Confirm a follow-up meeting on the calendar before leaving the call.` },
    ];

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          top: '-100000px',
          left: '-100000px',
          width: '794px',       // A4 portrait width at 96dpi
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: '11px',
          lineHeight: 1.45,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {/* ─── PAGE 1 ────────────────────────────────────────────────── */}
        <section style={{ padding: '32px 40px', height: '1123px', overflow: 'hidden', boxSizing: 'border-box', pageBreakAfter: 'always' }}>
          {/* Masthead */}
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4f46e5' }}>
                  Discovery Meeting Brief
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 2px', color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {account.name}
                </h1>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {account.domain}{account.industry ? ` · ${account.industry}` : ''}{account.employeeCount ? ` · ${account.employeeCount.toLocaleString()} employees` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prepared</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>{dateStamp}</div>
              </div>
            </div>
          </div>

          {/* Scorecard strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '18px' }}>
            {[
              { k: 'Fit Score',      v: `${info.fitScore}%`,       tint: '#10b981' },
              { k: 'Timing Score',   v: `${info.timingScore}%`,    tint: '#f59e0b' },
              { k: 'Priority Index', v: `${info.priorityIndex}`,   tint: '#4f46e5' },
              { k: 'Wave',           v: info.priorityFlag.replace(' Required', '').replace(' Track', ''), tint: '#0ea5e9' },
            ].map((m) => (
              <div key={m.k} style={{ border: '1px solid #e2e8f0', borderLeft: `3px solid ${m.tint}`, borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.09em', color: '#64748b', fontWeight: 700 }}>{m.k}</div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginTop: '2px', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Estimated deal size — anchor for the conversation, not a quote */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#065f46', flexShrink: 0 }}>
              Est. Deal Size
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#065f46', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>
              {formatCurrencyCompact(roi.mid)}
              {roi.contractYears > 1 && <span style={{ fontSize: '11px', color: '#059669', marginLeft: '4px' }}>/{roi.contractYears}y</span>}
            </div>
            <div style={{ fontSize: '10px', color: '#047857', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>
              {formatCurrencyFull(roi.low)} — {formatCurrencyFull(roi.high)}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: '9px', color: '#065f46', textAlign: 'right', lineHeight: 1.3 }}>
              {roi.employeeCount.toLocaleString()}{roi.isInferredEmployeeCount ? '*' : ''} employees × ${roi.perEmployeeAcv}/emp × {Math.round(roi.adoptionPct * 100)}%
              <div style={{ fontSize: '8.5px', color: '#059669', marginTop: '1px' }}>Industry: {roi.matchedIndustry}{roi.isInferredEmployeeCount ? ' · * inferred headcount' : ''}</div>
            </div>
          </div>

          {/* Fit rationale */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>Why this account, right now</div>
            <div style={{ fontSize: '12px', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', lineHeight: 1.55 }}>
              {analysis?.rationale || account.fitReason || 'Fit rationale not yet generated for this account.'}
            </div>
          </div>

          {/* Talking points */}
          {talkingPoints.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>Top talking points</div>
              <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
                {talkingPoints.slice(0, 5).map((tp, i) => (
                  <li key={i} style={{ fontSize: '11.5px', color: '#0f172a', marginBottom: '4px', lineHeight: 1.5 }}>
                    {tp}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Personas — top 3 */}
          {topPersonas.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>
                Buyer personas ({topPersonas.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {topPersonas.map((p, i) => {
                  const topPain = p.painPoints?.[0];
                  const topObj = p.counterNarratives?.[0];
                  return (
                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#ffffff' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{p.role}</div>
                      {topPain && (
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '4px' }}>
                          <b style={{ color: '#0f172a' }}>Pain:</b> {topPain}
                        </div>
                      )}
                      {p.valueAngle && (
                        <div style={{ fontSize: '10.5px', color: '#0f172a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '4px 6px', marginBottom: '4px' }}>
                          <b>Value angle:</b> {p.valueAngle}
                        </div>
                      )}
                      {topObj && (
                        <div style={{ fontSize: '10px', color: '#78350f', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 6px' }}>
                          <b>If they say:</b> "{topObj.objection}"<br />
                          <b>Reframe:</b> {topObj.reframingMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ─── PAGE 2 ────────────────────────────────────────────────── */}
        <section style={{ padding: '32px 40px', height: '1123px', overflow: 'hidden', boxSizing: 'border-box' }}>
          {/* Repeat masthead (light) so the second page stands alone */}
          <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
              {account.name} · Discovery brief · page 2
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>{dateStamp}</div>
          </div>

          {/* Competitors */}
          {topCompetitors.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>
                Competitive displacement — if they name an incumbent
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                {topCompetitors.map((c: any, i: number) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                      {c.displacementScore !== undefined && (
                        <div style={{ fontSize: '10px', color: '#4f46e5', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                          Displace: {c.displacementScore}%
                        </div>
                      )}
                    </div>
                    {c.positioningPitch && (
                      <div style={{ fontSize: '10.5px', color: '#0f172a', lineHeight: 1.5 }}>
                        <b>Pitch:</b> {c.positioningPitch}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-threading stakeholder map */}
          {stakeholders && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>
                Multi-threading stakeholder map
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {([
                  ['Accessible Entry', stakeholders.accessibleEntryPoint],
                  ['Internal Champion', stakeholders.internalChampion],
                  ['Economic Buyer', stakeholders.economicBuyer],
                  ['Technical Gatekeeper', stakeholders.technicalGatekeeper],
                ] as const).map(([label, s], i) => (
                  s ? (
                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', background: '#f8fafc' }}>
                      <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{s.role}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{s.timing}</div>
                      <div style={{ fontSize: '10.5px', color: '#0f172a', marginTop: '3px', lineHeight: 1.45 }}>{s.messagingFocus}</div>
                    </div>
                  ) : null
                ))}
              </div>
              {stakeholders.coordinationRules && stakeholders.coordinationRules.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
                  <b style={{ color: '#0f172a', fontStyle: 'normal' }}>Coordination rule:</b> {stakeholders.coordinationRules[0]}
                </div>
              )}
            </div>
          )}

          {/* Discovery call agenda */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#4f46e5', marginBottom: '6px' }}>
              45-minute discovery agenda
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', border: '1px solid #e2e8f0', width: '60px' }}>Min</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', border: '1px solid #e2e8f0', width: '120px' }}>Block</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', border: '1px solid #e2e8f0' }}>Goal</th>
                </tr>
              </thead>
              <tbody>
                {agenda.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#0f172a', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{row.minutes}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 700 }}>{row.block}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.45 }}>{row.goal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '1px solid #cbd5e1', fontSize: '9px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Prepared with AI Market Pulse — grounded in first-party filings, job posts, and web signals.</span>
            <span>Verify inferred fields before quoting on-call.</span>
          </div>
        </section>
      </div>
    );
  }
);
