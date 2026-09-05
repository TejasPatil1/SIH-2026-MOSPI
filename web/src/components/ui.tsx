import { type ReactNode } from 'react';
import type { RiskBand, Severity } from '../api/types';
import { BAND, SEVERITY, clamp } from '../lib/format';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ layout */

export function Page({ title, lede, actions, children, info }: {
  title: string; lede?: ReactNode; actions?: ReactNode; children: ReactNode; info?: ReactNode;
}) {
  return (
    <div className="fade-in">
      <header className="flex items-end justify-between gap-6 pb-4 mb-5 border-b border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
            {info}
          </div>
          {lede && <p className="text-[13px] text-ink-2 mt-1 max-w-3xl">{lede}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 pb-0.5">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Section({ title, note, actions, children, className, flush, tour, info }: {
  title?: string; note?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; flush?: boolean; tour?: string;
  /**
   * An <Info> for the terminology this section uses. It sits with the heading —
   * one fixed place across the whole application, so a reader who finds it once
   * knows where to look on every other section.
   */
  info?: ReactNode;
}) {
  return (
    <section className={className} data-tour={tour}>
      {(title || actions) && (
        <div className={cx('flex items-baseline justify-between gap-4', flush ? 'mb-2' : 'mb-3')}>
          <div className="flex items-baseline gap-2.5 min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-ink tracking-[-0.01em] whitespace-nowrap">{title}</h2>}
            {info}
            {note && <span className="text-xs text-ink-3 min-w-0 truncate">{note}</span>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const Panel = ({ children, className, pad = true, tour }: {
  children: ReactNode; className?: string; pad?: boolean; tour?: string;
}) => (
  <div className={cx('panel', pad && 'p-4', className)} data-tour={tour}>{children}</div>
);

/* ----------------------------------------------------------------- metrics */

/** A metric block, not a card. Size drives hierarchy — use `hero` sparingly. */
export function Metric({ label, value, unit, hint, size = 'md', tone, className, info }: {
  label: string; value: ReactNode; unit?: string; hint?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'hero'; tone?: 'default' | 'critical' | 'positive'; className?: string;
  /** An <Info> for this metric's terminology, shown beside the label. */
  info?: ReactNode;
}) {
  const sizes = {
    sm: 'text-md font-semibold',
    md: 'text-xl font-semibold',
    lg: 'text-2xl font-semibold',
    hero: 'text-3xl font-semibold',
  } as const;
  const tones = {
    default: 'text-ink',
    critical: 'text-risk-critical',
    positive: 'text-risk-low',
  } as const;
  return (
    <div className={className}>
      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
        {label}
        {info}
      </div>
      <div className={cx('num tracking-[-0.02em] leading-none flex items-baseline gap-1.5', sizes[size], tones[tone ?? 'default'])}>
        <span>{value}</span>
        {unit && <span className="text-[12px] font-medium text-ink-3 tracking-normal">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-ink-3 mt-1.5 leading-snug">{hint}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- indicators */

/** Risk band always carries its label — colour alone is not an indicator (§10.1). */
export function RiskBadge({ band, score, size = 'md' }: { band: RiskBand; score?: number; size?: 'sm' | 'md' }) {
  const b = BAND[band];
  return (
    <span className={cx('chip', b.bg, b.fg, b.border, size === 'sm' && 'h-[19px] px-1.5')}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b.hex }} />
      {b.label}
      {score !== undefined && <span className="num font-bold tabular-nums">{score.toFixed(1)}</span>}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.LOW;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: s.hex }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.hex }} />
      {s.label}
    </span>
  );
}

export function ProgressBar({ value, color = '#1B3F73', width = 62 }: {
  value: number; color?: string; width?: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 align-middle">
      <div className="relative h-[5px] rounded-full bg-line overflow-hidden" style={{ width }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${clamp(value, 0, 100)}%`, background: color }}
        />
      </div>
      <span className="num text-xs text-ink-2 w-8 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

/**
 * A single button, not a label wrapping one: a <button> is a labelable element,
 * so nesting it inside <label htmlFor> makes the click fire twice.
 */
export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'group inline-flex items-center gap-2.5 h-8 pl-2.5 pr-3 rounded border select-none text-left',
        'transition-all duration-200 active:scale-[0.99]',
        checked ? 'bg-accent-soft border-accent-line' : 'bg-surface border-line hover:border-line-strong',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'relative w-[30px] h-[17px] rounded-full transition-colors duration-200 shrink-0',
          checked ? 'bg-accent' : 'bg-ink-4/50 group-hover:bg-ink-4/70',
        )}
      >
        <span
          className="absolute top-[2px] left-[2px] w-[13px] h-[13px] rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: checked ? 'translateX(13px)' : 'none' }}
        />
      </span>
      <span className="leading-tight">
        <span className={cx('block text-[12.5px] font-semibold', checked ? 'text-accent' : 'text-ink-2')}>{label}</span>
        {hint && <span className="block text-2xs text-ink-3 font-medium">{hint}</span>}
      </span>
    </button>
  );
}

export function Select({ label, value, onChange, options, allLabel = 'All' }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allLabel?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      <select className="field max-w-[190px]" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SegmentedControl<T extends string | number>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {label && <span className="eyebrow">{label}</span>}
      <div className="inline-flex p-[2px] rounded bg-line-faint border border-line">
        {options.map((o) => (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={cx(
              'num px-2.5 h-[24px] rounded-[3px] text-[12px] font-semibold transition-all duration-150',
              value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('sk', className)} />;

export function SkeletonTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel overflow-hidden">
      <div className="h-[33px] bg-raised border-b border-line" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 h-[38px] border-b border-line-faint last:border-0">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} className={cx('h-2.5', j === 0 ? 'flex-[2.4]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action, icon = 'search' }: {
  title: string; message: ReactNode; action?: ReactNode; icon?: 'search' | 'clock' | 'file';
}) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.9" /></>,
    file: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /></>,
  };
  return (
    <div className="panel py-12 px-6 flex flex-col items-center text-center">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" className="text-ink-4 mb-3">
        {paths[icon]}
      </svg>
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      <div className="text-[12.5px] text-ink-2 mt-1.5 max-w-md leading-relaxed">{message}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorCard({ error, retry, context }: { error: unknown; retry?: () => void; context?: string }) {
  const e = error as { message?: string; detail?: string; status?: number };
  const offline = e?.status === 0;
  return (
    <div className="panel p-5 border-risk-watch/30 bg-riskbg-watch/40">
      <div className="flex items-start gap-3">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2"
          strokeLinecap="round" className="mt-px shrink-0">
          <path d="M12 8v5M12 17h.01" />
          <path d="M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">
            {offline ? 'Could not reach the scoring service' : e?.message ?? 'Something went wrong'}
          </h3>
          <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed">
            {e?.detail ?? (context ? `${context} could not be loaded.` : 'The request did not complete.')}
          </p>
          {retry && (
            <button onClick={retry} className="btn btn-ghost mt-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />
              </svg>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Calm, permanent provenance statement (§23) — not a warning banner. */
export function ProvenanceNote({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-start gap-2.5 text-[12px] text-ink-2 leading-relaxed', className)}>
      <span className="chip bg-surface border-line text-ink-3 mt-px shrink-0">Prototype data</span>
      <p className="max-w-3xl">
        Synthetic PAIMANA-schema dataset, calibrated to published portfolio aggregates. The model,
        feature pipeline and inference path are real; production validation requires the historical
        CUF export.
      </p>
    </div>
  );
}

export { cx };
