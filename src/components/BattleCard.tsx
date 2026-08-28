import React from 'react';
import { BattleCard as BattleCardType } from '../types';

// Printable off-screen A4 portrait battle card, rasterized to PDF by the
// modal via html2canvas-pro + jsPDF. Follows the MeetingBrief.tsx pattern:
// - Fixed page height (1123px at 96dpi = A4) with overflow:hidden so the
//   rasterizer never gets more canvas than fits on one page.
// - Solid hex colors only, no shadows / dark-mode conditionals — html2canvas
//   handles that DOM most reliably.
// - Dense layout: 4 sections tuned to fit 1 page at 10-11px body font.
export const BattleCardPrintable = React.forwardRef<HTMLDivElement, { card: BattleCardType; sellerName?: string }>(
  function BattleCardPrintable({ card, sellerName }, ref) {
    const dateStamp = new Date(card.generatedAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    const seller = sellerName || 'Our team';

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed', top: '-100000px', left: '-100000px',
          width: '794px', height: '1123px', overflow: 'hidden',
          background: '#ffffff', color: '#0f172a',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
          padding: '32px 36px',
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      >
        {/* Masthead */}
        <div style={{ borderBottom: '3px solid #4f46e5', paddingBottom: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Battle Card
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '4px', lineHeight: 1.15 }}>
                {seller} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '18px' }}>vs.</span> {card.competitorName}
              </div>
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'right', paddingTop: '2px' }}>
              Generated {dateStamp}
              {card.isFallback && <div style={{ color: '#f59e0b', marginTop: '2px', fontWeight: 600 }}>SIMULATED DATA</div>}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', lineHeight: 1.4, fontStyle: 'italic' }}>
            {card.competitorTagline}
          </div>
        </div>

        {/* Row 1: Strengths | Weaknesses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '14px', marginBottom: '14px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Where They Win (baseline)
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {card.theirStrengths.slice(0, 4).map((s, i) => (
                <li key={i} style={{ fontSize: '10.5px', color: '#334155', lineHeight: 1.35, marginBottom: '4px', paddingLeft: '9px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: '5px', width: '3px', height: '3px', background: '#94a3b8', borderRadius: '50%' }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Their Weaknesses (exploit these)
            </div>
            {card.theirWeaknesses.slice(0, 4).map((w, i) => (
              <div key={i} style={{ marginBottom: i === card.theirWeaknesses.slice(0, 4).length - 1 ? 0 : '8px', paddingBottom: i === card.theirWeaknesses.slice(0, 4).length - 1 ? 0 : '8px', borderBottom: i === card.theirWeaknesses.slice(0, 4).length - 1 ? 'none' : '1px solid #fecaca' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', lineHeight: 1.3 }}>
                  {w.weakness}
                </div>
                <div style={{ fontSize: '9.5px', color: '#7f1d1d', lineHeight: 1.35, marginTop: '2px' }}>
                  <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8.5px', color: '#b91c1c' }}>Evidence:</b> {w.evidence}
                </div>
                <div style={{ fontSize: '9.5px', color: '#0f172a', lineHeight: 1.35, marginTop: '2px' }}>
                  <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8.5px', color: '#059669' }}>Ask:</b> {w.howToExploit}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2: Our Differentiators grid */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#4f46e5', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Where We Win — Our Differentiators
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {card.ourDifferentiators.slice(0, 4).map((d, i) => (
              <div key={i} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#3730a3', lineHeight: 1.3 }}>
                  {d.claim}
                </div>
                <div style={{ fontSize: '9.5px', color: '#4338ca', lineHeight: 1.35, marginTop: '3px', opacity: 0.85 }}>
                  {d.proofPoint}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Objection responses */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Objection Library — {card.objectionResponses.length} rehearsed rebuttals
          </div>
          <div>
            {card.objectionResponses.slice(0, 5).map((o, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '8px', padding: '6px 10px', background: i % 2 === 0 ? '#fafafa' : '#ffffff', borderLeft: '2px solid #f59e0b', marginBottom: '3px', borderRadius: '3px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', paddingTop: '1px', fontFamily: 'monospace' }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: '10px', color: '#78350f', fontStyle: 'italic', lineHeight: 1.3 }}>
                    <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8.5px', color: '#b45309', fontStyle: 'normal' }}>They say:</b> "{o.theySay}"
                  </div>
                  <div style={{ fontSize: '10px', color: '#0f172a', lineHeight: 1.3, marginTop: '2px' }}>
                    <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8.5px', color: '#059669' }}>We say:</b> {o.weSay}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4: Recent switchers */}
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Recent Switchers — proof it works
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {card.switchingStories.slice(0, 3).map((s, i) => (
              <div key={i} style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#065f46', lineHeight: 1.25 }}>
                  {s.customerName}
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#059669', fontFamily: 'monospace', marginTop: '2px' }}>
                  {s.whenSwitched}
                </div>
                <div style={{ fontSize: '9.5px', color: '#065f46', lineHeight: 1.3, marginTop: '4px' }}>
                  <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8px', color: '#059669' }}>Why:</b> {s.reason}
                </div>
                <div style={{ fontSize: '9.5px', color: '#0f172a', lineHeight: 1.3, marginTop: '3px' }}>
                  <b style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '8px', color: '#059669' }}>Outcome:</b> {s.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: '18px', left: '36px', right: '36px', display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
          <span>AI Market Pulse — Battle Card generated {dateStamp}</span>
          <span>Selling: {seller}  ·  vs. {card.competitorName}</span>
        </div>
      </div>
    );
  },
);
