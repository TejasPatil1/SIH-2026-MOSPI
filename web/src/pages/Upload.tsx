import { useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScoreRun, useUpload } from '../api/hooks';
import { ErrorCard, Page, Panel, RiskBadge, Section, cx } from '../components/ui';
import { formatCount, formatCrore, formatMonth } from '../lib/format';
import type { RiskBand } from '../api/types';

type Stage = 'upload' | 'validate' | 'score' | 'review';

const STEPS: { key: Stage; label: string; caption: string }[] = [
  { key: 'upload', label: 'Upload', caption: 'Monthly CUF export' },
  { key: 'validate', label: 'Validate', caption: 'Schema and continuity checks' },
  { key: 'score', label: 'Rescore', caption: 'Full portfolio inference' },
  { key: 'review', label: 'Review', caption: 'Band transitions' },
];

export default function Upload() {
  const nav = useNavigate();
  const [dragging, setDragging] = useState(false);
  const upload = useUpload();
  const score = useScoreRun();

  const validation = upload.data;
  const result = score.data;
  const stage: Stage = result ? 'review' : score.isPending ? 'score' : validation ? 'validate' : 'upload';
  const stageIdx = STEPS.findIndex((s) => s.key === stage);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { score.reset(); upload.mutate(f); }
  };

  const reset = () => { upload.reset(); score.reset(); };

  return (
    <Page
      title="Monthly upload and rescore"
      lede="The operating cycle: a new CUF export is validated, the full portfolio is rescored, and the analyst reviews what changed."
      actions={
        (validation || result) && <button className="btn btn-ghost" onClick={reset}>Start over</button>
      }
    >
      {/* ------------------------------------------------------ step rail */}
      <div className="flex items-stretch mb-5 panel overflow-hidden">
        {STEPS.map((s, i) => {
          const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'todo';
          return (
            <div
              key={s.key}
              className={cx(
                'flex-1 flex items-center gap-3 px-4 py-3 border-r border-line last:border-r-0 transition-colors duration-200',
                state === 'active' && 'bg-accent-soft',
              )}
            >
              <span className={cx(
                'num w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-bold shrink-0 transition-colors duration-200',
                state === 'done' && 'bg-risk-low text-white',
                state === 'active' && 'bg-accent text-white',
                state === 'todo' && 'bg-line text-ink-3',
              )}>
                {state === 'done' ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5.5 5.5L20 6" /></svg>
                ) : i + 1}
              </span>
              <div className="min-w-0">
                <div className={cx('text-[12.5px] font-semibold leading-tight', state === 'todo' ? 'text-ink-3' : 'text-ink')}>
                  {s.label}
                </div>
                <div className="text-2xs text-ink-3 truncate">{s.caption}</div>
              </div>
            </div>
          );
        })}
      </div>

      {upload.isError && <ErrorCard error={upload.error} context="The upload" />}
      {score.isError && <ErrorCard error={score.error} context="The scoring run" />}

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5">
          {/* ------------------------------------------------- drop zone --- */}
          {!validation && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                'panel border-dashed py-14 px-6 flex flex-col items-center text-center transition-all duration-200',
                dragging ? 'border-accent bg-accent-soft' : 'hover:border-line-strong',
                upload.isPending && 'opacity-60 pointer-events-none',
              )}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" className={cx('mb-3', dragging ? 'text-accent' : 'text-ink-4')}>
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
              </svg>
              <h3 className="text-[13.5px] font-semibold text-ink">
                {upload.isPending ? 'Reading file…' : 'Drop the monthly CUF export'}
              </h3>
              <p className="text-[12.5px] text-ink-2 mt-1.5 max-w-md leading-relaxed">
                CSV to the PAIMANA snapshot schema — one row per project per monitoring month. Maximum 10 MB.
              </p>
              <div className="flex items-center gap-2.5 mt-5">
                <label className="btn btn-ghost cursor-pointer">
                  Choose file
                  <input type="file" accept=".csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { score.reset(); upload.mutate(f); } }} />
                </label>
                <span className="text-2xs text-ink-3">or</span>
                <button className="btn btn-primary" onClick={() => { score.reset(); upload.mutate(null); }} disabled={upload.isPending}>
                  Use sample next-month file
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ validation --- */}
          {validation && (
            <Section title="Validation report" note={validation.filename}>
              <Panel pad={false}>
                <div className="grid grid-cols-4 divide-x divide-line border-b border-line">
                  <Cell label="Rows read" value={formatCount(validation.rows_read)} />
                  <Cell label="Accepted" value={formatCount(validation.accepted)} tone="positive" />
                  <Cell label="Rejected" value={formatCount(validation.rejected)} tone={validation.rejected ? 'critical' : undefined} />
                  <Cell label="Snapshot month" value={formatMonth(validation.snapshot_month)} />
                </div>

                {validation.issues.length > 0 && (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="n w-[64px]">Row</th>
                        <th className="w-[120px]">Project</th>
                        <th className="w-[190px]">Field</th>
                        <th>Reason for rejection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.issues.map((i) => (
                        <tr key={`${i.row}-${i.field}`}>
                          <td className="n text-ink-3">{i.row}</td>
                          <td className="num text-[12px] text-ink-2">{i.project_id ?? '—'}</td>
                          <td className="num text-[12px] font-medium text-ink">{i.field}</td>
                          <td className="text-[12px] text-ink-2">{i.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>

              {!result && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[12.5px] text-ink-2">
                    Rejected rows are excluded from scoring; their previous filing is retained.
                  </p>
                  <button className="btn btn-primary h-9 px-4" onClick={() => score.mutate(validation.batch_id)} disabled={score.isPending}>
                    {score.isPending ? 'Scoring…' : 'Run scoring'}
                  </button>
                </div>
              )}
            </Section>
          )}

          {/* --------------------------------------------------- scoring --- */}
          {score.isPending && <ScoringProgress accepted={validation?.accepted ?? 0} />}

          {/* ---------------------------------------------------- review --- */}
          {result && (
            <Section
              title="Band transitions"
              note={`${result.transitions.length} projects changed band · ordered by exposure`}
              actions={<button className="btn btn-primary" onClick={() => nav('/watchlist')}>Open refreshed watchlist →</button>}
            >
              <Panel pad={false}>
                {result.transitions.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[12.5px] text-ink-2">
                    No project changed risk band in this cycle.
                  </p>
                ) : (
                  <table className="tbl tbl-hover">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th className="w-[136px]">Sector</th>
                        <th className="w-[104px]">From</th>
                        <th className="w-[104px]">To</th>
                        <th className="n w-[104px]">Risk change</th>
                        <th className="n w-[104px]">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transitions.map((t) => {
                        const worse = t.risk_after > t.risk_before;
                        return (
                          <tr key={t.project_id} onClick={() => nav(`/project/${t.project_id}`)}>
                            <td className="max-w-[300px]">
                              <div className="font-medium text-ink truncate">{t.project_name}</div>
                              <div className="num text-2xs text-ink-3">{t.project_id}</div>
                            </td>
                            <td className="text-ink-2 truncate">{t.sector}</td>
                            <td><RiskBadge band={t.from_band} size="sm" /></td>
                            <td><RiskBadge band={t.to_band} size="sm" /></td>
                            <td className={cx('n font-semibold', worse ? 'text-risk-critical' : 'text-risk-low')}>
                              {t.risk_before.toFixed(0)} → {t.risk_after.toFixed(0)}
                            </td>
                            <td className="n text-ink">{formatCrore(t.exposure_at_risk_cr)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Panel>
            </Section>
          )}
        </div>

        {/* ------------------------------------------------- right rail ---- */}
        <div className="space-y-4">
          {result ? (
            <>
              <Panel className="border-accent-line bg-accent-soft/45">
                <div className="num text-2xl font-semibold tracking-[-0.025em] text-accent leading-none">
                  {formatCount(result.scored)}
                </div>
                <div className="text-2xs font-bold uppercase tracking-[0.08em] text-accent mt-1.5">
                  projects rescored
                </div>
                <div className="num text-[12px] text-ink-2 mt-2.5 pt-2.5 border-t border-accent-line">
                  Completed in {(result.duration_ms / 1000).toFixed(1)} s
                </div>
              </Panel>

              <Panel>
                <div className="eyebrow mb-2.5">Band movement</div>
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {(['CRITICAL', 'HIGH', 'WATCH', 'LOW'] as RiskBand[]).map((b) => {
                      const before = result.band_counts_before[b];
                      const after = result.band_counts_after[b];
                      const d = after - before;
                      return (
                        <tr key={b}>
                          <td className="py-[5px]"><RiskBadge band={b} size="sm" /></td>
                          <td className="num text-right text-ink-2 py-[5px]">{before}</td>
                          <td className="num text-center text-ink-4 px-1.5">→</td>
                          <td className="num text-right font-semibold text-ink py-[5px]">{after}</td>
                          <td className={cx('num text-right w-[42px] font-semibold py-[5px]',
                            d > 0 ? 'text-risk-critical' : d < 0 ? 'text-risk-low' : 'text-ink-4')}>
                            {d > 0 ? `+${d}` : d || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[12px] text-ink-2 mt-3 pt-3 border-t border-line-faint leading-relaxed">
                  <span className="num font-bold text-ink">{result.entered_critical}</span> projects entered the critical
                  band and <span className="num font-bold text-ink">{result.exited_critical}</span> left it this cycle.
                </p>
              </Panel>
            </>
          ) : (
            <Panel>
              <div className="eyebrow mb-2.5">What this step does</div>
              <ol className="space-y-3">
                {[
                  ['Schema validation', 'Required fields, types, and reference values for ministry, sector and agency.'],
                  ['Continuity checks', 'Cumulative expenditure and physical progress may not decrease without a recorded revision.'],
                  ['Feature rebuild', 'The same feature code path used in training — never a second implementation.'],
                  ['Batch inference', 'All ongoing projects rescored with the loaded model, then SHAP drivers and alert rules recomputed.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="num text-2xs font-bold text-ink-4 mt-[3px] w-3 shrink-0">{i + 1}</span>
                    <div>
                      <div className="text-[12.5px] font-semibold text-ink">{t}</div>
                      <p className="text-[12px] text-ink-2 leading-snug mt-0.5">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}

const Cell = ({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'critical' }) => (
  <div className="px-4 py-3">
    <div className="eyebrow mb-1">{label}</div>
    <div className={cx('num text-md font-semibold',
      tone === 'positive' ? 'text-risk-low' : tone === 'critical' ? 'text-risk-critical' : 'text-ink')}>
      {value}
    </div>
  </div>
);

/** Determinate, staged progress — a generic spinner would say nothing (§16). */
function ScoringProgress({ accepted }: { accepted: number }) {
  const phases = ['Rebuilding features', 'Running batch inference', 'Computing SHAP drivers', 'Evaluating alert rules'];
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[13px] font-semibold text-ink">Scoring portfolio</span>
        <span className="num text-[12px] text-ink-2">{formatCount(accepted)} projects</span>
      </div>
      <div className="h-[5px] rounded-full bg-line-faint overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ animation: 'score 1.4s cubic-bezier(0.4,0,0.2,1) forwards' }} />
      </div>
      <style>{'@keyframes score { from { width: 4% } to { width: 100% } }'}</style>
      <div className="grid grid-cols-4 gap-3 mt-3.5">
        {phases.map((p, i) => (
          <div key={p} className="text-[12px] text-ink-2 flex items-center gap-1.5"
            style={{ animation: `fade 0.25s ease-out ${i * 0.32}s both` }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            {p}
          </div>
        ))}
      </div>
    </Panel>
  );
}
