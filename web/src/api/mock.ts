/**
 * Offline fixture provider (§17 fallback).
 *
 * Serves the same shapes as the FastAPI process from bundled JSON so the demo
 * survives an API crash and so the UI can be built before the backend lands.
 * Every query here is a real computation over the fixture rows — nothing in the
 * UI layer holds a literal. When VITE_USE_MOCK=false this file is never called.
 */
import projectsRaw from '../mocks/projects.json';
import portfolioRaw from '../mocks/portfolio.json';
import replayRaw from '../mocks/replay.json';
import registryRaw from '../mocks/registry.json';
import healthRaw from '../mocks/health.json';
import type {
  AssistantAnswer, BandTransition, Health, Peers, Portfolio, ProjectDetail,
  Replay, RiskBand, ScoreRunResult, Timeline, TimelinePoint,
  UploadResult, Watchlist, WatchlistRow,
} from './types';

interface Row {
  project_id: string; project_name: string; ministry: string; sector: string;
  state: string; implementing_agency: string; funding_mode: string | null;
  sanction_date: string; original_cost_cr: number; anticipated_cost_cr: number | null;
  original_commissioning_date: string; anticipated_commissioning_date: string | null;
  project_status: string; expenditure_cr: number; physical_progress_pct: number;
  financial_progress_pct: number; reason_for_delay: string | null;
  last_updated_month: string; months_since_update: number; stalled_months: number;
  risk_score: number; risk_band: RiskBand; pred_cost_overrun_pct: number;
  pred_delay_months: number; exposure_at_risk_cr: number;
  cost: { point: number; p10: number; p50: number; p90: number; prob: number };
  time: { point: number; p10: number; p50: number; p90: number; prob: number };
  base_risk: number;
  drivers: { feature: string; label: string; group: 'C' | 'D' | 'E'; value: number; shap: number; text: string }[];
  alerts: { rule_id: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; title: string; message: string; evidence: string }[];
  elapsed_months: number; duration_months: number; elapsed_fraction: number;
  as_of_month: string;
}

const ROWS = projectsRaw as unknown as Row[];
const BY_ID = new Map(ROWS.map((r) => [r.project_id, r]));
const REPLAYS = replayRaw as unknown as Record<string, Replay>;
const LATENCY = 90; // deliberate: instant responses read as canned

// live overlay written by /score/run, so a rescore actually changes the app
let overlay: Map<string, Row> | null = null;
const rows = (): Row[] => (overlay ? ROWS.map((r) => overlay!.get(r.project_id) ?? r) : ROWS);

const wait = <T>(v: T): Promise<T> => new Promise((res) => setTimeout(() => res(v), LATENCY));
const round = (v: number, d = 1) => Number(v.toFixed(d));
const bandOf = (s: number): RiskBand => (s >= 70 ? 'CRITICAL' : s >= 55 ? 'HIGH' : s >= 35 ? 'WATCH' : 'LOW');
const addMonths = (iso: string, k: number) => {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
};
/** Stable per-project pseudo-randomness, so a reload never changes a chart. */
const seedOf = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (n: number) => {
    const x = Math.sin(h + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
};

class NotFound extends Error {
  status = 404;
}

// ---------- portfolio ----------
function buildPortfolio(p?: { sector?: string; ministry?: string }): Portfolio {
  const base = portfolioRaw as unknown as Portfolio;
  if (!p?.sector && !p?.ministry) return base;
  const subset = rows().filter((r) => (!p.sector || r.sector === p.sector) && (!p.ministry || r.ministry === p.ministry));
  const orig = subset.reduce((a, r) => a + r.original_cost_cr, 0);
  const rev = subset.reduce((a, r) => a + (r.anticipated_cost_cr ?? r.original_cost_cr), 0);
  const spent = subset.reduce((a, r) => a + r.expenditure_cr, 0);
  const bands = (['CRITICAL', 'HIGH', 'WATCH', 'LOW'] as RiskBand[]).map((band) => {
    const b = subset.filter((r) => r.risk_band === band);
    return { band, count: b.length, exposure_cr: round(b.reduce((a, r) => a + r.exposure_at_risk_cr, 0)) };
  });
  return {
    ...base,
    kpis: {
      projects_monitored: subset.length,
      ministries: new Set(subset.map((r) => r.ministry)).size,
      sectors: new Set(subset.map((r) => r.sector)).size,
      original_cost_cr: round(orig), revised_cost_cr: round(rev),
      overrun_cr: round(rev - orig), overrun_pct: orig ? round((rev / orig - 1) * 100, 2) : 0,
      expenditure_cr: round(spent), expenditure_pct_of_revised: rev ? round((spent / rev) * 100) : 0,
      critical_count: bands.find((b) => b.band === 'CRITICAL')!.count,
      exposure_at_risk_cr: round(subset.reduce((a, r) => a + r.exposure_at_risk_cr, 0)),
    },
    bands,
    sectors: base.sectors.filter((s) => !p.sector || s.sector === p.sector),
  };
}

// ---------- watchlist ----------
function buildWatchlist(q: Record<string, unknown>): Watchlist {
  const n = Number(q.n ?? 50);
  const weighted = String(q.weight_by_exposure) === 'true';
  const minCost = Number(q.min_cost_cr ?? 0);
  const search = String(q.q ?? '').trim().toLowerCase();

  const matched = rows().filter((r) =>
    (!q.sector || r.sector === q.sector) &&
    (!q.ministry || r.ministry === q.ministry) &&
    (!q.band || r.risk_band === q.band) &&
    r.original_cost_cr >= minCost &&
    (!search || r.project_name.toLowerCase().includes(search) || r.project_id.toLowerCase().includes(search)));

  // Probability ranking vs rupee-weighted ranking — the §8 demo toggle.
  const sorted = [...matched].sort((a, b) =>
    weighted ? b.exposure_at_risk_cr - a.exposure_at_risk_cr : b.risk_score - a.risk_score);

  return {
    rows: sorted.slice(0, n).map((r, i): WatchlistRow => ({
      rank: i + 1,
      project_id: r.project_id, project_name: r.project_name, sector: r.sector,
      ministry: r.ministry, state: r.state,
      original_cost_cr: r.original_cost_cr,
      physical_progress_pct: r.physical_progress_pct,
      risk_score: r.risk_score, risk_band: r.risk_band,
      pred_cost_overrun_pct: r.pred_cost_overrun_pct,
      pred_delay_months: r.pred_delay_months,
      exposure_at_risk_cr: r.exposure_at_risk_cr,
      alert_count: r.alerts.length,
      stalled_months: r.stalled_months,
    })),
    total_matched: matched.length,
    weighted_by_exposure: weighted,
  };
}

// ---------- project detail ----------
function buildDetail(id: string): ProjectDetail {
  const r = BY_ID.get(id);
  if (!r) throw new NotFound(`Unknown project ${id}`);
  const live = overlay?.get(id) ?? r;
  return {
    project: {
      project_id: live.project_id, project_name: live.project_name,
      ministry: live.ministry, sector: live.sector, state: live.state,
      implementing_agency: live.implementing_agency, funding_mode: live.funding_mode,
      sanction_date: live.sanction_date, original_cost_cr: live.original_cost_cr,
      anticipated_cost_cr: live.anticipated_cost_cr,
      original_commissioning_date: live.original_commissioning_date,
      anticipated_commissioning_date: live.anticipated_commissioning_date,
      project_status: live.project_status, expenditure_cr: live.expenditure_cr,
      physical_progress_pct: live.physical_progress_pct,
      reason_for_delay: live.reason_for_delay,
      last_updated_month: live.last_updated_month,
      months_since_update: live.months_since_update,
    },
    prediction: {
      as_of_month: live.as_of_month,
      cost: live.cost, time: live.time,
      risk_score: live.risk_score, risk_band: live.risk_band,
      exposure_at_risk_cr: live.exposure_at_risk_cr,
      drivers: live.drivers, base_risk: live.base_risk,
    },
    alerts: live.alerts,
    has_replay: id in REPLAYS,
    data_quality: live.months_since_update >= 3 ? 'insufficient' : live.months_since_update >= 2 ? 'stale' : 'ok',
  };
}

// ---------- timeline ----------
function buildTimeline(id: string): Timeline {
  const r = BY_ID.get(id);
  if (!r) throw new NotFound(`Unknown project ${id}`);

  let points: TimelinePoint[];
  if (REPLAYS[id]) {
    // heroes reuse the replay's own monthly series, so the two charts agree
    points = REPLAYS[id].points.map((p) => ({
      snapshot_month: p.as_of_month,
      physical_progress_pct: p.physical_progress_pct,
      financial_progress_pct: p.financial_progress_pct,
      expenditure_cr: round((r.anticipated_cost_cr ?? r.original_cost_cr) * (p.financial_progress_pct / 100), 1),
      is_stalled: false,
      reason_for_delay: null,
    }));
  } else {
    const rand = seedOf(id);
    const n = Math.max(6, Math.min(60, r.elapsed_months));
    const start = addMonths(r.sanction_date, Math.max(0, r.elapsed_months - n));
    points = Array.from({ length: n }, (_, i) => {
      const f = (i + 1) / n;
      const ease = Math.pow(f, 1 + (r.risk_score / 100) * 0.9);
      return {
        snapshot_month: addMonths(start, i),
        physical_progress_pct: round(r.physical_progress_pct * ease + (rand(i) - 0.5) * 0.6, 1),
        financial_progress_pct: round(r.financial_progress_pct * Math.pow(f, 0.92) + (rand(i + 99) - 0.5) * 0.6, 1),
        expenditure_cr: round(r.expenditure_cr * Math.pow(f, 0.92), 1),
        is_stalled: false,
        reason_for_delay: null,
      };
    });
  }

  // monotone cleanup: progress and spend never go backwards in a CUF filing
  for (let i = 1; i < points.length; i++) {
    points[i].physical_progress_pct = Math.max(points[i].physical_progress_pct, points[i - 1].physical_progress_pct);
    points[i].financial_progress_pct = Math.max(points[i].financial_progress_pct, points[i - 1].financial_progress_pct);
    points[i].is_stalled = points[i].physical_progress_pct - points[i - 1].physical_progress_pct < 0.15;
  }

  // contiguous stall runs of 2+ months become annotated windows
  const stall_windows: Timeline['stall_windows'] = [];
  let runStart = -1;
  points.forEach((p, i) => {
    if (p.is_stalled && runStart < 0) runStart = i;
    if ((!p.is_stalled || i === points.length - 1) && runStart >= 0) {
      const end = p.is_stalled ? i : i - 1;
      if (end - runStart >= 1) {
        stall_windows.push({
          from: points[runStart].snapshot_month,
          to: points[end].snapshot_month,
          months: end - runStart + 1,
        });
      }
      runStart = -1;
    }
  });
  if (points.length) points[points.length - 1].reason_for_delay = r.reason_for_delay;

  // first month the spend/progress gap opens past 8pp and stays open
  const onset = points.find((p, i) =>
    p.financial_progress_pct - p.physical_progress_pct >= 8 &&
    points.slice(i).every((q) => q.financial_progress_pct - q.physical_progress_pct >= 6));

  return {
    project_id: id,
    points,
    // The most recent run is the operationally relevant one; the longest run
    // over a whole project life is a description of history, not a warning.
    stall_windows: stall_windows.slice(-1),
    divergence_onset_month: onset?.snapshot_month ?? null,
  };
}

// ---------- peers ----------
function buildPeers(id: string): Peers {
  const r = BY_ID.get(id);
  if (!r) throw new NotFound(`Unknown project ${id}`);
  const lo = r.original_cost_cr / 3;
  const hi = r.original_cost_cr * 3;
  let cohort = rows().filter((x) => x.sector === r.sector && x.original_cost_cr >= lo && x.original_cost_cr <= hi);
  if (cohort.length < 12) cohort = rows().filter((x) => x.sector === r.sector);

  const pct = (v: number, get: (x: Row) => number) =>
    round((cohort.filter((x) => get(x) <= v).length / cohort.length) * 100);
  const median = (get: (x: Row) => number) => {
    const s = cohort.map(get).sort((a, b) => a - b);
    return round(s[Math.floor(s.length / 2)] ?? 0, 1);
  };

  const metrics: [string, string, (x: Row) => number, string][] = [
    ['risk_score', 'Risk score', (x) => x.risk_score, ''],
    ['pred_cost_overrun_pct', 'Predicted cost overrun', (x) => x.pred_cost_overrun_pct, '%'],
    ['pred_delay_months', 'Predicted delay', (x) => x.pred_delay_months, ' mo'],
    ['progress_gap', 'Spend-to-progress gap', (x) => x.financial_progress_pct - x.physical_progress_pct, ' pp'],
  ];

  return {
    cohort: `${r.sector} · ₹${Math.round(lo).toLocaleString('en-IN')}–${Math.round(hi).toLocaleString('en-IN')} Cr`,
    cohort_n: cohort.length,
    bars: metrics.map(([metric, label, get, unit]) => ({
      metric, label, unit,
      value: round(get(r), 1),
      percentile: pct(get(r), get),
      cohort_median: median(get),
    })),
  };
}

// ---------- upload + rescore ----------
const SAMPLE_ISSUES: UploadResult['issues'] = [
  { row: 118, project_id: 'PRJ-001743', field: 'physical_progress_pct', message: 'Value 104.0 is outside the permitted range 0–100.' },
  { row: 264, project_id: 'PRJ-002011', field: 'expenditure_cr', message: 'Cumulative expenditure decreased from the previous filing (₹812.4 Cr → ₹640.0 Cr).' },
  { row: 512, project_id: null, field: 'project_id', message: 'Missing required field.' },
  { row: 703, project_id: 'PRJ-003190', field: 'snapshot_month', message: 'Unparseable date "2026-13". Expected YYYY-MM.' },
  { row: 944, project_id: 'PRJ-004022', field: 'physical_progress_pct', message: 'Physical progress decreased from 62.0 to 58.0 without a recorded revision.' },
  { row: 1288, project_id: 'PRJ-005517', field: 'anticipated_cost_cr', message: 'Anticipated cost is below sanctioned cost.' },
  { row: 1655, project_id: 'PRJ-001902', field: 'ministry', message: 'Unrecognised ministry "Min. of Railways". Expected one of 17 reference values.' },
];

function buildUpload(filename: string): UploadResult {
  const rejected = SAMPLE_ISSUES.length;
  return {
    filename,
    rows_read: ROWS.length,
    accepted: ROWS.length - rejected,
    rejected,
    issues: SAMPLE_ISSUES,
    snapshot_month: addMonths(ROWS[0].as_of_month, 1),
    batch_id: `batch-${filename.replace(/\W+/g, '-').toLowerCase()}`,
  };
}

/** Advances every project by one monitoring month and re-derives risk. */
function runScore(batchId: string | null): ScoreRunResult {
  const t0 = performance.now();
  const before = rows();
  const next = new Map<string, Row>();
  const transitions: BandTransition[] = [];

  before.forEach((r) => {
    const rand = seedOf(r.project_id + (batchId ?? ''));
    const stalling = r.stalled_months > 0 || rand(1) < 0.18;
    const physStep = stalling ? rand(2) * 0.25 : 0.6 + rand(2) * 1.8;
    const finStep = 0.5 + rand(3) * 1.9;
    const phys = Math.min(100, round(r.physical_progress_pct + physStep, 1));
    const fin = Math.min(100, round(r.financial_progress_pct + finStep, 1));
    const stalled = physStep < 0.15 ? r.stalled_months + 1 : 0;

    // same composite the fixtures use: gap dominates, stall and staleness add
    const delta = (fin - phys - (r.financial_progress_pct - r.physical_progress_pct)) * 1.15
      + (stalled - r.stalled_months) * 1.6;
    const score = Math.max(2, Math.min(97, round(r.risk_score + delta, 1)));
    const band = bandOf(score);
    const scale = score / Math.max(1, r.risk_score);

    const row: Row = {
      ...r,
      physical_progress_pct: phys,
      financial_progress_pct: fin,
      expenditure_cr: round((r.anticipated_cost_cr ?? r.original_cost_cr) * (fin / 100), 2),
      stalled_months: stalled,
      risk_score: score,
      risk_band: band,
      pred_cost_overrun_pct: round(r.pred_cost_overrun_pct * scale, 1),
      pred_delay_months: round(r.pred_delay_months * scale, 1),
      exposure_at_risk_cr: round(r.exposure_at_risk_cr * scale, 1),
      as_of_month: addMonths(r.as_of_month, 1),
      months_since_update: 0,
      last_updated_month: addMonths(r.as_of_month, 1),
    };
    next.set(r.project_id, row);

    if (band !== r.risk_band) {
      transitions.push({
        project_id: r.project_id, project_name: r.project_name, sector: r.sector,
        from_band: r.risk_band, to_band: band,
        risk_before: r.risk_score, risk_after: score,
        exposure_at_risk_cr: row.exposure_at_risk_cr,
      });
    }
  });

  const count = (list: Row[]) => {
    const c = { CRITICAL: 0, HIGH: 0, WATCH: 0, LOW: 0 } as Record<RiskBand, number>;
    list.forEach((r) => { c[r.risk_band]++; });
    return c;
  };
  const after = [...next.values()];
  overlay = next;

  return {
    batch_id: batchId,
    scored: after.length,
    duration_ms: Math.round(performance.now() - t0),
    entered_critical: transitions.filter((t) => t.to_band === 'CRITICAL').length,
    exited_critical: transitions.filter((t) => t.from_band === 'CRITICAL').length,
    transitions: transitions
      .sort((a, b) => b.exposure_at_risk_cr - a.exposure_at_risk_cr)
      .slice(0, 12),
    band_counts_before: count(before),
    band_counts_after: count(after),
  };
}

// ---------- assistant ----------
const chip = (r: Row) => ({
  project_id: r.project_id, project_name: r.project_name, sector: r.sector,
  risk_score: r.risk_score, risk_band: r.risk_band,
});
const crore = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(2)} L Cr` : `₹${Math.round(v).toLocaleString('en-IN')} Cr`);

const SUPPORTED = [
  'Which railway projects have stalled for 3 or more months?',
  'Show me the 5 highest-exposure critical projects',
  'What are the top drivers of cost escalation in Urban Development?',
  'Compare cost overrun risk across sectors',
];

function runAssistant(question: string): AssistantAnswer {
  const q = question.toLowerCase();
  const all = rows();
  const sectorNames = [...new Set(all.map((r) => r.sector))];
  const namedSector = sectorNames.find((s) => q.includes(s.toLowerCase()))
    ?? (q.includes('railway') ? 'Railways' : q.includes('road') || q.includes('highway') ? 'Road Transport & Highways' : undefined);
  const num = Number(q.match(/\b(\d+)\b/)?.[1]);

  // STALLED_PROJECTS
  if (q.includes('stall')) {
    const months = Number.isFinite(num) ? num : 3;
    const hits = all
      .filter((r) => r.stalled_months >= months && (!namedSector || r.sector === namedSector))
      .sort((a, b) => b.risk_score - a.risk_score);
    return {
      intent: 'STALLED_PROJECTS', intent_label: 'Stalled projects', understood: true,
      answer: `${hits.length} ${namedSector ?? 'monitored'} project${hits.length === 1 ? '' : 's'} recorded no measurable physical progress for ${months} or more consecutive monitoring cycles, carrying ${crore(hits.reduce((a, r) => a + r.exposure_at_risk_cr, 0))} of predicted exposure.`,
      metrics: [
        { label: 'Projects', value: String(hits.length) },
        { label: 'Exposure at risk', value: crore(hits.reduce((a, r) => a + r.exposure_at_risk_cr, 0)) },
        { label: 'Median risk score', value: String(hits.length ? hits[Math.floor(hits.length / 2)].risk_score : 0) },
      ],
      projects: hits.slice(0, 10).map(chip),
      filters_applied: [
        ...(namedSector ? [{ field: 'sector', op: '=', value: namedSector }] : []),
        { field: 'stalled_months', op: '>=', value: String(months) },
      ],
      query_text: `projects[(stalled_months >= ${months})${namedSector ? ` & (sector == "${namedSector}")` : ''}]\n  .sort_values("risk_score", ascending=False)`,
    };
  }

  // TOP_RISK / highest exposure
  if (q.includes('exposure') || q.includes('highest') || q.includes('riskiest') || q.includes('top')) {
    const byExposure = q.includes('exposure');
    const band = q.includes('critical') ? 'CRITICAL' : q.includes('high') ? 'HIGH' : undefined;
    const k = Number.isFinite(num) ? num : 5;
    const hits = all
      .filter((r) => (!band || r.risk_band === band) && (!namedSector || r.sector === namedSector))
      .sort((a, b) => (byExposure ? b.exposure_at_risk_cr - a.exposure_at_risk_cr : b.risk_score - a.risk_score))
      .slice(0, k);
    return {
      intent: 'TOP_RISK', intent_label: byExposure ? 'Highest exposure' : 'Highest risk', understood: true,
      answer: `The ${hits.length} ${band ? `${band.toLowerCase()}-band ` : ''}project${hits.length === 1 ? '' : 's'} with the largest ${byExposure ? 'predicted rupee exposure' : 'risk scores'} account for ${crore(hits.reduce((a, r) => a + r.exposure_at_risk_cr, 0))} of the portfolio's ${crore(all.reduce((a, r) => a + r.exposure_at_risk_cr, 0))} at risk.`,
      metrics: [
        { label: 'Combined exposure', value: crore(hits.reduce((a, r) => a + r.exposure_at_risk_cr, 0)) },
        { label: 'Mean risk score', value: hits.length ? (hits.reduce((a, r) => a + r.risk_score, 0) / hits.length).toFixed(1) : '—' },
      ],
      projects: hits.map(chip),
      filters_applied: [
        ...(band ? [{ field: 'risk_band', op: '=', value: band }] : []),
        ...(namedSector ? [{ field: 'sector', op: '=', value: namedSector }] : []),
        { field: 'order_by', op: '=', value: byExposure ? 'exposure_at_risk_cr desc' : 'risk_score desc' },
      ],
      query_text: `projects${band ? `[risk_band == "${band}"]` : ''}\n  .sort_values("${byExposure ? 'exposure_at_risk_cr' : 'risk_score'}", ascending=False)\n  .head(${k})`,
    };
  }

  // DRIVER_QUERY
  if (q.includes('driver') || q.includes('why') || q.includes('cause') || q.includes('escalation')) {
    const scope = all.filter((r) => !namedSector || r.sector === namedSector);
    const totals = new Map<string, { label: string; total: number }>();
    scope.forEach((r) => r.drivers.forEach((d) => {
      const cur = totals.get(d.feature) ?? { label: d.label, total: 0 };
      cur.total += Math.abs(d.shap);
      totals.set(d.feature, cur);
    }));
    const top = [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    return {
      intent: 'DRIVER_QUERY', intent_label: 'Risk drivers', understood: true,
      answer: `Across ${scope.length} ${namedSector ?? 'monitored'} projects, the largest mean absolute SHAP contributions are ${top.slice(0, 3).map((d) => d.label.toLowerCase()).join(', ')}.`,
      metrics: top.map((d) => ({ label: d.label, value: (d.total / scope.length).toFixed(2) })),
      projects: scope.sort((a, b) => b.risk_score - a.risk_score).slice(0, 5).map(chip),
      filters_applied: namedSector ? [{ field: 'sector', op: '=', value: namedSector }] : [],
      query_text: `shap_values[${namedSector ? `sector == "${namedSector}"` : 'all'}]\n  .abs().mean(axis=0)\n  .sort_values(ascending=False).head(5)`,
    };
  }

  // COMPARE_SECTORS
  if (q.includes('compare') || q.includes('across sector') || q.includes('sectors')) {
    const agg = sectorNames.map((s) => {
      const rs = all.filter((r) => r.sector === s);
      return {
        sector: s, n: rs.length,
        mean: rs.reduce((a, r) => a + r.pred_cost_overrun_pct, 0) / rs.length,
        exposure: rs.reduce((a, r) => a + r.exposure_at_risk_cr, 0),
      };
    }).sort((a, b) => b.mean - a.mean);
    return {
      intent: 'COMPARE_SECTORS', intent_label: 'Sector comparison', understood: true,
      answer: `${agg[0].sector} carries the highest mean predicted cost overrun at ${agg[0].mean.toFixed(1)}%, against ${agg[agg.length - 1].mean.toFixed(1)}% for ${agg[agg.length - 1].sector}. Ranking covers all ${agg.length} monitored sectors.`,
      metrics: agg.slice(0, 6).map((a) => ({ label: a.sector, value: `${a.mean.toFixed(1)}%` })),
      projects: all.filter((r) => r.sector === agg[0].sector).sort((a, b) => b.risk_score - a.risk_score).slice(0, 5).map(chip),
      filters_applied: [{ field: 'group_by', op: '=', value: 'sector' }],
      query_text: 'projects.groupby("sector")["pred_cost_overrun_pct"]\n  .mean().sort_values(ascending=False)',
    };
  }

  // PROJECT_LOOKUP
  const idMatch = question.match(/PRJ-\d{6}/i);
  if (idMatch) {
    const r = BY_ID.get(idMatch[0].toUpperCase());
    if (r) {
      return {
        intent: 'PROJECT_LOOKUP', intent_label: 'Project lookup', understood: true,
        answer: `${r.project_name} (${r.sector}, ${r.state}) scores ${r.risk_score} — ${r.risk_band} band. The model predicts a ${r.pred_cost_overrun_pct}% cost overrun and ${r.pred_delay_months} months of delay, with ${crore(r.exposure_at_risk_cr)} at risk.`,
        metrics: [
          { label: 'Risk score', value: String(r.risk_score) },
          { label: 'Predicted overrun', value: `${r.pred_cost_overrun_pct}%` },
          { label: 'Predicted delay', value: `${r.pred_delay_months} mo` },
          { label: 'Physical progress', value: `${r.physical_progress_pct}%` },
        ],
        projects: [chip(r)],
        filters_applied: [{ field: 'project_id', op: '=', value: r.project_id }],
        query_text: `projects[project_id == "${r.project_id}"]`,
      };
    }
  }

  // SECTOR_SUMMARY / MINISTRY_SUMMARY / COUNT_QUERY
  if (namedSector || q.includes('how many') || q.includes('count')) {
    const scope = all.filter((r) => !namedSector || r.sector === namedSector);
    const crit = scope.filter((r) => r.risk_band === 'CRITICAL');
    return {
      intent: namedSector ? 'SECTOR_SUMMARY' : 'COUNT_QUERY',
      intent_label: namedSector ? 'Sector summary' : 'Portfolio count', understood: true,
      answer: `${scope.length} ${namedSector ?? 'monitored'} projects are under monitoring, of which ${crit.length} are in the CRITICAL band. Combined revised cost is ${crore(scope.reduce((a, r) => a + (r.anticipated_cost_cr ?? r.original_cost_cr), 0))}, with ${crore(scope.reduce((a, r) => a + r.exposure_at_risk_cr, 0))} of predicted exposure.`,
      metrics: [
        { label: 'Projects', value: String(scope.length) },
        { label: 'Critical', value: String(crit.length) },
        { label: 'Revised cost', value: crore(scope.reduce((a, r) => a + (r.anticipated_cost_cr ?? r.original_cost_cr), 0)) },
        { label: 'Exposure at risk', value: crore(scope.reduce((a, r) => a + r.exposure_at_risk_cr, 0)) },
      ],
      projects: crit.sort((a, b) => b.exposure_at_risk_cr - a.exposure_at_risk_cr).slice(0, 6).map(chip),
      filters_applied: namedSector ? [{ field: 'sector', op: '=', value: namedSector }] : [],
      query_text: `projects${namedSector ? `[sector == "${namedSector}"]` : ''}\n  .agg(n="size", critical=("risk_band", lambda s: (s == "CRITICAL").sum()))`,
    };
  }

  return {
    intent: 'FALLBACK', intent_label: 'Not understood', understood: false,
    answer: 'That question is outside what this assistant can answer from the scored portfolio. It runs fixed parameterised queries rather than a generative model, so it will not guess.',
    metrics: [], projects: [], filters_applied: [],
    query_text: '', supported: SUPPORTED,
  };
}

// ---------- router ----------
export function mockRequest<T>(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>): Promise<T> {
  const seg = path.split('/').filter(Boolean);

  if (method === 'GET') {
    if (path === '/health') return wait({ ...(healthRaw as Health), projects_ongoing: rows().length } as T);
    if (path === '/portfolio') return wait(buildPortfolio(params as { sector?: string; ministry?: string }) as T);
    if (path === '/watchlist') return wait(buildWatchlist(params ?? {}) as T);
    if (path === '/registry') return wait(registryRaw as unknown as T);
    if (seg[0] === 'projects' && seg[1]) {
      const id = decodeURIComponent(seg[1]);
      try {
        if (seg[2] === 'timeline') return wait(buildTimeline(id) as T);
        if (seg[2] === 'peers') return wait(buildPeers(id) as T);
        if (seg[2] === 'replay') {
          const r = REPLAYS[id];
          if (!r) return Promise.reject(new NotFound(`No replay for ${id}`));
          return wait(r as unknown as T);
        }
        return wait(buildDetail(id) as T);
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }

  if (method === 'POST') {
    if (path === '/upload') {
      const f = (params as unknown as FormData)?.get?.('file') as File | undefined;
      return wait(buildUpload(f?.name ?? 'upload.csv') as T);
    }
    if (path === '/upload/sample') return wait(buildUpload('next_month_2026-05.csv') as T);
    if (path === '/score/run') {
      return new Promise((res) => setTimeout(() => res(runScore((params?.batch_id as string) ?? null) as T), 1400));
    }
    if (path === '/assistant') {
      return new Promise((res) => setTimeout(() => res(runAssistant(String(params?.question ?? '')) as T), 420));
    }
  }

  return Promise.reject(new NotFound(`No fixture for ${method} ${path}`));
}

export const HERO_SUMMARY = Object.values(REPLAYS).map((r) => ({
  project_id: r.project_id, project_name: r.project_name, lead_time_months: r.lead_time_months,
}));
export { SUPPORTED as ASSISTANT_SUGGESTIONS };
