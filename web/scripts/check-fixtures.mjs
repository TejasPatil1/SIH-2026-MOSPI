/**
 * Guards the four demo scenarios (§12) and the A3 calibration anchors.
 * If a fixture regenerates wrong, this fails here rather than on stage.
 * Run: npm run check
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const M = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks');
const read = (f) => JSON.parse(readFileSync(join(M, f), 'utf8'));

const projects = read('projects.json');
const portfolio = read('portfolio.json');
const replay = read('replay.json');
const registry = read('registry.json');

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('\nA3 published aggregates');
const k = portfolio.kpis;
ok('1,981 ongoing projects', k.projects_monitored === 1981, `got ${k.projects_monitored}`);
ok('17 ministries', k.ministries === 17, `got ${k.ministries}`);
ok('22 sectors', k.sectors === 22, `got ${k.sectors}`);
ok('₹37.13 L Cr original', near(k.original_cost_cr, 3_713_000, 500), `got ${k.original_cost_cr}`);
ok('₹42.78 L Cr revised', near(k.revised_cost_cr, 4_278_000, 500), `got ${k.revised_cost_cr}`);
ok('15.2% aggregate overrun', near(k.overrun_pct, 15.2, 0.2), `got ${k.overrun_pct}`);
ok('₹20.36 L Cr spent', near(k.expenditure_cr, 2_036_000, 500), `got ${k.expenditure_cr}`);
ok('47.6% of revised spent', near(k.expenditure_pct_of_revised, 47.6, 0.3), `got ${k.expenditure_pct_of_revised}`);
ok('214 CRITICAL', k.critical_count === 214, `got ${k.critical_count}`);
ok('₹3.1 L Cr exposure at risk', near(k.exposure_at_risk_cr, 310_000, 500), `got ${k.exposure_at_risk_cr}`);

console.log('\nPortfolio integrity');
ok('band counts sum to portfolio', portfolio.bands.reduce((a, b) => a + b.count, 0) === 1981);
ok('sector projects sum to portfolio', portfolio.sectors.reduce((a, s) => a + s.projects, 0) === 1981);
ok('no undefined risk band', projects.every((p) => ['LOW', 'WATCH', 'HIGH', 'CRITICAL'].includes(p.risk_band)));
ok('every project has a positive sanctioned cost', projects.every((p) => p.original_cost_cr > 0));
ok('revised cost never below sanctioned',
  projects.every((p) => (p.anticipated_cost_cr ?? p.original_cost_cr) >= p.original_cost_cr - 0.01));
ok('project ids unique', new Set(projects.map((p) => p.project_id)).size === projects.length);

console.log('\nSHAP waterfall closes');
const bad = projects.filter((p) => {
  const sum = p.drivers.reduce((a, d) => a + d.shap, 0);
  return !near(p.base_risk + sum, p.risk_score, 2.5);
});
ok('base rate + contributions ≈ risk score', bad.length === 0, `${bad.length} projects off`);

console.log('\nWatchlist ranking (the exposure toggle must actually re-rank)');
const byRisk = [...projects].sort((a, b) => b.risk_score - a.risk_score).slice(0, 50);
const byExposure = [...projects].sort((a, b) => b.exposure_at_risk_cr - a.exposure_at_risk_cr).slice(0, 50);
ok('top project differs between the two rankings', byRisk[0].project_id !== byExposure[0].project_id);
const moved = byRisk.filter((r, i) => byExposure.findIndex((e) => e.project_id === r.project_id) !== i).length;
ok('ranking visibly reorders', moved >= 25, `${moved} of 50 rows change position`);

console.log('\nScenario 1 — the silent failure (PRJ-004217)');
const hero = projects.find((p) => p.project_id === 'PRJ-004217');
const heroReplay = replay['PRJ-004217'];
ok('project exists', !!hero);
ok('CRITICAL band at 78.4', hero.risk_band === 'CRITICAL' && hero.risk_score === 78.4, `got ${hero?.risk_score}`);
ok('+23.4% predicted cost overrun', hero.pred_cost_overrun_pct === 23.4, `got ${hero?.pred_cost_overrun_pct}`);
ok('+14.2 months predicted delay', hero.pred_delay_months === 14.2, `got ${hero?.pred_delay_months}`);
ok('p10–p90 is 9.1–41.6', hero.cost.p10 === 9.1 && hero.cost.p90 === 41.6);
ok('41% physical vs 57% financial', hero.physical_progress_pct === 41 && hero.financial_progress_pct === 57);
ok('top driver is the progress gap', hero.drivers[0].feature === 'progress_gap', `got ${hero?.drivers[0]?.feature}`);
ok('rule R1 (stall) fires', hero.alerts.some((a) => a.rule_id === 'R1_PROGRESS_STALL'));
ok('rule R2 (spend ahead of work) fires', hero.alerts.some((a) => a.rule_id === 'R2_SPEND_AHEAD_OF_WORK'));
ok('model flags Nov 2024', heroReplay.model_alert_month === '2024-11-01', `got ${heroReplay?.model_alert_month}`);
ok('official revision Oct 2025', heroReplay.official_event_month === '2025-10-01', `got ${heroReplay?.official_event_month}`);
ok('11 months of early warning', heroReplay.lead_time_months === 11, `got ${heroReplay?.lead_time_months}`);
ok('risk stays below threshold before the crossing',
  heroReplay.points.slice(0, heroReplay.points.findIndex((p) => p.as_of_month === '2024-11-01'))
    .every((p) => p.risk_score < heroReplay.alert_threshold));
ok('replay ends at the current risk score',
  near(heroReplay.points[heroReplay.points.length - 1].risk_score, hero.risk_score, 1));

console.log('\nScenario 2 — the healthy project (PRJ-001188)');
const healthy = projects.find((p) => p.project_id === 'PRJ-001188');
ok('LOW band at 12.6', healthy.risk_band === 'LOW' && healthy.risk_score === 12.6);
ok('94% complete', healthy.physical_progress_pct === 94);
ok('+1.2% overrun with a tight interval', healthy.pred_cost_overrun_pct === 1.2 && healthy.cost.p90 < 6);
ok('no alerts fired', healthy.alerts.length === 0, `${healthy?.alerts.length} fired`);
ok('never crosses the alert threshold', replay['PRJ-001188'].model_alert_month === null);

console.log('\nScenario 3 — the vindicated prediction (PRJ-002904)');
const done = projects.find((p) => p.project_id === 'PRJ-002904');
const doneReplay = replay['PRJ-002904'];
ok('completed project', done.project_status === 'completed');
ok('outcome is known', doneReplay.outcome_known === true);
ok('final overrun +47%', doneReplay.actual_cost_overrun_pct === 47);
ok('final delay 22 months', doneReplay.actual_delay_months === 22);
ok('model flagged before the official revision', doneReplay.lead_time_months > 0, `got ${doneReplay?.lead_time_months}`);
const flagPoint = doneReplay.points.find((p) => p.as_of_month === doneReplay.model_alert_month);
ok('flagged around 34% elapsed', near(flagPoint.elapsed_fraction, 0.34, 0.03), `got ${flagPoint?.elapsed_fraction}`);

console.log('\nScenario 4 — the data quality case (PRJ-003355)');
const stale = projects.find((p) => p.project_id === 'PRJ-003355');
ok('₹890 Cr road project', stale.original_cost_cr === 890 && stale.sector === 'Road Transport & Highways');
ok('no update for 3 cycles', stale.months_since_update === 3);
ok('rule R6 (stale reporting) fires at MEDIUM',
  stale.alerts.some((a) => a.rule_id === 'R6_STALE_REPORTING' && a.severity === 'MEDIUM'));

console.log('\nModel registry');
ok('LightGBM is the primary model', registry.baselines.find((b) => b.is_primary)?.family === 'ml');
ok('LightGBM beats every baseline', registry.baselines.every((b) => b.is_primary || b.pr_auc < 0.78));
ok('all four conventional baselines present', registry.baselines.length === 5);
ok('three ablation configurations', registry.ablation.length === 3);
ok('ablation is monotone increasing',
  registry.ablation.every((a, i, arr) => i === 0 || a.pr_auc > arr[i - 1].pr_auc));
ok('all four leakage tests pass', registry.leakage_tests.length === 4 && registry.leakage_tests.every((t) => t.passed));
ok('shuffled-label AUC below 0.60', /0\.5\d\d/.test(registry.leakage_tests[3].value));
ok('limitations are stated', registry.limitations.length >= 4);

console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
