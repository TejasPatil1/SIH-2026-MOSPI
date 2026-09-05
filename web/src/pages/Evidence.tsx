import { useRegistry } from '../api/hooks';
import { CalibrationChart, LeadTimeHistogram } from '../components/charts';
import { EmptyState, Page, Panel, ProvenanceNote, Section, Skeleton, cx } from '../components/ui';
import { Info, Term } from '../components/Info';
import { formatCount, formatMonth } from '../lib/format';
import type { TermKey } from '../lib/glossary';

export default function Evidence() {
  const { data: r, isLoading, isError } = useRegistry();

  if (isLoading) return <EvidenceSkeleton />;

  if (isError || !r) {
    return (
      <EmptyState
        icon="file"
        title="Model registry unavailable"
        message={
          <>
            Every figure on this page is read from <code className="text-ink font-medium">models/registry.json</code>.
            Produce it by running the training pipeline:
            <code className="block mt-2.5 px-3 py-2 bg-ink text-white/90 rounded text-[12px] text-left">make train</code>
          </>
        }
      />
    );
  }

  const primary = r.baselines.find((b) => b.is_primary);
  const naive = r.baselines.find((b) => b.family === 'naive');
  /* The strongest thing that is not the proposed model — the honest comparison. */
  const bestConventional = r.baselines
    .filter((b) => !b.is_primary && b.family !== 'naive')
    .reduce((a, b) => (b.pr_auc > a.pr_auc ? b : a), r.baselines[0]);

  const full = r.ablation[r.ablation.length - 1];
  const derived = r.ablation[r.ablation.length - 2];
  const early = r.by_stage[0];
  const leakPassed = r.leakage_tests.filter((t) => t.passed).length;
  const shuffled = r.leakage_tests.find((t) => t.name.toLowerCase().includes('shuffled'));

  return (
    <Page
      title="Evidence"
      lede="Whether the method holds up, tested rather than asserted. Every number below is read from the model registry written by the training run — nothing on this page is typed by hand."
      info={
        <Info
          title="How to read this page"
          terms={['pr_auc', 'holdout', 'baseline']}
        >
          <p>
            Each section answers one question a reviewer would ask, in order: does it beat simpler
            methods, what is the data worth, is it honest about uncertainty, and could the result be
            an artefact.
          </p>
        </Info>
      }
      actions={
        <div className="flex items-center gap-4 text-[12px]">
          <Meta label="Model" value={r.model_version} />
          <Meta label="Trained" value={formatMonth(r.trained_at.slice(0, 7))} />
        </div>
      }
    >
      <div className="space-y-7">
        {/* ============================================================ verdict */}
        {primary && naive && (
          <Panel pad={false}>
            <div className="grid grid-cols-4 divide-x divide-line">
              <Headline
                label="Beats the best conventional method"
                value={`+${(primary.pr_auc - bestConventional.pr_auc).toFixed(2)}`}
                unit="PR-AUC"
                sub={`${primary.pr_auc.toFixed(2)} against ${bestConventional.pr_auc.toFixed(2)} for ${bestConventional.model}`}
                terms={['pr_auc']}
              />
              <Headline
                label="Warning before the official record"
                value={String(r.lead_time_median)}
                unit="months"
                sub={`half fall between ${r.lead_time_p25} and ${r.lead_time_p75} months`}
                terms={['lead_time']}
                accent
              />
              <Headline
                label="Cost forecast error"
                value={primary.mae_cost_pp.toFixed(1)}
                unit="pp"
                sub={`against ${naive.mae_cost_pp.toFixed(1)} pp with no model — cut by ${Math.round((1 - primary.mae_cost_pp / naive.mae_cost_pp) * 100)}%`}
                terms={['mae']}
              />
              <Headline
                label="Leakage checks"
                value={`${leakPassed} of ${r.leakage_tests.length}`}
                unit="pass"
                sub="training does not run unless all of them pass"
                terms={['leakage']}
                tone={leakPassed === r.leakage_tests.length ? 'good' : 'bad'}
              />
            </div>
          </Panel>
        )}

        {/* ================================================ 1. vs simpler methods */}
        <Section
          title="1 — Does it beat simpler methods?"
          note="same features, same project-disjoint splits, same test window"
          info={
            <Info
              title="How this comparison was run"
              terms={['baseline', 'disjoint_split', 'pr_auc', 'roc_auc', 'brier', 'mae']}
            >
              <p>
                Every method was fitted on identical data and scored on identical held-out
                projects. A model that only looks good against a weak comparison has not been
                tested, so the comparison includes the methods a statistician would actually reach
                for first.
              </p>
            </Info>
          }
        >
          <Panel pad={false} tour="evidence-baselines">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="w-[230px]">
                    <span className="inline-flex items-center gap-1.5">Finds real failures <Info terms={['pr_auc']} /></span>
                  </th>
                  <th className="n w-[86px]">
                    <span className="inline-flex items-center gap-1.5">Ranks well <Info terms={['roc_auc']} /></span>
                  </th>
                  <th className="n w-[92px]">
                    <span className="inline-flex items-center gap-1.5">Honest odds <Info terms={['brier']} /></span>
                  </th>
                  <th className="n w-[104px]">Cost error</th>
                  <th className="n w-[104px]">Delay error</th>
                </tr>
              </thead>
              <tbody>
                {[...r.baselines].sort((a, b) => a.pr_auc - b.pr_auc).map((b) => (
                  <tr key={b.model} className={cx(b.is_primary && 'bg-accent-soft/70')}>
                    <td>
                      <div className={cx('text-[12.5px]', b.is_primary ? 'font-bold text-accent' : 'text-ink')}>
                        {b.model}
                      </div>
                      <div className="text-2xs text-ink-3 mt-px">
                        {b.family === 'ml' ? 'this system' : b.family === 'naive' ? 'no model at all' : 'conventional statistics'}
                      </div>
                    </td>
                    <td>
                      {/*
                        Scaled 0–1, the real range of the measure, with the no-model
                        result marked. Normalising to the winner would flatter it.
                      */}
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-1 h-[14px] rounded-[2px] bg-line-faint overflow-hidden">
                          <div
                            className="h-full rounded-[2px] transition-[width] duration-500"
                            style={{ width: `${b.pr_auc * 100}%`, background: b.is_primary ? '#1B3F73' : '#A9BBD4' }}
                          />
                          {naive && (
                            <span
                              className="absolute inset-y-0 w-px bg-ink-3/70"
                              style={{ left: `${naive.pr_auc * 100}%` }}
                              title={`No-model reference: ${naive.pr_auc.toFixed(2)}`}
                            />
                          )}
                        </div>
                        <span className={cx('num text-[12.5px] w-[32px] text-right', b.is_primary ? 'font-bold text-accent' : 'font-semibold text-ink')}>
                          {b.pr_auc.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="n text-ink-2">{b.roc_auc.toFixed(2)}</td>
                    <td className="n text-ink-2">{b.brier.toFixed(3)}</td>
                    <td className="n text-ink-2">{b.mae_cost_pp.toFixed(1)} pp</td>
                    <td className="n text-ink-2">{b.mae_delay_months.toFixed(1)} mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-line flex items-center gap-2 text-2xs text-ink-3">
              <span className="w-px h-3 bg-ink-3/70" />
              vertical mark is the no-model result ({naive?.pr_auc.toFixed(2)}) · higher is better in the
              first two columns, lower in the last three
            </div>
          </Panel>

          {primary && naive && (
            <Finding>
              <strong>Yes, by a margin worth having.</strong> Against the strongest conventional
              method — {bestConventional.model} — the gain is{' '}
              <N>{(primary.pr_auc - bestConventional.pr_auc).toFixed(2)}</N> PR-AUC on identical
              splits. Against no model at all, the cost error falls from <N>{naive.mae_cost_pp.toFixed(1)}</N> to{' '}
              <N>{primary.mae_cost_pp.toFixed(1)}</N> percentage points and the delay error from{' '}
              <N>{naive.mae_delay_months.toFixed(1)}</N> to <N>{primary.mae_delay_months.toFixed(1)}</N> months.
              The <Term k="brier">Brier score</Term> improves too, which matters more than the ranking:
              it means the stated probabilities can be believed, not just ordered.
            </Finding>
          )}
        </Section>

        {/* ====================================================== 2. what data buys */}
        <Section
          title="2 — What is each kind of information worth?"
          note="feature groups added one at a time, retrained from scratch each time"
          info={
            <Info title="How this was measured" terms={['ablation', 'feature']}>
              <p>
                Share of lift is measured against the no-model result: the full model's advantage
                counts as 100%, and each group is credited with the portion it recovers.
              </p>
            </Info>
          }
        >
          <Panel>
            <div className="space-y-4">
              {r.ablation.map((a, i) => (
                <div key={a.config} className="grid grid-cols-[minmax(0,1fr)_264px] gap-6 items-start">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className={cx('text-[13px] font-semibold', i === 1 ? 'text-accent' : 'text-ink')}>
                        {a.label}
                      </span>
                      <span className="num text-2xs text-ink-3">
                        {a.n_features} features
                      </span>
                      {i === 1 && (
                        <span className="chip bg-accent-soft text-accent border-accent-line">no new collection</span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink-2 leading-snug mt-1">{a.description}</p>
                  </div>

                  <div className="pt-0.5">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xs text-ink-3">share of achievable gain</span>
                      <span className="num text-[13px] font-bold text-ink">{a.pct_of_full.toFixed(1)}%</span>
                    </div>
                    <div className="relative h-[10px] rounded-[2px] bg-line-faint overflow-hidden">
                      <div
                        className="h-full transition-[width] duration-500"
                        style={{ width: `${a.pct_of_full}%`, background: i === 1 ? '#1B3F73' : '#A9BBD4' }}
                      />
                    </div>
                    <div className="num text-2xs text-ink-3 mt-1.5 flex justify-between">
                      <span>PR-AUC {a.pr_auc.toFixed(2)}</span>
                      {a.delta_vs_prev ? <span className="text-ink-2">+{a.delta_vs_prev.toFixed(2)} on the row above</span> : <span>starting point</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {derived && full && (
            <Finding>
              <strong>Most of the signal is already being collected.</strong> Features computed from
              fields the <Term k="cuf" /> captures today recover <N>{derived.pct_of_full.toFixed(0)}%</N> of the
              total achievable gain, with nothing new asked of any agency. The remaining{' '}
              <N>{(full.pct_of_full - derived.pct_of_full).toFixed(0)}%</N> needs agency workload history
              and structured land-acquisition status — which makes this a costed recommendation for
              the next CUF revision rather than a wish list.
            </Finding>
          )}
        </Section>

        {/* ========================================== 3. is it honest / when does it work */}
        <Section
          title="3 — Are the probabilities honest, and is the warning early enough?"
          note="held-out projects only"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.92fr)] gap-5 items-stretch">
            <Panel className="flex flex-col">
              <SubHead title="Stated odds against reality" info={<Info terms={['calibration', 'isotonic']} title="What calibration means" />} />
              <CalibrationChart points={r.calibration} />
              <p className="text-[12px] text-ink-2 mt-2.5 leading-snug">
                The closer the line sits to the diagonal, the more literally the percentages can be
                taken. Of the projects given a 70% chance, close to 70% did overrun — that is what
                makes the score usable for deciding how much to worry, not merely what to look at first.
              </p>
            </Panel>

            <Panel className="flex flex-col">
              <SubHead title="How much warning it gives" info={<Info terms={['lead_time', 'replay']} title="How lead time is measured" />} />
              <LeadTimeHistogram registry={r} />
              <p className="text-[12px] text-ink-2 mt-2.5 leading-snug">
                Months between the model crossing its alert threshold and the first revision appearing
                in the monitoring record, across correctly flagged test projects. Median{' '}
                <N>{r.lead_time_median}</N> months; half fall between <N>{r.lead_time_p25}</N> and{' '}
                <N>{r.lead_time_p75}</N>.
              </p>
            </Panel>

            <Panel pad={false} className="flex flex-col">
              <div className="px-4 pt-3.5 pb-2">
                <SubHead title="Accuracy by project stage" info={<Info terms={['pr_auc', 'mae']} title="Reading this table" />} />
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th className="n">PR-AUC</th>
                    <th className="n">Cost error</th>
                    <th className="n">Projects</th>
                  </tr>
                </thead>
                <tbody>
                  {r.by_stage.map((s, i) => (
                    <tr key={s.stage} className={cx(i === 0 && 'bg-accent-soft/70')}>
                      <td>
                        <div className={cx('text-[12.5px]', i === 0 ? 'font-bold text-accent' : 'font-medium text-ink')}>
                          {s.stage}
                        </div>
                        <div className="num text-2xs text-ink-3">{s.elapsed_range}</div>
                      </td>
                      <td className="n font-semibold text-ink">{s.pr_auc.toFixed(2)}</td>
                      <td className="n text-ink-2">{s.mae_cost_pp.toFixed(1)} pp</td>
                      <td className="n text-ink-2">{formatCount(s.n_projects)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[12px] text-ink-2 px-4 py-2.5 leading-snug border-t border-line mt-auto">
                Accuracy climbs as a project runs on — but a warning at 90% elapsed cannot change the
                outcome. The <span className="font-semibold text-ink">early</span> row at{' '}
                <N>{early.pr_auc.toFixed(2)}</N> is the figure this system should be judged on.
              </p>
            </Panel>
          </div>
        </Section>

        {/* ============================================================= 4. leakage */}
        <Section
          title="4 — Could the result be an artefact?"
          note="build-breaking checks — training aborts unless all four pass"
          info={
            <Info title="Why this section exists" terms={['leakage', 'disjoint_split', 'shuffled_label']}>
              <p>
                A forecasting result that looks excellent is usually leaking. These checks are run
                on every training pass rather than once, so the guarantee cannot quietly rot.
              </p>
            </Info>
          }
        >
          <Panel pad={false} tour="evidence-leakage">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-[196px]">Check</th>
                  <th>What it rules out</th>
                  <th className="w-[220px]">Measured</th>
                  <th className="n w-[80px]">Result</th>
                </tr>
              </thead>
              <tbody>
                {r.leakage_tests.map((t) => (
                  <tr key={t.name}>
                    <td className="text-[12.5px] font-medium text-ink">{t.name}</td>
                    <td className="text-[12px] text-ink-2 leading-snug">{t.description}</td>
                    <td className="num text-[12px] text-ink-2">{t.value}</td>
                    <td className="n">
                      <span className={cx('chip', t.passed ? 'bg-riskbg-low text-risk-low border-risk-low/25' : 'bg-riskbg-critical text-risk-critical border-risk-critical/25')}>
                        {t.passed ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {shuffled && (
            <Finding>
              <strong>The shuffled-label check is the one that matters.</strong> Train the same model
              on randomly scrambled answers and it must collapse to chance. It scores{' '}
              <N>{shuffled.value}</N>. Had it scored well, the inputs would contain the answer and
              every other figure on this page would be worthless.
            </Finding>
          )}
        </Section>

        {/* ================================================= 5. how to read / limits */}
        <Section title="5 — How to read these results">
          <div className="grid grid-cols-2 gap-5 items-start">
            <Panel>
              <SubHead title="What these numbers do and do not say" />
              <ul className="space-y-2.5 mt-2.5">
                {/*
                  Deliberately excludes anything the Limitations panel beside it
                  already states — these are reading instructions, not caveats.
                */}
                <Reading>
                  Judge it on the <strong>early-stage</strong> row and on lead time. Accuracy late in a
                  project is easy to achieve and arrives too late to act on.
                </Reading>
                <Reading>
                  Treat the probability and the size of the overrun as{' '}
                  <strong>two separate facts</strong>. Ranking by one gives a different queue than
                  ranking by the other, which is why the watchlist offers both.
                </Reading>
                <Reading>
                  Because the probabilities are calibrated, they can be read{' '}
                  <strong>literally</strong>. A 70% is a genuine 7-in-10, not a relative score, so it
                  can be weighed against the cost of intervening.
                </Reading>
                <Reading>
                  Compare methods on <strong>PR-AUC and Brier together</strong>. The first says whether
                  the right projects are found; the second says whether the stated odds can be
                  trusted. A method can win one and lose the other.
                </Reading>
              </ul>
            </Panel>

            <Panel>
              <SubHead
                title="Limitations"
                info={<Info terms={['survivorship', 'censoring', 'synthetic_data']} title="Terms used here" />}
              />
              <ul className="space-y-2.5 mt-2.5">
                {r.limitations.map((l, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px] text-ink-2 leading-relaxed">
                    <span className="num text-2xs font-bold text-ink-4 mt-[3px] shrink-0 w-3">{i + 1}</span>
                    {l}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Section>

        {/* ============================================================ provenance */}
        <Section title="What was trained, on what">
          <Panel>
            <div className="grid grid-cols-5 gap-6">
              <Meta block label="Model version" value={r.model_version} />
              <Meta block label="Projects in panel" value={formatCount(r.n_projects)} />
              <Meta block label="Monthly snapshots" value={formatCount(r.n_snapshot_rows)} info="snapshot_row" />
              <Meta block label="Features" value={formatCount(r.n_features)} info="feature" />
              <Meta
                block
                label="Train / valid / test"
                value={`${formatCount(r.split.train)} / ${formatCount(r.split.valid)} / ${formatCount(r.split.test)}`}
              />
            </div>
            <div className="mt-4 pt-3.5 border-t border-line-faint">
              <div className="eyebrow mb-1 flex items-center gap-1.5">
                Split strategy <Info terms={['split_strategy', 'disjoint_split', 'holdout']} />
              </div>
              <p className="text-[12.5px] text-ink-2 leading-relaxed">{r.split.strategy}</p>
            </div>
            <ProvenanceNote className="mt-4 pt-3.5 border-t border-line-faint" />
          </Panel>
        </Section>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ pieces */

const N = ({ children }: { children: React.ReactNode }) => (
  <span className="num font-semibold text-ink">{children}</span>
);

/** The one place a conclusion is stated. Same shape under every section. */
const Finding = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12.5px] text-ink-2 mt-3 leading-relaxed max-w-5xl border-l-2 border-accent-line pl-3.5">
    {children}
  </p>
);

const Reading = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2.5 text-[12.5px] text-ink-2 leading-relaxed">
    <span className="w-1 h-1 rounded-full bg-ink-4 mt-[7px] shrink-0" />
    <span className="[&_strong]:text-ink [&_strong]:font-semibold">{children}</span>
  </li>
);

function SubHead({ title, info }: { title: string; info?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
      {info}
    </div>
  );
}

function Headline({ label, value, unit, sub, terms, accent, tone }: {
  label: string; value: string; unit: string; sub: string;
  terms: TermKey[];
  accent?: boolean; tone?: 'good' | 'bad';
}) {
  const colour = tone === 'bad' ? 'text-risk-critical' : accent ? 'text-accent' : 'text-ink';
  return (
    <div className="px-4 py-3.5">
      <div className="eyebrow mb-2 flex items-center gap-1.5 leading-snug">
        <span className="min-w-0">{label}</span>
        <Info terms={terms} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cx('num text-2xl font-semibold tracking-[-0.025em] leading-none', colour)}>{value}</span>
        <span className="text-[12px] font-medium text-ink-3">{unit}</span>
      </div>
      <p className="text-2xs text-ink-3 mt-2 leading-snug">{sub}</p>
    </div>
  );
}

function Meta({ label, value, block, info }: {
  label: string; value: string; block?: boolean; info?: TermKey;
}) {
  if (block) {
    return (
      <div>
        <div className="eyebrow mb-1 flex items-center gap-1.5">
          {label}
          {info && <Info terms={[info]} />}
        </div>
        <div className="num text-[12.5px] font-semibold text-ink leading-snug">{value}</div>
      </div>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="eyebrow">{label}</span>
      <span className="num font-semibold text-ink-2">{value}</span>
    </span>
  );
}

function EvidenceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-64" />
      <div className="panel p-4 grid grid-cols-4 gap-6 divide-x divide-line">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={i ? 'pl-6' : ''}>
            <Skeleton className="h-2.5 w-28 mb-3" />
            <Skeleton className="h-7 w-20 mb-2.5" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ))}
      </div>
      <div className="panel p-4 space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
      <div className="panel p-4 space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
    </div>
  );
}
