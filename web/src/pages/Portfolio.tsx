import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio, useRegistry } from '../api/hooks';
import { BandDistribution, GlobalDrivers, SectorMatrix } from '../components/charts';
import { ErrorCard, Metric, Page, Panel, ProvenanceNote, Section, Select, Skeleton } from '../components/ui';
import { Info, Term } from '../components/Info';
import { croreParts, formatCount, formatCrore, formatPct } from '../lib/format';
import type { Registry, RiskBand } from '../api/types';
import { HERO_PROJECT } from '../lib/demo';

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
  const { data: registry } = useRegistry();

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
      lede={<>Early-warning signals across the monitored central sector infrastructure portfolio, scored from the monthly <Term k="cuf" /> returns.</>}
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
        <div className="space-y-4">
          {/*
            The product's actual claim, stated before the portfolio it is a claim
            about. Without this the landing screen answers "how big is the
            portfolio", which is not what PEWS is for.
          */}
          {registry && <ClaimBand registry={registry} />}

          {/* ---- headline: scale and money first, hierarchy not five equal cards ---- */}
          <div className="panel p-4" data-tour="portfolio-headline">
            <div className="grid grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-6 divide-x divide-line">
              <div>
                <Metric
                  label="Revised portfolio value"
                  value={croreParts(data.kpis.revised_cost_cr).value}
                  unit={croreParts(data.kpis.revised_cost_cr).unit}
                  size="hero"
                  hint={
                    <>
                      <span className="num font-semibold text-ink-2">{formatCount(data.kpis.projects_monitored)}</span> projects ·{' '}
                      <span className="num font-semibold text-ink-2">{data.kpis.ministries}</span> ministries ·{' '}
                      <span className="num font-semibold text-ink-2">{data.kpis.sectors}</span> sectors
                    </>
                  }
                />

                <div className="mt-4 pt-3.5 border-t border-line-faint space-y-2">
                  {[
                    ['Sanctioned', data.kpis.original_cost_cr, '#A9BBD4'],
                    ['Revised', data.kpis.revised_cost_cr, '#1B3F73'],
                    ['Spent to date', data.kpis.expenditure_cr, '#7C8492'],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="grid grid-cols-[86px_1fr_84px] items-center gap-2.5">
                      <span className="text-[11.5px] text-ink-2">{label as string}</span>
                      <span className="h-[9px] rounded-[2px]"
                        style={{ width: `${((value as number) / data.kpis.revised_cost_cr) * 100}%`, background: color as string }} />
                      <span className="num text-[11.5px] font-semibold text-ink text-right">{formatCrore(value as number)}</span>
                    </div>
                  ))}

                  {/*
                    The insight in these three bars is the distance between the
                    first two. Leaving the reader to measure it by eye is what
                    makes a chart decorative — so the gap is drawn and labelled.
                  */}
                  <div className="grid grid-cols-[86px_1fr_84px] items-center gap-2.5 pt-0.5">
                    <span />
                    <span className="relative block h-[15px]">
                      <span
                        className="absolute top-0 h-[7px] border-x border-b border-risk-critical/55"
                        style={{ left: `${(data.kpis.original_cost_cr / data.kpis.revised_cost_cr) * 100}%`, right: 0 }}
                      />
                      <span
                        className="num absolute top-[7px] text-[10.5px] font-bold text-risk-critical whitespace-nowrap -translate-x-1/2"
                        style={{ left: `${((data.kpis.original_cost_cr / data.kpis.revised_cost_cr) * 100 + 100) / 2}%` }}
                      >
                        +{formatPct(data.kpis.overrun_pct, 1)}
                      </span>
                    </span>
                    <span className="num text-[11.5px] font-semibold text-risk-critical text-right">
                      {formatCrore(data.kpis.overrun_cr, { sign: true })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pl-6">
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
                <div className="mt-3 pt-3 border-t border-line-faint">
                  <Metric
                    label="Expenditure to date"
                    value={croreParts(data.kpis.expenditure_cr).value}
                    unit={croreParts(data.kpis.expenditure_cr).unit}
                    size="sm"
                    hint={`${data.kpis.expenditure_pct_of_revised.toFixed(1)}% of revised portfolio value`}
                  />
                </div>
              </div>

              <div className="pl-6" data-tour="portfolio-bands">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <Metric
                    label="Predicted exposure at risk"
                    value={croreParts(data.kpis.exposure_at_risk_cr).value}
                    unit={croreParts(data.kpis.exposure_at_risk_cr).unit}
                    size="lg"
                    tone="critical"
                    info={<Info terms={['exposure_at_risk', 'probability']} />}
                    // The one term where hiding the arithmetic behind the "i" is
                    // wrong: read cold, "₹X crore at risk" means "₹X crore will
                    // be lost", which is alarming and false.
                    hint="revised cost, weighted by failure probability"
                  />
                  <Metric
                    label="Critical band"
                    value={formatCount(data.kpis.critical_count)}
                    size="lg"
                    hint="projects"
                    className="text-right"
                    info={<Info terms={['risk_band', 'risk_score']} />}
                  />
                </div>
                <BandDistribution bands={data.bands} total={data.kpis.projects_monitored} onSelect={(b) => toWatchlist(sector || undefined, b)} />
              </div>
            </div>
          </div>

          {/* ---- where to look, and what the model is keying on ---- */}
          <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-4">
            <Section
              title="Risk concentration by sector"
              info={<Info terms={['exposure_at_risk', 'risk_band']} title="Reading this chart" />}
              note={<>
                <span className="num font-semibold text-ink-2">6</span> of{' '}
                <span className="num font-semibold text-ink-2">{data.sectors.length}</span> sectors ·
                bar length is money at risk, segments are risk bands
              </>}
              actions={<button className="btn btn-quiet" onClick={() => toWatchlist()}>Open watchlist →</button>}
            >
              <Panel tour="portfolio-sectors">
                <SectorMatrix sectors={data.sectors} onSelect={toWatchlist} limit={6} />
                {data.sectors.length > 6 && (
                  <div className="mt-3 pt-2.5 border-t border-line-faint flex items-center justify-between">
                    <span className="text-[12px] text-ink-3">
                      The remaining {data.sectors.length - 6} sectors carry{' '}
                      <span className="num font-semibold text-ink-2">
                        {formatCrore(data.sectors.slice(6).reduce((a, x) => a + x.exposure_at_risk_cr, 0))}
                      </span>{' '}
                      between them.
                    </span>
                    <button className="btn btn-quiet h-7" onClick={() => toWatchlist()}>View all sectors →</button>
                  </div>
                )}
              </Panel>
            </Section>

            <Section
              title="What drives risk across the portfolio"
              note="averaged over every scored project"
              info={<Info terms={['shap', 'feature']} title="How this is calculated" />}
            >
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

/* ------------------------------------------------------------- claim band */

/**
 * The lead-time claim, stated on the landing screen.
 *
 * A judge who spends ninety seconds here and never opens a replay should still
 * leave knowing what PEWS asserts and where to go to check it. The figure is
 * read from the model registry — the same source the Evidence page reads out —
 * so it cannot drift away from the evidence behind it.
 */
function ClaimBand({ registry }: { registry: Registry }) {
  return (
    <div className="panel emph claim-band px-5 py-4 flex items-center gap-6">
      <div className="flex items-baseline gap-3 shrink-0">
        <span className="num text-4xl font-semibold tracking-[-0.035em] leading-none text-accent">
          {registry.lead_time_median}
        </span>
        <span className="text-[13px] font-semibold text-accent leading-tight">
          months of<br />early warning
        </span>
      </div>

      <div className="w-px self-stretch bg-accent-line shrink-0" aria-hidden />

      <p className="text-[14px] text-ink leading-[1.55] min-w-0 flex-1 max-w-3xl">
        Replayed across the monitored portfolio, PEWS crossed its{' '}
        <Term k="alert_threshold">alert threshold</Term> a{' '}
        <Term k="median">median</Term> of{' '}
        <span className="num font-semibold">{registry.lead_time_median} months</span> before the
        first official cost or date revision was filed — half of them between{' '}
        <span className="num font-semibold">{registry.lead_time_p25}</span> and{' '}
        <span className="num font-semibold">{registry.lead_time_p75}</span> months.
        <span className="block text-[12.5px] text-ink-3 mt-1">
          Measured on held-out projects, against generated revision events. The whole distribution
          is on the Evidence page.
        </span>
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <Link to="/evidence" className="btn btn-ghost h-9 px-3">How it was measured</Link>
        <Link to={`/project/${HERO_PROJECT}/replay`} className="btn btn-primary h-9 px-4">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8M3 4v4h4" />
          </svg>
          Replay the case
        </Link>
      </div>
    </div>
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
      <div className="grid grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-4">
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
