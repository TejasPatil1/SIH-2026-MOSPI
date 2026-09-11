"""
The two architectures.

baseline_v1     -- SYSTEM A, the existing design, preserved conceptually.
                   Snapshot features -> LightGBM -> isotonic calibration.
                   A horizon question is answered by a classifier trained
                   directly on "did an event occur in the next H months".

experimental_v2 -- SYSTEM B, the proposal in new_infra.md.
                   The same snapshot features (plus groups R and K) reshaped
                   into person-period form, one discrete-time hazard model per
                   event kind, and horizon probabilities obtained by
                   multiplying out the survival function.

Both use identical hyperparameters, identical calibration, identical splits and
identical labels. The only differences are the feature groups each is handed
and the formulation of the event task -- which is precisely what the benchmark
is asking about.
"""
from __future__ import annotations

import time

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor, early_stopping, log_evaluation
from sklearn.isotonic import IsotonicRegression

from ml.config import (ALERT_THRESHOLD, EARLY_STOPPING_ROUNDS, LGB_CLF, LGB_REG,
                       RISK_WEIGHTS, SEED, band_for)
from ml.events import person_period, survival_horizon_prob
from ml.features.build import CATEGORICALS, feature_columns
from ml.features.leakage_guard import assert_clean

MAX_LAG = 12


def design(snap: pd.DataFrame, groups: tuple[str, ...], extra: list[str] | None = None
           ) -> pd.DataFrame:
    cols = feature_columns(snap, groups) + list(extra or [])
    X = snap[cols].copy()
    for c in CATEGORICALS:
        if c in X.columns:
            X[c] = X[c].astype("category")
    for c in X.columns:
        if c not in CATEGORICALS:
            X[c] = pd.to_numeric(X[c], errors="coerce").astype(np.float32)
    assert_clean(X, where="design()")
    return X


def _fit_clf(Xtr, ytr, Xva, yva, seed=SEED):
    m = LGBMClassifier(random_state=seed, **LGB_CLF)
    m.fit(Xtr, ytr, eval_set=[(Xva, yva)], eval_metric="average_precision",
          callbacks=[early_stopping(EARLY_STOPPING_ROUNDS, verbose=False), log_evaluation(0)])
    return m


def _fit_reg(Xtr, ytr, Xva, yva, seed=SEED):
    m = LGBMRegressor(random_state=seed, **LGB_REG)
    m.fit(Xtr, ytr, eval_set=[(Xva, yva)], eval_metric="l1",
          callbacks=[early_stopping(EARLY_STOPPING_ROUNDS, verbose=False), log_evaluation(0)])
    return m


def _calibrate(p_va, y_va):
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(p_va, y_va)
    return iso


# ---------------------------------------------------------------- SYSTEM A


class DirectHorizonModel:
    """baseline_v1's answer to 'will something happen in the next H months?':
    one calibrated binary classifier per (event kind, horizon)."""

    def __init__(self, groups):
        self.groups = groups
        self.models: dict[tuple[str, int], tuple] = {}
        self.fit_seconds = 0.0

    def fit(self, tr, va, labels_tr, labels_va, kinds, horizons):
        t0 = time.perf_counter()
        for kind in kinds:
            for h in horizons:
                mtr = labels_tr[(kind, h)]["observed"].to_numpy()
                mva = labels_va[(kind, h)]["observed"].to_numpy()
                Xtr = design(tr[mtr], self.groups)
                Xva = design(va[mva], self.groups)
                ytr = labels_tr[(kind, h)]["y"].to_numpy()[mtr]
                yva = labels_va[(kind, h)]["y"].to_numpy()[mva]
                m = _fit_clf(Xtr, ytr, Xva, yva)
                iso = _calibrate(m.predict_proba(Xva)[:, 1], yva)
                self.models[(kind, h)] = (m, iso)
        self.fit_seconds = time.perf_counter() - t0
        return self

    def predict(self, snap, kind, horizon):
        m, iso = self.models[(kind, horizon)]
        return iso.predict(m.predict_proba(design(snap, self.groups))[:, 1])


# ---------------------------------------------------------------- SYSTEM B


class HazardModel:
    """experimental_v2: one discrete-time hazard per event kind.

    h_k(x_t) = P(event at exactly t+k | x_t, no event in (t, t+k)), with the
    lag k entering as a feature so a single model carries the whole baseline
    hazard shape. Horizon probabilities come out of the survival product, so
    the 3-, 6- and 12-month answers are guaranteed mutually consistent -- three
    unrelated classifiers are not."""

    def __init__(self, groups):
        self.groups = groups
        self.models: dict[str, tuple] = {}
        self.fit_seconds = 0.0

    def fit(self, tr, va, kinds, seed=SEED):
        t0 = time.perf_counter()
        for kind in kinds:
            pp_tr = person_period(tr, kind, MAX_LAG, seed=seed)
            pp_va = person_period(va, kind, MAX_LAG, seed=seed + 1)
            Xtr = self._lagged(tr, pp_tr)
            Xva = self._lagged(va, pp_va)
            m = _fit_clf(Xtr, pp_tr["y"].to_numpy(), Xva, pp_va["y"].to_numpy())
            iso = _calibrate(m.predict_proba(Xva)[:, 1], pp_va["y"].to_numpy())
            self.models[kind] = (m, iso)
        self.fit_seconds = time.perf_counter() - t0
        return self

    def _lagged(self, snap, pp):
        X = design(snap, self.groups).iloc[pp["row"].to_numpy()].reset_index(drop=True)
        X["lag"] = pp["lag"].to_numpy().astype(np.float32)
        return X

    def hazards(self, snap, kind):
        """(n_rows, MAX_LAG) calibrated monthly hazards."""
        m, iso = self.models[kind]
        X = design(snap, self.groups)
        out = np.empty((len(X), MAX_LAG), dtype=np.float64)
        for k in range(1, MAX_LAG + 1):
            Xk = X.copy()
            Xk["lag"] = np.float32(k)
            out[:, k - 1] = iso.predict(m.predict_proba(Xk)[:, 1])
        return out

    def predict(self, snap, kind, horizon, cache=None):
        h = cache if cache is not None else self.hazards(snap, kind)
        return survival_horizon_prob(h, horizon)


# ------------------------------------------------------- final-outcome models


class OutcomeModel:
    """Final cost overrun % and final delay in months, plus their calibrated
    threshold classifiers. Identical structure in both systems -- only the
    feature groups differ -- because new_infra.md keeps final-outcome
    prediction as a separate task from the hazard, not a replacement for it."""

    def __init__(self, groups):
        self.groups = groups
        self.reg: dict[str, object] = {}
        self.clf: dict[str, tuple] = {}
        self.fit_seconds = 0.0

    def fit(self, tr, va, targets):
        t0 = time.perf_counter()
        for name, (ycol, flagcol) in targets.items():
            mtr, mva = tr[ycol].notna().to_numpy(), va[ycol].notna().to_numpy()
            Xtr, Xva = design(tr[mtr], self.groups), design(va[mva], self.groups)
            self.reg[name] = _fit_reg(Xtr, tr[ycol].to_numpy()[mtr],
                                      Xva, va[ycol].to_numpy()[mva])
            ytr, yva = tr[flagcol].to_numpy()[mtr], va[flagcol].to_numpy()[mva]
            m = _fit_clf(Xtr, ytr, Xva, yva)
            self.clf[name] = (m, _calibrate(m.predict_proba(Xva)[:, 1], yva))
        self.fit_seconds = time.perf_counter() - t0
        return self

    def predict_value(self, snap, name):
        return self.reg[name].predict(design(snap, self.groups))

    def predict_prob(self, snap, name):
        m, iso = self.clf[name]
        return iso.predict(m.predict_proba(design(snap, self.groups))[:, 1])


# ------------------------------------------------------------- risk scoring
#
# §11.3, unchanged, and applied identically to both systems. The score is a
# transparent weighted combination of model outputs and rule signals, not a
# model output -- which is what lets a ministry retune it without retraining.


def _clamp01(x):
    return np.clip(x, 0.0, 1.0)


def risk_score(snap: pd.DataFrame, p_cost, p_time, sev_cost_pct, sev_time_months
               ) -> pd.DataFrame:
    severity = 0.5 * _clamp01(np.maximum(sev_cost_pct, 0) / 50.0) \
             + 0.5 * _clamp01(np.maximum(sev_time_months, 0) / 36.0)
    momentum = _clamp01(
        0.35 * _clamp01(snap["d_stall_months_3m"].to_numpy() / 3.0)
        + 0.35 * _clamp01(snap["d_velocity_deficit"].fillna(0).to_numpy() / 2.0)
        + 0.20 * _clamp01(snap["d_n_date_revisions"].to_numpy() / 3.0)
        + 0.10 * _clamp01(snap["d_months_since_update"].to_numpy() / 3.0))
    w = RISK_WEIGHTS
    score = 100.0 * (w["p_cost"] * p_cost + w["p_time"] * p_time
                     + w["severity"] * severity + w["momentum"] * momentum)

    alerts = rule_alerts(snap)
    score = np.where(alerts["critical"].to_numpy(), np.maximum(score, 75.0), score)
    score = np.minimum(score, 100.0)
    return pd.DataFrame({
        "risk_score": score,
        "risk_band": [band_for(s) for s in score],
        "momentum": momentum,
        "severity": severity,
        "flagged": score >= ALERT_THRESHOLD,
    }, index=snap.index)


def rule_alerts(snap: pd.DataFrame) -> pd.DataFrame:
    """§11.4. Runs independently of the models, so the system still says
    something useful when an artefact fails to load."""
    f = snap
    r = {
        "R1_PROGRESS_STALL": f["d_stall_months_3m"].to_numpy() >= 3,
        "R2_SPEND_AHEAD_OF_WORK": f["d_progress_gap"].to_numpy() > 20,
        "R3_SCHEDULE_EXHAUSTED": ((f["c_elapsed_fraction"].to_numpy() > 0.8)
                                  & (f["c_physical_progress_pct"].to_numpy() < 60)),
        "R4_REPEATED_SLIPPAGE": f["d_n_date_revisions"].to_numpy() >= 2,
        "R5_COST_ALREADY_REVISED": f["d_realized_overrun_pct"].to_numpy() > 10,
        "R6_STALE_REPORTING": f["d_months_since_update"].to_numpy() >= 2,
        "R7_VELOCITY_INFEASIBLE": ((f["d_velocity_deficit"].fillna(0).to_numpy() > 2.0)
                                   & (f["c_elapsed_fraction"].to_numpy() > 0.5)),
    }
    out = pd.DataFrame(r, index=f.index)
    out["critical"] = out["R7_VELOCITY_INFEASIBLE"]
    out["n_alerts"] = out[list(r)].sum(axis=1)
    return out
