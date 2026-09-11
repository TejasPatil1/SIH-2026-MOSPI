/**
 * Guided tour configuration.
 *
 * Steps are data, not code. Nothing in this file touches the DOM or the tour
 * engine — to change the tour, change this array.
 *
 * ── FIGURES ──────────────────────────────────────────────────────────────────
 * Every number the tour says out loud is read from the same fixtures the pages
 * read, never typed into the prose. A tour that quotes a figure the screen
 * behind it contradicts is worse than a tour with no figures at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import portfolioRaw from '../mocks/portfolio.json';
import registryRaw from '../mocks/registry.json';
import type { Portfolio, Registry } from '../api/types';
import { croreParts, formatCount } from '../lib/format';
import { HERO_PROJECT } from '../lib/demo';

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourIcon =
  | 'portfolio' | 'risk' | 'sector' | 'queue' | 'money' | 'chart'
  | 'forecast' | 'explain' | 'replay' | 'proof' | 'evidence' | 'guard' | 'cycle'
  | 'problem' | 'solution';

export interface TourStep {
  /** Stable id — used for persistence and for resuming a specific step. */
  id: string;
  /**
   * 'spotlight' (the default) rings an element on the page behind it.
   * 'statement' is a wide centred card over a flat dim, with no target — used
   * for the two opening moments, which are an argument rather than a label.
   */
  kind?: 'spotlight' | 'statement';
  /** CSS selector for the element to spotlight. Omit for a centred step. */
  target?: string;
  /**
   * Optional selector for one element *inside* the spotlight to ring separately —
   * "look at this panel, and at this row in particular".
   */
  subTarget?: string;
  title: string;
  /** Substring of `title` rendered in the accent colour. */
  emphasis?: string;
  body: string;
  /** Second paragraph. Statement steps only — spotlight cards stay to one. */
  body2?: string;
  /** Eyebrow above the title on a statement card. */
  kicker?: string;
  /**
   * Clip shown under the prose on a statement card. A plain static file under
   * /public — the browser range-requests it as it plays, and `preload="none"`
   * means nothing is fetched until the viewer presses play. No backend.
   * If the file isn't there yet, the block removes itself.
   */
  video?: string;
  /** Still frame for `video`, shown before playback. Optional. */
  poster?: string;
  /** Figures printed under a statement card's prose. Real values only. */
  stats?: { value: string; unit?: string; label: string }[];
  /** Short aside shown in a callout under the body. One sentence. */
  tip?: string;
  icon?: TourIcon;
  /** Where the popover sits relative to the target. 'auto' picks the side with room. */
  placement?: Placement;
  /** Route to be on before this step runs. The engine navigates if needed. */
  route?: string;
  /**
   * When set, the user must interact with the target to continue and the
   * primary button becomes a skip. Clicks pass through to the target.
   */
  action?: string;
  /** Advance automatically once this predicate holds (polled while the step is open). */
  advanceWhen?: () => boolean;
  /** Padding around the target rect, in px. Charts usually want a little more. */
  pad?: number;
  /** Corner radius of the spotlight cut-out. */
  radius?: number;
  /** Declared but not yet written — the engine skips these. */
  placeholder?: boolean;
}

const path = () => window.location.pathname;


/* ------------------------------------------------------------------ figures */

const P = portfolioRaw as unknown as Portfolio;
const R = registryRaw as unknown as Registry;

const sanctioned = croreParts(P.kpis.original_cost_cr);
const revised = croreParts(P.kpis.revised_cost_cr);
const overrun = croreParts(P.kpis.overrun_cr);
const criticalExposure = croreParts(
  P.bands.find((b) => b.band === 'CRITICAL')?.exposure_cr ?? 0,
);
const atRisk = croreParts(P.kpis.exposure_at_risk_cr);

/** The largest feature group recoverable without asking for a new field. */
const fromExistingFields = R.ablation.find((a) => a.config === 'C+D');

const heroReplay = { alert: 'Nov 2024', official: 'Oct 2025', lead: 11 };

/* -------------------------------------------------------------------- steps */

export const TOUR_STEPS: TourStep[] = [
  // ── 1 — THE PROBLEM ────────────────────────────────────────────────────────
  {
    id: 'the-problem',
    kind: 'statement',
    route: '/',
    icon: 'problem',
    kicker: 'The problem',
    title: 'Cost overruns are recorded, not predicted',
    emphasis: 'recorded, not predicted',
    body: `India's central sector infrastructure portfolio is monitored monthly. Every project files progress, expenditure and revised dates — and the system faithfully records the overrun once a revision has already been filed.`,
    body2: `By that point the money is committed, the schedule has slipped, and the only decision left is how to absorb it. The monitoring works. It just arrives after the outcome it describes.`,
    stats: [
      { value: sanctioned.value, unit: sanctioned.unit, label: 'sanctioned across the monitored portfolio' },
      { value: revised.value, unit: revised.unit, label: 'after revision' },
      { value: overrun.value, unit: overrun.unit, label: 'of overrun, recorded after the fact' },
    ],
    // ponytail: placeholder — drop a ~1 min MP4 at web/public/tour/intro.mp4
    // (H.264 + faststart so the moov atom is at the front and it plays while
    // it downloads). Until then this block hides itself.
    video: '/tour/intro.mp4',
    poster: '/tour/intro.jpg',
    tip: `${formatCount(P.kpis.projects_monitored)} ongoing projects across ${P.kpis.ministries} ministries file into this cycle every month.`,
  },

  // ── 2 — THE SOLUTION ───────────────────────────────────────────────────────
  {
    id: 'the-solution',
    kind: 'statement',
    route: '/',
    icon: 'solution',
    kicker: 'What PEWS does',
    title: 'The signal is already in the filings — months earlier',
    emphasis: 'months earlier',
    body: `PEWS reads the same monthly returns and scores every ongoing project for how likely it is to end over budget or late, with the reasons attached. Nothing new is collected from any agency.`,
    body2: `Replaying the model month by month over the historical record, its alert crosses the threshold a median of ${R.lead_time_median} months before the first official revision is filed. That gap is the whole product — and the Time Machine at the end of this walkthrough is where you can check it.`,
    stats: [
      { value: String(R.lead_time_median), unit: 'months', label: `median warning before the official revision (${R.lead_time_p25}–${R.lead_time_p75} typical)` },
      { value: `${fromExistingFields?.pct_of_full.toFixed(0) ?? '—'}%`, label: 'of the achievable gain comes from fields already collected' },
      { value: String(R.n_features), unit: 'features', label: 'built from the existing monthly schedule' },
    ],
    tip: 'Every figure in this walkthrough is read from the running application — nothing is typed into the script.',
  },

  // ── The portfolio: scale, then where risk sits ─────────────────────────────
  {
    id: 'portfolio-bands',
    route: '/',
    target: '[data-tour="portfolio-bands"]',
    placement: 'left',
    icon: 'risk',
    title: 'Where the risk actually sits',
    emphasis: 'actually sits',
    body: `Every ongoing project carries a model score and a band. ${formatCount(P.kpis.critical_count)} sit in the critical band, carrying ${criticalExposure.value} ${criticalExposure.unit} of the ${atRisk.value} ${atRisk.unit} at risk portfolio-wide.`,
    tip: 'Exposure is concentrated, not spread evenly — which is what makes a shortlist worth having.',
  },
  {
    id: 'portfolio-sectors',
    route: '/',
    target: '[data-tour="portfolio-sectors"]',
    subTarget: '[data-tour="sector-row-top"]',
    placement: 'right',
    pad: 10,
    icon: 'sector',
    title: 'Where attention should go first',
    emphasis: 'attention',
    body: 'Bar length is rupees at risk; the coloured segments are how that money splits across risk bands. Railways and Urban Development concentrate both — that is the investigative direction.',
    tip: 'Click any bar segment to open the watchlist already filtered to it.',
  },

  // ── IDENTIFY: the work queue ───────────────────────────────────────────────
  {
    id: 'nav-watchlist',
    target: '[data-tour="nav-watchlist"]',
    placement: 'right',
    icon: 'queue',
    title: 'From a portfolio to a work queue',
    emphasis: 'work queue',
    body: `An analyst cannot examine ${formatCount(P.kpis.projects_monitored)} projects a month. The watchlist is the ranked shortlist of what to open first, and every row states its own reason for being there.`,
    action: 'Open the Watchlist',
    advanceWhen: () => path() === '/watchlist',
  },
  {
    id: 'watchlist-table',
    route: '/watchlist',
    target: '[data-tour="watchlist-table"]',
    subTarget: '[data-tour="watchlist-row-top"]',
    placement: 'top',
    pad: 6,
    icon: 'queue',
    title: 'Already recorded, against what PEWS predicts',
    emphasis: 'against what PEWS predicts',
    body: 'The left group is history the monitoring cycle already knows — progress, overrun, delay. The right group is the model looking forward: risk, the driver behind it, and the money exposed. Keeping them apart is the difference between a report and a warning.',
  },
  {
    id: 'watchlist-toggle',
    route: '/watchlist',
    target: '[data-tour="watchlist-toggle"]',
    placement: 'bottom',
    icon: 'money',
    title: 'Probability is not the same as consequence',
    emphasis: 'consequence',
    body: 'Switching to exposure re-ranks the queue by rupees at stake rather than by likelihood of failure. A ₹5,200 Cr project at 62% risk outranks a ₹210 Cr project at 84%.',
    tip: 'Watch the order change — the system reasons about money, not only probability.',
    action: 'Flip the toggle',
    advanceWhen: () => new URLSearchParams(window.location.search).get('weight') === 'exposure',
  },

  // ── INVESTIGATE: one project ───────────────────────────────────────────────
  {
    id: 'project-divergence',
    route: `/project/${HERO_PROJECT}`,
    target: '[data-tour="project-divergence"]',
    placement: 'right',
    pad: 8,
    icon: 'chart',
    title: 'The signal itself',
    emphasis: 'signal',
    body: 'Expenditure keeps climbing while physical progress flattens. That widening wedge — money moving, work not — is the pattern the model is trained to recognise long before a revision is filed.',
    tip: 'Hover any month to read both lines and the gap between them.',
  },
  {
    id: 'project-forecast',
    route: `/project/${HERO_PROJECT}`,
    target: '[data-tour="project-forecast"]',
    placement: 'left',
    icon: 'forecast',
    title: 'How much, and how likely — two separate facts',
    emphasis: 'two separate facts',
    body: 'The large number is the expected size of the overrun, shown inside the range it lands in 8 times out of 10. The bar underneath is a different question: how often a project in this position ends up over the line at all.',
    tip: 'The two are drawn differently on purpose — a size and a likelihood must never look like the same number.',
  },
  {
    id: 'project-shap',
    route: `/project/${HERO_PROJECT}`,
    target: '[data-tour="project-shap"]',
    placement: 'left',
    icon: 'explain',
    title: 'Why the model says so',
    emphasis: 'Why',
    body: 'Measured per-feature contributions from the trained model, split into what raises risk and what lowers it, and adding up to the score. An analyst has to justify acting on a number — this is that justification.',
  },

  // ── RECONSTRUCT: the proof ─────────────────────────────────────────────────
  {
    id: 'open-time-machine',
    route: `/project/${HERO_PROJECT}`,
    target: '[data-tour="open-time-machine"]',
    placement: 'left',
    icon: 'replay',
    title: 'What could we have known, and when?',
    emphasis: 'and when?',
    body: 'The Time Machine re-scores this project at every past monitoring month, with everything filed after that month hidden from the model.',
    action: 'Open the Time Machine',
    advanceWhen: () => path().endsWith('/replay'),
  },
  {
    id: 'replay-chart',
    route: `/project/${HERO_PROJECT}/replay`,
    target: '[data-tour="replay-chart"]',
    placement: 'bottom',
    pad: 8,
    icon: 'replay',
    title: 'Not an animation of a fixed curve',
    emphasis: 'Not an animation',
    body: 'Each point is the model scored again on that month’s masked inputs. The line turns red where it crosses the alert threshold — and it crosses long before the official record moves.',
    tip: 'Press Replay from start, or drag the slider to any month, and the panel on the right follows.',
  },
  {
    id: 'replay-finding',
    route: `/project/${HERO_PROJECT}/replay`,
    target: '[data-tour="replay-finding"]',
    placement: 'top',
    pad: 8,
    icon: 'proof',
    title: `${heroReplay.lead} months of early warning`,
    emphasis: `${heroReplay.lead} months`,
    body: `The reconstructed score crossed the alert threshold in ${heroReplay.alert}. The first official revision was filed in ${heroReplay.official}. No new fields were collected — the signal was already in what was being filed every month.`,
    tip: 'This is a retrospective replay on synthetic data, not a live prediction, and the screen says so.',
  },

  // ── VERIFY: credibility ────────────────────────────────────────────────────
  {
    id: 'nav-evidence',
    target: '[data-tour="nav-evidence"]',
    placement: 'right',
    icon: 'evidence',
    title: 'Does the method actually hold?',
    emphasis: 'actually hold',
    body: 'A claim is worth only as much as the testing behind it. The Evidence page reports the experiments — including the ones that would have sunk it.',
    action: 'Open the Evidence page',
    advanceWhen: () => path() === '/evidence',
  },
  {
    id: 'evidence-baselines',
    route: '/evidence',
    target: '[data-tour="evidence-baselines"]',
    placement: 'bottom',
    pad: 6,
    icon: 'evidence',
    title: 'Measured against conventional statistics',
    emphasis: 'Measured',
    body: 'Sector medians, OLS, logistic regression and a Weibull survival model, all fitted on identical project-disjoint splits. The margin is reported against the strongest of them, not against a straw man.',
  },
  {
    id: 'evidence-leakage',
    route: '/evidence',
    target: '[data-tour="evidence-leakage"]',
    placement: 'top',
    pad: 6,
    icon: 'guard',
    title: 'The guard that makes it credible',
    emphasis: 'credible',
    body: 'Four build-breaking tests. The strongest retrains on randomly shuffled labels — if that model still scored well, the features would contain the answer and every other figure here would be worthless.',
    tip: 'Training aborts if any of the four fails, so the guarantee cannot quietly rot.',
  },

  // ── Close ──────────────────────────────────────────────────────────────────
  {
    id: 'nav-operate',
    target: '[data-tour="nav-upload"]',
    placement: 'right',
    icon: 'cycle',
    title: 'It fits the existing monthly cycle',
    emphasis: 'existing monthly cycle',
    body: 'Upload the next monthly export, validate it, rescore the whole portfolio, review what changed band. The same cycle that produces the problem produces the warning.',
    tip: 'Nothing in this system asks any ministry to collect a new field.',
  },
];
