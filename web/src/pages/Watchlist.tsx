import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio, useWatchlist } from '../api/hooks';
import {
  EmptyState, ErrorCard, Page, ProgressBar, RiskBadge, Section, SegmentedControl,
  Select, SkeletonTable, Toggle, cx,
} from '../components/ui';
import { Info, Term } from '../components/Info';
import { BAND_ORDER, formatCount, formatCrore, formatPct, downloadCsv } from '../lib/format';

export default function Watchlist() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  // Filter state lives in the URL so a mid-demo refresh restores the exact view.
  const sector = params.get('sector') ?? '';
  const ministry = params.get('ministry') ?? '';
  const band = params.get('band') ?? '';
  const weighted = params.get('weight') === 'exposure';
  const n = Number(params.get('n') ?? 50);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const { data: portfolio } = usePortfolio();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useWatchlist({
    n, weight_by_exposure: weighted,
    sector: sector || undefined, ministry: ministry || undefined, band: band || undefined,
  });

  const hasFilters = !!(sector || ministry || band);
  const totalExposure = useMemo(
    () => data?.rows.reduce((a, r) => a + r.exposure_at_risk_cr, 0) ?? 0,
    [data],
  );

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `pews-watchlist-${weighted ? 'exposure' : 'risk'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Rank', 'Project ID', 'Project', 'Sector', 'Ministry', 'State', 'Sanctioned cost (Cr)',
        'Physical progress (%)', 'Rule checks fired', 'Risk score', 'Band', 'Top driver',
        'Predicted overrun (%)', 'Predicted delay (months)', 'Exposure at risk (Cr)'],
      data.rows.map((r) => [r.rank, r.project_id, r.project_name, r.sector, r.ministry, r.state,
        r.original_cost_cr, r.physical_progress_pct, r.alert_count, r.risk_score, r.risk_band,
        r.top_driver?.label ?? '',
        r.pred_cost_overrun_pct, r.pred_delay_months, r.exposure_at_risk_cr]),
    );
  };

  return (
    <Page
      title="Analyst watchlist"
      lede="Projects requiring attention this monitoring cycle, ranked by the trained model."
      actions={
        <>
          <span data-tour="watchlist-toggle" className="inline-flex items-center gap-1.5">
          <Toggle
            checked={weighted}
            onChange={(v) => set({ weight: v ? 'exposure' : null })}
            label="Weight by financial exposure"
            hint={weighted ? 'Ranking by rupees at risk' : 'Ranking by failure probability'}
          />
          <Info terms={['exposure_at_risk', 'probability']} title="What this toggle changes" />
          </span>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!data?.rows.length}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 11l5 5 5-5M4 19h16" />
            </svg>
            Export CSV
          </button>
        </>
      }
    >
      {/* ---- filter bar ---- */}
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Select label="Ministry" value={ministry} onChange={(v) => set({ ministry: v })} allLabel="All ministries"
            options={(portfolio?.ministries ?? []).map((m) => ({ value: m, label: m.replace(/^Ministry of |^Department of /, '') }))} />
          <Select label="Sector" value={sector} onChange={(v) => set({ sector: v })} allLabel="All sectors"
            options={(portfolio?.sectors ?? []).map((s) => ({ value: s.sector, label: s.sector }))} />
          <Select label="Band" value={band} onChange={(v) => set({ band: v })} allLabel="All bands"
            options={BAND_ORDER.map((b) => ({ value: b, label: b }))} />
          {hasFilters && (
            <button className="btn btn-quiet" onClick={() => set({ sector: null, ministry: null, band: null })}>
              Clear filters
            </button>
          )}
        </div>
        <SegmentedControl label="Show" value={n} onChange={(v) => set({ n: String(v) })}
          options={[10, 25, 50, 100].map((v) => ({ value: v, label: String(v) }))} />
      </div>

      {isError && <ErrorCard error={error} retry={() => refetch()} context="The watchlist" />}
      {isLoading && !data && <SkeletonTable rows={10} cols={8} />}

      {data && data.rows.length === 0 && (
        <EmptyState
          title="No projects match these filters"
          message={
            <>
              Active filters:{' '}
              {[sector && `sector = ${sector}`, ministry && `ministry = ${ministry}`, band && `band = ${band}`]
                .filter(Boolean).join(' · ')}
            </>
          }
          action={<button className="btn btn-primary" onClick={() => set({ sector: null, ministry: null, band: null })}>Clear filters</button>}
        />
      )}

      {data && data.rows.length > 0 && (
        <>
          <Section
            flush
            note={
              <>
                Showing <span className="num font-semibold text-ink-2">{data.rows.length}</span> of{' '}
                <span className="num font-semibold text-ink-2">{formatCount(data.total_matched)}</span> matched ·{' '}
                <span className="num font-semibold text-ink-2">{formatCrore(totalExposure)}</span> exposure on this page ·
                ranked by <span className="font-semibold text-ink-2">{weighted ? 'rupee exposure' : 'risk score'}</span>
              </>
            }
          >
            <div data-tour="watchlist-table" className={cx('panel overflow-hidden transition-opacity duration-150', isPlaceholderData && 'opacity-60')}>
              <div className="max-h-[calc(100vh-252px)] overflow-y-auto overflow-x-hidden">
                <table className="tbl tbl-hover tbl-tight">
                  {/*
                    Two header rows. The single flat row was the most damaging
                    thing on this screen: it presented what already happened and
                    what the model expects as peer columns, so a reader going
                    left to right concluded the model was describing the present.
                    The split is structural, which means it never has to be
                    explained out loud.
                  */}
                  <thead className="tbl-sticky">
                    <tr className="tbl-group">
                      <th colSpan={4} />
                      <th colSpan={2}>Already recorded</th>
                      <th colSpan={5} className="tbl-group-predicted">
                        <span className="inline-flex items-center gap-1.5 text-accent">
                          PEWS predicts
                          <Info
                            title="What the model produces"
                            terms={['risk_score', 'prediction_interval', 'exposure_at_risk']}
                          >
                            <p>
                              Everything to the right of this line is forward-looking output from
                              the trained model. Everything to the left is what the monthly return
                              already reported.
                            </p>
                          </Info>
                        </span>
                      </th>
                      <th />
                    </tr>
                    <tr>
                      <th className="w-[28px] n">#</th>
                      <th>Project</th>
                      <th className="w-[92px]">Sector</th>
                      <th className="n w-[76px]">Sanctioned</th>
                      <th className="w-[86px]">
                        <span className="inline-flex items-center gap-1.5">Progress <Info terms={['physical_progress']} /></span>
                      </th>
                      <th className="n w-[48px]">
                        <span className="inline-flex items-center gap-1.5">Checks <Info terms={['deterministic_rules']} /></span>
                      </th>
                      <th className="w-[98px] tbl-group-predicted">
                        <span className="inline-flex items-center gap-1.5">Risk <Info terms={['risk_score', 'risk_band']} /></span>
                      </th>
                      <th className="w-[128px]">
                        <span className="inline-flex items-center gap-1.5">Top driver <Info terms={['shap', 'feature']} /></span>
                      </th>
                      <th className="n w-[68px]">Overrun</th>
                      <th className="n w-[66px]">Delay (mo)</th>
                      <th className="n w-[82px]">
                        <span className="inline-flex items-center gap-1.5">Exposure <Info terms={['exposure_at_risk']} /></span>
                      </th>
                      <th className="w-[18px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr
                        key={r.project_id}
                        data-tour={i === 0 ? 'watchlist-row-top' : undefined}
                        onClick={() => nav(`/project/${r.project_id}`)}
                        // Rank changes on toggle; the transition makes the re-ranking legible.
                        style={{ transition: 'background-color 150ms ease' }}
                      >
                        <td className="n text-ink-3 font-semibold">{r.rank}</td>
                        <td className="max-w-0">
                          <div className="font-medium text-ink truncate" title={r.project_name}>{r.project_name}</div>
                          <div className="num text-2xs text-ink-3 mt-px truncate">
                            {r.project_id}
                            {r.stalled_months > 0 && (
                              <span className="text-risk-high font-semibold"> · stalled {r.stalled_months} mo</span>
                            )}
                          </div>
                        </td>
                        <td className="text-ink-2 truncate" title={r.sector}>{r.sector}</td>
                        <td className="n text-ink-2">{formatCrore(r.original_cost_cr)}</td>
                        <td><ProgressBar value={r.physical_progress_pct} width={42} /></td>
                        <td className="n">
                          {r.alert_count > 0 ? (
                            <span className="num inline-grid place-items-center w-[19px] h-[19px] rounded-full
                                             bg-riskbg-high text-risk-high text-2xs font-bold">
                              {r.alert_count}
                            </span>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="tbl-group-predicted"><RiskBadge band={r.risk_band} score={r.risk_score} size="sm" /></td>
                        <td className="max-w-0">
                          {/*
                            A ranked list with no reasons is a scoreboard. With
                            one it is a work queue, and the "why" arrives before
                            the judge has to ask for it.
                          */}
                          <div className="text-[12px] text-ink truncate" title={r.top_driver?.text ?? undefined}>
                            {r.top_driver?.label ?? '—'}
                          </div>
                        </td>
                        <td className="n font-semibold text-ink">{formatPct(r.pred_cost_overrun_pct, 1, true)}</td>
                        <td className="n text-ink">+{r.pred_delay_months.toFixed(1)}</td>
                        <td className={cx('n font-semibold', weighted ? 'text-accent' : 'text-ink')}>
                          {formatCrore(r.exposure_at_risk_cr)}
                        </td>
                        <td>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="row-arrow">
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          <p className="text-[12px] text-ink-3 mt-3 max-w-4xl leading-relaxed">
            Weighting by <Term k="exposure_at_risk">exposure</Term> re-ranks this queue from{' '}
            <em>most likely to fail</em> to <em>most rupees at stake</em> — a ₹5,200 Cr project at 62% risk
            outranks a ₹210 Cr project at 84%.
          </p>
        </>
      )}
    </Page>
  );
}
