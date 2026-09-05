import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio } from '../api/hooks';
import { BandDistribution, GlobalDrivers, SectorMatrix } from '../components/charts';
import { ErrorCard, Metric, Page, Panel, ProvenanceNote, Section, Select, Skeleton } from '../components/ui';
import { croreParts, formatCount, formatCrore, formatPct } from '../lib/format';
import type { RiskBand } from '../api/types';

export default function Portfolio() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const sector = params.get('sector') ?? '';
  const ministry = params.get('ministry') ?? '';

  const { data, isLoading, isError, error, refetch } = usePortfolio({
    sector: sector || undefined,
    ministry: ministry || undefined,
  });
  // Options come from the unfiltered aggregate (cached, no extra fetch) so
  // narrowing to one sector never removes the other choices from the dropdown.
  const { data: all } = usePortfolio();

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };

  const toWatchlist = (s?: string, band?: RiskBand) => {
    const q = new URLSearchParams();
    if (s) q.set('sector', s);
    if (ministry) q.set('ministry', ministry);
    if (band) q.set('band', band);
    nav(`/watchlist?${q}`);
  };

  return (
    <Page
      title="Infrastructure Risk Intelligence"
      lede="Early-warning signals across the monitored central sector infrastructure portfolio. Scores are model output, not recorded outcomes."
      actions={
        all ? (
          <>
            <Select label="Ministry" value={ministry} onChange={(v) => setParam('ministry', v)} allLabel="All ministries"
              options={all.ministries.map((m) => ({ value: m, label: m.replace(/^Ministry of |^Department of /, '') }))} />
            <Select label="Sector" value={sector} onChange={(v) => setParam('sector', v)} allLabel="All sectors"
              options={all.sectors.map((s) => ({ value: s.sector, label: s.sector }))} />
          </>
        ) : null
      }
    >
      {isError && <ErrorCard error={error} retry={() => refetch()} context="The portfolio summary" />}

      {isLoading && <PortfolioSkeleton />}

      {data && (
        <div className="space-y-5">
          {/* ---- headline: scale and money first, hierarchy not five equal cards ---- */}
          <div className="panel p-5">
            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-7 divide-x divide-line">
              <div>
                <Metric
                  label="Revised portfolio value"
                  value={croreParts(data.kpis.revised_cost_cr).value}
                  unit={croreParts(data.kpis.revised_cost_cr).unit}
                  size="hero"
                  hint={
                    <>
                      Sanctioned at <span className="num font-semibold text-ink-2">{formatCrore(data.kpis.original_cost_cr)}</span> across{' '}
                      <span className="num font-semibold text-ink-2">{formatCount(data.kpis.projects_monitored)}</span> projects,{' '}
                      <span className="num font-semibold text-ink-2">{data.kpis.ministries}</span> ministries,{' '}
                      <span className="num font-semibold text-ink-2">{data.kpis.sectors}</span> sectors.
                    </>
                  }
                />
              </div>

              <div className="pl-7">
                <Metric
                  label="Cost overrun already incurred"
                  value={croreParts(data.kpis.overrun_cr).value}
                  unit={croreParts(data.kpis.overrun_cr).unit}
                  size="lg"
                  hint={
                    <>
                      <span className="num font-semibold text-ink-2">{formatPct(data.kpis.overrun_pct, 1)}</span> above sanctioned cost —
                      recorded after the fact by the existing monitoring cycle.
                    </>
                  }
                />
                <div className="mt-4 pt-4 border-t border-line-faint">
                  <Metric
                    label="Expenditure to date"
                    value={croreParts(data.kpis.expenditure_cr).value}
                    unit={croreParts(data.kpis.expenditure_cr).unit}
                    size="sm"
                    hint={`${data.kpis.expenditure_pct_of_revised.toFixed(1)}% of revised portfolio value`}
                  />
                </div>
              </div>

              <div className="pl-7">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <Metric
                    label="Predicted exposure at risk"
                    value={croreParts(data.kpis.exposure_at_risk_cr).value}
                    unit={croreParts(data.kpis.exposure_at_risk_cr).unit}
                    size="lg"
                    tone="critical"
                  />
                  <Metric
                    label="Critical band"
                    value={formatCount(data.kpis.critical_count)}
                    size="lg"
                    hint="projects"
                    className="text-right"
                  />
                </div>
                <BandDistribution bands={data.bands} total={data.kpis.projects_monitored} onSelect={(b) => toWatchlist(sector || undefined, b)} />
              </div>
            </div>
          </div>

          {/* ---- where to look, and what the model is keying on ---- */}
          <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-5">
            <Section
              title="Risk concentration by sector"
              note="Bar length is predicted rupee exposure · segments are risk-band composition"
              actions={<button className="btn btn-quiet" onClick={() => toWatchlist()}>Open watchlist →</button>}
            >
              <Panel>
                <SectorMatrix sectors={data.sectors} onSelect={toWatchlist} limit={10} />
              </Panel>
            </Section>

            <Section title="What the model keys on" note="mean |SHAP| across the scored portfolio">
              <Panel>
                <GlobalDrivers drivers={data.drivers} />
              </Panel>
            </Section>
          </div>

          <ProvenanceNote className="pt-1" />
        </div>
      )}
    </Page>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-5">
      <div className="panel p-5 grid grid-cols-3 gap-7 divide-x divide-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className={i ? 'pl-7' : ''}>
            <Skeleton className="h-2.5 w-28 mb-3" />
            <Skeleton className="h-8 w-44 mb-3" />
            <Skeleton className="h-2.5 w-full mb-1.5" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-5">
        <div className="panel p-4 space-y-2.5">
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-6" />)}
        </div>
        <div className="panel p-4 space-y-2.5">
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-4" />)}
        </div>
      </div>
    </div>
  );
}
