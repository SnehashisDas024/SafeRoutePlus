"""
SafeRoute+ — Route Safety ML Model (GradientBoosting)
=====================================================

Trains a scikit-learn GradientBoostingRegressor on synthetic data to predict
route segment safety scores from 6 location/time features.

No API keys. No epochs. Fits in < 2 seconds on any laptop.

Usage:
    python ml/safety_model/train_model.py          # trains + saves model
    python ml/safety_model/train_model.py --eval    # trains + prints evaluation

After training, the model is saved to:
    ml/safety_model/safety_model.joblib
"""

import os
import sys
import csv
import argparse
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(MODEL_DIR, "training_data.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "safety_model.joblib")

FEATURE_COLUMNS = [
    "street_light_coverage",
    "police_station_dist_m",
    "crowd_density",
    "road_quality",
    "cctv_coverage",
    "historical_incident_rate",
    "hour",
    "is_night",
    "time_risk_score",
]
LABEL_COLUMN = "safety_score"


def load_data(path=DATA_PATH):
    """Load CSV training data into numpy arrays."""
    X, y = [], []
    with open(path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            features = [float(row[col]) for col in FEATURE_COLUMNS]
            label = float(row[LABEL_COLUMN])
            X.append(features)
            y.append(label)
    return np.array(X), np.array(y)


def train(evaluate=False):
    """Train and save the model."""
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import joblib

    print("=" * 60)
    print("  SafeRoute+ — Safety Score ML Model Training")
    print("=" * 60)

    if not os.path.exists(DATA_PATH):
        print(f"\n[!] Training data not found at {DATA_PATH}")
        print("    Run generate_training_data.py first.")
        sys.exit(1)

    X, y = load_data()
    print(f"\nDataset: {len(X)} samples, {len(FEATURE_COLUMNS)} features")
    print(f"Features: {FEATURE_COLUMNS}")
    print(f"Label range: [{y.min():.3f}, {y.max():.3f}]")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Train
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )

    import time
    t0 = time.time()
    model.fit(X_train, y_train)
    t1 = time.time()

    print(f"\nModel trained in {t1 - t0:.2f}s (no epochs, no API key)")
    print(f"Model type: {type(model).__name__}")

    # Feature importances
    print("\n--- Feature Importances ---")
    importances = model.feature_importances_
    for feat, imp in sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: -x[1]):
        bar = "#" * int(imp * 40)
        print(f"  {feat:30s} {imp:.4f}  {bar}")

    # Evaluation
    if evaluate or True:  # Always show basic metrics
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        print("\n--- Test Set Metrics ---")
        print(f"  MAE  : {mae:.4f}")
        print(f"  RMSE : {rmse:.4f}")
        print(f"  R²   : {r2:.4f}")

        # Show a few sample predictions
        print("\n--- Sample Predictions (first 8 test samples) ---")
        print(f"  {'Actual':>8s}  {'Predicted':>10s}  {'Error':>8s}")
        for actual, pred in list(zip(y_test, y_pred))[:8]:
            err = pred - actual
            print(f"  {actual:8.4f}  {pred:10.4f}  {err:+8.4f}")

    # Save
    joblib.dump({
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "training_samples": len(X_train),
        "test_r2": r2_score(y_test, model.predict(X_test)),
        "trained_at": str(np.datetime64("now")),
    }, MODEL_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")
    print("=" * 60)

    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train SafeRoute+ safety model")
    parser.add_argument("--eval", action="store_true", help="Show detailed evaluation")
    args = parser.parse_args()
    train(evaluate=args.eval)
