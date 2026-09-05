import { useRegistry } from '../api/hooks';
import { CalibrationChart, LeadTimeHistogram } from '../components/charts';
import { EmptyState, Page, Panel, Section, Skeleton, cx } from '../components/ui';
import { formatCount } from '../lib/format';

export default function Evidence() {
  const { data: r, isLoading, isError } = useRegistry();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-80" />
        <div className="panel p-4 space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
        <div className="panel p-4 space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
      </div>
    );
  }

  if (isError || !r) {
    return (
      <EmptyState
        icon="file"
        title="Model registry unavailable"
        message={
          <>
            The evidence page reads every figure from <code className="text-ink font-medium">models/registry.json</code>.
            Produce it by running the training pipeline:
            <code className="block mt-2.5 px-3 py-2 bg-ink text-white/90 rounded text-[12px] text-left">make train</code>
          </>
        }
      />
    );
  }

  const best = r.baselines.find((b) => b.is_primary);
  const naive = r.baselines.find((b) => b.family === 'naive');
  const survival = r.baselines.find((b) => b.family === 'survival');
  const ols = r.baselines.find((b) => b.model.startsWith('OLS'));
  const full = r.ablation[r.ablation.length - 1];
  const derived = r.ablation[r.ablation.length - 2];
  const maxPr = Math.max(...r.baselines.map((b) => b.pr_auc));

  return (
    <Page
      title="Method evidence"
      lede="The problem statement asks two research questions. Both were answered with experiments on identical splits, not assertions. Every figure on this page is read from the model registry."
      actions={
        <div className="flex items-center gap-3 text-[12px]">
          <Field label="Model" value={r.model_version} />
          <Field label="Features" value={String(r.n_features)} />
          <Field label="Snapshot rows" value={formatCount(r.n_snapshot_rows)} />
        </div>
      }
    >
      <div className="space-y-6">
        {/* ------------------------------------------- Q1: ML vs statistics */}
        <Section
          title="Question 1 — Does machine learning beat conventional statistics here?"
          note="binary target: final cost overrun > 10% · identical project-disjoint splits"
        >
          <Panel pad={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="w-[196px]">PR-AUC</th>
                  <th className="n w-[84px]">ROC-AUC</th>
                  <th className="n w-[74px]">Brier</th>
                  <th className="n w-[104px]">MAE cost (pp)</th>
                  <th className="n w-[112px]">MAE delay (mo)</th>
                </tr>
              </thead>
              <tbody>
                {r.baselines.map((b) => (
                  <tr key={b.model} className={cx(b.is_primary && 'bg-accent-soft/70')}>
                    <td>
                      <span className={cx('text-[12.5px]', b.is_primary ? 'font-bold text-accent' : 'text-ink')}>
                        {b.model}
                      </span>
                      <span className="text-2xs text-ink-3 ml-2 uppercase tracking-[0.05em]">{b.family}</span>
                    </td>
                    <td>
                      {/* bar starts at zero — the scale is not manipulated */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-[13px] rounded-[2px] bg-line-faint overflow-hidden">
                          <div
                            className="h-full rounded-[2px] transition-[width] duration-500"
                            style={{ width: `${(b.pr_auc / maxPr) * 100}%`, background: b.is_primary ? '#1B3F73' : '#A9BBD4' }}
                          />
                        </div>
                        <span className={cx('num text-[12.5px] w-[34px] text-right', b.is_primary ? 'font-bold text-accent' : 'font-semibold text-ink')}>
                          {b.pr_auc.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="n text-ink-2">{b.roc_auc.toFixed(2)}</td>
                    <td className="n text-ink-2">{b.brier.toFixed(3)}</td>
                    <td className="n text-ink-2">{b.mae_cost_pp.toFixed(1)}</td>
                    <td className="n text-ink-2">{b.mae_delay_months.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {best && naive && (
            <p className="text-[12.5px] text-ink-2 mt-2.5 leading-relaxed">
              <span className="font-semibold text-ink">Yes, with a measurable margin.</span> The gradient-boosted model
              reaches <span className="num font-semibold text-ink">{best.pr_auc.toFixed(2)}</span> PR-AUC against{' '}
              <span className="num font-semibold text-ink">{survival?.pr_auc.toFixed(2) ?? '—'}</span> for the Weibull
              survival model and <span className="num font-semibold text-ink">{ols?.pr_auc.toFixed(2) ?? '—'}</span> for
              OLS, on the same features and the same splits. It also halves the naive baseline's cost error, from{' '}
              <span className="num font-semibold text-ink">{naive.mae_cost_pp.toFixed(1)}</span> to{' '}
              <span className="num font-semibold text-ink">{best.mae_cost_pp.toFixed(1)}</span> percentage points.
            </p>
          )}
        </Section>

        {/* ---------------------------------------------- Q2: CUF ablation */}
        <Section
          title="Question 2 — How much predictive power do the existing CUF fields already hold?"
          note="nested feature groups, retrained from scratch for each configuration"
        >
          <Panel pad={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-[52px]">Set</th>
                  <th className="w-[190px]">Feature group</th>
                  <th>What it adds</th>
                  <th className="n w-[74px]">Features</th>
                  <th className="n w-[74px]">PR-AUC</th>
                  <th className="n w-[64px]">Δ</th>
                  <th className="n w-[128px]">Share of achievable lift</th>
                </tr>
              </thead>
              <tbody>
                {r.ablation.map((a) => (
                  <tr key={a.config} className={cx(a.config === 'C+D' && 'bg-accent-soft/70')}>
                    <td className="num font-bold text-ink-2">{a.config}</td>
                    <td className={cx('text-[12.5px]', a.config === 'C+D' ? 'font-bold text-accent' : 'font-medium text-ink')}>
                      {a.label}
                    </td>
                    <td className="text-[12px] text-ink-2 leading-snug max-w-[430px]">{a.description}</td>
                    <td className="n text-ink-2">{a.n_features}</td>
                    <td className="n font-semibold text-ink">{a.pr_auc.toFixed(2)}</td>
                    <td className="n text-ink-2">{a.delta_vs_prev ? `+${a.delta_vs_prev.toFixed(2)}` : '—'}</td>
                    <td className="n">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-[54px] h-[11px] rounded-[2px] bg-line-faint overflow-hidden">
                          <div className="h-full transition-[width] duration-500"
                            style={{ width: `${a.pct_of_full}%`, background: a.config === 'C+D' ? '#1B3F73' : '#A9BBD4' }} />
                        </div>
                        <span className="font-semibold text-ink w-[38px] text-right">{a.pct_of_full.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {derived && full && (
            <p className="text-[12.5px] text-ink-2 mt-2.5 leading-relaxed max-w-5xl">
              <span className="font-semibold text-ink">Most of the signal is already being collected.</span> Features
              derived from fields the CUF captures today reach{' '}
              <span className="num font-semibold text-ink">{derived.pct_of_full.toFixed(0)}%</span> of the achievable
              lift over the naive baseline, with no new data collection at all. The remaining{' '}
              <span className="num font-semibold text-ink">{(full.pct_of_full - derived.pct_of_full).toFixed(0)}%</span>{' '}
              requires agency workload history and structured land-acquisition status — a concrete, evidence-based
              recommendation for the next CUF revision.
            </p>
          )}
        </Section>

        {/* ------------------------------------ calibration + lead time ---- */}
        <div className="grid grid-cols-3 gap-5">
          <Section title="Probability calibration" note="predicted vs observed, held-out set">
            <Panel>
              <CalibrationChart points={r.calibration} />
              <p className="text-[12px] text-ink-2 mt-2 leading-snug">
                Points on the diagonal mean a stated 70% chance of overrun corresponds to roughly 70% of such
                projects actually overrunning. Calibration is what makes the score usable for triage.
              </p>
            </Panel>
          </Section>

          <Section title="Lead time distribution" note="correctly flagged test projects">
            <Panel>
              <LeadTimeHistogram registry={r} />
              <p className="text-[12px] text-ink-2 mt-2 leading-snug">
                Median <span className="num font-semibold text-ink">{r.lead_time_median}</span> months of warning
                before the first official revision (IQR{' '}
                <span className="num font-semibold text-ink">{r.lead_time_p25}–{r.lead_time_p75}</span>).
              </p>
            </Panel>
          </Section>

          <Section title="Accuracy by project stage" note="accuracy late is worth little; early is the point">
            <Panel pad={false}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th className="n">PR-AUC</th>
                    <th className="n">MAE cost</th>
                    <th className="n">n</th>
                  </tr>
                </thead>
                <tbody>
                  {r.by_stage.map((s) => (
                    <tr key={s.stage}>
                      <td>
                        <div className="text-[12.5px] font-medium text-ink">{s.stage}</div>
                        <div className="num text-2xs text-ink-3">{s.elapsed_range}</div>
                      </td>
                      <td className="n font-semibold text-ink">{s.pr_auc.toFixed(2)}</td>
                      <td className="n text-ink-2">{s.mae_cost_pp.toFixed(1)} pp</td>
                      <td className="n text-ink-2">{formatCount(s.n_projects)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[12px] text-ink-2 px-3 py-2.5 leading-snug border-t border-line">
                Performance rises as a project progresses — but a warning at 90% elapsed is operationally
                worthless. The early-stage figure is the one that matters.
              </p>
            </Panel>
          </Section>
        </div>

        {/* ------------------------------------------------ leakage guard --- */}
        <Section title="Leakage guard" note="build-breaking tests — training does not run unless all four pass">
          <Panel pad={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-[190px]">Test</th>
                  <th>What it rules out</th>
                  <th className="w-[210px]">Result</th>
                  <th className="n w-[74px]">Status</th>
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
          <p className="text-[12.5px] text-ink-2 mt-2.5 leading-relaxed max-w-5xl">
            The shuffled-label test is the strongest of the four: a model trained on randomly permuted labels must
            score near chance. If it does not, the features encode the answer and every other number on this page is
            meaningless.
          </p>
        </Section>

        {/* ------------------------------------------------- limitations ---- */}
        <Section title="Limitations" note="stated up front, not on request">
          <Panel>
            <ul className="space-y-2.5">
              {r.limitations.map((l, i) => (
                <li key={i} className="flex gap-2.5 text-[12.5px] text-ink-2 leading-relaxed">
                  <span className="num text-2xs font-bold text-ink-4 mt-[3px] shrink-0 w-3">{i + 1}</span>
                  {l}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-4 gap-5 mt-4 pt-4 border-t border-line">
              <Field label="Model version" value={r.model_version} block />
              <Field label="Split strategy" value={r.split.strategy} block />
              <Field label="Train / valid / test rows" value={`${formatCount(r.split.train)} / ${formatCount(r.split.valid)} / ${formatCount(r.split.test)}`} block />
              <Field label="Projects in panel" value={formatCount(r.n_projects)} block />
            </div>
          </Panel>
        </Section>
      </div>
    </Page>
  );
}

function Field({ label, value, block }: { label: string; value: string; block?: boolean }) {
  if (block) {
    return (
      <div>
        <div className="eyebrow mb-1">{label}</div>
        <div className="num text-[12px] font-medium text-ink-2 leading-snug">{value}</div>
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
