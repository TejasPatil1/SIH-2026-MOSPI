"""
The shared snapshot and feature builder.

ONE implementation, used by baseline_v1 and experimental_v2 alike. The systems
differ only in which feature GROUPS they are handed and in what they do with
them -- never in how a feature is computed. That is enforced by there being no
second copy of this code to drift from.

Column prefixes are the group codes, and the prefix is the ablation switch:

    c_  CUF fields, static and as-of-t dynamic
    d_  derived from CUF, no new data collection
    e_  external enrichment + the current delay-reason category
    r_  delay-reason history            (new in experimental_v2)
    k_  cohort-relative, as-of-t        (new in experimental_v2)

Every column is a function of panel rows with snapshot_month <= t. `as_of()`
records the boundary and leakage_guard.assert_as_of re-checks it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ml.config import MIN_ELAPSED_MONTHS
from ml.features import cohort as K
from ml.features.reasons import CATEGORIES, reason_matrix, temporal_reason_features
from ml.schema import MONSOON_EXPOSED

CATEGORICALS = ["c_sector", "c_ministry", "c_state", "c_agency", "c_funding_mode"]

# Stand-in for the WPI construction-materials index. A bundled real series drops
# straight in here; the shape (steady escalation) is what the feature encodes.
_INDEX_BASE = pd.Timestamp("2006-01-01")
_INDEX_RATE = 0.0045


def _months_between(a: pd.Series, b: pd.Series) -> pd.Series:
    return (b.dt.year - a.dt.year) * 12 + (b.dt.month - a.dt.month)


def _cost_index(month: pd.Series) -> pd.Series:
    n = (month.dt.year - _INDEX_BASE.year) * 12 + (month.dt.month - _INDEX_BASE.month)
    return np.power(1.0 + _INDEX_RATE, n)


def build_features(panel: pd.DataFrame) -> pd.DataFrame:
    """Panel (with events already marked) -> one feature row per project-month."""
    p = panel.sort_values(["project_id", "snapshot_month"]).reset_index(drop=True)
    g = p.groupby("project_id", sort=False)
    pid = p["project_id"].to_numpy()

    first = g[["sanction_date", "original_cost_cr", "original_commissioning_date"]].transform("first")
    duration = _months_between(first["sanction_date"], first["original_commissioning_date"])
    elapsed = _months_between(first["sanction_date"], p["snapshot_month"])

    out = pd.DataFrame(index=p.index)
    out["project_id"] = p["project_id"]
    out["as_of_month"] = p["snapshot_month"]
    out["source_max_month"] = p["snapshot_month"]   # by construction
    out["cost_event"] = p["cost_event"]
    out["time_event"] = p["time_event"]
    out["project_status"] = p["project_status"]
    out["original_cost_cr"] = first["original_cost_cr"]
    out["expenditure_cr"] = p["expenditure_cr"]

    # ------------------------------------------------------------- group C
    out["c_sector"] = p["sector"].astype("category")
    out["c_ministry"] = p["ministry"].astype("category")
    out["c_state"] = p["state"].astype("category")
    out["c_agency"] = p["implementing_agency"].astype("category")
    out["c_funding_mode"] = p["funding_mode"].astype("category")
    out["c_original_cost_cr"] = first["original_cost_cr"]
    out["c_log_original_cost"] = np.log1p(first["original_cost_cr"])
    out["c_original_duration_months"] = duration.astype(float)
    out["c_sanction_year"] = first["sanction_date"].dt.year.astype(float)
    out["c_elapsed_months"] = elapsed.astype(float)
    out["c_elapsed_fraction"] = elapsed / duration.clip(lower=1)
    out["c_physical_progress_pct"] = p["physical_progress_pct"]
    out["c_expenditure_cr"] = p["expenditure_cr"]
    out["c_financial_progress_pct"] = (100.0 * p["expenditure_cr"]
                                       / first["original_cost_cr"].clip(lower=1e-9))

    # ------------------------------------------------------------- group D
    phy = p["physical_progress_pct"]
    fin = out["c_financial_progress_pct"]
    out["d_progress_gap"] = fin - phy
    out["d_schedule_perf_index"] = phy / (out["c_elapsed_fraction"] * 100.0).clip(lower=1e-6)
    out["d_cost_perf_index"] = phy / fin.clip(lower=1e-6)

    for w in (3, 6):
        out[f"d_progress_velocity_{w}m"] = (phy - g["physical_progress_pct"].shift(w)) / w
        out[f"d_expenditure_velocity_{w}m"] = (
            (p["expenditure_cr"] - g["expenditure_cr"].shift(w)) / w
            / first["original_cost_cr"].clip(lower=1e-9) * 100.0)

    dphy = phy - g["physical_progress_pct"].shift(1)
    stalled = (dphy.fillna(0) < 0.5).astype(float)
    out["d_stall_months_3m"] = (stalled.groupby(pid).rolling(3, min_periods=1).sum()
                                .reset_index(level=0, drop=True))
    out["d_stall_months_6m"] = (stalled.groupby(pid).rolling(6, min_periods=1).sum()
                                .reset_index(level=0, drop=True))

    idx = pd.Series(np.arange(len(p), dtype=float), index=p.index)
    moved = dphy.abs() > 1e-9
    out["d_months_since_update"] = (idx - idx.where(moved).groupby(pid).ffill()).fillna(0.0)

    out["d_n_cost_revisions"] = g["cost_event"].cumsum().astype(float)
    out["d_n_date_revisions"] = g["time_event"].cumsum().astype(float)
    for kind in ("cost", "time"):
        last_ev = idx.where(p[f"{kind}_event"] == 1).groupby(pid).ffill()
        out[f"d_months_since_{kind}_event"] = (idx - last_ev).fillna(-1.0)

    out["d_realized_overrun_pct"] = (100.0 * (p["anticipated_cost_cr"] - first["original_cost_cr"])
                                     / first["original_cost_cr"].clip(lower=1e-9))
    out["d_realized_slip_months"] = _months_between(
        first["original_commissioning_date"], p["anticipated_commissioning_date"]).astype(float)

    remaining = (duration - elapsed).clip(lower=0)
    required_vel = (100.0 - phy) / remaining.clip(lower=1)
    out["d_velocity_deficit"] = required_vel - out["d_progress_velocity_3m"]
    out["d_months_to_complete_at_velocity"] = (
        (100.0 - phy) / out["d_progress_velocity_3m"].clip(lower=0.05)).clip(upper=600)
    out["d_projected_slip_months"] = out["d_months_to_complete_at_velocity"] - remaining
    out["d_is_first_slip_logged"] = (out["d_n_date_revisions"] > 0).astype(float)

    # ------------------------------------------------------------- group E
    rz = reason_matrix(p)
    for c in CATEGORIES:
        out[f"e_reason_{c}"] = rz[f"rz_{c}"].astype(float)
    out["e_n_distinct_reasons_now"] = rz.sum(axis=1).astype(float)
    out["e_has_reason"] = (rz.sum(axis=1) > 0).astype(float)
    out["e_monsoon_exposed"] = p["state"].isin(MONSOON_EXPOSED).astype(float)
    out["e_cost_index_delta"] = (_cost_index(p["snapshot_month"])
                                 / _cost_index(first["sanction_date"]) - 1.0)
    out["e_concurrent_agency_load"] = (
        p.groupby(["implementing_agency", "snapshot_month"])["project_id"]
        .transform("size").astype(float) - 1.0)

    # ------------------------------------------------------------- group R
    out = out.join(temporal_reason_features(p))

    # ------------------------------------------------------------- group K
    kin = pd.DataFrame({
        "sector": p["sector"],
        "implementing_agency": p["implementing_agency"],
        "cost_band": K.cost_band(first["original_cost_cr"]),
        "duration_band": K.duration_band(duration),
        "stage_bucket": K.stage_bucket(out["c_elapsed_fraction"]),
        "as_of_month": p["snapshot_month"],
        "physical_progress_pct": phy,
        "financial_progress_pct": fin,
        "progress_gap": out["d_progress_gap"],
        "progress_velocity_3m": out["d_progress_velocity_3m"],
        "cost_event": p["cost_event"],
        "time_event": p["time_event"],
    })
    out = out.join(K.cohort_features(kin))

    static = pd.DataFrame({
        "project_id": p["project_id"],
        "sector": p["sector"],
        "cost_band": kin["cost_band"],
        "original_duration_months": duration,
        "sanction_date": first["sanction_date"],
    }).groupby("project_id", as_index=False).first()
    dpct = K.duration_percentile_at_sanction(static)
    out["k_duration_pct_at_sanction"] = out["project_id"].map(dpct)

    # Too little history for a velocity to mean anything (§11.1).
    out = out[out["c_elapsed_months"] >= MIN_ELAPSED_MONTHS].reset_index(drop=True)
    return out


def feature_columns(snap: pd.DataFrame, groups: tuple[str, ...]) -> list[str]:
    """The ablation switch. Group membership is the column prefix, so there is
    no separate list to fall out of sync with the builder."""
    pref = tuple(f"{g.lower()}_" for g in groups)
    return [c for c in snap.columns if c.startswith(pref)]


# ------------------------------------------------------- training-window priors

TE_SPECS = (("c_agency", "y_cost"), ("c_agency", "y_time"),
            ("c_sector", "y_cost"), ("c_sector", "y_time"),
            ("c_state", "y_time"))


def fit_target_encodings(train: pd.DataFrame) -> dict:
    """Historical priors (Group E). Fitted on TRAIN rows only and applied
    unchanged to validation and test -- leakage channel 3. Smoothed towards the
    global mean so a two-project agency does not get a confident prior."""
    enc = {}
    for key, target in TE_SPECS:
        d = train[[key, target]].dropna()
        if d.empty:
            enc[(key, target)] = (0.0, {})
            continue
        prior = float(d[target].mean())
        stats = d.groupby(key, observed=True)[target].agg(["mean", "count"])
        k = 50.0
        smoothed = (stats["mean"] * stats["count"] + prior * k) / (stats["count"] + k)
        enc[(key, target)] = (prior, smoothed.to_dict())
    return enc


def apply_target_encodings(snap: pd.DataFrame, enc: dict) -> pd.DataFrame:
    snap = snap.copy()
    for (key, target), (prior, table) in enc.items():
        name = f"e_te_{key.replace('c_', '')}_{target}"
        snap[name] = snap[key].astype(str).map(table).astype(float).fillna(prior)
    return snap
