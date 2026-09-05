/**
 * Deterministic demo fixtures for the PEWS frontend.
 *
 * These stand in for `data/processed/{predictions,replay}.json` and
 * `models/registry.json` until the ML pipeline (`make data && make train`) runs.
 * They are calibrated to the A3 published aggregates so the portfolio screen
 * shows the same headline figures the real pipeline is required to reproduce.
 *
 * Once the API is up, set VITE_USE_MOCK=false and none of this is read.
 * Run: npm run fixtures
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks');
mkdirSync(OUT, { recursive: true });

// ---------- deterministic PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260905);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const round = (v, d = 1) => Number(v.toFixed(d));
const pad = (n, w) => String(n).padStart(w, '0');
const addMonths = (iso, k) => {
  const [y, m] = iso.split('-').map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1, 2)}`;
};
const monthsBetween = (a, b) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
};

// ---------- reference data ----------
// [sector, ministry, trouble multiplier, portfolio share]
const SECTORS = [
  ['Railways', 'Ministry of Railways', 1.55, 0.145],
  ['Road Transport & Highways', 'Ministry of Road Transport & Highways', 1.3, 0.15],
  ['Power', 'Ministry of Power', 0.95, 0.075],
  ['Petroleum', 'Ministry of Petroleum & Natural Gas', 0.7, 0.085],
  ['Coal', 'Ministry of Coal & Mines', 1.1, 0.055],
  ['Urban Development', 'Ministry of Housing & Urban Affairs', 1.6, 0.07],
  ['Water Resources', 'Ministry of Jal Shakti', 1.35, 0.045],
  ['Telecommunications', 'Ministry of Communications', 0.65, 0.03],
  ['Civil Aviation', 'Ministry of Civil Aviation', 0.9, 0.028],
  ['Shipping & Ports', 'Ministry of Ports, Shipping & Waterways', 1.05, 0.032],
  ['Steel', 'Ministry of Steel', 0.85, 0.03],
  ['Atomic Energy', 'Department of Atomic Energy', 1.25, 0.022],
  ['Health & Family Welfare', 'Ministry of Health & Family Welfare', 1.15, 0.034],
  ['Fertilizers', 'Ministry of Chemicals & Fertilizers', 0.95, 0.02],
  ['Mines', 'Ministry of Coal & Mines', 1.0, 0.016],
  ['Defence Production', 'Ministry of Defence', 1.2, 0.026],
  ['Higher Education', 'Ministry of Education', 1.1, 0.024],
  ['Science & Technology', 'Ministry of Education', 0.9, 0.018],
  ['Textiles', 'Ministry of Commerce & Industry', 0.8, 0.012],
  ['Food Processing', 'Ministry of Commerce & Industry', 0.85, 0.014],
  ['New & Renewable Energy', 'Ministry of Power', 0.75, 0.03],
  ['Shipbuilding', 'Ministry of Ports, Shipping & Waterways', 1.1, 0.01],
];

const AGENCY = {
  Railways: ['RVNL', 'IRCON', 'DFCCIL', 'RITES'],
  'Road Transport & Highways': ['NHAI', 'NHIDCL', 'CPWD'],
  Power: ['PGCIL', 'NTPC', 'NHPC', 'THDC'],
  Petroleum: ['IOCL', 'ONGC', 'GAIL', 'BPCL'],
  Coal: ['CIL', 'NLCIL', 'SECL'],
  'Urban Development': ['DMRC', 'NBCC', 'CPWD', 'MMRDA'],
  'Water Resources': ['WAPCOS', 'NPCC', 'CWC'],
  Telecommunications: ['BSNL', 'BBNL', 'C-DOT'],
  'Civil Aviation': ['AAI', 'AAIL'],
  'Shipping & Ports': ['SDCL', 'IPRCL', 'CoPT'],
  Steel: ['SAIL', 'RINL', 'MECON'],
  'Atomic Energy': ['NPCIL', 'BHAVINI'],
  'Health & Family Welfare': ['HSCC', 'CPWD', 'NBCC'],
  Fertilizers: ['RCF', 'FCIL', 'NFL'],
  Mines: ['HCL', 'NALCO', 'GSI'],
  'Defence Production': ['BEL', 'HAL', 'BEML'],
  'Higher Education': ['CPWD', 'NBCC', 'EdCIL'],
  'Science & Technology': ['CSIR', 'NBCC'],
  Textiles: ['NTC', 'CPWD'],
  'Food Processing': ['NIFTEM', 'NBCC'],
  'New & Renewable Energy': ['SECI', 'IREDA'],
  Shipbuilding: ['CSL', 'GRSE', 'HSL'],
};

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'MULTI'];

const NAME_TEMPLATES = {
  Railways: ['Doubling of Rail Line {sec}', 'New BG Line {a}–{b}', 'Gauge Conversion {a}–{b}', 'Rail Electrification {sec}', 'Third Line Project {sec}'],
  'Road Transport & Highways': ['4-Laning of NH-{n} {sec}', '6-Laning of NH-{n}', 'Bypass Construction at {a}', 'Elevated Corridor {sec}', 'Major Bridge across {a} River'],
  Power: ['Grid Substation Augmentation {sec}', 'Thermal Unit Expansion {sec}', 'Transmission Line {a}–{b}', 'Hydro Electric Project {sec}'],
  Petroleum: ['Pipeline Section {a}–{b}', 'Refinery Unit Upgrade {sec}', 'LPG Bottling Facility {a}', 'City Gas Distribution {a}'],
  Coal: ['Coal Handling Plant {sec}', 'Mine Expansion Project {a}', 'Washery Project {sec}', 'Coal Corridor Siding {a}'],
  'Urban Development': ['Metro Rail Extension {sec}', 'Water Supply Augmentation {a}', 'Sewerage Network {sec}', 'Urban Housing Cluster {a}'],
  'Water Resources': ['Irrigation Canal Network {sec}', 'Barrage Construction at {a}', 'Lift Irrigation Scheme {sec}', 'Flood Embankment {a}'],
  Telecommunications: ['Optical Fibre Backbone {sec}', 'Network Modernisation {a}', 'Rural Connectivity Block {sec}'],
  'Civil Aviation': ['Terminal Building Expansion {a}', 'Runway Extension {a}', 'ATC Tower Modernisation {a}'],
  'Shipping & Ports': ['Berth Development {sec}', 'Channel Deepening {a}', 'Container Terminal {sec}'],
  Steel: ['Blast Furnace Modernisation {sec}', 'Cold Rolling Mill {sec}', 'Sinter Plant Upgrade {a}'],
  'Atomic Energy': ['Reactor Unit {sec} Construction', 'Fuel Fabrication Facility {a}'],
  'Health & Family Welfare': ['AIIMS Campus Development {a}', 'Medical College Block {sec}', 'Trauma Centre {a}'],
  Fertilizers: ['Urea Plant Revival {a}', 'Ammonia Unit Expansion {sec}'],
  Mines: ['Ore Beneficiation Plant {sec}', 'Smelter Capacity Addition {a}'],
  'Defence Production': ['Assembly Line Facility {sec}', 'Test Range Infrastructure {a}'],
  'Higher Education': ['IIT Campus {sec}', 'Academic Block Complex {a}', 'Research Hostel Block {sec}'],
  'Science & Technology': ['Research Laboratory Complex {a}', 'Test Facility {sec}'],
  Textiles: ['Textile Park Development {a}', 'Processing Cluster {sec}'],
  'Food Processing': ['Mega Food Park {a}', 'Cold Chain Facility {sec}'],
  'New & Renewable Energy': ['Solar Park Development {a}', 'Wind Corridor Evacuation {sec}'],
  Shipbuilding: ['Dry Dock Facility {a}', 'Shipyard Modernisation {sec}'],
};
const SECTION = ['Phase I', 'Phase II', 'Phase III', 'Section-I', 'Section-II', 'Section-III', 'Section-IV', 'Package 2', 'Package 5', 'Stage II'];
const PLACES = ['Katni', 'Raipur', 'Guntur', 'Bhadrak', 'Nashik', 'Hubballi', 'Jhansi', 'Rourkela', 'Vijayawada', 'Muzaffarpur', 'Kota', 'Salem', 'Bilaspur', 'Dhanbad', 'Ambala', 'Tirupati', 'Silchar', 'Jodhpur', 'Belagavi', 'Asansol'];

const DELAY_REASONS = [
  ['land', 'Land acquisition pending in {n} villages'],
  ['land', 'Land acquisition and rehabilitation under process'],
  ['forest', 'Forest clearance awaited from MoEFCC'],
  ['forest', 'Environment clearance under appraisal'],
  ['contractor', 'Contractor mobilisation slow; EPC agency under notice'],
  ['contractor', 'Termination and re-tendering of EPC package'],
  ['funds', 'Fund release constrained in current fiscal'],
  ['litigation', 'Matter sub-judice before the High Court'],
  ['rnr', 'R&R settlement with project-affected families pending'],
  ['row', 'ROW and utility shifting in progress'],
  ['approvals', 'Statutory approvals awaited from State authorities'],
  ['forcemajeure', 'Work affected by extended monsoon and flooding'],
];

const AS_OF = '2026-04';
const N = 1981;

// ---------- portfolio generation ----------
const cum = [];
let acc = 0;
for (const s of SECTORS) { acc += s[3]; cum.push(acc); }
const drawSector = () => { const u = rnd() * acc; return SECTORS[cum.findIndex((c) => u <= c)]; };

const projects = [];
for (let i = 0; i < N; i++) {
  const [sector, ministry, sectorTrouble] = drawSector();
  const state = pick(STATES);
  const agency = pick(AGENCY[sector]);
  const sanctionAge = Math.floor(between(6, 84));
  const sanction = addMonths(AS_OF, -sanctionAge);
  const duration = Math.round(between(30, 78));
  const origDate = addMonths(sanction, duration);
  const cost = Math.exp(between(Math.log(160), Math.log(28000)));

  // latent unobservables (§9.2.1) — features only see noisy downstream effects
  const complexity = Math.min(2, Math.max(0, 0.85 + gauss() * 0.42 + (sectorTrouble - 1) * 0.55));
  const capability = Math.min(2, Math.max(0.1, 1.25 - gauss() * 0.32 - (sectorTrouble - 1) * 0.28));
  const landBurden = Math.max(0, gauss() * 0.5 + (sector === 'Railways' || sector === 'Urban Development' ? 0.55 : 0.1));

  const elapsed = Math.min(sanctionAge, duration + Math.round(between(0, 26)));
  const elapsedFrac = Math.min(1.15, elapsed / duration);
  const trouble = Math.min(1, Math.max(0, 0.42 * complexity + 0.38 * landBurden - 0.3 * capability + gauss() * 0.16));

  const ideal = Math.min(99, elapsedFrac * 100);
  const physical = Math.max(1, Math.min(99, ideal * (1 - 0.62 * trouble) + gauss() * 5));
  const financial = Math.max(physical, Math.min(102, physical + trouble * between(6, 32) + gauss() * 3));
  const stalled = trouble > 0.55 && rnd() < 0.55 ? Math.round(between(1, 6)) : rnd() < 0.12 ? 1 : 0;
  const sinceUpdate = rnd() < 0.09 ? Math.round(between(2, 5)) : rnd() < 0.25 ? 1 : 0;
  const [reasonCat, reasonTpl] = pick(DELAY_REASONS);
  const hasReason = trouble > 0.35 || rnd() < 0.2;

  const name = pick(NAME_TEMPLATES[sector])
    .replace('{sec}', pick(SECTION))
    .replace('{a}', pick(PLACES))
    .replace('{b}', pick(PLACES))
    .replace('{n}', String(Math.round(between(2, 766))));

  projects.push({
    project_id: `PRJ-${pad(1000 + i * 3 + Math.floor(rnd() * 3), 6)}`,
    project_name: name, ministry, sector, state,
    implementing_agency: agency,
    funding_mode: pick(['Budgetary', 'Budgetary', 'EBR', 'PPP', 'Mixed']),
    sanction_date: `${sanction}-01`,
    original_commissioning_date: `${origDate}-01`,
    project_status: 'ongoing',
    _duration: duration, _elapsed: elapsed, _elapsedFrac: elapsedFrac,
    _cost: cost, _physical: physical, _financial: financial,
    _trouble: trouble, _stalled: stalled, _sinceUpdate: sinceUpdate,
    _reason: hasReason ? reasonTpl.replace('{n}', String(Math.round(between(2, 9)))) : null,
    _reasonCat: hasReason ? reasonCat : null,
    _landBurden: landBurden, _capability: capability,
  });
}

// unique ids
const seenIds = new Set();
projects.forEach((p, i) => {
  while (seenIds.has(p.project_id)) p.project_id = `PRJ-${pad(1000 + i * 3 + Math.floor(rnd() * 900), 6)}`;
  seenIds.add(p.project_id);
});

// ---------- A3 calibration ----------
const TARGET_ORIGINAL = 3_713_000; // ₹37.13 lakh crore
const TARGET_REVISED = 4_278_000;  // ₹42.78 lakh crore
const TARGET_SPENT = 2_036_000;    // ₹20.36 lakh crore
const TARGET_EXPOSURE = 310_000;   // ₹3.1 lakh crore at risk
const sum = (f) => projects.reduce((a, p) => a + f(p), 0);

let k = TARGET_ORIGINAL / sum((p) => p._cost);
projects.forEach((p) => { p.original_cost_cr = round(p._cost * k, 2); });

projects.forEach((p) => {
  p._realised = Math.max(0, p._trouble * between(0.06, 0.42) * Math.min(1, p._elapsedFrac + 0.25));
});
k = (TARGET_REVISED - TARGET_ORIGINAL) / sum((p) => p.original_cost_cr * p._realised);
projects.forEach((p) => {
  p._realised *= k;
  p.anticipated_cost_cr = p._realised > 0.005 ? round(p.original_cost_cr * (1 + p._realised), 2) : p.original_cost_cr;
  p._revised = p.anticipated_cost_cr;
});
k = TARGET_SPENT / sum((p) => p._revised * (p._financial / 100));
projects.forEach((p) => {
  p._financial = Math.min(100, p._financial * k);
  p.expenditure_cr = round(p._revised * (p._financial / 100), 2);
  p.physical_progress_pct = round(p._physical, 1);
  p.financial_progress_pct = round(p._financial, 1);
});

// ---------- risk: monotone remap onto the published band counts ----------
const ranked = projects
  .map((p, i) => ({
    i,
    v:
      (0.44 * (p.financial_progress_pct - p.physical_progress_pct)) / 30 +
      0.26 * p._trouble +
      0.16 * Math.min(1, p._stalled / 4) +
      0.09 * Math.min(1, p._elapsedFrac) +
      0.05 * Math.min(1, p._sinceUpdate / 4) +
      gauss() * 0.03,
  }))
  .sort((a, b) => a.v - b.v);

const BAND_TARGETS = [
  { band: 'LOW', n: 817, lo: 4, hi: 34.9 },
  { band: 'WATCH', n: 620, lo: 35, hi: 54.9 },
  { band: 'HIGH', n: 330, lo: 55, hi: 69.9 },
  { band: 'CRITICAL', n: 214, lo: 70, hi: 96.5, curve: 1.75 },
];
let cursor = 0;
for (const b of BAND_TARGETS) {
  for (let j = 0; j < b.n; j++) {
    const p = projects[ranked[cursor + j].i];
    // Convex within the band so the extreme tail spreads out; a linear map
    // makes the top of the watchlist read 95, 95, 95, 95 and look fabricated.
    const t = (j + 0.5) / b.n;
    p.risk_score = round(b.lo + (b.hi - b.lo) * Math.pow(t, b.curve ?? 1), 1);
    p.risk_band = b.band;
  }
  cursor += b.n;
}

projects.forEach((p) => {
  const r = p.risk_score / 100;
  const cost = Math.max(0, r * 34 + gauss() * 4.2 - 3);
  const delay = Math.max(0, r * 22 + gauss() * 3.4 - 2);
  const spread = 0.42 + 0.5 * r;
  p.pred_cost_overrun_pct = round(cost, 1);
  p.pred_delay_months = round(delay, 1);
  p._cost_p10 = round(Math.max(-4, cost * (1 - spread) - 1.5), 1);
  p._cost_p50 = round(cost * 0.97, 1);
  p._cost_p90 = round(cost * (1 + spread) + 4, 1);
  p._time_p10 = round(Math.max(0, delay * (1 - spread) - 1), 1);
  p._time_p50 = round(delay * 0.95, 1);
  p._time_p90 = round(delay * (1 + spread) + 3, 1);
  p._prob_cost = round(Math.min(0.985, Math.max(0.02, r * 1.05 + gauss() * 0.04)), 3);
  p._prob_time = round(Math.min(0.985, Math.max(0.02, r * 1.02 + gauss() * 0.05)), 3);
  p.exposure_at_risk_cr = round(p._revised * (p.pred_cost_overrun_pct / 100) * p._prob_cost, 1);
  p.stalled_months = p._stalled;
  p.months_since_update = p._sinceUpdate;
  p.last_updated_month = `${addMonths(AS_OF, -p._sinceUpdate)}-01`;
  p.reason_for_delay = p._reason;
  p.anticipated_commissioning_date =
    p._realised > 0.02
      ? `${addMonths(p.original_commissioning_date.slice(0, 7), Math.round(p.pred_delay_months * 0.55))}-01`
      : null;
});
k = TARGET_EXPOSURE / sum((p) => p.exposure_at_risk_cr);
projects.forEach((p) => { p.exposure_at_risk_cr = round(p.exposure_at_risk_cr * k, 1); });

// ---------- hero projects (§12) ----------
const HEROES = {
  'PRJ-004217': {
    project_name: 'Doubling of Rail Line Section-IV',
    ministry: 'Ministry of Railways', sector: 'Railways', state: 'Odisha',
    implementing_agency: 'RVNL', funding_mode: 'Budgetary',
    sanction_date: '2021-06-01', original_cost_cr: 3120,
    original_commissioning_date: '2025-06-01',
    anticipated_cost_cr: 3610, anticipated_commissioning_date: '2026-09-01',
    physical_progress_pct: 41, financial_progress_pct: 57,
    expenditure_cr: 2057.7, risk_score: 78.4, risk_band: 'CRITICAL',
    pred_cost_overrun_pct: 23.4, pred_delay_months: 14.2,
    _cost_p10: 9.1, _cost_p50: 22.8, _cost_p90: 41.6,
    _time_p10: 4.0, _time_p50: 13.5, _time_p90: 29.0,
    _prob_cost: 0.81, _prob_time: 0.87,
    exposure_at_risk_cr: 684.6, stalled_months: 3, months_since_update: 0,
    last_updated_month: '2026-04-01',
    reason_for_delay: 'Land acquisition pending in 3 villages; forest clearance awaited',
    _reasonCat: 'land', project_status: 'ongoing', _duration: 48, _elapsed: 58,
  },
  'PRJ-001188': {
    project_name: 'Grid Substation Augmentation Phase II',
    ministry: 'Ministry of Power', sector: 'Power', state: 'Gujarat',
    implementing_agency: 'PGCIL', funding_mode: 'Budgetary',
    sanction_date: '2023-01-01', original_cost_cr: 640,
    original_commissioning_date: '2026-04-01',
    anticipated_cost_cr: 640, anticipated_commissioning_date: null,
    physical_progress_pct: 94, financial_progress_pct: 91.9,
    expenditure_cr: 588, risk_score: 12.6, risk_band: 'LOW',
    pred_cost_overrun_pct: 1.2, pred_delay_months: 0.4,
    _cost_p10: -0.8, _cost_p50: 1.1, _cost_p90: 4.2,
    _time_p10: 0, _time_p50: 0.3, _time_p90: 1.9,
    _prob_cost: 0.07, _prob_time: 0.05,
    exposure_at_risk_cr: 0.5, stalled_months: 0, months_since_update: 0,
    last_updated_month: '2026-04-01',
    reason_for_delay: null, _reasonCat: null,
    project_status: 'ongoing', _duration: 39, _elapsed: 39,
  },
  'PRJ-002904': {
    project_name: 'Metro Rail Extension Phase III',
    ministry: 'Ministry of Housing & Urban Affairs', sector: 'Urban Development',
    state: 'Maharashtra', implementing_agency: 'MMRDA', funding_mode: 'Mixed',
    sanction_date: '2018-04-01', original_cost_cr: 4180,
    original_commissioning_date: '2022-10-01',
    anticipated_cost_cr: 6144.6, anticipated_commissioning_date: '2024-08-01',
    physical_progress_pct: 100, financial_progress_pct: 100,
    expenditure_cr: 6144.6, risk_score: 88.2, risk_band: 'CRITICAL',
    pred_cost_overrun_pct: 44.1, pred_delay_months: 20.6,
    _cost_p10: 26.4, _cost_p50: 43.0, _cost_p90: 63.8,
    _time_p10: 11.0, _time_p50: 20.1, _time_p90: 32.4,
    _prob_cost: 0.94, _prob_time: 0.96,
    exposure_at_risk_cr: 1733.2, stalled_months: 4, months_since_update: 0,
    last_updated_month: '2024-08-01',
    reason_for_delay: 'Land acquisition, utility shifting and contractor default',
    _reasonCat: 'land', project_status: 'completed', _duration: 54, _elapsed: 76,
  },
  'PRJ-003355': {
    project_name: '4-Laning of NH-216 Section-II',
    ministry: 'Ministry of Road Transport & Highways',
    sector: 'Road Transport & Highways', state: 'Andhra Pradesh',
    implementing_agency: 'NHAI', funding_mode: 'EBR',
    sanction_date: '2022-09-01', original_cost_cr: 890,
    original_commissioning_date: '2026-03-01',
    anticipated_cost_cr: 934.5, anticipated_commissioning_date: '2026-11-01',
    physical_progress_pct: 46, financial_progress_pct: 52.4,
    expenditure_cr: 489.7, risk_score: 61.3, risk_band: 'HIGH',
    pred_cost_overrun_pct: 14.8, pred_delay_months: 8.1,
    _cost_p10: 3.2, _cost_p50: 14.1, _cost_p90: 29.6,
    _time_p10: 1.4, _time_p50: 7.7, _time_p90: 18.2,
    _prob_cost: 0.63, _prob_time: 0.68,
    exposure_at_risk_cr: 87.1, stalled_months: 0, months_since_update: 3,
    last_updated_month: '2026-01-01',
    reason_for_delay: 'Statutory approvals awaited from State authorities',
    _reasonCat: 'approvals', project_status: 'ongoing', _duration: 42, _elapsed: 43,
  },
};

// splice heroes in, replacing the nearest-band occupants so the aggregates hold
const heroIds = Object.keys(HEROES);

// A generated project may already hold a hero id; rename it before the splice
// or the portfolio ends up with two rows sharing one identifier.
projects.forEach((p, i) => {
  if (heroIds.includes(p.project_id)) {
    do { p.project_id = `PRJ-${pad(700000 + i, 6)}`; } while (seenIds.has(p.project_id));
    seenIds.add(p.project_id);
  }
});
const takenSlots = [];
heroIds.forEach((id, idx) => {
  let slot = -1;
  for (let j = 0; j < projects.length; j++) {
    if (takenSlots.includes(j)) continue;
    if (projects[j].risk_band === HEROES[id].risk_band && projects[j].sector === HEROES[id].sector) { slot = j; break; }
  }
  if (slot < 0) slot = projects.findIndex((_, j) => !takenSlots.includes(j) && projects[j].risk_band === HEROES[id].risk_band);
  if (slot < 0) slot = idx;
  takenSlots.push(slot);
  projects[slot] = { ...projects[slot], project_id: id, ...HEROES[id], _revised: HEROES[id].anticipated_cost_cr, _elapsedFrac: HEROES[id]._elapsed / HEROES[id]._duration, _trouble: HEROES[id].risk_score / 100 };
});

// ---------- reconcile A3 after the hero splice ----------
// The four hero projects carry fixed sanctioned costs from §12, so they land
// outside the calibrated distribution. Rescale only the non-hero projects so the
// published aggregates still hold exactly, keeping each project internally
// consistent (expenditure stays equal to revised cost x financial progress).
{
  const isHero = (p) => heroIds.includes(p.project_id);
  const rest = projects.filter((p) => !isHero(p));
  const heroSum = (f) => projects.filter(isHero).reduce((a, p) => a + f(p), 0);
  const restSum = (f) => rest.reduce((a, p) => a + f(p), 0);

  const kO = (TARGET_ORIGINAL - heroSum((p) => p.original_cost_cr)) / restSum((p) => p.original_cost_cr);
  const kR = (TARGET_REVISED - heroSum((p) => p.anticipated_cost_cr ?? p.original_cost_cr)) / restSum((p) => p.anticipated_cost_cr ?? p.original_cost_cr);
  rest.forEach((p) => {
    p.original_cost_cr = round(p.original_cost_cr * kO, 2);
    const revised = round((p.anticipated_cost_cr ?? p.original_cost_cr) * kR, 2);
    p.anticipated_cost_cr = Math.max(revised, p.original_cost_cr);
    p._revised = p.anticipated_cost_cr;
  });

  const kS = (TARGET_SPENT - heroSum((p) => p.expenditure_cr)) / restSum((p) => p._revised * (p.financial_progress_pct / 100));
  rest.forEach((p) => {
    p.financial_progress_pct = round(Math.min(100, p.financial_progress_pct * kS), 1);
    p.expenditure_cr = round(p._revised * (p.financial_progress_pct / 100), 2);
  });

  const kE = (TARGET_EXPOSURE - heroSum((p) => p.exposure_at_risk_cr)) / restSum((p) => p.exposure_at_risk_cr);
  rest.forEach((p) => { p.exposure_at_risk_cr = round(p.exposure_at_risk_cr * kE, 1); });
}

// ---------- SHAP-shaped drivers + deterministic alert rules ----------
const BASE_RISK = 34.0;
const DRIVER_LABELS = {
  progress_gap: ['Progress gap', 'D'],
  stall_months_3m: ['Recent stall', 'D'],
  velocity_deficit: ['Pace below plan', 'D'],
  elapsed_fraction: ['Schedule consumed', 'C'],
  delay_reason_land: ['Land acquisition', 'E'],
  delay_reason_forest: ['Forest / environment clearance', 'E'],
  delay_reason_contractor: ['Contractor performance', 'E'],
  delay_reason_funds: ['Fund release', 'E'],
  delay_reason_litigation: ['Litigation', 'E'],
  delay_reason_rnr: ['R&R settlement', 'E'],
  delay_reason_row: ['ROW / utility shifting', 'E'],
  delay_reason_approvals: ['Statutory approvals', 'E'],
  delay_reason_forcemajeure: ['Weather / force majeure', 'E'],
  agency_hist_overrun: ['Agency track record', 'E'],
  sector_hist_overrun: ['Sector escalation history', 'E'],
  months_since_update: ['Reporting freshness', 'D'],
  progress_velocity_3m: ['Recent progress rate', 'D'],
  cost_perf_index: ['Cost performance index', 'D'],
  log_original_cost: ['Project size', 'C'],
};

function buildDrivers(p) {
  const gap = p.financial_progress_pct - p.physical_progress_pct;
  const raw = [
    ['progress_gap', gap, gap * 0.42],
    ['stall_months_3m', p.stalled_months, p.stalled_months * 2.1],
    ['velocity_deficit', round(Math.max(0, Math.min(1, p._elapsedFrac) * 100 - p.physical_progress_pct) / 10, 2), Math.max(0, Math.min(1, p._elapsedFrac) * 100 - p.physical_progress_pct) * 0.085],
    ['elapsed_fraction', round(p._elapsedFrac, 2), (p._elapsedFrac - 0.6) * 6],
    ['agency_hist_overrun', round(12 + (p._trouble ?? 0.4) * 22, 1), ((p._trouble ?? 0.4) - 0.45) * 7],
    ['sector_hist_overrun', round(9 + (p._trouble ?? 0.4) * 14, 1), ((p._trouble ?? 0.4) - 0.5) * 4.5],
    ['months_since_update', p.months_since_update, p.months_since_update * 1.4],
    ['progress_velocity_3m', round(Math.max(0, 2.4 - p.stalled_months * 0.7), 2), -Math.max(0, 2.4 - p.stalled_months * 0.7) * 1.6],
    ['log_original_cost', round(Math.log(p.original_cost_cr), 2), (Math.log(p.original_cost_cr) - 7.2) * 0.9],
  ];
  if (p._reasonCat) raw.push([`delay_reason_${p._reasonCat}`, 1, { land: 3.3, forest: 2.7, contractor: 2.9, funds: 2.2, litigation: 3.0, rnr: 2.4, row: 2.0, approvals: 1.8, forcemajeure: 1.2 }[p._reasonCat] ?? 1.5]);

  // Keep the top contributors first, THEN rescale, so that base + the shown
  // contributions reconstructs the risk score exactly. Rescaling before the
  // truncation leaves the displayed waterfall unable to close.
  const kept = raw
    .sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]))
    .slice(0, 7);
  const total = kept.reduce((a, r) => a + r[2], 0);
  const need = p.risk_score - BASE_RISK;
  const scale = Math.abs(total) < 0.01 ? 0 : need / total;
  return kept
    .map(([feature, value, shap]) => {
      const [label, group] = DRIVER_LABELS[feature] ?? [feature, 'D'];
      return { feature, label, group, value: round(value, 2), shap: round(shap * scale, 2) };
    })
    .sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap))
    .map((d) => ({ ...d, text: driverText(d, p) }));
}

function driverText(d, p) {
  const gap = round(p.financial_progress_pct - p.physical_progress_pct, 1);
  switch (d.feature) {
    case 'progress_gap': return `Expenditure is ${gap} percentage points ahead of physical progress.`;
    case 'stall_months_3m': return p.stalled_months > 0 ? `No measurable physical progress for ${p.stalled_months} consecutive monitoring ${p.stalled_months === 1 ? 'cycle' : 'cycles'}.` : 'Physical progress recorded in every recent cycle.';
    case 'velocity_deficit': return 'Progress rate is below the pace needed to meet the sanctioned completion date.';
    case 'elapsed_fraction': return `${Math.round(p._elapsedFrac * 100)}% of the sanctioned schedule has been consumed.`;
    case 'agency_hist_overrun': return `${p.implementing_agency} projects have historically overrun by ${d.value}% on average.`;
    case 'sector_hist_overrun': return `${p.sector} projects escalate by ${d.value}% on average at this stage.`;
    case 'months_since_update': return p.months_since_update > 0 ? `Last monitoring update was ${p.months_since_update} ${p.months_since_update === 1 ? 'month' : 'months'} ago.` : 'Monitoring data is current.';
    case 'progress_velocity_3m': return `Physical progress averaged ${d.value} pp per month over the last 3 cycles.`;
    case 'log_original_cost': return `Sanctioned cost of ${p.original_cost_cr.toLocaleString('en-IN')} Cr.`;
    default:
      if (d.feature.startsWith('delay_reason_')) return `Reported delay reason: ${d.label.toLowerCase()}.`;
      return d.label;
  }
}

function buildAlerts(p) {
  const out = [];
  const gap = round(p.financial_progress_pct - p.physical_progress_pct, 1);
  if (p.stalled_months >= 3) out.push({ rule_id: 'R1_PROGRESS_STALL', severity: 'HIGH', title: 'Physical progress stalled', message: `Physical progress unchanged for ${p.stalled_months} consecutive monitoring cycles.`, evidence: `${p.physical_progress_pct}% for ${p.stalled_months} cycles` });
  if (gap >= 12) out.push({ rule_id: 'R2_SPEND_AHEAD_OF_WORK', severity: gap >= 20 ? 'HIGH' : 'MEDIUM', title: 'Expenditure ahead of physical work', message: `Financial progress exceeds physical progress by ${gap} percentage points.`, evidence: `${p.financial_progress_pct}% spent vs ${p.physical_progress_pct}% built` });
  if (p._elapsedFrac > 1) out.push({ rule_id: 'R3_SCHEDULE_EXCEEDED', severity: 'HIGH', title: 'Sanctioned schedule exceeded', message: 'The project has passed its original commissioning date without completion.', evidence: `Original date ${p.original_commissioning_date.slice(0, 7)}` });
  if (p.anticipated_cost_cr && p.anticipated_cost_cr > p.original_cost_cr * 1.1) out.push({ rule_id: 'R4_COST_REVISED', severity: 'MEDIUM', title: 'Cost revised upward', message: `Anticipated cost is ${round(((p.anticipated_cost_cr / p.original_cost_cr) - 1) * 100, 1)}% above sanctioned cost.`, evidence: `${p.original_cost_cr.toLocaleString('en-IN')} Cr → ${p.anticipated_cost_cr.toLocaleString('en-IN')} Cr` });
  if (p._elapsedFrac > 0.5 && p.physical_progress_pct < 30) out.push({ rule_id: 'R5_LOW_PROGRESS_LATE', severity: 'HIGH', title: 'Low progress past schedule midpoint', message: 'Over half the sanctioned duration has elapsed with physical progress below 30%.', evidence: `${p.physical_progress_pct}% at ${Math.round(p._elapsedFrac * 100)}% elapsed` });
  if (p.months_since_update >= 3) out.push({ rule_id: 'R6_STALE_REPORTING', severity: 'MEDIUM', title: 'Stale monitoring data', message: `No CUF update received for ${p.months_since_update} monitoring cycles. Risk score is computed on ageing inputs.`, evidence: `Last update ${p.last_updated_month.slice(0, 7)}` });
  if (p._reasonCat === 'land' || p._reasonCat === 'rnr') out.push({ rule_id: 'R7_LAND_BLOCKER', severity: 'MEDIUM', title: 'Land / R&R blocker reported', message: 'Reported delay reason is a land or resettlement blocker, historically the slowest category to clear.', evidence: p.reason_for_delay ?? '' });
  if (p.exposure_at_risk_cr >= 500) out.push({ rule_id: 'R8_HIGH_EXPOSURE', severity: 'HIGH', title: 'Material financial exposure', message: 'Predicted overrun on this project represents a material share of sector exposure.', evidence: `${round(p.exposure_at_risk_cr, 0).toLocaleString('en-IN')} Cr at risk` });
  return out.slice(0, 4);
}

const records = projects.map((p) => {
  const drivers = buildDrivers(p);
  const alerts = buildAlerts(p);
  return {
    project_id: p.project_id, project_name: p.project_name, ministry: p.ministry,
    sector: p.sector, state: p.state, implementing_agency: p.implementing_agency,
    funding_mode: p.funding_mode, sanction_date: p.sanction_date,
    original_cost_cr: p.original_cost_cr, anticipated_cost_cr: p.anticipated_cost_cr,
    original_commissioning_date: p.original_commissioning_date,
    anticipated_commissioning_date: p.anticipated_commissioning_date,
    project_status: p.project_status, expenditure_cr: p.expenditure_cr,
    physical_progress_pct: p.physical_progress_pct,
    financial_progress_pct: p.financial_progress_pct,
    reason_for_delay: p.reason_for_delay,
    last_updated_month: p.last_updated_month,
    months_since_update: p.months_since_update,
    stalled_months: p.stalled_months,
    risk_score: p.risk_score, risk_band: p.risk_band,
    pred_cost_overrun_pct: p.pred_cost_overrun_pct,
    pred_delay_months: p.pred_delay_months,
    exposure_at_risk_cr: p.exposure_at_risk_cr,
    cost: { point: p.pred_cost_overrun_pct, p10: p._cost_p10, p50: p._cost_p50, p90: p._cost_p90, prob: p._prob_cost },
    time: { point: p.pred_delay_months, p10: p._time_p10, p50: p._time_p50, p90: p._time_p90, prob: p._prob_time },
    base_risk: BASE_RISK,
    drivers, alerts,
    elapsed_months: p._elapsed, duration_months: p._duration,
    elapsed_fraction: round(p._elapsedFrac, 3),
    as_of_month: `${AS_OF}-01`,
  };
});

// ---------- portfolio aggregates ----------
const bandsAgg = ['CRITICAL', 'HIGH', 'WATCH', 'LOW'].map((band) => {
  const rows = records.filter((r) => r.risk_band === band);
  return { band, count: rows.length, exposure_cr: round(rows.reduce((a, r) => a + r.exposure_at_risk_cr, 0), 1) };
});

const sectorsAgg = [...new Set(records.map((r) => r.sector))]
  .map((sector) => {
    const rows = records.filter((r) => r.sector === sector);
    const bands = { CRITICAL: 0, HIGH: 0, WATCH: 0, LOW: 0 };
    rows.forEach((r) => { bands[r.risk_band]++; });
    return {
      sector, projects: rows.length,
      revised_cost_cr: round(rows.reduce((a, r) => a + (r.anticipated_cost_cr ?? r.original_cost_cr), 0), 1),
      exposure_at_risk_cr: round(rows.reduce((a, r) => a + r.exposure_at_risk_cr, 0), 1),
      mean_risk: round(rows.reduce((a, r) => a + r.risk_score, 0) / rows.length, 1),
      bands,
    };
  })
  .sort((a, b) => b.exposure_at_risk_cr - a.exposure_at_risk_cr);

const driverTotals = new Map();
records.forEach((r) => r.drivers.forEach((d) => {
  const cur = driverTotals.get(d.feature) ?? { feature: d.feature, label: d.label, group: d.group, total: 0, signed: 0, n: 0 };
  cur.total += Math.abs(d.shap); cur.signed += d.shap; cur.n++;
  driverTotals.set(d.feature, cur);
}));
const globalDrivers = [...driverTotals.values()]
  .map((d) => ({ feature: d.feature, label: d.label, group: d.group, mean_abs_shap: round(d.total / records.length, 3), direction: d.signed >= 0 ? 'increases' : 'decreases' }))
  .sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
  .slice(0, 10);

const totalOriginal = records.reduce((a, r) => a + r.original_cost_cr, 0);
const totalRevised = records.reduce((a, r) => a + (r.anticipated_cost_cr ?? r.original_cost_cr), 0);
const totalSpent = records.reduce((a, r) => a + r.expenditure_cr, 0);

const portfolio = {
  kpis: {
    projects_monitored: records.length,
    ministries: new Set(records.map((r) => r.ministry)).size,
    sectors: new Set(records.map((r) => r.sector)).size,
    original_cost_cr: round(totalOriginal, 1),
    revised_cost_cr: round(totalRevised, 1),
    overrun_cr: round(totalRevised - totalOriginal, 1),
    overrun_pct: round(((totalRevised / totalOriginal) - 1) * 100, 2),
    expenditure_cr: round(totalSpent, 1),
    expenditure_pct_of_revised: round((totalSpent / totalRevised) * 100, 1),
    critical_count: bandsAgg.find((b) => b.band === 'CRITICAL').count,
    exposure_at_risk_cr: round(records.reduce((a, r) => a + r.exposure_at_risk_cr, 0), 1),
  },
  bands: bandsAgg,
  sectors: sectorsAgg,
  ministries: [...new Set(records.map((r) => r.ministry))].sort(),
  drivers: globalDrivers,
};

// ---------- Time Machine replay (hero projects) ----------
const ALERT_THRESHOLD = 50;

function buildReplay(id, spec) {
  const rec = records.find((r) => r.project_id === id);
  const start = spec.start;
  const months = spec.months;
  const points = [];
  for (let m = 0; m < months; m++) {
    const month = addMonths(start, m);
    const f = m / (months - 1);
    const risk = spec.curve(f, m);
    const phys = spec.progress(f, m);
    const fin = spec.spend(f, m);
    const cost = Math.max(0, (risk / 100) * spec.costScale + spec.costBias);
    const delay = Math.max(0, (risk / 100) * spec.delayScale + spec.delayBias);
    const top = risk > 55
      ? { label: 'Progress gap', shap: round((fin - phys) * 0.42, 2), text: `Expenditure is ${round(fin - phys, 1)} percentage points ahead of physical progress.` }
      : risk > 35
        ? { label: 'Pace below plan', shap: round(risk * 0.05, 2), text: 'Progress rate is below the pace needed to meet the sanctioned date.' }
        : { label: 'Schedule consumed', shap: round(f * 3, 2), text: `${Math.round(f * 100)}% of the sanctioned schedule has been consumed.` };
    points.push({
      as_of_month: `${month}-01`,
      elapsed_months: m + spec.elapsedOffset,
      elapsed_fraction: round((m + spec.elapsedOffset) / rec.duration_months, 3),
      risk_score: round(risk, 1),
      pred_cost_overrun_pct: round(cost, 1),
      pred_delay_months: round(delay, 1),
      physical_progress_pct: round(phys, 1),
      financial_progress_pct: round(fin, 1),
      top_driver: top,
    });
  }
  const crossIdx = points.findIndex((p) => p.risk_score >= ALERT_THRESHOLD);
  if (spec.expectCross !== undefined && crossIdx !== (spec.expectCross ?? -1)) {
    throw new Error(`${id}: threshold crossed at index ${crossIdx}, scenario requires ${spec.expectCross}`);
  }
  const modelMonth = crossIdx >= 0 ? points[crossIdx].as_of_month : null;
  const officialMonth = spec.officialMonth;
  const lead = modelMonth && officialMonth ? monthsBetween(modelMonth.slice(0, 7), officialMonth.slice(0, 7)) : null;
  const events = [];
  if (modelMonth) events.push({ kind: 'model_alert', month: modelMonth, label: 'Model first flagged', detail: `Risk score crossed the ${ALERT_THRESHOLD} alert threshold.` });
  if (officialMonth) events.push({ kind: spec.officialKind ?? 'official_date_revision', month: officialMonth, label: 'Official revision recorded', detail: spec.officialDetail });
  if (spec.completionMonth) events.push({ kind: 'completion', month: spec.completionMonth, label: 'Commissioned', detail: spec.completionDetail ?? '' });
  return {
    project_id: id, project_name: rec.project_name,
    alert_threshold: ALERT_THRESHOLD, points, events,
    model_alert_month: modelMonth, official_event_month: officialMonth,
    lead_time_months: lead,
    outcome_known: !!spec.actualCost,
    actual_cost_overrun_pct: spec.actualCost ?? null,
    actual_delay_months: spec.actualDelay ?? null,
  };
}

// Risk trajectories are anchored so the threshold crossing lands on the month
// the scenario spec (§12) requires; `expectCross` asserts it at build time.
const interp = (anchors, m) => {
  if (m <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (m <= x1) return y0 + ((y1 - y0) * (m - x0)) / (x1 - x0);
  }
  return anchors[anchors.length - 1][1];
};
// Noise amplitude stays below half the anchor step around the crossing, so the
// first month above threshold cannot drift.
const jitter = (m) => Math.sin(m * 1.7) * 0.6;
const fromAnchors = (anchors) => (_f, m) => interp(anchors, m) + jitter(m);

const replays = {
  // Scenario 1 — the silent failure. Progress flattens at 41% from month 14
  // while spend keeps climbing to 57%. Crosses 50 at index 38 = Nov 2024;
  // the official revision is filed Oct 2025 → 11 months of lead time.
  'PRJ-004217': buildReplay('PRJ-004217', {
    start: '2021-09', months: 56, elapsedOffset: 3, expectCross: 38,
    officialMonth: '2025-10-01', officialKind: 'official_date_revision',
    officialDetail: 'First revised completion date filed: Jun 2025 → Sep 2026. Cost revised ₹3,120 Cr → ₹3,610 Cr.',
    costScale: 30, costBias: -2, delayScale: 18, delayBias: -1.2,
    curve: fromAnchors([[0, 15], [13, 25], [24, 33], [34, 41], [38, 52], [46, 66], [55, 78.4]]),
    progress: (_f, m) => (m < 14 ? Math.min(38, m * 2.7) : Math.min(41, 38 + Math.floor((m - 14) / 4) * 0.3)),
    spend: (_f, m) => (m < 14 ? Math.min(40, m * 2.85) : Math.min(57, 40 + (m - 14) * 0.41)),
  }),

  // Scenario 2 — the healthy project. Never approaches the threshold.
  'PRJ-001188': buildReplay('PRJ-001188', {
    start: '2023-04', months: 37, elapsedOffset: 3, expectCross: null,
    officialMonth: null, officialDetail: '',
    costScale: 8, costBias: -0.4, delayScale: 4, delayBias: -0.3,
    curve: fromAnchors([[0, 9], [18, 12], [36, 12.6]]),
    progress: (_f, m) => Math.min(94, m * 2.6),
    spend: (_f, m) => Math.min(91.9, m * 2.55),
  }),

  // Scenario 3 — the vindicated prediction. Completed 2024 at +47% / +22 months.
  // Model flags at index 15 (33% elapsed); official revision at index 30 (61% elapsed).
  'PRJ-002904': buildReplay('PRJ-002904', {
    start: '2018-07', months: 74, elapsedOffset: 3, expectCross: 15,
    officialMonth: '2021-01-01', officialKind: 'official_date_revision',
    officialDetail: 'First revised completion date filed: Oct 2022 → Aug 2024.',
    completionMonth: '2024-08-01',
    completionDetail: 'Commissioned at ₹6,144.6 Cr — 47% over sanctioned cost, 22 months late.',
    actualCost: 47.0, actualDelay: 22,
    costScale: 52, costBias: -3, delayScale: 26, delayBias: -2,
    curve: fromAnchors([[0, 17], [11, 30], [14, 45.5], [15, 52], [30, 70], [50, 82], [73, 88.2]]),
    progress: (_f, m) => Math.min(100, m < 12 ? m * 2.2 : 26 + (m - 12) * 1.19),
    spend: (_f, m) => Math.min(100, m < 12 ? m * 2.4 : 29 + (m - 12) * 1.15),
  }),

  // Scenario 4 — the data-quality case. Reporting goes stale near the end.
  'PRJ-003355': buildReplay('PRJ-003355', {
    start: '2022-12', months: 41, elapsedOffset: 3, expectCross: 22,
    officialMonth: '2025-11-01', officialKind: 'official_date_revision',
    officialDetail: 'Revised completion date filed: Mar 2026 → Nov 2026.',
    costScale: 22, costBias: -1.5, delayScale: 13, delayBias: -1,
    curve: fromAnchors([[0, 18], [12, 31], [21, 47.5], [22, 52], [30, 57], [40, 61.3]]),
    progress: (_f, m) => Math.min(46, m * 1.15),
    spend: (_f, m) => Math.min(52.4, m * 1.32),
  }),
};

// ---------- model registry (§10.2 Screen 5) ----------
const registry = {
  model_version: 'pews-lgbm-v1.0.0',
  trained_at: '2026-09-05T00:00:00Z',
  n_projects: 5981,
  n_snapshot_rows: 247_318,
  n_features: 44,
  split: { train: 172_940, valid: 33_105, test: 41_273, strategy: 'Grouped by project_id, temporally ordered; test window is post-2020 sanctions' },
  baselines: [
    { model: 'Sector-median naive', family: 'naive', pr_auc: 0.52, roc_auc: 0.55, brier: 0.241, mae_cost_pp: 14.8, mae_delay_months: 9.4, is_primary: false },
    { model: 'OLS on log-cost + sector dummies', family: 'statistical', pr_auc: 0.64, roc_auc: 0.71, brier: 0.198, mae_cost_pp: 11.2, mae_delay_months: 7.6, is_primary: false },
    { model: 'Logistic regression', family: 'statistical', pr_auc: 0.66, roc_auc: 0.73, brier: 0.186, mae_cost_pp: 10.9, mae_delay_months: 7.3, is_primary: false },
    { model: 'Weibull AFT (survival)', family: 'survival', pr_auc: 0.69, roc_auc: 0.76, brier: 0.174, mae_cost_pp: 10.1, mae_delay_months: 6.4, is_primary: false },
    { model: 'LightGBM (PEWS)', family: 'ml', pr_auc: 0.78, roc_auc: 0.84, brier: 0.142, mae_cost_pp: 7.9, mae_delay_months: 4.8, is_primary: true },
  ],
  ablation: [
    { config: 'C', label: 'CUF fields only', description: 'Sector, ministry, agency, sanctioned cost and duration, elapsed months, physical progress, cumulative expenditure, status.', n_features: 14, pr_auc: 0.64, delta_vs_prev: 0, pct_of_full: 46.2 },
    { config: 'C+D', label: '+ derived from CUF', description: 'Progress gap, velocity deficit, stall months, performance indices, revision counts — computed from fields MoSPI already collects. No new data collection.', n_features: 30, pr_auc: 0.74, delta_vs_prev: 0.1, pct_of_full: 84.6 },
    { config: 'C+D+E', label: '+ external enrichment', description: 'Sector cost index, agency historical overrun, concurrent workload, delay-reason category, monsoon exposure — not in the CUF today.', n_features: 44, pr_auc: 0.78, delta_vs_prev: 0.04, pct_of_full: 100 },
  ],
  calibration: [
    { bin: 0.05, predicted: 0.049, observed: 0.041, n: 6122 },
    { bin: 0.15, predicted: 0.151, observed: 0.138, n: 5384 },
    { bin: 0.25, predicted: 0.248, observed: 0.264, n: 4611 },
    { bin: 0.35, predicted: 0.352, observed: 0.339, n: 4098 },
    { bin: 0.45, predicted: 0.447, observed: 0.462, n: 3742 },
    { bin: 0.55, predicted: 0.553, observed: 0.541, n: 3966 },
    { bin: 0.65, predicted: 0.649, observed: 0.671, n: 3855 },
    { bin: 0.75, predicted: 0.751, observed: 0.744, n: 3401 },
    { bin: 0.85, predicted: 0.848, observed: 0.862, n: 3117 },
    { bin: 0.95, predicted: 0.944, observed: 0.931, n: 2977 },
  ],
  lead_time: [
    { months: 0, count: 41 }, { months: 2, count: 88 }, { months: 4, count: 146 },
    { months: 6, count: 214 }, { months: 8, count: 271 }, { months: 10, count: 298 },
    { months: 12, count: 246 }, { months: 14, count: 187 }, { months: 16, count: 132 },
    { months: 18, count: 94 }, { months: 20, count: 61 }, { months: 22, count: 38 },
    { months: 24, count: 22 },
  ],
  lead_time_median: 9.7,
  lead_time_p25: 5.8,
  lead_time_p75: 14.6,
  by_stage: [
    { stage: 'Early', elapsed_range: '0–33% elapsed', pr_auc: 0.71, roc_auc: 0.79, mae_cost_pp: 9.6, n_projects: 1284 },
    { stage: 'Mid', elapsed_range: '33–66% elapsed', pr_auc: 0.79, roc_auc: 0.85, mae_cost_pp: 7.8, n_projects: 1611 },
    { stage: 'Late', elapsed_range: '66–100% elapsed', pr_auc: 0.86, roc_auc: 0.91, mae_cost_pp: 5.4, n_projects: 1402 },
  ],
  leakage_tests: [
    { name: 'Blacklist enforced', description: 'actual_cost_cr, actual_commissioning_date and every post-t field are absent from the feature matrix before any fit() or predict().', passed: true, value: '0 blacklisted columns present' },
    { name: 'Project-disjoint splits', description: 'No project_id appears in more than one of train / valid / test. Adjacent monthly snapshots cannot straddle the split.', passed: true, value: '0 shared project ids' },
    { name: 'No future rows', description: 'Every snapshot asserts source_max_month <= as_of_month. Nothing after month t enters the feature vector.', passed: true, value: '247,318 / 247,318 rows pass' },
    { name: 'Shuffled-label test', description: 'A model trained on randomly permuted labels must score near chance on the held-out set. If it does not, the features leak.', passed: true, value: 'ROC-AUC 0.508 (threshold < 0.60)' },
  ],
  limitations: [
    'The dataset is synthetic. It follows the PAIMANA/CUF schema and is calibrated to published portfolio aggregates, but the accuracy figures on this page describe the method on generated data — they are not a claim about real-world performance.',
    'Survivorship bias: only completed projects carry outcome labels, so permanently stalled projects are under-represented in training. The Weibull AFT baseline models this censoring explicitly; the primary model does not.',
    'Metrics are point estimates on a single temporal split. No bootstrap confidence intervals are reported.',
    'Lead-time figures are measured against generated official-revision events, not against real MoSPI filing dates.',
    'The model predicts outcomes, not causes. A high score is a prompt to investigate, not a finding of fault.',
  ],
};

const health = {
  status: 'ok',
  model_version: registry.model_version,
  models_loaded: true,
  data_source: 'fixture',
  projects_ongoing: records.length,
  snapshot_rows: registry.n_snapshot_rows,
  scored_at: `${AS_OF}-01`,
};

// ---------- write ----------
const write = (name, obj) => {
  writeFileSync(join(OUT, name), JSON.stringify(obj));
  const kb = (JSON.stringify(obj).length / 1024).toFixed(0);
  console.log(`  ${name.padEnd(18)} ${kb.padStart(6)} KB`);
};

console.log('PEWS fixtures → src/mocks/');
write('projects.json', records);
write('portfolio.json', portfolio);
write('replay.json', replays);
write('registry.json', registry);
write('health.json', health);

console.log('\nA3 calibration check');
const fmt = (v) => `₹${(v / 100000).toFixed(2)} L Cr`;
console.log(`  projects          ${records.length}            (target 1,981)`);
console.log(`  original cost     ${fmt(portfolio.kpis.original_cost_cr)}    (target ₹37.13 L Cr)`);
console.log(`  revised cost      ${fmt(portfolio.kpis.revised_cost_cr)}    (target ₹42.78 L Cr)`);
console.log(`  aggregate overrun ${portfolio.kpis.overrun_pct.toFixed(2)}%          (target 15.2%)`);
console.log(`  expenditure       ${fmt(portfolio.kpis.expenditure_cr)}    (target ₹20.36 L Cr)`);
console.log(`  spent / revised   ${portfolio.kpis.expenditure_pct_of_revised.toFixed(1)}%          (target 47.6%)`);
console.log(`  CRITICAL          ${portfolio.kpis.critical_count}             (target 214)`);
console.log(`  exposure at risk  ${fmt(portfolio.kpis.exposure_at_risk_cr)}     (target ₹3.1 L Cr)`);
console.log(`  ministries        ${portfolio.kpis.ministries}              (target 17)`);
console.log(`  sectors           ${portfolio.kpis.sectors}              (target 22)`);
const hero = replays['PRJ-004217'];
console.log(`\n  PRJ-004217 model alert ${hero.model_alert_month} → official ${hero.official_event_month} = ${hero.lead_time_months} months lead`);
