"""Train the unified one-/two-hand ISL gesture classifier.

Expected CSV: dataset/isl_alphabet_dataset.csv
Expected features: 126 normalized landmarks + 8 spatial/presence values (134 total).
The script deliberately refuses random row splits: samples from the same
capture session must not appear in both train and test sets.
"""

from pathlib import Path
import sys

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import GroupShuffleSplit

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "dataset" / "isl_alphabet_dataset.csv"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "unified_hand_model.joblib"


def expected_feature_columns() -> list[str]:
    left = [f"left_{axis}{i}" for i in range(21) for axis in ("x", "y", "z")]
    right = [f"right_{axis}{i}" for i in range(21) for axis in ("x", "y", "z")]
    metadata = [
        "left_wrist_x", "left_wrist_y",
        "right_wrist_x", "right_wrist_y",
        "left_hand_scale", "right_hand_scale",
        "left_present", "right_present",
    ]
    return left + right + metadata


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {CSV_PATH}\n"
            "Place your exported CSV at dataset/isl_alphabet_dataset.csv."
        )

    df = pd.read_csv(CSV_PATH)
    required = {"label", "session_id"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(missing)}")

    feature_columns = expected_feature_columns()
    missing_features = [c for c in feature_columns if c not in df.columns]
    if missing_features:
        raise ValueError(
            f"CSV is missing {len(missing_features)} expected landmark columns. "
            f"First missing columns: {missing_features[:6]}"
        )

    # Use a fixed left-then-right order, regardless of CSV column order.
    X = df[feature_columns].apply(pd.to_numeric, errors="coerce")
    y = df["label"].astype("string").str.strip().str.upper()
    groups = df["session_id"].astype("string").str.strip()

    valid = X.notna().all(axis=1) & y.notna() & y.ne("") & groups.notna() & groups.ne("")
    dropped = int((~valid).sum())
    X, y, groups = X.loc[valid], y.loc[valid], groups.loc[valid]

    print(f"Dataset: {CSV_PATH}")
    print(f"Valid samples: {len(X)} (dropped invalid rows: {dropped})")
    print(f"Feature count: {X.shape[1]}")
    print(f"Capture sessions: {groups.nunique()}")
    print("\nSamples per label:")
    print(y.value_counts().sort_index().to_string())

    if X.empty:
        raise ValueError("No valid samples remain after validation.")
    if y.nunique() < 2:
        raise ValueError(
            "Training stopped: the CSV contains only one gesture label. "
            "Collect at least two different labels before training a classifier. "
            "Your current upload contains only L, so it cannot learn A-Z."
        )
    if groups.nunique() < 2:
        raise ValueError(
            "Training stopped: only one session_id is present. Collect samples "
            "in at least two separate sessions so the test set can contain "
            "unseen-session data. The script will not use a random row split, "
            "because that can leak near-identical frames across train and test."
        )

    # Find a session-level split that retains every label in both partitions.
    splitter = GroupShuffleSplit(n_splits=100, test_size=0.25, random_state=42)
    all_labels = set(y.unique())
    chosen = None
    for train_idx, test_idx in splitter.split(X, y, groups):
        if set(y.iloc[train_idx].unique()) == all_labels and set(y.iloc[test_idx].unique()) == all_labels:
            chosen = (train_idx, test_idx)
            break

    if chosen is None:
        raise ValueError(
            "Could not create a session-based train/test split containing every "
            "label in both sets. Collect each gesture across multiple sessions "
            "(ideally multiple signers) before training."
        )

    train_idx, test_idx = chosen
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    print(f"\nTrain samples: {len(X_train)} | Test samples: {len(X_test)}")
    print(f"Train sessions: {sorted(groups.iloc[train_idx].unique().tolist())}")
    print(f"Test sessions: {sorted(groups.iloc[test_idx].unique().tolist())}")

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced_subsample",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    print(f"\nAccuracy: {accuracy_score(y_test, predictions):.4f}")
    print("\nClassification report:")
    print(classification_report(y_test, predictions, zero_division=0))
    print("Confusion matrix (label order shown below):")
    print(sorted(all_labels))
    print(confusion_matrix(y_test, predictions, labels=sorted(all_labels)))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_columns": feature_columns,
            "feature_count": len(feature_columns),
            "input_format": "left_63_right_63_wrist_xy_scale_presence_v1",
            "labels": sorted(all_labels),
            "training_sessions": sorted(groups.iloc[train_idx].unique().tolist()),
            "test_sessions": sorted(groups.iloc[test_idx].unique().tolist()),
        },
        MODEL_PATH,
    )
    print(f"\nUnified model saved: {MODEL_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
