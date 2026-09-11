"""
Delay-reason normalisation and the temporal reason features (feature group R).

NORMALISATION
-------------
Free text -> a stable 9-category taxonomy, by lexicon match. A lexicon, not an
embedding model, because on this panel the reason text is generated from
templates and an embedding kNN would be measuring the generator, not a language
problem. `normalise()` is the single swap point: replacing its body with a
MiniLM + kNN call over seed phrases changes nothing downstream, and that is the
right move the moment real Flash Report text is available. Claiming an
embedding step here would be theatre.

TEMPORAL FEATURES
-----------------
new_infra.md's central claim is that the *evolution* of reasons carries more
signal than the current category. The features below are the operationalisation
of that claim, and Experiment 9 tests it by metric delta rather than by feature
importance.

Everything here is strictly backward-looking: every column at month t is a
function of reason text observed in months <= t.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

CATEGORIES = ["land", "forest", "contractor", "funds", "litigation",
              "rnr", "row", "approvals", "forcemajeure"]

# Terms chosen to also match Flash Report phrasing, not just this panel's
# templates -- the lexicon is the thing that has to survive contact with real
# text, so it is written for real text.
LEXICON: dict[str, tuple[str, ...]] = {
    "land": ("land acquisition", "land aquisition", "acquisition of land", "possession of land"),
    "forest": ("forest clearance", "forest land", "environment clearance", "environmental clearance",
               "moefcc", "wildlife clearance"),
    "contractor": ("contractor", "epc", "agency under notice", "re-tender", "retender",
                   "tendering", "mobilisation", "mobilization", "termination"),
    "funds": ("fund release", "funds", "budgetary support", "financial constraint",
              "paucity of fund", "cash flow"),
    "litigation": ("sub-judice", "sub judice", "court", "litigation", "arbitration", "stay order"),
    "rnr": ("r&r", "rehabilitation and resettlement", "project-affected", "project affected",
            "resettlement"),
    "row": ("right of way", "row ", "utility shifting", "utility diversion", "shifting of utilities"),
    "approvals": ("statutory approval", "approvals awaited", "sanction under process",
                  "permission", "noc", "safety approval", "technical sanction"),
    "forcemajeure": ("monsoon", "flood", "rain", "cyclone", "pandemic", "covid",
                     "adverse weather", "force majeure", "law and order"),
}


def normalise(text: str | float | None) -> list[str]:
    """Free text -> zero or more taxonomy categories. Multi-label by design: a
    single monitoring comment routinely names two or three distinct blockers,
    and collapsing that to one label destroys the compounding signal."""
    if text is None or (isinstance(text, float) and np.isnan(text)) or not str(text).strip():
        return []
    low = str(text).lower()
    return [c for c, terms in LEXICON.items() if any(t in low for t in terms)]


def reason_matrix(panel: pd.DataFrame) -> pd.DataFrame:
    """One boolean column per category, aligned to the panel index."""
    hits = panel["reason_for_delay"].map(normalise)
    return pd.DataFrame(
        {f"rz_{c}": hits.map(lambda h, c=c: c in h).to_numpy() for c in CATEGORIES},
        index=panel.index,
    )


def temporal_reason_features(panel: pd.DataFrame, group_key: str = "project_id") -> pd.DataFrame:
    """Feature group R. Panel must be sorted by (project_id, snapshot_month)."""
    rz = reason_matrix(panel)
    g = rz.groupby(panel[group_key].to_numpy())
    out: dict[str, np.ndarray] = {}

    n_active = rz.sum(axis=1)
    out["r_reason_count"] = n_active.to_numpy(dtype=float)
    out["r_compounding"] = (n_active >= 2).to_numpy(dtype=float)
    # A month with k simultaneous reasons contains k(k-1)/2 co-occurring pairs.
    out["r_cooccurring_pairs"] = (n_active * (n_active - 1) / 2).to_numpy(dtype=float)

    prev = g.shift(1).fillna(False).astype(bool)
    newly = rz.to_numpy() & ~prev.to_numpy()
    cleared = ~rz.to_numpy() & prev.to_numpy()
    out["r_new_reasons_now"] = newly.sum(axis=1).astype(float)
    out["r_cleared_reasons_now"] = cleared.sum(axis=1).astype(float)

    pid = panel[group_key].to_numpy()
    newly_s = pd.Series(newly.sum(axis=1).astype(float), index=panel.index)
    for w in (3, 6):
        out[f"r_new_reasons_{w}m"] = (
            newly_s.groupby(pid).rolling(w, min_periods=1).sum()
            .reset_index(level=0, drop=True).to_numpy())

    # A transition is any month in which the set of active reasons changed.
    changed = pd.Series((newly.any(axis=1) | cleared.any(axis=1)).astype(float), index=panel.index)
    out["r_transitions_to_date"] = changed.groupby(pid).cumsum().to_numpy()

    any_active = pd.Series((n_active > 0).astype(float), index=panel.index)
    months_seen = any_active.groupby(pid).cumcount().to_numpy() + 1.0
    out["r_active_months_to_date"] = any_active.groupby(pid).cumsum().to_numpy()
    out["r_active_months_frac"] = out["r_active_months_to_date"] / months_seen

    # Per-category persistence: consecutive months the category has been active
    # up to and including t. The run-length trick is cumcount minus the cumcount
    # frozen at the last inactive month.
    persistence = np.zeros((len(panel), len(CATEGORIES)), dtype=float)
    ever = np.zeros_like(persistence)
    for j, c in enumerate(CATEGORIES):
        col = rz[f"rz_{c}"].astype(float)
        s = pd.Series(col.to_numpy(), index=panel.index)
        grp = s.groupby(pid)
        blocks = (s != grp.shift(1).fillna(-1.0)).groupby(pid).cumsum()
        run = s.groupby([pid, blocks.to_numpy()]).cumcount() + 1
        persistence[:, j] = np.where(s.to_numpy() > 0, run.to_numpy(), 0.0)
        ever[:, j] = grp.cummax().to_numpy()
        out[f"r_active_{c}"] = s.to_numpy()
        out[f"r_persist_{c}"] = persistence[:, j]
        out[f"r_ever_{c}"] = ever[:, j]

    out["r_max_persistence"] = persistence.max(axis=1)
    out["r_sum_persistence"] = persistence.sum(axis=1)
    out["r_distinct_ever"] = ever.sum(axis=1)

    # Months since the most recent newly-appearing reason. A reason that arrived
    # last month is a different signal from one that has been open for two years.
    idx = pd.Series(np.arange(len(panel), dtype=float), index=panel.index)
    last_new = idx.where(pd.Series(newly.any(axis=1), index=panel.index)).groupby(pid).ffill()
    out["r_months_since_new_reason"] = (idx - last_new).fillna(-1.0).to_numpy()

    return pd.DataFrame(out, index=panel.index)


def cooccurrence_table(panel: pd.DataFrame) -> pd.DataFrame:
    """Observed co-occurring reason pairs, for the report's reason analysis.
    Descriptive only -- co-occurrence is not evidence of a causal interaction."""
    rz = reason_matrix(panel).to_numpy()
    rows = []
    for i, a in enumerate(CATEGORIES):
        for j, b in enumerate(CATEGORIES):
            if j <= i:
                continue
            both = int((rz[:, i] & rz[:, j]).sum())
            if both:
                rows.append({"reason_a": a, "reason_b": b, "months_together": both,
                             "share_of_months_with_any_reason": round(
                                 both / max(int(rz.any(axis=1).sum()), 1), 4)})
    return pd.DataFrame(rows).sort_values("months_together", ascending=False).reset_index(drop=True)
