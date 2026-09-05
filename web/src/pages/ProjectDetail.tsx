import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePeers, useProject, useReplay, useTimeline } from '../api/hooks';
import {
  ContributionBars, DivergenceChart, DivergenceLegend, RangeBar, RiskGauge,
} from '../components/charts';
import {
  EmptyState, ErrorCard, Panel, Section, SeverityDot, Skeleton, cx,
} from '../components/ui';
import { Info, Term } from '../components/Info';
import type { Interval, Replay, RiskBand, Timeline } from '../api/types';
import { BAND, clamp, formatCount, formatCrore, formatMonth, formatMonths, formatPct } from '../lib/format';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError, error, refetch } = useProject(id);
  const timeline = useTimeline(id);
  const peers = usePeers(id);
  // Also warms the Time Machine's cache, so the replay opens instantly when the
  // claim below it is clicked.
  const replay = useReplay(id);

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
                <span className="chip bg-riskbg-watch text-risk-watch border-risk-watch/25 gap-1">
                  {data.data_quality === 'insufficient' ? 'Insufficient recent data' : 'Stale data'}
                  <Info terms={['data_quality']} label="What this data flag means" />
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

          {/*
            Only the overall judgement lives here. The cost and delay figures used
            to be repeated in this corner and again in the forecast card a few
            centimetres to the right, which invited the reader to check whether
            the two agreed instead of reading either.
          */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="eyebrow flex items-center gap-1.5">
              Overall risk
              <Info terms={['risk_score', 'risk_band']} label="How the risk score works" />
            </div>
            <RiskGauge score={pred.risk_score} band={pred.risk_band} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-5 text-[12.5px] min-w-0 flex-wrap">
            <Stat label="Sanctioned cost" value={formatCrore(p.original_cost_cr)} />
            <Stat label="Anticipated cost" value={formatCrore(p.anticipated_cost_cr ?? p.original_cost_cr)}
              tone={(p.anticipated_cost_cr ?? 0) > p.original_cost_cr ? 'critical' : undefined} />
            <Stat label="Spent to date" value={formatCrore(p.expenditure_cr)} />
            <Stat label="Physical progress" value={`${p.physical_progress_pct.toFixed(0)}%`} info="physical_progress" />
            <Stat label="Spend-to-work gap" value={`${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`}
              tone={gap >= 12 ? 'critical' : undefined} info="spend_gap" />
          </div>

          {/*
            Navigation phrased as a finding gets clicked; navigation phrased as a
            menu item does not. The number is this project's own, and the button
            falls back to a plain invitation when there is no measured lead time
            rather than inventing one.
          */}
          <TimeMachineCall replay={replay.data} onOpen={() => nav(`/project/${p.project_id}/replay`)} />
        </div>
      </header>

      {/*
        The one thing a reader must leave with, before any chart. Every clause is
        assembled from figures already on this screen — nothing here is a second
        opinion about the project.
      */}
      <Verdict gap={gap} timeline={timeline.data} prob={pred.cost.prob} band={pred.risk_band}
        exposure={pred.exposure_at_risk_cr}
        driver={pred.drivers.filter((d) => d.shap > 0).sort((a, b) => b.shap - a.shap)[0]} />

      {/* ------------------------------------------------------------- body */}
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5">
          <Section
            title="Expenditure against physical progress"
            info={<Info terms={['physical_progress', 'financial_progress', 'spend_gap', 'stall']} title="Reading this chart" />}
            actions={<DivergenceLegend />}
          >
            <Panel tour="project-divergence">
              {timeline.isLoading && <Skeleton className="h-[260px]" />}
              {timeline.isError && <ErrorCard error={timeline.error} retry={() => timeline.refetch()} context="The monitoring history" />}
              {timeline.data && (
                <>
                  <DivergenceChart timeline={timeline.data} />
                  <p className="text-[12.5px] text-ink-3 mt-3 pt-3 border-t border-line-faint leading-relaxed">
                    The shaded wedge is the gap between the two lines: expenditure recorded against
                    physical work certified. A wedge that keeps widening is the pattern the model
                    weighs most heavily.
                    {timeline.data.divergence_onset_month && (
                      <> The dashed marker is <span className="font-semibold text-ink-2">{formatMonth(timeline.data.divergence_onset_month)}</span>,
                      the month it opened past 8 points and stayed open.</>
                    )}
                  </p>
                </>
              )}
            </Panel>
          </Section>

          <Section
            title="Rule checks that fired"
            note={`${alerts.length} of 8 triggered this cycle`}
            info={<Info terms={['deterministic_rules']} title="What these rules are" />}
          >
            <Panel pad={false}>
              {alerts.length === 0 ? (
                <div className="px-4 py-7 text-center">
                  <p className="text-[13px] font-medium text-ink">No rules fired</p>
                  <p className="text-[12.5px] text-ink-2 mt-1">
                    This project clears all eight monitoring rule checks for the current cycle.
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
          <Section
            title="Model forecast"
            note={`as of ${formatMonth(pred.as_of_month)}`}
            info={
              <Info title="How this forecast is produced" terms={['quantile', 'isotonic', 'prediction_interval']}>
                <p>
                  Three separate models produce the low, middle and high ends of the range. The
                  chance figure comes from a fourth model whose output is corrected against
                  observed frequencies, so a stated 70% means roughly 70 in 100.
                </p>
              </Info>
            }
          >
            <Panel tour="project-forecast" pad={false}>
              <Forecast
                label="Cost overrun"
                iv={pred.cost}
                headline={formatPct(pred.cost.point, 1, true)}
                exceeds="more than 10% over budget"
                domain={[Math.min(pred.cost.p10, 0) - 2, pred.cost.p90 + 4]}
                unit="%"
              />
              <Forecast
                label="Delay"
                iv={pred.time}
                headline={formatMonths(pred.time.point, 1, true)}
                exceeds="more than 6 months late"
                domain={[0, pred.time.p90 + 3]}
                unit="mo"
                divided
              />
            </Panel>
          </Section>

          <Section
            title={`Why this project is ${BAND[pred.risk_band].label.toLowerCase()} risk`}
            note="what pushed the score"
            info={
              <Info title="How this explanation was produced" terms={['shap', 'base_rate', 'gbdt']}>
                <p>
                  Each row is that feature's measured effect on this project's score, taken from
                  the trained model itself rather than from a rule of thumb. Nothing here is
                  written by hand: remove a contribution and the score changes by exactly that
                  much.
                </p>
              </Info>
            }
          >
            <Panel tour="project-shap">
              <ContributionBars drivers={pred.drivers} baseRisk={pred.base_risk} riskScore={pred.risk_score} />
            </Panel>
          </Section>

          {peers.data && (
            <Section
              title="Compared with similar projects"
              info={
                <Info title="Reading this comparison" terms={['cohort', 'median', 'percentile']}>
                  <p>
                    Peers are the projects most like this one — same sector, and within a third to
                    three times its sanctioned cost, because a ₹300 Cr project and a ₹30,000 Cr
                    project do not fail the same way. The bar is this project's rank inside that
                    group; further right is worse.
                  </p>
                </Info>
              }
            >
              <Panel>
                <p className="text-[12px] text-ink-2 leading-relaxed pb-3 mb-3.5 border-b border-line-faint">
                  Measured against{' '}
                  <span className="num font-semibold text-ink">{formatCount(peers.data.cohort_n)}</span>{' '}
                  <Term k="cohort">comparable projects</Term> — {peers.data.cohort}.
                </p>
                <div className="space-y-3.5">
                  {peers.data.bars.map((b) => (
                    <div key={b.metric}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-[12px] text-ink-2 min-w-0 truncate">{b.label}</span>
                        <span className="num text-[12px] shrink-0">
                          <span className="font-semibold text-ink">{b.value}{b.unit}</span>
                          <span className="text-ink-3"> vs {b.cohort_median}{b.unit} typical</span>
                        </span>
                      </div>
                      {/*
                        The bar is the project's rank within the cohort; the tick
                        is the middle of that cohort. Without the tick the reader
                        has a number with nothing to measure it against, which is
                        the whole failure mode of a peer comparison.
                      */}
                      <div className="relative h-[6px] rounded-full bg-line-faint">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                          style={{
                            width: `${clamp(b.percentile, 2, 100)}%`,
                            background: b.percentile >= 80 ? '#DC2626' : b.percentile >= 55 ? '#CA8A04' : '#1B3F73',
                          }}
                        />
                        <span className="absolute top-[-3px] bottom-[-3px] w-px bg-ink-3" style={{ left: '50%' }} />
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-2xs text-ink-3 mt-1">
                        <span>
                          Higher than <span className="num font-semibold text-ink-2">{b.percentile}</span> of every 100
                          comparable projects
                        </span>
                        <span className="shrink-0">tick = cohort middle</span>
                      </div>
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


/* ----------------------------------------------------------------- verdict */

/**
 * "What is happening, and how bad is it" — in one sentence, above everything.
 *
 * It replaced a paragraph that used to sit *under* the divergence chart, where
 * the conclusion arrived after the evidence for it. Everything it says is
 * assembled from values already rendered elsewhere on this screen.
 */
function Verdict({ gap, timeline, prob, band, exposure, driver }: {
  gap: number; timeline?: Timeline; prob: number; band: RiskBand; exposure: number;
  driver?: { label: string; text: string };
}) {
  const stall = timeline?.stall_windows[0];
  const onset = timeline?.divergence_onset_month;
  const diverging = gap >= 8;

  return (
    <div className="panel emph finding-band px-5 py-3.5 mb-5">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5">What is happening</div>
          <p className="text-[15px] text-ink leading-[1.55]">
            {diverging ? (
              <>
                Money is moving; work is not. Expenditure has run{' '}
                <span className="num font-semibold">{gap.toFixed(1)} percentage points</span> ahead of
                certified physical progress
                {onset && <> since <span className="font-semibold">{formatMonth(onset)}</span></>}
                {stall && <>, with no measurable progress for{' '}
                  <span className="num font-semibold">{stall.months}</span>{' '}
                  <Term k="stall">consecutive cycles</Term></>}
                .
              </>
            ) : (
              <>
                Expenditure and physical progress are broadly in step — the{' '}
                <Term k="spend_gap">spend-to-work gap</Term> is{' '}
                <span className="num font-semibold">{gap.toFixed(1)} points</span>. The score below is
                driven by {driver ? driver.label.toLowerCase() : 'other factors'} rather than by divergence.
              </>
            )}
          </p>
          {driver && (
            <p className="text-[12.5px] text-ink-2 leading-snug mt-1.5">
              Largest single contribution to the score: <span className="font-semibold text-ink">{driver.label}</span> — {driver.text}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right pl-5 border-l border-accent-line">
          <div className="eyebrow mb-1 flex items-center justify-end gap-1.5">
            How bad
            <Info terms={['probability', 'calibration']} label="How this chance is produced" />
          </div>
          <div className="num text-2xl font-semibold tracking-[-0.03em] leading-none" style={{ color: BAND[band].hex }}>
            {Math.round(prob * 100)}%
          </div>
          <div className="text-[12px] text-ink-2 mt-1.5 max-w-[186px] leading-snug">
            chance of finishing more than 10% over budget
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-accent-line">
            <div className="num text-md font-semibold text-risk-critical leading-none">{formatCrore(exposure)}</div>
            <div className="text-[11.5px] text-ink-2 mt-1 flex items-center justify-end gap-1.5">
              exposure at risk
              <Info terms={['exposure_at_risk']} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- time machine call */

/**
 * The route into the replay, phrased as this project's own finding when there
 * is one to state, and as a plain invitation when there is not.
 */
function TimeMachineCall({ replay, onOpen }: { replay?: Replay; onOpen: () => void }) {
  const lead = replay?.lead_time_months ?? null;
  return (
    <div className="shrink-0 flex items-center gap-3.5">
      {lead !== null && (
        <p className="text-[12.5px] text-ink-2 leading-snug text-right max-w-[236px] hidden xl:block">
          PEWS crossed its <Term k="alert_threshold">alert threshold</Term>{' '}
          <span className="num font-bold text-accent">{lead} months</span> before this project's first
          official revision.
        </p>
      )}
      <button
        data-tour="open-time-machine"
        className="btn btn-primary h-9 px-4 shrink-0"
        onClick={onOpen}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4" />
        </svg>
        {lead !== null ? 'Replay the reconstruction' : 'Open Time Machine'}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- forecast */

/** "about 7 in every 10" — a frequency people reason about correctly. */
function naturalFrequency(prob: number): string {
  const tenths = Math.round(prob * 10);
  if (tenths >= 1 && tenths <= 9) return `about ${tenths} in every 10`;
  return `about ${Math.round(prob * 100)} in every 100`;
}

/**
 * One forecast, ordered so the three questions are answered top to bottom and
 * never compete: what is predicted, how uncertain it is, how likely it is.
 * The prediction and the probability are deliberately given different visual
 * forms — a marker on a range versus a filled meter — because presenting them
 * as two similar numbers side by side is what made the old card ambiguous.
 */
function Forecast({ label, iv, headline, exceeds, domain, unit, divided }: {
  label: string; iv: Interval; headline: string;
  exceeds: string; domain: [number, number]; unit: string; divided?: boolean;
}) {
  const pct = Math.round(iv.prob * 100);
  return (
    <div className={cx('px-4 py-4', divided && 'border-t border-line')}>
      <div className="eyebrow mb-2">{label}</div>

      {/* 1 — what the model predicts */}
      <div className="flex items-baseline gap-2.5">
        <span className="num text-[27px] font-semibold tracking-[-0.03em] leading-none text-ink">
          {headline}
        </span>
        <span className="text-[12px] text-ink-3">most likely</span>
      </div>

      {/* 2 — how uncertain that is */}
      <div className="mt-3">
        <RangeBar
          p10={iv.p10} p50={iv.p50} p90={iv.p90} point={iv.point}
          unit={unit} domain={domain}
          caption="Where it lands 8 times out of 10"
        />
      </div>

      {/* 3 — how likely the outcome is, in a form that cannot be misread as a size */}
      <div className="mt-3.5 pt-3 border-t border-line-faint">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-ink-2">Chance of ending {exceeds}</span>
          <span className="num text-[15px] font-bold text-ink shrink-0">{pct}%</span>
        </div>
        <div className="relative h-[6px] rounded-full bg-line-faint overflow-hidden mt-1.5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${clamp(pct, 0, 100)}%` }}
          />
        </div>
        <div className="text-2xs text-ink-3 mt-1">
          {naturalFrequency(iv.prob)} projects in this position end up here
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

const Meta = ({ label, value, tone }: { label: string; value: string; tone?: 'critical' }) => (
  <div className="flex items-baseline gap-1.5">
    <dt className="text-ink-3">{label}</dt>
    <dd className={cx('font-medium', tone === 'critical' ? 'text-risk-critical' : 'text-ink-2')}>{value}</dd>
  </div>
);

const Stat = ({ label, value, tone, info }: {
  label: string; value: string; tone?: 'critical';
  info?: 'physical_progress' | 'spend_gap' | 'exposure_at_risk';
}) => (
  <div className="shrink-0">
    <div className="eyebrow mb-0.5 flex items-center gap-1.5 whitespace-nowrap">
      {label}
      {info && <Info terms={[info]} />}
    </div>
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
