"""
Cohort-relative features (feature group K), computed strictly as-of month t.

"Physical progress = 42%" is not a fact an analyst can act on. "Physical
progress is at the 8th percentile of comparable projects at the same stage" is.
That is the whole content of this module.

LEAKAGE
-------
This is the most dangerous feature group in the system, because the natural
implementation -- "average final overrun for this agency" -- reads the future.
Every statistic here is built from a REFERENCE WINDOW of panel rows strictly
BEFORE the current month, and contains no outcome variable of any kind: only
what those peer projects had already reported by then.

The reference window is trailing rather than all-of-history on purpose. A 2008
cohort is not the right benchmark for a 2024 project, and bounding the window
also keeps the computation linear in panel size.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

REFERENCE_WINDOW_MONTHS = 36
MIN_COHORT_SIZE = 30          # below this the percentile is noise; emit NaN
N_STAGE_BUCKETS = 10

VALUE_COLS = ("physical_progress_pct", "financial_progress_pct",
              "progress_gap", "progress_velocity_3m")

COHORTS = {
    "sec": ("sector", "cost_band"),
    "agy": ("implementing_agency",),
    "dur": ("duration_band",),
}


def cost_band(cost_cr: pd.Series) -> pd.Series:
    return pd.cut(cost_cr, [0, 500, 1500, 5000, 20000, np.inf],
                  labels=["<500", "500-1.5k", "1.5k-5k", "5k-20k", ">20k"]).astype(str)


def duration_band(months: pd.Series) -> pd.Series:
    return pd.cut(months, [0, 30, 42, 54, 72, np.inf],
                  labels=["<30m", "30-42m", "42-54m", "54-72m", ">72m"]).astype(str)


def stage_bucket(elapsed_fraction: pd.Series) -> pd.Series:
    return np.clip((elapsed_fraction * N_STAGE_BUCKETS).fillna(0).astype(int),
                   0, N_STAGE_BUCKETS + 2)


def cohort_features(df: pd.DataFrame) -> pd.DataFrame:
    """`df` must be sorted by snapshot_month and carry VALUE_COLS, the cohort
    key columns, `stage_bucket`, `as_of_month`, and the two event flags."""
    out = pd.DataFrame(index=df.index)
    months = np.sort(df["as_of_month"].unique())
    month_pos = {m: i for i, m in enumerate(months)}
    pos = df["as_of_month"].map(month_pos).to_numpy()

    for tag, keys in COHORTS.items():
        gkey = df[list(keys)].astype(str).agg("|".join, axis=1) + "|s" + df["stage_bucket"].astype(str)
        out = out.join(_percentiles_vs_prior(df, gkey, pos, months, tag))
    return out


def _percentiles_vs_prior(df: pd.DataFrame, gkey: pd.Series, pos: np.ndarray,
                          months: np.ndarray, tag: str) -> pd.DataFrame:
    """Percentile of each row's values among peer rows from the trailing window.

    Uses the identity  count_less_in_history = rank_in(history + current)
    - rank_in(current), so one vectorised groupby-rank per month replaces a
    per-cohort Python loop.
    """
    vals = df[list(VALUE_COLS)].to_numpy(dtype=np.float64)
    ev = df[["cost_event", "time_event"]].to_numpy(dtype=np.float64)
    codes, _ = pd.factorize(gkey)

    n = len(df)
    pct = np.full((n, len(VALUE_COLS)), np.nan)
    ev_rate = np.full((n, 2), np.nan)
    csize = np.zeros(n)

    order = np.argsort(pos, kind="stable")
    starts = np.searchsorted(pos[order], np.arange(len(months)), side="left")
    ends = np.searchsorted(pos[order], np.arange(len(months)), side="right")

    for mi in range(len(months)):
        cur = order[starts[mi]:ends[mi]]
        if cur.size == 0:
            continue
        lo = max(0, mi - REFERENCE_WINDOW_MONTHS)
        hist = order[starts[lo]:starts[mi]]
        if hist.size == 0:
            continue

        hc, cc = codes[hist], codes[cur]
        n_hist = pd.Series(np.ones(hist.size)).groupby(hc).transform("size")
        size_map = pd.Series(np.ones(hist.size), index=hc).groupby(level=0).size()
        cur_size = pd.Series(cc).map(size_map).to_numpy()
        csize[cur] = np.nan_to_num(cur_size)

        # peer event rate: how often this cohort books a revision in a month
        rate = pd.DataFrame(ev[hist], index=hc).groupby(level=0).mean()
        ev_rate[cur] = rate.reindex(cc).to_numpy()

        both = np.concatenate([hist, cur])
        bc = np.concatenate([hc, cc])
        rank_union = (pd.DataFrame(vals[both]).groupby(bc).rank(method="min") - 1).to_numpy()
        rank_cur = (pd.DataFrame(vals[cur]).groupby(cc).rank(method="min") - 1).to_numpy()
        less_in_hist = rank_union[hist.size:] - rank_cur
        with np.errstate(invalid="ignore", divide="ignore"):
            pct[cur] = less_in_hist / cur_size[:, None]

        small = cur_size < MIN_COHORT_SIZE
        pct[cur[small]] = np.nan
        ev_rate[cur[small]] = np.nan
        _ = n_hist  # size series retained for readability of the identity above

    cols = {}
    for j, v in enumerate(VALUE_COLS):
        cols[f"k_{tag}_pct_{v}"] = pct[:, j]
    cols[f"k_{tag}_cost_event_rate"] = ev_rate[:, 0]
    cols[f"k_{tag}_time_event_rate"] = ev_rate[:, 1]
    cols[f"k_{tag}_size"] = csize
    return pd.DataFrame(cols, index=df.index)


def duration_percentile_at_sanction(panel_static: pd.DataFrame) -> pd.Series:
    """Percentile of a project's sanctioned duration within its sector x cost
    band, among projects sanctioned strictly earlier. A project given an
    unusually short schedule for its class is a different risk from one given a
    generous one, and the raw month count cannot express that."""
    d = panel_static.sort_values("sanction_date").reset_index(drop=True)
    key = d["sector"].astype(str) + "|" + d["cost_band"].astype(str)
    out = np.full(len(d), np.nan)
    hist: dict[str, list[float]] = {}
    for i, (k, v, _) in enumerate(zip(key, d["original_duration_months"], d["sanction_date"])):
        prev = hist.setdefault(k, [])
        if len(prev) >= MIN_COHORT_SIZE:
            arr = np.sort(np.asarray(prev))
            out[i] = np.searchsorted(arr, v, side="left") / arr.size
        prev.append(float(v))
    return pd.Series(out, index=d["project_id"].to_numpy(), name="k_duration_pct_at_sanction")
