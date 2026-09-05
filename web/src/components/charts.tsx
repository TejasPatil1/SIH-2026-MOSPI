import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Driver, GlobalDriver, Registry, Replay, RiskBand, SectorRow, Timeline } from '../api/types';
import { BAND, bandHex, clamp, formatCrore, formatMonthShort } from '../lib/format';
import { cx } from './ui';

const AXIS = { fontSize: 10.5, fill: '#7C8492', fontWeight: 500 } as const;
const GRID = '#EDEBE6';
const NAVY = '#1B3F73';
const AMBER = '#CA8A04';

/** Container width, so custom SVG charts can be laid out in real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function TooltipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-line-strong rounded shadow-pop px-3 py-2 min-w-[168px]">
      <div className="eyebrow mb-1.5 pb-1.5 border-b border-line-faint">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function TipRow({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5 text-[12px]">
      <span className="flex items-center gap-1.5 text-ink-2">
        {color && <span className="w-2 h-[3px] rounded-full shrink-0" style={{ background: color }} />}
        {label}
      </span>
      <span className={cx('num', strong ? 'font-bold text-ink' : 'font-semibold text-ink')}>{value}</span>
    </div>
  );
}

/* ============================================================== divergence */

/**
 * Expenditure against physical progress. The shaded wedge between the two lines
 * is the whole point: money moving without work behind it.
 */
export function DivergenceChart({ timeline, height = 260 }: { timeline: Timeline; height?: number }) {
  const data = timeline.points.map((p) => ({
    month: p.snapshot_month.slice(0, 7),
    physical: p.physical_progress_pct,
    financial: p.financial_progress_pct,
    expenditure: p.expenditure_cr,
    gap: [p.physical_progress_pct, p.financial_progress_pct] as [number, number],
  }));
  const stall = timeline.stall_windows[0];
  const onset = timeline.divergence_onset_month?.slice(0, 7);
  const step = Math.max(1, Math.ceil(data.length / 9));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.34} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0.12} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={GRID} vertical={false} />

        {stall && (
          <ReferenceArea
            x1={stall.from.slice(0, 7)} x2={stall.to.slice(0, 7)}
            fill="#15181D" fillOpacity={0.045} stroke="none"
            label={{ value: `Stalled ${stall.months} mo`, position: 'insideTop', fontSize: 10, fill: '#495260', fontWeight: 600, dy: -13 }}
          />
        )}
        {onset && <ReferenceLine x={onset} stroke="#A5ABB5" strokeDasharray="3 3" />}

        <XAxis
          dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }}
          interval={step - 1} tickFormatter={formatMonthShort} tickMargin={7}
        />
        <YAxis
          tick={AXIS} tickLine={false} axisLine={false} width={40}
          domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`}
        />

        <Tooltip
          cursor={{ stroke: '#A5ABB5', strokeWidth: 1, strokeDasharray: '3 3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            const gap = d.financial - d.physical;
            return (
              <TooltipShell title={formatMonthShort(String(label))}>
                <TipRow label="Physical progress" value={`${d.physical.toFixed(1)}%`} color={NAVY} />
                <TipRow label="Financial progress" value={`${d.financial.toFixed(1)}%`} color={AMBER} />
                <div className="pt-1 mt-1 border-t border-line-faint">
                  <TipRow label="Gap" value={`${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`} strong />
                  <TipRow label="Cumulative spend" value={formatCrore(d.expenditure)} />
                </div>
              </TooltipShell>
            );
          }}
        />

        <Area type="monotone" dataKey="gap" fill="url(#gapFill)" stroke="none" isAnimationActive={false} activeDot={false} />
        <Line type="monotone" dataKey="financial" stroke={AMBER} strokeWidth={2} dot={false}
          activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
        <Line type="monotone" dataKey="physical" stroke={NAVY} strokeWidth={2.25} dot={false}
          activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const DivergenceLegend = () => (
  <div className="flex items-center gap-4 text-[11.5px] text-ink-2">
    <span className="flex items-center gap-1.5"><span className="w-3 h-[2.5px] rounded-full" style={{ background: NAVY }} />Physical progress</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-[2.5px] rounded-full" style={{ background: AMBER }} />Expenditure</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(202,138,4,0.18)' }} />Gap</span>
  </div>
);

/* =========================================================== risk trajectory */

/**
 * The Time Machine hero chart. Hand-built rather than Recharts because it needs
 * clip-based reveal, per-segment colouring at the threshold crossing, and an
 * annotated lead-time bracket that no chart library exposes cleanly.
 */
export function RiskTrajectory({ replay, index, height = 268 }: {
  replay: Replay; index: number; height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const pts = replay.points;
  const PL = 46, PR = 22, PT = 26, PB = 30;
  const iw = Math.max(10, w - PL - PR);
  const ih = height - PT - PB;

  const x = (i: number) => PL + (iw * i) / Math.max(1, pts.length - 1);
  const y = (v: number) => PT + ih * (1 - clamp(v, 0, 100) / 100);
  const idxOf = (month: string | null) => (month ? pts.findIndex((p) => p.as_of_month === month) : -1);

  const alertIdx = idxOf(replay.model_alert_month);
  const officialIdx = idxOf(replay.official_event_month);
  const cur = pts[clamp(index, 0, pts.length - 1)];

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.risk_score).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const revealW = x(index) - PL + 0.5;

  const showAlert = alertIdx >= 0 && index >= alertIdx;
  const showOfficial = officialIdx >= 0 && index >= officialIdx;
  const showLead = showAlert && showOfficial && replay.lead_time_months !== null;

  if (w === 0) return <div ref={ref} style={{ height }} />;

  return (
    <div ref={ref} className="relative select-none">
      <svg width={w} height={height} className="block overflow-visible">
        <defs>
          <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.14} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0.01} />
          </linearGradient>
          <clipPath id="reveal">
            <rect x={PL - 0.5} y={0} width={Math.max(0, revealW)} height={height} />
          </clipPath>
          <clipPath id="aboveThreshold">
            <rect x={0} y={0} width={w} height={y(replay.alert_threshold)} />
          </clipPath>
        </defs>

        {/* grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PL} x2={PL + iw} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={PL - 9} y={y(v) + 3.5} textAnchor="end" fontSize={10.5} fill="#7C8492" fontWeight={500}>{v}</text>
          </g>
        ))}

        {/* alert threshold */}
        <line x1={PL} x2={PL + iw} y1={y(replay.alert_threshold)} y2={y(replay.alert_threshold)}
          stroke="#DC2626" strokeWidth={1.25} strokeDasharray="5 4" opacity={0.7} />
        <text x={PL + iw} y={y(replay.alert_threshold) - 6} textAnchor="end"
          fontSize={9.5} fontWeight={700} fill="#DC2626" letterSpacing="0.07em">
          ALERT THRESHOLD {replay.alert_threshold}
        </text>

        <g clipPath="url(#reveal)">
          <path d={area} fill="url(#riskFill)" />
          <path d={path} fill="none" stroke={NAVY} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          {/* the stretch above threshold restates the state change in colour */}
          <g clipPath="url(#aboveThreshold)">
            <path d={path} fill="none" stroke="#DC2626" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </g>

        {/* event markers, revealed as the replay reaches them */}
        {showAlert && (
          <g className="fade-in">
            <line x1={x(alertIdx)} x2={x(alertIdx)} y1={PT - 6} y2={y(0)} stroke={NAVY} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <circle cx={x(alertIdx)} cy={y(pts[alertIdx].risk_score)} r={4.5} fill="#fff" stroke={NAVY} strokeWidth={2.5} />
          </g>
        )}
        {showOfficial && (
          <g className="fade-in">
            <line x1={x(officialIdx)} x2={x(officialIdx)} y1={PT - 6} y2={y(0)} stroke="#DC2626" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
            <circle cx={x(officialIdx)} cy={y(0)} r={4} fill="#DC2626" />
          </g>
        )}

        {/* lead-time bracket */}
        {showLead && (
          <g className="fade-in">
            <line x1={x(alertIdx)} x2={x(officialIdx)} y1={PT - 10} y2={PT - 10} stroke="#495260" strokeWidth={1.25} />
            <line x1={x(alertIdx)} x2={x(alertIdx)} y1={PT - 14} y2={PT - 6} stroke="#495260" strokeWidth={1.25} />
            <line x1={x(officialIdx)} x2={x(officialIdx)} y1={PT - 14} y2={PT - 6} stroke="#495260" strokeWidth={1.25} />
          </g>
        )}

        {/* current month */}
        <line x1={x(index)} x2={x(index)} y1={PT - 6} y2={y(0)} stroke="#15181D" strokeWidth={1.25} opacity={0.35} />
        <circle cx={x(index)} cy={y(cur.risk_score)} r={5} fill="#fff"
          stroke={cur.risk_score >= replay.alert_threshold ? '#DC2626' : NAVY} strokeWidth={2.75} />

        {/* x labels */}
        <text x={PL} y={height - 9} fontSize={10.5} fill="#7C8492" fontWeight={500}>
          {formatMonthShort(pts[0].as_of_month)}
        </text>
        <text x={PL + iw} y={height - 9} textAnchor="end" fontSize={10.5} fill="#7C8492" fontWeight={500}>
          {formatMonthShort(pts[pts.length - 1].as_of_month)}
        </text>
      </svg>

      {/* HTML overlays — easier to type well than SVG text */}
      {showLead && (
        <div
          className="absolute -translate-x-1/2 fade-in pointer-events-none"
          style={{ left: (x(alertIdx) + x(officialIdx)) / 2, top: 0 }}
        >
          <div className="num text-[11px] font-bold text-ink whitespace-nowrap bg-ground px-1.5">
            {replay.lead_time_months} months
          </div>
        </div>
      )}
    </div>
  );
}

export function TrajectoryLegend({ replay }: { replay: Replay }) {
  return (
    <div className="flex items-center gap-4 text-[11.5px] text-ink-2">
      <span className="flex items-center gap-1.5"><span className="w-3 h-[2.5px] rounded-full bg-accent" />Model risk score</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full border-2 border-accent bg-surface" />Model alert
      </span>
      {replay.official_event_month && (
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-critical" />Official revision</span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-0 border-t-[2px] border-dashed border-risk-critical" />Alert threshold
      </span>
    </div>
  );
}

/* ================================================================ SHAP bars */

/**
 * Ranked contribution view. Deliberately not a standard SHAP waterfall — the
 * question a judge asks is "why is this project high risk?", so contributions
 * are split into what raises risk and what lowers it, with plain-language text.
 */
export function ContributionBars({ drivers, baseRisk, riskScore }: {
  drivers: Driver[]; baseRisk: number; riskScore: number;
}) {
  const up = drivers.filter((d) => d.shap > 0).sort((a, b) => b.shap - a.shap);
  const down = drivers.filter((d) => d.shap < 0).sort((a, b) => a.shap - b.shap);
  const max = Math.max(...drivers.map((d) => Math.abs(d.shap)), 0.01);

  const Row = ({ d, tone }: { d: Driver; tone: 'up' | 'down' }) => (
    <div className="group grid grid-cols-[170px_1fr_46px] items-center gap-3 py-[5px]">
      <div className="text-[12.5px] font-medium text-ink truncate" title={d.label}>{d.label}</div>
      <div className="relative h-[15px] flex items-center">
        <div
          className="h-[15px] rounded-[2px] transition-[width] duration-300"
          style={{
            width: `${(Math.abs(d.shap) / max) * 100}%`,
            background: tone === 'up' ? 'rgba(220,38,38,0.72)' : 'rgba(22,163,74,0.72)',
          }}
        />
      </div>
      <div className="num text-[12px] font-bold text-right" style={{ color: tone === 'up' ? '#DC2626' : '#16A34A' }}>
        {d.shap > 0 ? '+' : ''}{d.shap.toFixed(1)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="eyebrow">Raises risk</span>
        <span className="eyebrow">Contribution</span>
      </div>
      {up.map((d) => <Row key={d.feature} d={d} tone="up" />)}

      {down.length > 0 && (
        <>
          <div className="eyebrow mt-3 mb-2 pt-3 border-t border-line-faint">Lowers risk</div>
          {down.map((d) => <Row key={d.feature} d={d} tone="down" />)}
        </>
      )}

      <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[12px]">
        <span className="text-ink-2">
          Portfolio base rate <span className="num font-semibold text-ink">{baseRisk.toFixed(1)}</span>
          <span className="text-ink-3"> + contributions</span>
        </span>
        <span className="num font-bold text-ink">= {riskScore.toFixed(1)}</span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {up.slice(0, 3).map((d) => (
          <li key={d.feature} className="flex gap-2 text-[12px] text-ink-2 leading-snug">
            <span className="w-1 h-1 rounded-full bg-ink-4 mt-[7px] shrink-0" />
            {d.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========================================================== prediction band */

/** Point estimate inside its p10–p90 interval. The interval is the credibility. */
export function RangeBar({ p10, p50, p90, point, unit, domain, caption }: {
  p10: number; p50: number; p90: number; point: number; unit: string; domain: [number, number];
  /** Replaces the default caption. Plain language beats "80% prediction interval". */
  caption?: string;
}) {
  const [lo, hi] = domain;
  const pos = (v: number) => `${clamp(((v - lo) / (hi - lo)) * 100, 0, 100)}%`;
  /* '%' hugs the number; a word unit needs the space. */
  const suffix = unit === '%' ? '%' : unit ? ` ${unit}` : '';
  return (
    <div className="pt-1">
      <div className="relative h-[26px]">
        <div className="absolute inset-x-0 top-[11px] h-[3px] rounded-full bg-line" />
        <div
          className="absolute top-[11px] h-[3px] rounded-full bg-accent/35"
          style={{ left: pos(p10), right: `calc(100% - ${pos(p90)})` }}
        />
        <div className="absolute top-[6px] w-[3px] h-[13px] rounded-full bg-accent/50" style={{ left: pos(p10) }} />
        <div className="absolute top-[6px] w-[3px] h-[13px] rounded-full bg-accent/50" style={{ left: pos(p90) }} />
        <div
          className="absolute top-[4px] w-[9px] h-[17px] rounded-[2px] bg-accent border-2 border-surface shadow-sm -translate-x-1/2 transition-[left] duration-300"
          style={{ left: pos(point) }}
        />
        <div className="absolute top-[21px] text-2xs num font-semibold text-ink-3 whitespace-nowrap" style={{ left: pos(p10), transform: 'translateX(-50%)' }}>
          {p10.toFixed(1)}{suffix}
        </div>
        <div className="absolute top-[21px] text-2xs num font-semibold text-ink-3 whitespace-nowrap" style={{ left: pos(p90), transform: 'translateX(-50%)' }}>
          {p90.toFixed(1)}{suffix}
        </div>
      </div>
      <div className="text-2xs text-ink-3 mt-3 flex justify-between gap-3">
        <span>{caption ?? `80% prediction interval${unit ? ` (${unit})` : ''}`}</span>
        {!caption && <span className="num shrink-0">median {p50.toFixed(1)}</span>}
      </div>
    </div>
  );
}

/* ======================================================= band distribution */

export function BandDistribution({ bands, onSelect, total }: {
  bands: { band: RiskBand; count: number; exposure_cr: number }[];
  onSelect?: (b: RiskBand) => void; total: number;
}) {
  return (
    <div>
      <div className="flex h-[26px] rounded overflow-hidden border border-line">
        {bands.map((b) => (
          <button
            key={b.band}
            onClick={() => onSelect?.(b.band)}
            title={`${b.count} ${b.band}`}
            className="relative group transition-opacity duration-150 hover:opacity-85"
            style={{ width: `${(b.count / total) * 100}%`, background: bandHex(b.band) }}
          >
            {b.count / total > 0.09 && (
              <span className="num text-[11px] font-bold text-white/95">{b.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-x-3 mt-3">
        {bands.map((b) => (
          <button key={b.band} onClick={() => onSelect?.(b.band)} className="text-left group">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: bandHex(b.band) }} />
              <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-ink-2 group-hover:text-ink">
                {BAND[b.band].label}
              </span>
            </div>
            <div className="num text-md font-semibold text-ink mt-1 leading-none">{b.count}</div>
            <div className="num text-2xs text-ink-3 mt-1 whitespace-nowrap">{formatCrore(b.exposure_cr)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ sector matrix */

/**
 * Where attention should go. Exposure sets the bar length (what it costs),
 * band composition sets the colour split (how likely). Both at once beats a pie.
 */
export function SectorMatrix({ sectors, onSelect, limit = 10 }: {
  sectors: SectorRow[]; onSelect?: (s: string, band?: RiskBand) => void; limit?: number;
}) {
  const shown = sectors.slice(0, limit);
  const max = Math.max(...shown.map((s) => s.exposure_at_risk_cr), 1);
  const order: RiskBand[] = ['CRITICAL', 'HIGH', 'WATCH', 'LOW'];

  return (
    <div className="space-y-px">
      <div className="grid grid-cols-[168px_1fr_86px_62px] gap-3 pb-1.5 mb-1 border-b border-line">
        <span className="eyebrow">Sector</span>
        <span className="eyebrow">Risk composition</span>
        <span className="eyebrow text-right">Exposure</span>
        <span className="eyebrow text-right">Avg risk</span>
      </div>
      {shown.map((s, i) => (
        <div
          key={s.sector}
          data-tour={i === 0 ? 'sector-row-top' : undefined}
          className="grid grid-cols-[168px_1fr_86px_62px] gap-3 items-center py-[7px] rounded px-1 -mx-1
                     hover:bg-accent-soft/50 transition-colors duration-150 cursor-pointer group"
          onClick={() => onSelect?.(s.sector)}
        >
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-ink truncate" title={s.sector}>{s.sector}</div>
            <div className="num text-2xs text-ink-3">{s.projects} projects</div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-[13px] rounded-[2px] overflow-hidden" style={{ width: `${Math.max(9, (s.exposure_at_risk_cr / max) * 100)}%` }}>
              {order.map((b) =>
                s.bands[b] > 0 ? (
                  <span
                    key={b}
                    title={`${s.bands[b]} ${b}`}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(s.sector, b); }}
                    className="hover:opacity-80 transition-opacity"
                    style={{ width: `${(s.bands[b] / s.projects) * 100}%`, background: bandHex(b) }}
                  />
                ) : null,
              )}
            </div>
          </div>

          <span className="num text-[12.5px] font-semibold text-ink text-right">{formatCrore(s.exposure_at_risk_cr)}</span>
          <span className="num text-[12.5px] text-ink-2 text-right">{s.mean_risk.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

/* ========================================================== global drivers */

export function GlobalDrivers({ drivers }: { drivers: GlobalDriver[] }) {
  const max = Math.max(...drivers.map((d) => d.mean_abs_shap), 0.01);
  const GROUP: Record<string, { label: string; color: string }> = {
    C: { label: 'CUF field', color: '#1B3F73' },
    D: { label: 'Derived from CUF', color: '#4A7BB8' },
    E: { label: 'External', color: '#A5ABB5' },
  };
  return (
    <div>
      <div className="space-y-[3px]">
        {drivers.map((d) => (
          <div key={d.feature} className="grid grid-cols-[152px_1fr_38px] items-center gap-2.5">
            <span className="text-[12px] text-ink truncate" title={d.label}>{d.label}</span>
            <div className="h-[11px] rounded-[2px] transition-[width] duration-300"
              style={{ width: `${(d.mean_abs_shap / max) * 100}%`, background: GROUP[d.group].color }} />
            <span className="num text-2xs text-ink-3 text-right">{d.mean_abs_shap.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3.5 mt-3 pt-2.5 border-t border-line-faint">
        {Object.entries(GROUP).map(([k, g]) => (
          <span key={k} className="flex items-center gap-1.5 text-2xs text-ink-2">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: g.color }} />{g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================== calibration */

export function CalibrationChart({ points, height = 210 }: {
  points: Registry['calibration']; height?: number;
}) {
  const data = points.map((p) => ({ ...p, ideal: p.predicted }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="predicted" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
          tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tickMargin={6} />
        <YAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
          tick={AXIS} tickLine={false} axisLine={false} width={38} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip
          cursor={{ stroke: '#A5ABB5', strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <TooltipShell title={`Predicted ${(d.predicted * 100).toFixed(0)}%`}>
                <TipRow label="Observed rate" value={`${(d.observed * 100).toFixed(1)}%`} strong />
                <TipRow label="Projects in bin" value={d.n.toLocaleString('en-IN')} />
              </TooltipShell>
            );
          }}
        />
        <Line type="linear" dataKey="ideal" stroke="#A5ABB5" strokeWidth={1.25} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="observed" stroke={NAVY} strokeWidth={2.25}
          dot={{ r: 2.75, fill: NAVY, strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* =========================================================== lead-time hist */

export function LeadTimeHistogram({ registry, height = 168 }: { registry: Registry; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const bins = registry.lead_time;
  const max = Math.max(...bins.map((b) => b.count), 1);
  const PL = 34, PR = 12, PT = 8, PB = 26;
  const iw = Math.max(10, w - PL - PR);
  const ih = height - PT - PB;
  const bw = iw / bins.length;
  const maxMonths = bins[bins.length - 1].months;
  const medianX = PL + (registry.lead_time_median / maxMonths) * (iw - bw) + bw / 2;

  if (w === 0) return <div ref={ref} style={{ height }} />;

  return (
    <div ref={ref}>
      <svg width={w} height={height} className="block overflow-visible">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PL} x2={PL + iw} y1={PT + ih * (1 - f)} y2={PT + ih * (1 - f)} stroke={GRID} />
        ))}
        {bins.map((b, i) => {
          const h = (b.count / max) * ih;
          const early = b.months >= registry.lead_time_median;
          return (
            <g key={b.months}>
              <rect x={PL + i * bw + 1.5} y={PT + ih - h} width={bw - 3} height={h} rx={1.5}
                fill={early ? NAVY : '#A9BBD4'} />
              {i % 2 === 0 && (
                <text x={PL + i * bw + bw / 2} y={height - 9} textAnchor="middle" fontSize={10} fill="#7C8492" fontWeight={500}>
                  {b.months}
                </text>
              )}
            </g>
          );
        })}
        <line x1={medianX} x2={medianX} y1={PT - 4} y2={PT + ih} stroke="#DC2626" strokeWidth={1.25} strokeDasharray="4 3" />
        <text x={medianX + 5} y={PT + 4} fontSize={10} fontWeight={700} fill="#DC2626">
          median {registry.lead_time_median}
        </text>
        <text x={PL - 8} y={PT + 4} textAnchor="end" fontSize={10} fill="#7C8492" fontWeight={500}>{max}</text>
        <text x={PL - 8} y={PT + ih + 3} textAnchor="end" fontSize={10} fill="#7C8492" fontWeight={500}>0</text>
      </svg>
      <div className="text-2xs text-ink-3 text-center mt-1">Months of lead time before the official revision</div>
    </div>
  );
}

/* ============================================================ progress ring */

export function RiskGauge({ score, band, size = 104 }: { score: number; band: RiskBand; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const [len, setLen] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setLen((clamp(score, 0, 100) / 100) * c));
    return () => cancelAnimationFrame(t);
  }, [score, c]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GRID} strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bandHex(band)} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={`${len} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="num text-2xl font-semibold tracking-[-0.03em] leading-none" style={{ color: bandHex(band) }}>
          {score.toFixed(0)}
        </div>
        <div className="text-2xs font-bold uppercase tracking-[0.08em] mt-1" style={{ color: bandHex(band) }}>
          {BAND[band].label}
        </div>
      </div>
    </div>
  );
}
