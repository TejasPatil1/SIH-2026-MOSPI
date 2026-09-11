"""
Schema-faithful synthetic monthly panel (assumption A3).

WHAT THIS IS AND IS NOT
-----------------------
This is a simulator, not PAIMANA data. Every number the benchmark reports is a
statement about *this generative process*, not about central-sector projects.
The benchmark is therefore a comparison of methodologies under a stated
data-generating process, and nothing more. See LIMITATIONS in the report.

The generative assumptions that materially decide the benchmark outcome are
listed here so a reader can attack them directly:

  G1  A latent per-project fragility (sector x agency x size x region x noise)
      drives BOTH the onset of delay causes AND the loss of physical progress.
      Reasons and slowdown are two observable manifestations of one cause.

  G2  A delay cause becomes *reportable text* in the month it starts, but only
      becomes *visible in measured velocity* after several months of accrued
      shortfall exceed measurement noise. This is the entire reason delay-reason
      history could carry early-warning value. If this assumption is wrong for
      real PAIMANA reporting -- e.g. if reasons are back-filled only when a
      revision is already being prepared -- the delay-reason result collapses.

  G3  Cost and date revisions are administrative acts with a review lag after
      the underlying condition is met, not instantaneous reflections of reality.
      This lag is what an early-warning system is trying to buy back.

  G4  Sector/agency/size cohorts differ in base rates, so the same raw progress
      number means different things in different cohorts.

  G5  Reporting is imperfect: reasons go unreported, progress updates go stale.

None of these assumptions favour a particular *model family*. They do decide
whether the added feature groups can carry information at all -- which is the
honest framing of Experiments 9 and 10.
"""
from __future__ import annotations

import argparse

import numpy as np
import pandas as pd

from ml.config import AS_OF, DATA_DIR, PANEL_PATH, PANEL_START, SEED
from ml.schema import AGENCIES, CALIBRATION, MONSOON_EXPOSED, SECTORS, SNAPSHOT_COLUMNS, STATES

# Delay causes: monthly onset hazard, drag on progress, cost pressure per month,
# expected duration in months. Drag is multiplicative on the productivity term.
CAUSES = {
    #                base_onset  drag  cost_press  mean_dur
    "land":         (0.0067,     0.44, 0.0026,     14.0),
    "forest":       (0.0050,     0.45, 0.0015,     12.0),
    "contractor":   (0.0070,     0.50, 0.0034,      9.0),
    "funds":        (0.0060,     0.40, 0.0022,      7.0),
    "litigation":   (0.0023,     0.52, 0.0019,     16.0),
    "rnr":          (0.0035,     0.40, 0.0022,     11.0),
    "row":          (0.0060,     0.35, 0.0015,      8.0),
    "approvals":    (0.0070,     0.30, 0.0011,      6.0),
    "forcemajeure": (0.0040,     0.28, 0.0013,      4.0),
}
CAUSE_NAMES = list(CAUSES)

REASON_TEXT = {
    "land": ["Land acquisition pending in {n} villages",
             "Land acquisition and rehabilitation under process"],
    "forest": ["Forest clearance awaited from MoEFCC",
               "Environment clearance under appraisal"],
    "contractor": ["Contractor mobilisation slow; EPC agency under notice",
                   "Termination and re-tendering of EPC package"],
    "funds": ["Fund release constrained in current fiscal",
              "Budgetary support awaited for the package"],
    "litigation": ["Matter sub-judice before the High Court",
                   "Arbitration proceedings with the contractor ongoing"],
    "rnr": ["R&R settlement with project-affected families pending"],
    "row": ["ROW and utility shifting in progress",
            "Right of way handed over in part only"],
    "approvals": ["Statutory approvals awaited from State authorities",
                  "Safety and technical sanction under process"],
    "forcemajeure": ["Work affected by extended monsoon and flooding",
                     "Site work suspended due to adverse weather"],
}

# Administrative behaviour (G3)
COST_REVISION_TRIGGER = 0.06     # projected cost exceeds sanctioned/anticipated by 6%
COST_REVISION_LAG = (3, 10)       # months of review before the revision is booked
TIME_REVISION_TRIGGER = 3        # projected completion slips >= 3 months past anticipated
TIME_REVISION_LAG = (2, 8)

DRAG_SCALE = 0.80              # global severity knob; tuned so the delayed
                               # share lands near published Flash Report levels
PRICE_ESCALATION_PM = 0.0012   # unit-rate escalation per elapsed month

REPORT_REASON_PROB = 0.82        # G5: an active cause is reported in a given month
STALE_UPDATE_PROB = 0.06         # a monitoring cycle with no progress update


def _months(a: pd.Timestamp, b: pd.Timestamp) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def _add_months(ts: pd.Timestamp, n: int) -> pd.Timestamp:
    return (ts + pd.DateOffset(months=int(n))).normalize()


def _sector_table() -> tuple[list, np.ndarray]:
    shares = np.array([s[3] for s in SECTORS], dtype=float)
    return SECTORS, shares / shares.sum()


def generate_panel(n_projects: int = 8000, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    sectors, sector_p = _sector_table()

    # Sanction dates: portfolio grows over time, so recent cohorts are larger.
    n_years = AS_OF.year - PANEL_START.year + 1
    year_w = np.power(1.045, np.arange(n_years))
    year_w /= year_w.sum()
    years = PANEL_START.year + rng.choice(n_years, size=n_projects, p=year_w)
    months = rng.integers(1, 13, size=n_projects)

    # Agency quality is a persistent latent, shared across a whole agency's
    # portfolio. This is what makes cohort-relative features meaningful (G4).
    all_agencies = sorted({a for v in AGENCIES.values() for a in v})
    agency_effect = {a: float(rng.normal(0.0, 0.28)) for a in all_agencies}

    rows: list[tuple] = []

    for i in range(n_projects):
        pid = f"PRJ-{i + 1:06d}"
        s_idx = rng.choice(len(sectors), p=sector_p)
        sector, ministry, trouble_mult, _ = sectors[s_idx]
        agency = str(rng.choice(AGENCIES[sector]))
        state = str(rng.choice(STATES))
        sanction = pd.Timestamp(year=int(years[i]), month=int(months[i]), day=1)
        if sanction > AS_OF:
            sanction = AS_OF

        # ₹ crore. Heavy right tail; monitoring floor is 150.
        cost0 = float(150.0 + rng.lognormal(mean=5.9, sigma=1.15))
        size_effect = 0.22 * np.log10(cost0 / 150.0)

        duration = int(np.clip(rng.normal(30 + 12 * np.log10(cost0 / 150.0), 9), 20, 96))
        orig_commission = _add_months(sanction, duration)

        # G1: one latent fragility behind causes and behind productivity loss.
        fragility = float(np.exp(
            0.55 * np.log(trouble_mult)
            + agency_effect[agency]
            + size_effect
            + (0.18 if state in MONSOON_EXPOSED else 0.0)
            + rng.normal(0.0, 0.42)
        ))

        project_type = str(rng.choice(["greenfield", "brownfield", "expansion"], p=[0.55, 0.25, 0.20]))
        funding = str(rng.choice(["budgetary", "EBR", "PPP", "mixed"], p=[0.58, 0.18, 0.10, 0.14]))

        # Normalised S-curve: monthly planned progress increments summing to 100.
        _f = (np.arange(1, duration + 1) - 0.5) / duration
        schedule = 0.6 + 1.2 * np.exp(-((_f - 0.5) ** 2) / 0.22)
        schedule = 100.0 * schedule / schedule.sum()

        # ---- month-by-month simulation --------------------------------------
        active: dict[str, dict] = {}     # cause -> {start_idx, ends_idx}
        phys = 0.0
        spend = 0.0
        anticipated_cost = cost0
        anticipated_date = orig_commission
        projected_cost = cost0
        cost_trigger_since: int | None = None
        time_trigger_since: int | None = None
        cost_lag = int(rng.integers(*COST_REVISION_LAG))
        time_lag = int(rng.integers(*TIME_REVISION_LAG))
        cost_pressure = 0.0
        last_reported_phys = 0.0
        status = "ongoing"
        completed_month: pd.Timestamp | None = None
        n_cost_events = 0
        n_time_events = 0

        max_m = _months(sanction, AS_OF)
        project_rows: list[tuple] = []

        for m in range(1, max_m + 1):
            month = _add_months(sanction, m)
            frac = m / duration

            # cause onsets -- hazard rises in the middle of the project life
            phase = 0.45 + 1.5 * np.exp(-((frac - 0.45) ** 2) / 0.16)
            for c in CAUSE_NAMES:
                base, _, _, mean_dur = CAUSES[c]
                if c in active:
                    continue
                if rng.random() < base * fragility * phase:
                    dur = max(2, int(rng.gamma(2.2, mean_dur / 2.2)))
                    active[c] = {"start": m, "end": m + dur}
            for c in [c for c, v in active.items() if v["end"] <= m]:
                del active[c]

            drag = DRAG_SCALE * sum(CAUSES[c][1] for c in active)
            press = sum(CAUSES[c][2] for c in active)

            # Planned S-curve, normalised so an undisturbed project reaches
            # exactly 100% at its sanctioned duration -- otherwise every project
            # finishes early and there is no schedule risk to detect.
            planned = schedule[m - 1] if m <= duration else schedule[-1]
            productivity = float(np.exp(-drag) * rng.lognormal(-0.045, 0.30))
            phys = min(100.0, phys + planned * productivity)

            # Expenditure: work done at an escalating unit rate, plus mobilisation
            # front-load, establishment overhead that runs with the clock, and the
            # idle-time cost of whatever is currently blocked. Price escalation on
            # a delayed project is the mechanism that turns time overrun into cost
            # overrun -- the link the problem statement is actually about.
            escalation = 1.0 + PRICE_ESCALATION_PM * m
            spend += cost0 * (planned * productivity / 100.0) * escalation
            spend += cost0 * (0.005 if m <= 3 else 0.0)
            spend += cost0 * 0.0004          # establishment / overhead, runs with time
            spend += cost0 * press
            cost_pressure += press
            spend = min(spend, cost0 * 3.5)

            # Projected final cost as a reviewer would estimate it: money already
            # spent, plus the remaining work at unit rate, escalated for whatever
            # is currently going wrong. Deliberately NOT spend/(phys/100), which
            # front-load and overhead make wildly pessimistic early on.
            projected_cost = max(
                cost0,
                spend + cost0 * (100.0 - phys) / 100.0
                * (1.0 + PRICE_ESCALATION_PM * m + 13.0 * press),
            )
            vel = max(planned * productivity, 1e-3)
            months_to_go = (100.0 - phys) / vel
            projected_completion = _add_months(month, int(min(months_to_go, 400)))

            # ---- G3: administrative revision events -------------------------
            if projected_cost > anticipated_cost * (1 + COST_REVISION_TRIGGER):
                cost_trigger_since = m if cost_trigger_since is None else cost_trigger_since
            else:
                cost_trigger_since = None
            if cost_trigger_since is not None and m - cost_trigger_since >= cost_lag:
                # A revised estimate carries contingency, so it lands above the bare
                # projection. This is what keeps the revised-cost stock above the
                # sanctioned stock by the margin the Flash Report reports.
                anticipated_cost = float(projected_cost * rng.uniform(1.02, 1.13))
                cost_trigger_since = None
                cost_lag = int(rng.integers(*COST_REVISION_LAG))
                n_cost_events += 1

            slip = _months(anticipated_date, projected_completion)
            if slip >= TIME_REVISION_TRIGGER:
                time_trigger_since = m if time_trigger_since is None else time_trigger_since
            else:
                time_trigger_since = None
            if time_trigger_since is not None and m - time_trigger_since >= time_lag:
                anticipated_date = _add_months(projected_completion, int(rng.integers(-1, 3)))
                time_trigger_since = None
                time_lag = int(rng.integers(*TIME_REVISION_LAG))
                n_time_events += 1

            # ---- G5: imperfect reporting ------------------------------------
            reported = [c for c in active if rng.random() < REPORT_REASON_PROB]
            if reported:
                parts = [str(rng.choice(REASON_TEXT[c])) for c in sorted(reported)]
                text = "; ".join(parts).replace("{n}", str(int(rng.integers(2, 12))))
            else:
                text = None

            if rng.random() < STALE_UPDATE_PROB:
                obs_phys = last_reported_phys      # no update this cycle
            else:
                obs_phys = float(np.clip(phys + rng.normal(0, 0.6), 0, 100))
                last_reported_phys = obs_phys

            if phys >= 99.9:
                status = "completed"
                completed_month = month
            elif m > duration * 3 and phys < 25 and rng.random() < 0.02:
                status = "suspended"

            project_rows.append((
                pid, f"{sector} Project {i + 1}", ministry, sector, state, agency,
                funding, sanction, cost0, orig_commission, month,
                round(anticipated_cost, 2),
                anticipated_date if anticipated_date != orig_commission else orig_commission,
                round(spend, 2), round(obs_phys, 2), status, text,
                None, None,  # actual_* filled below for completed projects only
            ))

            if status in ("completed",):
                break

        if not project_rows:
            continue

        # Outcome columns exist only on the terminal row of a completed project.
        if status == "completed" and completed_month is not None:
            last = list(project_rows[-1])
            last[17] = round(spend, 2)          # actual_cost_cr
            last[18] = completed_month          # actual_commissioning_date
            project_rows[-1] = tuple(last)

        rows.extend(project_rows)

    panel = pd.DataFrame.from_records(rows, columns=[
        "project_id", "project_name", "ministry", "sector", "state",
        "implementing_agency", "funding_mode", "sanction_date", "original_cost_cr",
        "original_commissioning_date", "snapshot_month", "anticipated_cost_cr",
        "anticipated_commissioning_date", "expenditure_cr", "physical_progress_pct",
        "project_status", "reason_for_delay", "actual_cost_cr", "actual_commissioning_date",
    ])
    for c in ("sanction_date", "original_commissioning_date", "snapshot_month",
              "anticipated_commissioning_date", "actual_commissioning_date"):
        panel[c] = pd.to_datetime(panel[c])

    return _calibrate_costs(panel)


def _calibrate_costs(panel: pd.DataFrame) -> pd.DataFrame:
    """Scale all rupee columns by one constant so the ongoing portfolio matches
    the A5 anchor for total original cost. Ratios (overrun %, expenditure %) are
    products of the simulation and are NOT forced -- they are reported as
    achieved so the calibration can be judged."""
    last = panel.sort_values("snapshot_month").groupby("project_id").tail(1)
    ongoing = last[last["project_status"] != "completed"]
    if ongoing.empty:
        return panel
    scale = CALIBRATION["original_cost_cr"] / float(ongoing["original_cost_cr"].sum())
    for c in ("original_cost_cr", "anticipated_cost_cr", "expenditure_cr", "actual_cost_cr"):
        panel[c] = panel[c] * scale
    return panel


def calibration_report(panel: pd.DataFrame) -> dict:
    last = panel.sort_values("snapshot_month").groupby("project_id").tail(1)
    ongoing = last[last["project_status"] != "completed"]
    done = last[last["project_status"] == "completed"]
    oc = float(ongoing["original_cost_cr"].sum())
    ac = float(ongoing["anticipated_cost_cr"].sum())
    ex = float(ongoing["expenditure_cr"].sum())
    return {
        "n_projects": int(last["project_id"].nunique()),
        "n_panel_rows": int(len(panel)),
        "n_ongoing_at_as_of": int(len(ongoing)),
        "n_completed": int(len(done)),
        "ongoing_original_cost_cr": round(oc, 1),
        "ongoing_anticipated_cost_cr": round(ac, 1),
        "ongoing_expenditure_cr": round(ex, 1),
        "aggregate_cost_overrun_pct": round(100 * (ac / oc - 1), 2),
        "expenditure_pct_of_anticipated": round(100 * ex / ac, 2),
        "anchor_aggregate_cost_overrun_pct": round(
            100 * (CALIBRATION["revised_cost_cr"] / CALIBRATION["original_cost_cr"] - 1), 2),
        "anchor_expenditure_pct": round(
            100 * CALIBRATION["expenditure_cr"] / CALIBRATION["revised_cost_cr"], 2),
        "anchor_ongoing_projects": CALIBRATION["ongoing_projects"],
        "n_sectors": int(last["sector"].nunique()),
        "n_ministries": int(last["ministry"].nunique()),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate the synthetic CUF panel.")
    ap.add_argument("--projects", type=int, default=8000)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--out", type=str, default=str(PANEL_PATH))
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    panel = generate_panel(args.projects, args.seed)
    assert set(SNAPSHOT_COLUMNS) <= set(panel.columns), "panel violates the CUF schema"
    panel.to_parquet(args.out, index=False)

    rep = calibration_report(panel)
    print(f"wrote {args.out}")
    for k, v in rep.items():
        print(f"  {k:38s} {v}")


if __name__ == "__main__":
    main()
