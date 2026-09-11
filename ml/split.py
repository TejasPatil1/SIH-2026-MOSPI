"""
The shared purged group-time split. Both systems get exactly these rows.

Two cuts, both required:

  project cut   a project belongs to exactly one split, keyed on when it ends
                (completion month, or "never" for still-ongoing projects).
                Closes leakage channel 2 -- month 11 and month 12 of the same
                project can no longer straddle train and test.

  calendar cut  a row is used only if its as-of month falls inside its split's
                calendar window. Closes leakage channel 3 -- no training row is
                dated after the first evaluation row, so the model cannot have
                seen the later cost-escalation regime.

Rows that fail the second cut are dropped, not reassigned. That purge is why
the validation and test splits carry left-truncated project histories, and it
is the price of an out-of-time evaluation that means anything.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ml.config import TRAIN_END, VAL_END

SPLITS = ("train", "val", "test")


def project_era(panel: pd.DataFrame) -> pd.Series:
    """Split assignment per project, from the month the project ends."""
    last = panel.sort_values("snapshot_month").groupby("project_id").tail(1)
    end = np.where(last["project_status"].to_numpy() == "completed",
                   last["actual_commissioning_date"].to_numpy(),
                   np.datetime64("2099-01-01"))
    end = pd.Series(pd.to_datetime(end), index=last["project_id"].to_numpy())
    era = pd.Series(np.select([end < TRAIN_END, end < VAL_END], ["train", "val"], "test"),
                    index=end.index, name="era")
    return era


def assign(snap: pd.DataFrame, panel: pd.DataFrame) -> pd.Series:
    """Split label per snapshot row, or NaN for rows purged by the calendar cut."""
    era = project_era(panel)
    row_win = pd.Series(np.select(
        [snap["as_of_month"] < TRAIN_END, snap["as_of_month"] < VAL_END],
        ["train", "val"], "test"), index=snap.index)
    proj_era = snap["project_id"].map(era)
    return row_win.where(row_win == proj_era)


def split_frames(snap: pd.DataFrame, panel: pd.DataFrame
                 ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    s = assign(snap, panel)
    return tuple(snap[s == k].reset_index(drop=True) for k in SPLITS)  # type: ignore[return-value]
