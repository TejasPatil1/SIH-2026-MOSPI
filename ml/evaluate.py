"""
The shared evaluation framework. One implementation, both systems.

Headline metrics are operational, not statistical: what a fixed-capacity
monitoring cell catches, and how early. PR-AUC and Brier are supporting
evidence. An 0.85-AUC model with one month of warning is worth less than an
0.75-AUC model with nine.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import (average_precision_score, brier_score_loss,
                             mean_absolute_error, roc_auc_score)


def prob_metrics(y, p) -> dict:
    y = np.asarray(y).astype(int)
    p = np.asarray(p, dtype=float)
    base = float(y.mean()) if len(y) else float("nan")
    out = {"n": int(len(y)), "base_rate": round(base, 5)}
    if len(np.unique(y)) < 2:
        return {**out, "pr_auc": None, "roc_auc": None, "brier": None, "lift_over_base": None}
    ap = float(average_precision_score(y, p))
    out.update({
        "pr_auc": round(ap, 5),
        "roc_auc": round(float(roc_auc_score(y, p)), 5),
        "brier": round(float(brier_score_loss(y, p)), 6),
        # PR-AUC is not comparable across different base rates; this is.
        "lift_over_base": round(ap / base, 4) if base > 0 else None,
    })
    return out


def calibration_curve(y, p, bins=10) -> list[dict]:
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    edges = np.unique(edges)
    idx = np.clip(np.searchsorted(edges, p, side="right") - 1, 0, len(edges) - 2)
    rows = []
    for b in range(len(edges) - 1):
        m = idx == b
        if not m.any():
            continue
        rows.append({"bin": b, "n": int(m.sum()),
                     "mean_pred": round(float(p[m].mean()), 5),
                     "observed": round(float(y[m].mean()), 5),
                     "gap": round(float(p[m].mean() - y[m].mean()), 5)})
    return rows


def band_reliability(y, p, score, bands) -> list[dict]:
    rows = []
    for name, lo, hi in bands:
        m = (score >= lo) & (score < hi)
        if not m.any():
            continue
        rows.append({"band": name, "n": int(m.sum()),
                     "mean_pred": round(float(np.asarray(p)[m].mean()), 5),
                     "observed_event_rate": round(float(np.asarray(y)[m].mean()), 5)})
    return rows


def regression_metrics(y, yhat) -> dict:
    y, yhat = np.asarray(y, dtype=float), np.asarray(yhat, dtype=float)
    m = np.isfinite(y) & np.isfinite(yhat)
    if m.sum() == 0:
        return {"n": 0}
    e = yhat[m] - y[m]
    return {"n": int(m.sum()),
            "mae": round(float(mean_absolute_error(y[m], yhat[m])), 4),
            "rmse": round(float(np.sqrt(np.mean(e ** 2))), 4),
            "median_ae": round(float(np.median(np.abs(e))), 4),
            "bias": round(float(e.mean()), 4)}


def regression_by(y, yhat, key: pd.Series, min_n: int = 40) -> list[dict]:
    df = pd.DataFrame({"y": np.asarray(y, dtype=float),
                       "yhat": np.asarray(yhat, dtype=float),
                       "k": key.to_numpy()})
    rows = []
    for k, d in df.groupby("k", observed=True):
        if len(d) < min_n:
            continue
        rows.append({"group": str(k), **regression_metrics(d["y"], d["yhat"])})
    return sorted(rows, key=lambda r: -r["n"])


# ------------------------------------------------------- capacity-constrained


def capacity_metrics(scored: pd.DataFrame, capacities, cycle_months: int = 3) -> list[dict]:
    """One monitoring cycle = one month. Rank every project reporting that month
    by risk, review the top K, and ask what the cell caught.

    `scored` needs: as_of_month, project_id, score, y (event within horizon),
    observed, exposure_cr, and lead (months of warning, NaN where undefined).
    """
    d = scored[scored["observed"]].copy()
    months = np.sort(d["as_of_month"].unique())[::cycle_months]
    d = d[d["as_of_month"].isin(months)]
    if d.empty:
        return []

    rows = []
    for K in capacities:
        tp = fp = fn = 0
        caught_exposure = 0.0
        total_exposure = 0.0
        leads: list[float] = []
        n_cycles = 0
        for _, cyc in d.groupby("as_of_month"):
            if len(cyc) < 2:
                continue
            n_cycles += 1
            top = cyc.nlargest(min(K, len(cyc)), "score")
            hit = top["y"].to_numpy() == 1
            tp += int(hit.sum())
            fp += int((~hit).sum())
            fn += int(cyc["y"].sum() - hit.sum())
            caught_exposure += float(top.loc[top["y"] == 1, "exposure_cr"].sum())
            total_exposure += float(cyc.loc[cyc["y"] == 1, "exposure_cr"].sum())
            leads.extend(top.loc[top["y"] == 1, "lead"].dropna().tolist())
        rows.append({
            "capacity": K,
            "cycles": n_cycles,
            "precision": round(tp / max(tp + fp, 1), 4),
            "recall": round(tp / max(tp + fn, 1), 4),
            "true_events_captured": tp,
            "false_alerts": fp,
            "exposure_captured_cr": round(caught_exposure, 1),
            "exposure_capture_rate": round(caught_exposure / total_exposure, 4)
            if total_exposure > 0 else None,
            "median_lead_months": round(float(np.median(leads)), 2) if leads else None,
        })
    return rows


# -------------------------------------------------------------- early warning


def lead_times(scored: pd.DataFrame, first_signal: pd.DataFrame,
               threshold: float) -> pd.DataFrame:
    """Months between the first month the model flagged a project and the month
    its trouble first entered the official record. Positive = warned early.

    Only projects whose first official signal falls inside the evaluation window
    count, and only where the model had at least one scoring opportunity before
    that signal -- otherwise the metric rewards a late window, not a good model.
    """
    d = scored.merge(first_signal, on="project_id", how="inner")
    d = d[d["first_official_signal"] > d.groupby("project_id")["as_of_month"].transform("min")]
    flagged = d[d["score"] >= threshold]
    first_flag = flagged.groupby("project_id")["as_of_month"].min().rename("first_flag")
    sig = d.groupby("project_id")["first_official_signal"].first()
    out = pd.concat([first_flag, sig], axis=1, join="inner")
    out["lead_months"] = ((out["first_official_signal"].dt.year - out["first_flag"].dt.year) * 12
                          + (out["first_official_signal"].dt.month - out["first_flag"].dt.month))
    return out.reset_index()


def lead_summary(lead: pd.DataFrame, n_eligible: int) -> dict:
    if lead.empty:
        return {"n_flagged_before_signal": 0, "detection_rate": 0.0}
    early = lead[lead["lead_months"] > 0]
    return {
        "n_eligible_projects": int(n_eligible),
        "n_flagged_at_all": int(len(lead)),
        "n_flagged_before_signal": int(len(early)),
        "detection_rate": round(len(early) / max(n_eligible, 1), 4),
        "median_lead_months": round(float(early["lead_months"].median()), 2) if len(early) else None,
        "mean_lead_months": round(float(early["lead_months"].mean()), 2) if len(early) else None,
        "pct_ge_3m": round(float((early["lead_months"] >= 3).mean()), 4) if len(early) else None,
        "pct_ge_6m": round(float((early["lead_months"] >= 6).mean()), 4) if len(early) else None,
        "pct_ge_12m": round(float((early["lead_months"] >= 12).mean()), 4) if len(early) else None,
        "n_ge_12m": int((early["lead_months"] >= 12).sum()) if len(early) else 0,
    }


# ------------------------------------------------------------- risk trajectory


def trajectory_metrics(scored: pd.DataFrame, first_signal: pd.DataFrame) -> dict:
    """Does the score move before the official record does, and how noisily?

    velocity     mean month-on-month change in risk score
    escalation   a band crossing upward
    false esc.   an upward band crossing on a project that never books an event
    """
    d = scored.sort_values(["project_id", "as_of_month"]).copy()
    g = d.groupby("project_id")
    d["velocity"] = g["score"].diff()
    d["accel"] = g["velocity"].diff()
    order = {"LOW": 0, "WATCH": 1, "HIGH": 2, "CRITICAL": 3}
    d["band_i"] = d["band"].map(order)
    d["band_up"] = g["band_i"].diff() > 0

    ever_event = d.groupby("project_id")["y"].max()
    up = d[d["band_up"]]
    false_esc = up[up["project_id"].map(ever_event) == 0]

    pre = d.merge(first_signal, on="project_id", how="inner")
    pre = pre[pre["as_of_month"] < pre["first_official_signal"]]
    return {
        "mean_abs_velocity": round(float(d["velocity"].abs().mean()), 4),
        "mean_velocity_before_signal": round(float(pre["velocity"].mean()), 4)
        if len(pre) else None,
        "mean_abs_acceleration": round(float(d["accel"].abs().mean()), 4),
        "n_upward_transitions": int(len(up)),
        "false_escalation_rate": round(len(false_esc) / max(len(up), 1), 4),
        "escalations_per_project_month": round(len(up) / max(len(d), 1), 5),
    }
