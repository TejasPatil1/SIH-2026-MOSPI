// Wire types for the PEWS API (§13). These mirror the FastAPI response models.
// Nothing in the UI may invent a field that does not exist here.

export type RiskBand = 'LOW' | 'WATCH' | 'HIGH' | 'CRITICAL';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Health {
  status: 'ok' | 'degraded';
  model_version: string;
  models_loaded: boolean;
  data_source: 'live' | 'cached' | 'fixture';
  projects_ongoing: number;
  snapshot_rows: number;
  scored_at: string;
}

export interface PortfolioKpis {
  projects_monitored: number;
  ministries: number;
  sectors: number;
  original_cost_cr: number;
  revised_cost_cr: number;
  overrun_cr: number;
  overrun_pct: number;
  expenditure_cr: number;
  expenditure_pct_of_revised: number;
  critical_count: number;
  exposure_at_risk_cr: number;
}

export interface BandCount {
  band: RiskBand;
  count: number;
  exposure_cr: number;
}

export interface SectorRow {
  sector: string;
  projects: number;
  revised_cost_cr: number;
  exposure_at_risk_cr: number;
  mean_risk: number;
  bands: Record<RiskBand, number>;
}

export interface GlobalDriver {
  feature: string;
  label: string;
  mean_abs_shap: number;
  direction: 'increases' | 'decreases';
  group: 'C' | 'D' | 'E';
}

export interface Portfolio {
  kpis: PortfolioKpis;
  bands: BandCount[];
  sectors: SectorRow[];
  ministries: string[];
  drivers: GlobalDriver[];
}

export interface WatchlistRow {
  rank: number;
  project_id: string;
  project_name: string;
  sector: string;
  ministry: string;
  state: string;
  original_cost_cr: number;
  physical_progress_pct: number;
  risk_score: number;
  risk_band: RiskBand;
  pred_cost_overrun_pct: number;
  pred_delay_months: number;
  exposure_at_risk_cr: number;
  alert_count: number;
  stalled_months: number;
  /**
   * Highest-contributing feature for this project, in plain language. A
   * projection of the same SHAP values the detail screen renders — so the
   * queue states its own reasons instead of being a bare scoreboard.
   */
  top_driver: { label: string; text: string } | null;
}

export interface Watchlist {
  rows: WatchlistRow[];
  total_matched: number;
  weighted_by_exposure: boolean;
}

export interface Interval {
  point: number;
  p10: number;
  p50: number;
  p90: number;
  prob: number;
}

export interface Driver {
  feature: string;
  label: string;
  value: number;
  shap: number;
  text: string;
}

export interface Alert {
  rule_id: string;
  severity: Severity;
  title: string;
  message: string;
  evidence: string;
}

export interface Prediction {
  as_of_month: string;
  cost: Interval;
  time: Interval;
  risk_score: number;
  risk_band: RiskBand;
  exposure_at_risk_cr: number;
  drivers: Driver[];
  base_risk: number;
}

export interface ProjectMeta {
  project_id: string;
  project_name: string;
  ministry: string;
  sector: string;
  state: string;
  implementing_agency: string;
  funding_mode: string | null;
  sanction_date: string;
  original_cost_cr: number;
  anticipated_cost_cr: number | null;
  original_commissioning_date: string;
  anticipated_commissioning_date: string | null;
  project_status: string;
  expenditure_cr: number;
  physical_progress_pct: number;
  reason_for_delay: string | null;
  last_updated_month: string;
  months_since_update: number;
}

export interface ProjectDetail {
  project: ProjectMeta;
  prediction: Prediction;
  alerts: Alert[];
  has_replay: boolean;
  data_quality: 'ok' | 'stale' | 'insufficient';
}

export interface TimelinePoint {
  snapshot_month: string;
  physical_progress_pct: number;
  financial_progress_pct: number;
  expenditure_cr: number;
  is_stalled: boolean;
  reason_for_delay: string | null;
}

export interface Timeline {
  project_id: string;
  points: TimelinePoint[];
  stall_windows: { from: string; to: string; months: number }[];
  divergence_onset_month: string | null;
}

export interface ReplayPoint {
  as_of_month: string;
  elapsed_months: number;
  elapsed_fraction: number;
  risk_score: number;
  pred_cost_overrun_pct: number;
  pred_delay_months: number;
  physical_progress_pct: number;
  financial_progress_pct: number;
  top_driver: { label: string; shap: number; text: string } | null;
}

export interface ReplayEvent {
  kind: 'model_alert' | 'official_cost_revision' | 'official_date_revision' | 'completion';
  month: string;
  label: string;
  detail: string;
}

export interface Replay {
  project_id: string;
  project_name: string;
  alert_threshold: number;
  points: ReplayPoint[];
  events: ReplayEvent[];
  model_alert_month: string | null;
  official_event_month: string | null;
  lead_time_months: number | null;
  outcome_known: boolean;
  actual_cost_overrun_pct: number | null;
  actual_delay_months: number | null;
  /**
   * True when the trajectory was reconstructed on demand from the project's own
   * filed monthly series rather than read from a precomputed replay. A
   * reconstructed replay has a real threshold crossing but no filed-revision
   * date to measure lead time against, so `official_event_month` and
   * `lead_time_months` are null and the screen says so rather than implying the
   * project never crossed.
   */
  reconstructed: boolean;
}

export interface PeerBar {
  metric: string;
  label: string;
  value: number;
  percentile: number;
  cohort_median: number;
  unit: string;
}

export interface Peers {
  cohort: string;
  cohort_n: number;
  bars: PeerBar[];
}

export interface BaselineRow {
  model: string;
  family: 'naive' | 'statistical' | 'survival' | 'ml';
  pr_auc: number;
  roc_auc: number;
  brier: number;
  mae_cost_pp: number;
  mae_delay_months: number;
  is_primary: boolean;
}

export interface AblationRow {
  config: string;
  label: string;
  description: string;
  n_features: number;
  pr_auc: number;
  delta_vs_prev: number;
  pct_of_full: number;
}

export interface StageRow {
  stage: string;
  elapsed_range: string;
  pr_auc: number;
  roc_auc: number;
  mae_cost_pp: number;
  n_projects: number;
}

export interface Registry {
  model_version: string;
  trained_at: string;
  n_projects: number;
  n_snapshot_rows: number;
  n_features: number;
  split: { train: number; valid: number; test: number; strategy: string };
  baselines: BaselineRow[];
  ablation: AblationRow[];
  calibration: { bin: number; predicted: number; observed: number; n: number }[];
  lead_time: { months: number; count: number }[];
  lead_time_median: number;
  lead_time_p25: number;
  lead_time_p75: number;
  by_stage: StageRow[];
  leakage_tests: { name: string; description: string; passed: boolean; value: string }[];
  limitations: string[];
}

export interface UploadIssue {
  row: number;
  project_id: string | null;
  field: string;
  message: string;
}

export interface UploadResult {
  filename: string;
  rows_read: number;
  accepted: number;
  rejected: number;
  issues: UploadIssue[];
  snapshot_month: string | null;
  batch_id: string;
}

export interface BandTransition {
  project_id: string;
  project_name: string;
  sector: string;
  from_band: RiskBand;
  to_band: RiskBand;
  risk_before: number;
  risk_after: number;
  exposure_at_risk_cr: number;
}

export interface ScoreRunResult {
  batch_id: string | null;
  scored: number;
  duration_ms: number;
  entered_critical: number;
  exited_critical: number;
  transitions: BandTransition[];
  band_counts_before: Record<RiskBand, number>;
  band_counts_after: Record<RiskBand, number>;
}

export interface AssistantAnswer {
  intent: string;
  intent_label: string;
  understood: boolean;
  answer: string;
  metrics: { label: string; value: string }[];
  projects: { project_id: string; project_name: string; sector: string; risk_score: number; risk_band: RiskBand }[];
  filters_applied: { field: string; op: string; value: string }[];
  query_text: string;
  supported?: string[];
}
