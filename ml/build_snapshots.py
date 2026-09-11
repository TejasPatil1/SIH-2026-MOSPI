"""Build the shared snapshot matrix once; both systems read this file."""
from __future__ import annotations
import pandas as pd
from ml.config import PANEL_PATH, SNAPSHOT_PATH, DATA_DIR
from ml.events import add_events
from ml.features.build import build_features

def main() -> None:
    panel = add_events(pd.read_parquet(PANEL_PATH))
    snap = build_features(panel)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    panel.to_parquet(DATA_DIR / "panel_events.parquet", index=False)
    snap.to_parquet(SNAPSHOT_PATH, index=False)
    print(f"snapshots {snap.shape} -> {SNAPSHOT_PATH}")
    for g in ("c_", "d_", "e_", "r_", "k_"):
        print(f"  group {g[0].upper()}: {sum(c.startswith(g) for c in snap.columns)} features")

if __name__ == "__main__":
    main()
