/**
 * Every technical term the interface uses, defined once.
 *
 * House rules for an entry:
 *  - `short` must stand alone. A judge who has never seen the term should
 *    understand it from that sentence without reading `why`.
 *  - `why` answers "so what?" in this product. Optional.
 *  - Roughly forty words is the ceiling. A concept that needs more than that
 *    belongs in a page section, not in a help popover.
 *  - No term is defined in a page file. If it needs explaining, it goes here,
 *    so the same word never gets two different explanations.
 */
export interface TermDef {
  /** The word as the interface spells it. */
  term: string;
  /** Plain-language definition. Must stand alone. */
  short: string;
  /** Why it matters here. Optional. */
  why?: string;
}

export const GLOSSARY = {
  /* --------------------------------------------------------- model output */
  risk_score: {
    term: 'Risk score',
    short: 'A 0–100 score for how likely a project is to finish over budget or late. Higher means more likely.',
    why: 'It decides what an analyst looks at first. It is not a verdict on the project or its agency.',
  },
  risk_band: {
    term: 'Risk band',
    short: 'The risk score sorted into four labels — Low, Watch, High and Critical.',
    why: 'Bands make the queue workable without arguing over one-point differences between projects.',
  },
  exposure_at_risk: {
    term: 'Exposure at risk',
    short: 'Money that could be lost: revised project cost × predicted overrun × the probability of that overrun.',
    why: 'A tiny project almost certain to fail can matter less than a huge one that is only somewhat likely to.',
  },
  prediction_interval: {
    term: 'Prediction range',
    short: 'The range the real outcome is expected to land in about 8 times out of 10.',
    why: 'A single number would claim a precision the model does not have.',
  },
  probability: {
    term: 'Probability',
    short: 'How often an outcome like this one actually occurs, as a percentage.',
    why: 'Different from the size of the outcome. A 90% chance of a small overrun is a different problem from a 30% chance of a huge one.',
  },
  point_estimate: {
    term: 'Central estimate',
    short: 'The single most likely value — the middle of the predicted range.',
  },
  calibration: {
    term: 'Calibration',
    short: 'Whether stated probabilities match reality: of projects given a 70% chance, about 70% should actually overrun.',
    why: 'A score can rank projects correctly and still be useless for deciding how much to worry. Calibration is what fixes that.',
  },
  isotonic: {
    term: 'Isotonic calibration',
    short: 'A correction applied after training that rescales raw model outputs until they match observed frequencies.',
  },
  quantile: {
    term: 'Quantile models',
    short: 'Three models trained separately — one for the low end of the range, one for the middle, one for the high end.',
    why: 'This is what produces a real range, rather than one guess with an error bar bolted on.',
  },

  /* ---------------------------------------------------------- explanation */
  shap: {
    term: 'Feature contribution',
    short: 'How many points each piece of information added to, or subtracted from, this project’s risk score.',
    why: 'The parts add up exactly: portfolio average plus every contribution equals the score.',
  },
  base_rate: {
    term: 'Portfolio average',
    short: 'The score an average monitored project gets before anything specific to this one is considered.',
    why: 'It is the starting point the contributions are measured from.',
  },

  /* ------------------------------------------------------------ comparison */
  median: {
    term: 'Median',
    short: 'The middle value: half of comparable projects sit above it, half below.',
    why: 'Used instead of the average because a handful of very large projects would drag an average away from typical.',
  },
  percentile: {
    term: 'Percentile',
    short: 'Position in the line-up. 80th percentile means this project is worse than 80 out of every 100 comparable ones.',
  },
  cohort: {
    term: 'Comparison group',
    short: 'The projects this one is measured against — same sector, similar size and stage.',
    why: 'Comparing a metro extension against a rural road would make both look wrong.',
  },
  benchmark: {
    term: 'Benchmark',
    short: 'The typical value for the comparison group — the line this project is judged against.',
  },

  /* -------------------------------------------------------------- signals */
  physical_progress: {
    term: 'Physical progress',
    short: 'How much of the actual construction is finished, as a percentage, as reported in the monthly filing.',
  },
  financial_progress: {
    term: 'Financial progress',
    short: 'How much of the budget has been spent, as a percentage of the revised project cost.',
  },
  spend_gap: {
    term: 'Spend-to-work gap',
    short: 'Money spent minus work completed, in percentage points. +15 means 15% more of the budget is gone than of the construction.',
    why: 'A widening gap is the strongest early signal in this system — money moving while work is not.',
  },
  stall: {
    term: 'Stall',
    short: 'A run of consecutive monthly filings reporting no measurable physical progress.',
  },
  lead_time: {
    term: 'Lead time',
    short: 'How many months ahead of the official record the model raised its warning.',
    why: 'This is the point of the whole system: notice while there is still time to act.',
  },
  alert_threshold: {
    term: 'Alert threshold',
    short: 'The risk score at which a project is escalated for review.',
    why: 'Set to balance catching real failures against burying analysts in false alarms.',
  },
  data_quality: {
    term: 'Data quality flag',
    short: 'Marks projects whose recent filings are missing or out of date, so a score built on thin evidence is not read as confident.',
  },

  /* -------------------------------------------------------- evidence page */
  pr_auc: {
    term: 'PR-AUC',
    short: 'A 0–1 score for how well a method finds rare events. It rewards catching projects that really do fail and penalises false alarms.',
    why: 'Used instead of plain accuracy because most projects do not overrun — so always answering "fine" would score well and be worthless.',
  },
  roc_auc: {
    term: 'ROC-AUC',
    short: 'The chance the method scores a project that fails above one that does not. 0.5 is a coin flip; 1.0 is perfect.',
  },
  brier: {
    term: 'Brier score',
    short: 'Average squared error of the stated probabilities. Lower is better, 0 is perfect.',
    why: 'Measures whether the probabilities can be trusted, not just whether the ranking is right.',
  },
  mae: {
    term: 'Average error (MAE)',
    short: 'The typical size of a miss, ignoring whether it was high or low.',
    why: 'Stated in the units of the thing predicted — 7.4 pp means the cost forecast is off by about 7.4 percentage points on average.',
  },
  baseline: {
    term: 'Baseline',
    short: 'A deliberately simpler method run on identical data, to show what the complicated one is actually buying.',
  },
  ablation: {
    term: 'Ablation',
    short: 'Retraining the model with groups of information removed, to measure what each group is really worth.',
    why: 'Answers "is collecting this extra data worth it?" with a number instead of an opinion.',
  },
  leakage: {
    term: 'Data leakage',
    short: 'When information that would not have existed yet leaks into training, letting the model effectively see the answer.',
    why: 'The most common reason a forecasting result turns out to be worthless, so it is tested for explicitly.',
  },
  disjoint_split: {
    term: 'Project-disjoint split',
    short: 'No single project appears in both the training data and the testing data.',
    why: 'Otherwise the model could memorise a project one month and be tested on it the next.',
  },
  holdout: {
    term: 'Held-out data',
    short: 'Records set aside and never trained on, kept only for measuring performance.',
  },
  shuffled_label: {
    term: 'Shuffled-label test',
    short: 'Train the model on randomly scrambled answers. It must then score no better than chance.',
    why: 'If it still scores well, the inputs secretly contain the answer and every other figure is meaningless.',
  },
  survivorship: {
    term: 'Survivorship bias',
    short: 'Only finished projects have known outcomes, so projects that stalled indefinitely are under-represented in training.',
  },
  censoring: {
    term: 'Censoring',
    short: 'Projects still running have no final outcome yet — known to be unfinished, but not how they end.',
  },
  gbdt: {
    term: 'Gradient-boosted trees',
    short: 'The model used here: many small decision trees, each correcting the mistakes of the ones before it.',
    why: 'The standard choice for tabular records like these, and it supports per-project explanations.',
  },
  survival_model: {
    term: 'Survival model',
    short: 'A statistical method for predicting how long until an event happens, built to handle cases that have not finished yet.',
  },
  ols: {
    term: 'Linear regression',
    short: 'The classic statistical method: fit a straight-line relationship between the inputs and the outcome.',
  },
  logistic: {
    term: 'Logistic regression',
    short: 'The classic statistical method for yes/no outcomes, returning a probability.',
  },
  feature: {
    term: 'Feature',
    short: 'One input the model reads — a single column, such as elapsed months or the spend-to-work gap.',
  },
  snapshot_row: {
    term: 'Monthly snapshot',
    short: 'One project as it stood in one month. A project monitored for four years contributes about 48 of them.',
  },
  split_strategy: {
    term: 'Split strategy',
    short: 'How records were divided into training and testing sets, and on what rule.',
    why: 'The rule matters more than the sizes: a careless split is how leakage gets in.',
  },

  /* -------------------------------------------------------------- process */
  cuf: {
    term: 'CUF',
    short: 'Comprehensive Updation Format — the monthly return every monitored project already files with MoSPI.',
    why: 'It is the only data this system reads. Nothing new is asked of any agency.',
  },
  paimana: {
    term: 'PAIMANA',
    short: 'The MoSPI portal holding monitoring records for central sector infrastructure projects.',
  },
  deterministic_rules: {
    term: 'Rule checks',
    short: 'Eight fixed threshold tests written by hand, evaluated separately from the model.',
    why: 'They fire identically on identical numbers, so they can be audited without understanding the model.',
  },
  replay: {
    term: 'Historical replay',
    short: 'Re-running the model at each past month using only what had been filed by then, with everything later hidden.',
    why: 'It is how the lead-time claim gets tested instead of asserted.',
  },
  masking: {
    term: 'Masking',
    short: 'Hiding every record dated after the month being scored, so a replay cannot accidentally use hindsight.',
  },
  intent_parser: {
    term: 'Intent matching',
    short: 'Matches a typed question to one of eight fixed queries. If nothing matches, it says so rather than guessing.',
  },
  synthetic_data: {
    term: 'Prototype data',
    short: 'Records generated to follow the real PAIMANA schema and match published portfolio totals, standing in for the real export.',
    why: 'The pipeline and model are real; the rows are not. Accuracy figures describe the method, not real-world performance.',
  },
} satisfies Record<string, TermDef>;

export type TermKey = keyof typeof GLOSSARY;

export const term = (k: TermKey): TermDef => GLOSSARY[k];
