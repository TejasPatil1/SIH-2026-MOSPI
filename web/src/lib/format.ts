import type { RiskBand } from '../api/types';

const IN = 'en-IN';

/**
 * Indian convention only: crore, then lakh crore. There is no "thousand crore"
 * unit in MoSPI reporting — ₹99,620 Cr, never ₹99.62 K Cr.
 */
export function formatCrore(cr: number | null | undefined, opts?: { sign?: boolean }): string {
  if (cr === null || cr === undefined || Number.isNaN(cr)) return '—';
  const sign = opts?.sign && cr > 0 ? '+' : '';
  if (Math.abs(cr) >= 100_000) {
    return `${sign}₹${(cr / 100_000).toLocaleString(IN, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L Cr`;
  }
  return `${sign}₹${cr.toLocaleString(IN, { maximumFractionDigits: 0 })} Cr`;
}

/** Split form, so a large figure can be typeset with a small unit beside it. */
export function croreParts(cr: number | null | undefined): { value: string; unit: string } {
  if (cr === null || cr === undefined || Number.isNaN(cr)) return { value: '—', unit: '' };
  if (Math.abs(cr) >= 100_000) {
    return {
      value: `₹${(cr / 100_000).toLocaleString(IN, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      unit: 'lakh crore',
    };
  }
  return { value: `₹${cr.toLocaleString(IN, { maximumFractionDigits: 0 })}`, unit: 'crore' };
}

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(IN);
}

export function formatPct(v: number | null | undefined, digits = 1, sign = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = sign && v > 0 ? '+' : '';
  return `${s}${v.toFixed(digits)}%`;
}

export function formatMonths(v: number | null | undefined, digits = 1, sign = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = sign && v > 0 ? '+' : '';
  return `${s}${v.toFixed(digits)} mo`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2024-11-01' | '2024-11' → 'Nov 2024'. No Date parsing — avoids timezone drift. */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return iso;
  return `${MONTHS[idx]} ${y}`;
}

/** Whole months between two 'YYYY-MM' strings. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function formatMonthShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return iso;
  return `${MONTHS[idx]} ’${y.slice(2)}`;
}

export const BAND_ORDER: RiskBand[] = ['CRITICAL', 'HIGH', 'WATCH', 'LOW'];

export const BAND: Record<RiskBand, { label: string; fg: string; bg: string; border: string; hex: string }> = {
  CRITICAL: { label: 'Critical', fg: 'text-risk-critical', bg: 'bg-riskbg-critical', border: 'border-risk-critical/25', hex: '#DC2626' },
  HIGH: { label: 'High', fg: 'text-risk-high', bg: 'bg-riskbg-high', border: 'border-risk-high/25', hex: '#EA580C' },
  WATCH: { label: 'Watch', fg: 'text-risk-watch', bg: 'bg-riskbg-watch', border: 'border-risk-watch/25', hex: '#CA8A04' },
  LOW: { label: 'Low', fg: 'text-risk-low', bg: 'bg-riskbg-low', border: 'border-risk-low/25', hex: '#16A34A' },
};

export const bandHex = (b: RiskBand) => BAND[b]?.hex ?? '#7C8492';

export const SEVERITY: Record<string, { label: string; hex: string }> = {
  HIGH: { label: 'High', hex: '#DC2626' },
  MEDIUM: { label: 'Medium', hex: '#CA8A04' },
  LOW: { label: 'Low', hex: '#7C8492' },
};

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
