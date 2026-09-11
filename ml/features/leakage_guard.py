"""
The leakage guard. Runs before every fit and every predict, for both systems.

There is exactly one guard and both architectures call it. If a feature is
legal for experimental_v2 it is legal for baseline_v1, and vice versa -- that
is what makes the comparison fair rather than merely simultaneous.
"""
from __future__ import annotations

import pandas as pd

from ml.config import BLACKLIST


class LeakageError(AssertionError):
    pass


def assert_clean(X: pd.DataFrame, where: str = "") -> None:
    """No blacklisted column may reach a model."""
    bad = sorted(set(X.columns) & BLACKLIST)
    if bad:
        raise LeakageError(f"blacklisted columns reached the model {where}: {bad}")


def assert_as_of(frame: pd.DataFrame, where: str = "") -> None:
    """No feature row may be built from a panel row later than its own as-of month."""
    if "source_max_month" not in frame.columns or "as_of_month" not in frame.columns:
        raise LeakageError(f"as-of bookkeeping columns missing {where}")
    bad = int((frame["source_max_month"] > frame["as_of_month"]).sum())
    if bad:
        raise LeakageError(f"{bad} rows reference future panel rows {where}")


def assert_disjoint_projects(*splits: pd.DataFrame) -> None:
    """No project may appear in more than one split (leakage channel 2)."""
    sets = [set(s["project_id"].unique()) for s in splits]
    for i in range(len(sets)):
        for j in range(i + 1, len(sets)):
            overlap = sets[i] & sets[j]
            if overlap:
                raise LeakageError(
                    f"splits {i} and {j} share {len(overlap)} projects, e.g. {sorted(overlap)[:3]}")


def assert_disjoint_calendar(train: pd.DataFrame, val: pd.DataFrame, test: pd.DataFrame) -> None:
    """No training row may be dated at or after the first validation row, and so
    on (leakage channel 3). This is the 'purged' half of the purged group-time
    split -- without it, a train project still reporting in 2026 would leak the
    later cost-escalation regime into a model evaluated on 2022."""
    if len(train) and len(val) and train["as_of_month"].max() >= val["as_of_month"].min():
        raise LeakageError("train calendar window overlaps validation")
    if len(val) and len(test) and val["as_of_month"].max() >= test["as_of_month"].min():
        raise LeakageError("validation calendar window overlaps test")
