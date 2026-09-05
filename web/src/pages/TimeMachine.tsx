import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProject, useReplay } from '../api/hooks';
import { HERO_SUMMARY } from '../api/mock';
import { RiskTrajectory, TrajectoryLegend } from '../components/charts';
import { ErrorCard, Panel, Skeleton, cx } from '../components/ui';
import { Info, Term } from '../components/Info';
import { BAND, clamp, formatCrore, formatMonth, formatMonths, formatPct } from '../lib/format';

const STEP_MS = 250; // ~4 months per second (§10.2)

/** The stored replays that carry a filed revision date, so a lead time is measurable. */
const MEASURED_CASES = HERO_SUMMARY.filter((h) => h.lead_time_months !== null);

export default function TimeMachine() {
  const { id = '' } = useParams();
  const { data, isLoading, isError, error, refetch } = useReplay(id);
  const project = useProject(id);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>();

  const last = (data?.points.length ?? 1) - 1;

  useEffect(() => {
    if (!playing || !data) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= last) {
          setPlaying(false);
          return last;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer.current);
  }, [playing, data, last]);

  // Land on the completed replay. An empty chart is a terrible first
  // impression for the screen the whole submission rests on, and the presenter
  // gets a better narration by showing the finding, then rewinding to earn it.
  useEffect(() => { setPlaying(false); setIndex(data ? data.points.length - 1 : 0); }, [id, data]);

  const restart = () => { setIndex(0); setPlaying(true); };
  const toggle = () => (index >= last ? restart() : setPlaying((p) => !p));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!data) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') setIndex((i) => clamp(i + 1, 0, last));
      if (e.code === 'ArrowLeft') setIndex((i) => clamp(i - 1, 0, last));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-72" />
        <div className="panel p-5"><Skeleton className="h-[268px]" /></div>
      </div>
    );
  }

  if (isError) {
    const status = (error as { status?: number })?.status;
    /*
     * Not an error state. Replay is precomputed, so most projects simply do not
     * have one — which is a fact about this prototype's scope, not a failure.
     * It is presented as a choice of what to replay, keeping the project the
     * user came from named and one click away.
     */
    if (status === 404) return <ReplayUnavailable id={id} name={project.data?.project.project_name} />;
    return <ErrorCard error={error} retry={() => refetch()} context="The replay" />;
  }

  if (!data) return null;

  const cur = data.points[clamp(index, 0, last)];
  const crossed = cur.risk_score >= data.alert_threshold;
  const band = cur.risk_score >= 70 ? 'CRITICAL' : cur.risk_score >= 55 ? 'HIGH' : cur.risk_score >= 35 ? 'WATCH' : 'LOW';
  const alertIdx = data.points.findIndex((p) => p.as_of_month === data.model_alert_month);
  const officialIdx = data.points.findIndex((p) => p.as_of_month === data.official_event_month);
  const revealed = data.lead_time_months !== null && alertIdx >= 0 && officialIdx >= 0 && index >= officialIdx;
  /*
   * Three genuinely different states hide behind "no lead time on screen", and
   * collapsing them is how a reconstruction that DID cross the threshold ends up
   * captioned "never crosses" — the opposite of what happened.
   */
  const state = revealed ? 'measured'
    : alertIdx < 0 ? 'never-crossed'
      : data.official_event_month === null ? 'no-filed-revision'
        : 'rewound';

  return (
    <div className="fade-in">
      {/* ------------------------------------------------------------ header */}
      <header className="flex items-start justify-between gap-8 pb-3 mb-3 border-b border-line">
        <div className="min-w-0">
          <Link to={`/project/${id}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 hover:text-accent transition-colors mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {data.project_name}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink">Time Machine</h1>
            <Info terms={['replay', 'masking', 'lead_time']} title="What a replay does" />
            {data.reconstructed && (
              <span className="chip bg-raised border-line text-ink-3 gap-1">
                Reconstructed live
                <Info
                  title="What “reconstructed live” means"
                  terms={['replay', 'masking']}
                  label="What reconstructed live means"
                >
                  <p>
                    This trajectory was rebuilt on demand from this project’s own filed monthly
                    series. The threshold crossing below is real. What it has no comparison against
                    is a filed revision date — that is not in the snapshot data, so no lead time is
                    claimed for this project.
                  </p>
                </Info>
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-ink-2 mt-1 leading-relaxed">
            Re-scoring the project at every past monitoring month, with everything after that month hidden.
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="eyebrow mb-1">Replaying</div>
          <div className="num text-md font-semibold text-ink">{data.points.length} monitoring months</div>
          <div className="num text-2xs text-ink-3 mt-0.5">
            {formatMonth(data.points[0].as_of_month)} — {formatMonth(data.points[last].as_of_month)}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_296px] gap-5 items-start">
        {/* ------------------------------------------------------- trajectory */}
        <div className="space-y-3">
          <Panel className="pt-3.5 px-5 pb-4" tour="replay-chart">
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold text-ink">Reconstructed risk trajectory</h2>
                <Info terms={['replay', 'masking', 'risk_score', 'alert_threshold']} title="Reading this chart" />
              </div>
              <TrajectoryLegend replay={data} />
            </div>

            <RiskTrajectory replay={data} index={index} height={252} />

            {/* ------------------------------------------------ transport bar */}
            <div data-tour="replay-transport" className="flex items-center gap-4 mt-4 pt-3.5 border-t border-line">
              <button
                onClick={toggle}
                className={cx('btn h-9 px-3.5 shrink-0 w-[168px] whitespace-nowrap', playing ? 'btn-ghost' : 'btn-primary')}
              >
                {playing ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>Pause</>
                ) : index >= last ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4" /></svg>Replay from start</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 001.5.9l10-6.5a1 1 0 000-1.8l-10-6.5A1 1 0 008 5.5z" /></svg>Resume</>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <input
                  type="range" min={0} max={last} value={index}
                  onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
                  className="w-full accent-[#1B3F73] cursor-pointer"
                  aria-label="Monitoring month"
                />
                <div className="flex justify-between num text-2xs text-ink-3 mt-1">
                  <span>{formatMonth(data.points[0].as_of_month)}</span>
                  <span>drag to rewind · space to play</span>
                  <span>{formatMonth(data.points[last].as_of_month)}</span>
                </div>
              </div>

              <div className="text-right shrink-0 w-[136px]">
                <div className="eyebrow mb-0.5">Viewing</div>
                <div className="num text-md font-semibold text-ink leading-none">{formatMonth(cur.as_of_month)}</div>
                <div className="num text-2xs text-ink-3 mt-1 whitespace-nowrap">
                  month {cur.elapsed_months} · {(cur.elapsed_fraction * 100).toFixed(0)}% elapsed
                </div>
              </div>
            </div>
          </Panel>

          {/* ------------------------------------------------ the finding ---- */}
          {revealed ? (
            <Panel className="emph finding-band" tour="replay-finding">
              <div className="flex items-center gap-7">
                <div className="shrink-0">
                  <div className="num text-4xl font-semibold tracking-[-0.035em] text-accent leading-none">
                    {data.lead_time_months}
                  </div>
                  <div className="text-2xs font-bold uppercase tracking-[0.1em] text-accent mt-1.5 flex items-center gap-1.5">
                    months of <Term k="lead_time">early warning</Term>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-5 border-l border-accent-line pl-7">
                  <Finding
                    tone="accent"
                    kind="Model alert"
                    month={formatMonth(data.model_alert_month)}
                    detail={`Reconstructed risk score crossed the ${data.alert_threshold}-point alert threshold, using only data filed up to that month.`}
                  />
                  <Finding
                    tone="critical"
                    kind="Official record"
                    month={formatMonth(data.official_event_month)}
                    detail={data.events.find((e) => e.kind.startsWith('official'))?.detail ?? 'First revision recorded in the monitoring system.'}
                  />
                </div>
              </div>

              <p className="text-[12px] text-ink-2 mt-4 pt-3.5 border-t border-accent-line leading-relaxed">
                <span className="font-semibold text-ink">Retrospective replay.</span> Each point is the model re-scored
                on that month's masked feature vector — not an animation of a fixed curve. The lead time is the gap
                between the model's threshold crossing and the first revision recorded in the monitoring data. No new
                fields were collected; the signal was already present in what was being filed.
              </p>
            </Panel>
          ) : (
            <Panel className="border-dashed">
              {state === 'rewound' && (
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  Rewind past <span className="num font-semibold text-ink">{formatMonth(data.official_event_month)}</span> and
                  the finding is hidden again — the model's alert and the official record are only comparable once the
                  replay has reached both.
                </p>
              )}

              {state === 'never-crossed' && (
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  <span className="font-semibold text-ink">This project never crosses the alert threshold.</span> It is
                  here to show the model discriminates rather than flagging everything — the contrast with a failing
                  project is the point.
                </p>
              )}

              {state === 'no-filed-revision' && (
                <>
                  <p className="text-[13px] text-ink leading-relaxed">
                    <span className="font-semibold">
                      The reconstruction crosses the alert threshold in {formatMonth(data.model_alert_month)}
                    </span>{' '}
                    — <span className="num font-semibold">{last - alertIdx}</span> monitoring months before the end of
                    this project's record, using only what had been filed by that month.
                  </p>
                  <p className="text-[12.5px] text-ink-2 leading-relaxed mt-2">
                    No <em>lead time</em> is stated here, because lead time is measured against the month an official
                    revision was filed and the snapshot data does not carry that date for this project. Claiming one
                    would be inventing the number the whole system rests on.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3 border-t border-line">
                    <span className="text-[12.5px] text-ink-2">Cases where the revision date is on record:</span>
                    {MEASURED_CASES.map((h) => (
                      <Link key={h.project_id} to={`/project/${h.project_id}/replay`} className="btn btn-ghost h-[26px] px-2.5">
                        {h.project_name.length > 26 ? `${h.project_name.slice(0, 26)}…` : h.project_name}
                        <span className="num font-bold text-accent">{h.lead_time_months} mo</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          )}
        </div>

        {/* ------------------------------------------- state at selected month */}
        <div className="space-y-4 sticky top-0">
          <Panel>
            <div className="flex items-baseline justify-between mb-3">
              <span className="eyebrow flex items-center gap-1.5">
                Model state at
                <Info terms={['physical_progress', 'financial_progress', 'spend_gap', 'shap']} title="Terms in this panel" />
              </span>
              <span className="num text-[12.5px] font-semibold text-ink">{formatMonth(cur.as_of_month)}</span>
            </div>

            <div className="flex items-end justify-between pb-3 mb-3 border-b border-line-faint">
              <div>
                <div className="eyebrow mb-1">Risk score</div>
                <div
                  className="num text-3xl font-semibold tracking-[-0.03em] leading-none transition-colors duration-300"
                  style={{ color: BAND[band].hex }}
                >
                  {cur.risk_score.toFixed(1)}
                </div>
              </div>
              <span className={cx('chip', BAND[band].bg, BAND[band].fg, BAND[band].border)}>
                {crossed ? 'Above threshold' : BAND[band].label}
              </span>
            </div>

            <dl className="space-y-2.5">
              <Row label="Physical progress" value={`${cur.physical_progress_pct.toFixed(1)}%`} />
              <Row label="Financial progress" value={`${cur.financial_progress_pct.toFixed(1)}%`} />
              <Row
                label="Spend-to-work gap"
                value={`${(cur.financial_progress_pct - cur.physical_progress_pct).toFixed(1)} pp`}
                strong={cur.financial_progress_pct - cur.physical_progress_pct >= 10}
              />
              <Row label="Predicted overrun" value={formatPct(cur.pred_cost_overrun_pct, 1, true)} />
              <Row label="Predicted delay" value={formatMonths(cur.pred_delay_months, 1, true)} />
            </dl>

            {cur.top_driver && (
              <div className="mt-3.5 pt-3 border-t border-line-faint">
                <div className="eyebrow mb-1.5">Leading driver this month</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">{cur.top_driver.label}</span>
                  <span className="num text-[12px] font-bold text-risk-critical">+{cur.top_driver.shap.toFixed(1)}</span>
                </div>
                <p className="text-[12px] text-ink-2 mt-1 leading-snug">{cur.top_driver.text}</p>
              </div>
            )}
          </Panel>

          {/* ---- outcome, only for projects that have actually finished ---- */}
          {data.outcome_known && (
            <Panel>
              <div className="eyebrow mb-2.5">Verified outcome</div>
              <p className="text-[12px] text-ink-2 mb-3 leading-relaxed">
                This project has completed, so the prediction can be checked against what actually happened.
              </p>
              <dl className="space-y-2.5">
                <Row label="Final cost overrun" value={formatPct(data.actual_cost_overrun_pct, 1, true)} strong />
                <Row label="Final delay" value={formatMonths(data.actual_delay_months, 0, true)} strong />
              </dl>
            </Panel>
          )}

          {project.data && (
            <Panel>
              <div className="eyebrow mb-2.5">Current filing</div>
              <dl className="space-y-2.5">
                <Row label="Sanctioned cost" value={formatCrore(project.data.project.original_cost_cr)} />
                <Row label="Anticipated cost" value={formatCrore(project.data.project.anticipated_cost_cr ?? project.data.project.original_cost_cr)} />
                <Row label="Exposure at risk" value={formatCrore(project.data.prediction.exposure_at_risk_cr)} />
              </dl>
              <Link to={`/project/${id}`} className="btn btn-ghost w-full mt-3">Back to project detail</Link>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when a project has no precomputed replay. Deliberately not an error
 * card: it states the scope honestly, explains what a replay is, and offers the
 * projects that have one — with their lead times, which is the thing worth
 * clicking through for.
 */
function ReplayUnavailable({ id, name }: { id: string; name?: string }) {
  return (
    <div className="fade-in max-w-3xl">
      <header className="pb-4 mb-5 border-b border-line">
        <Link
          to={`/project/${id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 hover:text-accent transition-colors mb-2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {name ?? id}
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink">Time Machine</h1>
          <Info terms={['replay', 'masking', 'lead_time']} title="What a replay does" />
        </div>
        <p className="text-[13px] text-ink-2 mt-1">
          Re-scoring a project at every past monitoring month, with everything after that month hidden.
        </p>
      </header>

      <Panel className="border-dashed">
        <p className="text-[13px] text-ink leading-relaxed">
          <span className="font-semibold">No replay is stored for {name ?? id}.</span> Reconstructing one means
          re-running the model once per historical month against a rebuilt feature vector — too slow to do live, so
          the prototype ships four of them precomputed.
        </p>
        <p className="text-[12.5px] text-ink-2 leading-relaxed mt-2.5">
          In production this runs as part of the monthly scoring job, and every monitored project has one.
        </p>
      </Panel>

      <div className="eyebrow mt-5 mb-2">Replays available now</div>
      <ul className="panel divide-y divide-line-faint">
        {HERO_SUMMARY.map((h) => (
          <li key={h.project_id}>
            <Link
              to={`/project/${h.project_id}/replay`}
              className="group flex items-center gap-4 px-4 py-3 hover:bg-accent-soft/60 transition-colors duration-150"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink group-hover:text-accent transition-colors">
                  {h.project_name}
                </span>
                <span className="num block text-2xs text-ink-3 mt-px">{h.project_id}</span>
              </span>
              {h.lead_time_months !== null ? (
                <span className="text-right shrink-0">
                  <span className="num block text-md font-semibold text-accent leading-none">
                    {h.lead_time_months} mo
                  </span>
                  <span className="block text-2xs text-ink-3 mt-1">early warning</span>
                </span>
              ) : (
                <span className="text-2xs text-ink-3 shrink-0 max-w-[150px] text-right leading-snug">
                  never crosses the alert threshold
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 text-accent opacity-0 -translate-x-1 transition-all duration-150
                           group-hover:opacity-100 group-hover:translate-x-0">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className={cx('num text-[12.5px] tabular-nums', strong ? 'font-bold text-ink' : 'font-semibold text-ink')}>
        {value}
      </dd>
    </div>
  );
}

function Finding({ tone, kind, month, detail }: {
  tone: 'accent' | 'critical'; kind: string; month: string; detail: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cx('w-1.5 h-1.5 rounded-full', tone === 'accent' ? 'bg-accent' : 'bg-risk-critical')} />
        <span className={cx('text-2xs font-bold uppercase tracking-[0.07em]', tone === 'accent' ? 'text-accent' : 'text-risk-critical')}>
          {kind}
        </span>
      </div>
      <div className="num text-md font-semibold text-ink leading-none mb-1.5">{month}</div>
      <p className="text-[12px] text-ink-2 leading-snug">{detail}</p>
    </div>
  );
}
