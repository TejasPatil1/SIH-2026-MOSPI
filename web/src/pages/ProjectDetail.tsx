import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePeers, useProject, useTimeline } from '../api/hooks';
import {
  ContributionBars, DivergenceChart, DivergenceLegend, RangeBar, RiskGauge,
} from '../components/charts';
import {
  Disclosure, EmptyState, ErrorCard, Panel, Section, SeverityDot, Skeleton, cx,
} from '../components/ui';
import { BAND, clamp, formatCount, formatCrore, formatMonth, formatMonths, formatPct } from '../lib/format';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError, error, refetch } = useProject(id);
  const timeline = useTimeline(id);
  const peers = usePeers(id);

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      return (
        <EmptyState
          icon="search"
          title={`No project matching ${id}`}
          message="This identifier is not in the monitored portfolio. It may have been completed and archived, or the identifier may be mistyped."
          action={<Link to="/watchlist" className="btn btn-primary">Back to watchlist</Link>}
        />
      );
    }
    return <ErrorCard error={error} retry={() => refetch()} context="This project" />;
  }

  if (!data) return null;

  const { project: p, prediction: pred, alerts } = data;
  const gap = p.physical_progress_pct !== null
    ? (p.expenditure_cr / (p.anticipated_cost_cr ?? p.original_cost_cr)) * 100 - p.physical_progress_pct
    : 0;

  return (
    <div className="fade-in">
      {/* ------------------------------------------------------------ header */}
      <header className="pb-4 mb-5 border-b border-line">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="eyebrow text-accent">{p.sector}</span>
              <span className="text-ink-4">·</span>
              <span className="num text-2xs font-semibold tracking-[0.06em] text-ink-3">{p.project_id}</span>
              {data.data_quality !== 'ok' && (
                <span className="chip bg-riskbg-watch text-risk-watch border-risk-watch/25">
                  {data.data_quality === 'insufficient' ? 'Insufficient recent data' : 'Stale data'}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink">{p.project_name}</h1>
            <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-[12.5px]">
              <Meta label="Ministry" value={p.ministry.replace(/^Ministry of |^Department of /, '')} />
              <Meta label="Agency" value={p.implementing_agency} />
              <Meta label="State" value={p.state} />
              <Meta label="Funding" value={p.funding_mode ?? '—'} />
              <Meta label="Sanctioned" value={formatMonth(p.sanction_date)} />
              <Meta label="Original completion" value={formatMonth(p.original_commissioning_date)} />
              {p.anticipated_commissioning_date && (
                <Meta label="Revised completion" value={formatMonth(p.anticipated_commissioning_date)} tone="critical" />
              )}
            </dl>
          </div>

          <div className="flex items-start gap-7 shrink-0">
            <div className="text-right">
              <div className="eyebrow mb-1.5">Projected cost overrun</div>
              <div className="num text-2xl font-semibold tracking-[-0.025em] leading-none text-ink">
                {formatPct(pred.cost.point, 1, true)}
              </div>
              <div className="eyebrow mt-4 mb-1.5">Projected delay</div>
              <div className="num text-2xl font-semibold tracking-[-0.025em] leading-none text-ink">
                {formatMonths(pred.time.point, 1, true)}
              </div>
            </div>
            <RiskGauge score={pred.risk_score} band={pred.risk_band} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-6 text-[12.5px]">
            <Stat label="Sanctioned cost" value={formatCrore(p.original_cost_cr)} />
            <Stat label="Anticipated cost" value={formatCrore(p.anticipated_cost_cr ?? p.original_cost_cr)}
              tone={(p.anticipated_cost_cr ?? 0) > p.original_cost_cr ? 'critical' : undefined} />
            <Stat label="Spent to date" value={formatCrore(p.expenditure_cr)} />
            <Stat label="Physical progress" value={`${p.physical_progress_pct.toFixed(0)}%`} />
            <Stat label="Spend-to-work gap" value={`${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`}
              tone={gap >= 12 ? 'critical' : undefined} />
            <Stat label="Exposure at risk" value={formatCrore(pred.exposure_at_risk_cr)} tone="critical" />
          </div>

          <button
            className="btn btn-primary h-9 px-4"
            onClick={() => nav(`/project/${p.project_id}/replay`)}
            disabled={!data.has_replay}
            title={data.has_replay ? undefined : 'Historical replay is available for the curated demo projects'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4" />
            </svg>
            Open Time Machine
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- body */}
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5">
          <Section
            title="Expenditure against physical progress"
            note="the divergence between the two is the primary early-warning signal"
            actions={<DivergenceLegend />}
          >
            <Panel>
              {timeline.isLoading && <Skeleton className="h-[260px]" />}
              {timeline.isError && <ErrorCard error={timeline.error} retry={() => timeline.refetch()} context="The monitoring history" />}
              {timeline.data && (
                <>
                  <DivergenceChart timeline={timeline.data} />
                  {gap >= 8 && (
                    <p className="text-[12.5px] text-ink-2 mt-3 pt-3 border-t border-line-faint leading-relaxed">
                      Financial progress leads physical progress by{' '}
                      <span className="num font-semibold text-ink">{gap.toFixed(1)} percentage points</span>
                      {timeline.data.divergence_onset_month && (
                        <> — a gap that opened in <span className="font-semibold text-ink">{formatMonth(timeline.data.divergence_onset_month)}</span></>
                      )}
                      {timeline.data.stall_windows[0] && (
                        <> and coincides with a <span className="num font-semibold text-ink">{timeline.data.stall_windows[0].months}-month</span> run of no measurable physical progress</>
                      )}
                      . Money is moving; work is not.
                    </p>
                  )}
                </>
              )}
            </Panel>
          </Section>

          <Section title="Fired alert rules" note={`${alerts.length} of 8 deterministic rules triggered`}>
            <Panel pad={false}>
              {alerts.length === 0 ? (
                <div className="px-4 py-7 text-center">
                  <p className="text-[13px] font-medium text-ink">No rules fired</p>
                  <p className="text-[12.5px] text-ink-2 mt-1">
                    This project clears all eight deterministic monitoring rules for the current cycle.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line-faint">
                  {alerts.map((a) => (
                    <li key={a.rule_id} className="px-4 py-3 flex items-start gap-4">
                      <div className="w-[74px] shrink-0 pt-px">
                        <SeverityDot severity={a.severity} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[12.5px] font-semibold text-ink">{a.title}</span>
                          <span className="num text-2xs text-ink-4 tracking-[0.04em]">{a.rule_id}</span>
                        </div>
                        <p className="text-[12.5px] text-ink-2 mt-0.5 leading-snug">{a.message}</p>
                      </div>
                      <span className="num text-[12px] text-ink-2 shrink-0 max-w-[200px] text-right">{a.evidence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Section>
        </div>

        {/* ------------------------------------------------------ right rail */}
        <div className="space-y-5">
          <Section title="Model forecast" note={`as of ${formatMonth(pred.as_of_month)}`}>
            <Panel>
              <div className="eyebrow mb-1.5">Cost overrun</div>
              <div className="flex items-baseline justify-between">
                <span className="num text-2xl font-semibold tracking-[-0.025em] text-ink">
                  {formatPct(pred.cost.point, 1, true)}
                </span>
                <span className="num text-[12px] text-ink-2">
                  P(&gt;10% overrun) <span className="font-bold text-ink">{(pred.cost.prob * 100).toFixed(0)}%</span>
                </span>
              </div>
              <RangeBar
                p10={pred.cost.p10} p50={pred.cost.p50} p90={pred.cost.p90} point={pred.cost.point}
                unit="%" domain={[Math.min(pred.cost.p10, 0) - 2, pred.cost.p90 + 4]}
              />

              <div className="eyebrow mb-1.5 mt-5 pt-4 border-t border-line-faint">Expected delay</div>
              <div className="flex items-baseline justify-between">
                <span className="num text-2xl font-semibold tracking-[-0.025em] text-ink">
                  {formatMonths(pred.time.point, 1, true)}
                </span>
                <span className="num text-[12px] text-ink-2">
                  P(&gt;6 mo delay) <span className="font-bold text-ink">{(pred.time.prob * 100).toFixed(0)}%</span>
                </span>
              </div>
              <RangeBar
                p10={pred.time.p10} p50={pred.time.p50} p90={pred.time.p90} point={pred.time.point}
                unit="months" domain={[0, pred.time.p90 + 3]}
              />

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
                <div>
                  <div className="eyebrow mb-1">Composite risk</div>
                  <div className="num text-lg font-semibold" style={{ color: BAND[pred.risk_band].hex }}>
                    {pred.risk_score.toFixed(1)}
                    <span className="text-[11px] font-bold uppercase tracking-[0.07em] ml-1.5">
                      {BAND[pred.risk_band].label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="eyebrow mb-1">Exposure at risk</div>
                  <div className="num text-lg font-semibold text-ink">{formatCrore(pred.exposure_at_risk_cr)}</div>
                </div>
              </div>

              <p className="text-2xs text-ink-3 mt-3 leading-relaxed">
                Quantile heads are trained separately at α = 0.1 / 0.5 / 0.9; classifier probabilities are
                isotonically calibrated. The interval is the model's honest uncertainty, not a confidence display.
              </p>
            </Panel>
          </Section>

          <Section title={`Why this project is ${BAND[pred.risk_band].label.toLowerCase()} risk`} note="TreeSHAP contributions">
            <Panel>
              <ContributionBars drivers={pred.drivers} baseRisk={pred.base_risk} riskScore={pred.risk_score} />
              <Disclosure summary="How this explanation was produced">
                <p className="text-[12px] text-ink-2 leading-relaxed">
                  Values are per-feature SHAP contributions from <code className="text-ink font-medium">TreeExplainer</code>{' '}
                  on the trained LightGBM classifier, computed against the portfolio base rate. They are additive:
                  base rate plus every contribution reconstructs the composite risk score exactly.
                </p>
              </Disclosure>
            </Panel>
          </Section>

          {peers.data && (
            <Section title="Peer comparison" note={`${formatCount(peers.data.cohort_n)} projects · ${peers.data.cohort}`}>
              <Panel>
                <div className="space-y-3">
                  {peers.data.bars.map((b) => (
                    <div key={b.metric}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[12px] text-ink-2">{b.label}</span>
                        <span className="num text-[12px]">
                          <span className="font-semibold text-ink">{b.value}{b.unit}</span>
                          <span className="text-ink-3"> vs {b.cohort_median}{b.unit} median</span>
                        </span>
                      </div>
                      <div className="relative h-[6px] rounded-full bg-line-faint overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                          style={{
                            width: `${clamp(b.percentile, 2, 100)}%`,
                            background: b.percentile >= 80 ? '#DC2626' : b.percentile >= 55 ? '#CA8A04' : '#1B3F73',
                          }}
                        />
                      </div>
                      <div className="num text-2xs text-ink-3 mt-1">{b.percentile}th percentile in cohort</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

const Meta = ({ label, value, tone }: { label: string; value: string; tone?: 'critical' }) => (
  <div className="flex items-baseline gap-1.5">
    <dt className="text-ink-3">{label}</dt>
    <dd className={cx('font-medium', tone === 'critical' ? 'text-risk-critical' : 'text-ink-2')}>{value}</dd>
  </div>
);

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'critical' }) => (
  <div>
    <div className="eyebrow mb-0.5">{label}</div>
    <div className={cx('num font-semibold', tone === 'critical' ? 'text-risk-critical' : 'text-ink')}>{value}</div>
  </div>
);

function DetailSkeleton() {
  return (
    <div>
      <div className="pb-4 mb-5 border-b border-line flex justify-between gap-8">
        <div className="flex-1">
          <Skeleton className="h-2.5 w-40 mb-3" />
          <Skeleton className="h-6 w-96 mb-3" />
          <Skeleton className="h-2.5 w-[560px]" />
        </div>
        <Skeleton className="w-[104px] h-[104px] rounded-full" />
      </div>
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5">
        <div className="panel p-4"><Skeleton className="h-[260px]" /></div>
        <div className="panel p-4 space-y-3">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-4" />)}
        </div>
      </div>
    </div>
  );
}
