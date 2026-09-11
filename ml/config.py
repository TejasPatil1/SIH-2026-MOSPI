"""
Shared configuration for the PAIMANA architecture benchmark.

Both baseline_v1 and experimental_v2 import from here. Nothing that affects
fairness (splits, thresholds, event definitions, hyperparameters) may be
defined anywhere else -- if the two systems ever disagree about what a "cost
event" is, the benchmark is meaningless.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ARTIFACT_DIR = ROOT / "artifacts"
RESULTS_DIR = ROOT / "results"

PANEL_PATH = DATA_DIR / "panel.parquet"
SNAPSHOT_PATH = DATA_DIR / "snapshots.parquet"

SEED = 20260908

# ------------------------------------------------------------------ calendar

PANEL_START = pd.Timestamp("2006-01-01")
AS_OF = pd.Timestamp("2026-04-01")  # matches the frontend's demo month

# Purged group-time split. Project sets are disjoint AND calendar windows are
# disjoint -- this closes leakage channels 2 and 3 simultaneously (§7.2).
# Rows outside a project's own era window are dropped, not reassigned.
TRAIN_END = pd.Timestamp("2019-01-01")   # train rows:  as_of <  TRAIN_END
VAL_END = pd.Timestamp("2021-07-01")     # val rows:    TRAIN_END <= as_of < VAL_END
                                         # test rows:   as_of >= VAL_END

# ------------------------------------------------------------------- targets

COST_THRESHOLD_PCT = 10.0     # y_cost_flag = final cost overrun > 10%
TIME_THRESHOLD_MONTHS = 6.0   # y_time_flag = final delay > 6 months

# An *event* is an observable administrative act recorded in the panel, not a
# final outcome. new_infra.md §1 is explicit that these must not be conflated:
# a revision is a warning signal, an overrun is the eventual result.
COST_EVENT_MIN_JUMP_PCT = 2.0   # anticipated_cost_cr rises >2% vs previous month
TIME_EVENT_MIN_SLIP_MONTHS = 1  # anticipated_commissioning_date slips >=1 month

HORIZONS = (3, 6, 12)  # months ahead, for every horizon-based comparison

# Snapshot eligibility
MIN_ELAPSED_MONTHS = 3  # need some history before velocity features mean anything

# ------------------------------------------------------------- feature groups
#
# The group partition is the ablation partition. Group membership is decided by
# prefix in features/build.py; these are the group codes.
#
#   C  CUF static + CUF dynamic as-of-t          (what the form already collects)
#   D  derived from CUF, no new fields           (velocities, gaps, indices)
#   E  external enrichment + current delay reason category
#   R  temporal delay-reason features            (NEW in experimental_v2)
#   K  cohort-relative features, as-of-t         (NEW in experimental_v2)
#
GROUPS_OLD = ("C", "D", "E")
GROUPS_NEW = ("C", "D", "E", "R", "K")

ABLATIONS = {
    "A_cuf_only": ("C",),
    "B_cuf_derived": ("C", "D"),
    "C_plus_reasons": ("C", "D", "E", "R"),
    "D_plus_cohort": ("C", "D", "E", "R", "K"),
    "E_full_new": ("C", "D", "E", "R", "K"),  # == D, plus the hazard formulation
}

# ------------------------------------------------------------------- leakage
#
# Columns that encode the answer. assert_clean() runs before every fit and
# every predict. A raw panel column not derived as-of-t belongs here.
BLACKLIST = frozenset({
    "actual_cost_cr",
    "actual_commissioning_date",
    "project_status",
    "y_cost",
    "y_time",
    "y_cost_flag",
    "y_time_flag",
    "final_cost_overrun_pct",
    "final_delay_months",
    "completion_month",
    "is_completed",
    # forward-looking event labels, added by events.py
    "cost_event_next_month",
    "time_event_next_month",
})

# ---------------------------------------------------------------- model specs
#
# Identical hyperparameters for both systems. Any performance difference is
# therefore attributable to formulation and features, not to tuning.

LGB_CLF = dict(
    objective="binary",
    n_estimators=600,
    learning_rate=0.05,
    num_leaves=31,
    min_child_samples=100,  # adjacent monthly snapshots are near-duplicates
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    verbose=-1,
    n_jobs=-1,
)

LGB_REG = dict(
    objective="regression_l2",
    n_estimators=800,
    learning_rate=0.05,
    num_leaves=63,
    max_depth=8,
    min_child_samples=80,
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    verbose=-1,
    n_jobs=-1,
)

EARLY_STOPPING_ROUNDS = 50

# ------------------------------------------------------------------ operating
#
# The monitoring cell reviews a fixed number of projects per cycle. Capacity,
# not AUC, is the operating constraint that decides whether the system is
# useful (new_infra.md, "Capacity-constrained evaluation").
CAPACITIES = (10, 25, 50, 100)
HEADLINE_CAPACITY = 50

RISK_BANDS = (("LOW", 0, 25), ("WATCH", 25, 50), ("HIGH", 50, 75), ("CRITICAL", 75, 101))
RISK_WEIGHTS = {"p_cost": 0.30, "p_time": 0.30, "severity": 0.20, "momentum": 0.20}
ALERT_THRESHOLD = 50.0  # risk_score at which a project is "flagged", for lead time


def band_for(score: float) -> str:
    for name, lo, hi in RISK_BANDS:
        if lo <= score < hi:
            return name
    return "CRITICAL"
