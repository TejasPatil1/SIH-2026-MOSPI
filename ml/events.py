"""
Event definitions, horizon labels, and the person-period reshape.

This module is the load-bearing piece of the fairness argument. Both systems
predict *the same event*, defined once here, and both are scored against *the
same labels*. baseline_v1 learns P(event within H) directly; experimental_v2
learns a monthly hazard and multiplies it out. Nothing else differs about the
target.

WHY THE PRODUCT IS EXACT
------------------------
The hazard target is

    h_k(x_t) = P(event at exactly t+k | x_t, no event in (t, t+k) )

conditioned only on "no event yet", never on "still at risk". Project
completion is therefore a legitimate observed zero rather than a censoring
event, and the chain rule gives exactly

    P(no event in (t, t+H]) = prod_{k=1..H} (1 - h_k)

with no competing-risks machinery. new_infra.md's Stage 3 (full competing
risks) is deliberately not built: this identity is all the horizon comparison
needs, and the extra structure would buy nothing measurable here.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ml.config import (COST_EVENT_MIN_JUMP_PCT, SEED, TIME_EVENT_MIN_SLIP_MONTHS)

EVENT_KINDS = ("cost", "time")


def add_events(panel: pd.DataFrame) -> pd.DataFrame:
    """Mark the month in which an observable administrative revision is booked.

    A revision is a *warning signal*, not an overrun. new_infra.md is explicit
    that conflating the two is the main modelling error to avoid, so the final
    cost/time outcome stays a separate target (see final_outcomes)."""
    p = panel.sort_values(["project_id", "snapshot_month"]).reset_index(drop=True)
    g = p.groupby("project_id", sort=False)

    prev_cost = g["anticipated_cost_cr"].shift(1)
    jump_pct = 100.0 * (p["anticipated_cost_cr"] - prev_cost) / prev_cost.abs().clip(lower=1e-9)
    p["cost_event"] = (jump_pct > COST_EVENT_MIN_JUMP_PCT).fillna(False).astype(np.int8)

    prev_date = g["anticipated_commissioning_date"].shift(1)
    slip_m = ((p["anticipated_commissioning_date"].dt.year - prev_date.dt.year) * 12
              + (p["anticipated_commissioning_date"].dt.month - prev_date.dt.month))
    p["time_event"] = (slip_m >= TIME_EVENT_MIN_SLIP_MONTHS).fillna(False).astype(np.int8)
    return p


def _row_position(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Position within project, last position, and a completed-project flag."""
    g = df.groupby("project_id", sort=False)
    pos = g.cumcount().to_numpy()
    last = g["project_id"].transform("size").to_numpy() - 1
    completed = (g["project_status"].transform("last") == "completed").to_numpy()
    return pos, last, completed


def horizon_labels(panel: pd.DataFrame, kind: str, horizon: int) -> pd.DataFrame:
    """`y` = an event of this kind occurs in (t, t+H]. `observed` = the answer is
    knowable from the data we have; unobserved rows are dropped from training
    and from evaluation for BOTH systems, so neither is scored on a guess."""
    e = panel[f"{kind}_event"].to_numpy()
    pos, last, completed = _row_position(panel)
    pid = panel["project_id"].to_numpy()

    fwd = np.zeros(len(panel), dtype=np.int8)
    s = pd.Series(e, index=panel.index)
    grp = s.groupby(pid, sort=False)
    for k in range(1, horizon + 1):
        fwd = np.maximum(fwd, grp.shift(-k).fillna(0).to_numpy().astype(np.int8))

    remaining = last - pos
    # Fully observed if the whole window is in the panel, or if the project
    # completed -- a completed project cannot book a further revision.
    observed = (remaining >= horizon) | completed | (fwd == 1)
    return pd.DataFrame({"y": fwd.astype(np.int8), "observed": observed}, index=panel.index)


def person_period(panel: pd.DataFrame, kind: str, max_lag: int = 12,
                  n_sampled_lags: int = 2, seed: int = SEED) -> pd.DataFrame:
    """Reshape to (row, lag) person-period form for the discrete-time hazard.

    Lag 1 is always kept -- it is the monthly hazard itself. The remaining lags
    are a uniform random subsample of the valid (row, lag) pairs, which keeps
    the design matrix the same order of magnitude as baseline_v1's without
    biasing P(event at t+k | x_t, k): a uniform subsample of rows leaves the
    conditional distribution unchanged.

    Returns the index into `panel`, the lag, and the label.
    """
    rng = np.random.default_rng(seed)
    e = panel[f"{kind}_event"].to_numpy()
    pos, last, completed = _row_position(panel)
    pid = panel["project_id"].to_numpy()
    n = len(panel)

    s = pd.Series(e, index=panel.index)
    grp = s.groupby(pid, sort=False)
    lead = np.zeros((max_lag + 1, n), dtype=np.int8)
    for k in range(1, max_lag + 1):
        lead[k] = grp.shift(-k).fillna(0).to_numpy().astype(np.int8)

    remaining = last - pos
    # cumulative "an event already happened in (t, t+k)" -- the conditioning set
    prior_event = np.zeros((max_lag + 2, n), dtype=bool)
    for k in range(2, max_lag + 2):
        prior_event[k] = prior_event[k - 1] | (lead[k - 1] == 1)

    rows, lags, ys = [], [], []
    idx = np.arange(n)
    for k in range(1, max_lag + 1):
        # observed: window inside the panel, or the project is finished (=> 0)
        ok = ((remaining >= k) | completed) & ~prior_event[k]
        if k == 1:
            keep = ok
        else:
            # uniform subsample: each row keeps n_sampled_lags of the max_lag-1
            # non-unit lags, in expectation
            keep = ok & (rng.random(n) < n_sampled_lags / (max_lag - 1))
        if not keep.any():
            continue
        y = np.where(remaining >= k, lead[k], 0)  # completed => definite zero
        rows.append(idx[keep])
        lags.append(np.full(int(keep.sum()), k, dtype=np.int16))
        ys.append(y[keep].astype(np.int8))

    return pd.DataFrame({
        "row": np.concatenate(rows),
        "lag": np.concatenate(lags),
        "y": np.concatenate(ys),
    })


def survival_horizon_prob(hazard_by_lag: np.ndarray, horizon: int) -> np.ndarray:
    """P(event within H) = 1 - prod_{k=1..H} (1 - h_k). `hazard_by_lag` is
    (n_rows, max_lag) with h_k in column k-1."""
    h = np.clip(hazard_by_lag[:, :horizon], 1e-9, 1 - 1e-9)
    return 1.0 - np.prod(1.0 - h, axis=1)


def final_outcomes(panel: pd.DataFrame) -> pd.DataFrame:
    """Project-level final outcomes. Defined only for completed projects, and
    deliberately NOT equated with the revision events above."""
    last = panel.sort_values("snapshot_month").groupby("project_id").tail(1)
    done = last[last["project_status"] == "completed"].copy()
    done["y_cost"] = (100.0 * (done["actual_cost_cr"] - done["original_cost_cr"])
                      / done["original_cost_cr"].clip(lower=1e-9))
    done["y_time"] = ((done["actual_commissioning_date"].dt.year
                       - done["original_commissioning_date"].dt.year) * 12
                      + (done["actual_commissioning_date"].dt.month
                         - done["original_commissioning_date"].dt.month)).astype(float)
    done["completion_month"] = done["actual_commissioning_date"]
    return done[["project_id", "y_cost", "y_time", "completion_month"]].reset_index(drop=True)


def first_official_signal(panel: pd.DataFrame) -> pd.DataFrame:
    """The month a project's trouble first became visible in the official record
    -- the first cost or date revision. Lead time is measured against this."""
    ev = panel[(panel["cost_event"] == 1) | (panel["time_event"] == 1)]
    first = ev.groupby("project_id")["snapshot_month"].min().rename("first_official_signal")
    return first.reset_index()
