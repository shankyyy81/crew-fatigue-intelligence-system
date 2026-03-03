"""
ML Training Pipeline — Three-Layer Fatigue Intelligence Model
Trains XGBoost on train_samples.csv with Layer1 + Layer2 + Layer3 features.
Saves: model.pkl, preprocessor.pkl, model_metrics.json
"""
import os
import json
import pickle
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import (
    roc_auc_score, average_precision_score, confusion_matrix,
    precision_score, recall_score, accuracy_score
)
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
import shap

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "train_samples.csv")
OUTPUT_DIR = BASE_DIR


# ─── Layer 1: SAFTE-inspired Biomathematical Score ────────────────────────────
def compute_layer1(df: pd.DataFrame) -> pd.Series:
    def pick(cols):
        for c in cols:
            if c in df.columns:
                return c
        return None

    duty_col   = pick(["hours_flown_24h", "duty_hours", "duty_duration_hours"])
    rest_col   = pick(["sleep_opportunity_hours", "rest_hours", "sleep_hours"])
    consec_col = pick(["consecutive_duty_days", "consecutive_days"])
    night_col  = pick(["night_duty", "is_night_duty", "crosses_midnight"])
    circ_col   = pick(["circadian_misalignment"])
    tz_col     = pick(["timezone_displacement_hours"])

    def num(col, default):
        if col:
            return pd.to_numeric(df[col], errors="coerce").fillna(default)
        return pd.Series(default, index=df.index)

    duty   = num(duty_col, 8.0)
    rest   = num(rest_col, 8.0)
    consec = num(consec_col, 0.0)
    circ   = num(circ_col, 0.0).clip(0, 1)
    tz     = num(tz_col, 0.0).abs()

    if night_col:
        s = df[night_col]
        night = s.astype(str).str.lower().isin(["1","true","yes","y"]).astype(float) if s.dtype == object else (pd.to_numeric(s, errors="coerce").fillna(0) > 0).astype(float)
    else:
        night = pd.Series(0.0, index=df.index)

    score = pd.Series(100.0, index=df.index)
    score -= np.maximum(0, duty - 8.0) * 6.0
    score -= (rest < 7.0).astype(float) * 14.0
    score -= np.maximum(0, 7.0 - rest) * 2.0
    score -= np.maximum(0, consec - 3.0) * 6.0
    score -= night * 10.0
    score -= circ * 12.0
    score -= np.minimum(tz, 5.0) * 2.0   # timezone penalty
    return score.clip(0, 100)


# ─── Layer 3: Behavioral Risk Boost (0-15) ────────────────────────────────────
def compute_layer3_boost(df: pd.DataFrame) -> pd.Series:
    swap   = pd.to_numeric(df.get("swap_request_count_7d", 0), errors="coerce").fillna(0).clip(0, 4)
    well   = pd.to_numeric(df.get("wellness_score", 0.5), errors="coerce").fillna(0.5).clip(0, 1)
    late   = pd.to_numeric(df.get("late_checkin_count_30d", 0), errors="coerce").fillna(0).clip(0, 4)
    fat_r  = pd.to_numeric(df.get("fatigue_report_count", 0), errors="coerce").fillna(0).clip(0, 4)

    boost = swap * 2.0 + (1 - well) * 5.0 + late * 1.0 + fat_r * 1.5
    return boost.clip(0, 15)


# ─── Season Feature ───────────────────────────────────────────────────────────
def add_season(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "duty_start" in df.columns:
        month = pd.to_datetime(df["duty_start"], errors="coerce").dt.month.fillna(1).astype(int)
    elif "timestamp" in df.columns:
        month = pd.to_datetime(df["timestamp"], errors="coerce").dt.month.fillna(1).astype(int)
    else:
        month = pd.Series(1, index=df.index)
    df["season"] = month.map(lambda m: "winter" if m in [12,1,2] else ("summer" if m in [3,4,5] else ("monsoon" if m in [6,7,8,9] else "autumn")))
    return df


# ─── Main Training ─────────────────────────────────────────────────────────────
def train():
    print("[TRAIN] Loading data...")
    df = pd.read_csv(DATA_PATH)

    # Layer 1
    df["fatigue_base_score"] = compute_layer1(df)

    # Layer 3
    df["behavioral_boost"] = compute_layer3_boost(df)

    # Season
    df = add_season(df)

    # Label
    label_candidates = ["label_called_unfit", "label", "target", "y"]
    label_col = next((c for c in label_candidates if c in df.columns), None)
    if label_col is None:
        binary_cols = [c for c in df.columns if df[c].dropna().nunique() <= 2]
        label_col = binary_cols[0] if binary_cols else None
    if label_col is None:
        raise ValueError("No label column found in dataset.")

    y = pd.to_numeric(df[label_col], errors="coerce").fillna(0).astype(int)
    if y.nunique() != 2:
        raise ValueError("Label must be binary (0/1).")

    # Build X
    drop_cols = [label_col, "crew_id", "duty_id", "route", "layover_start",
                 "layover_end", "duty_start", "duty_end", "timestamp",
                 "hotel_tier", "habitual_sleep_start", "habitual_sleep_end",
                 "report_time_local"]
    X = df.drop(columns=[c for c in drop_cols if c in df.columns]).copy()

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_cols = X_train.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in X_train.columns if c not in numeric_cols]

    for c in numeric_cols:
        X_train[c] = pd.to_numeric(X_train[c], errors="coerce")
        X_test[c]  = pd.to_numeric(X_test[c], errors="coerce")
        med = X_train[c].median()
        X_train[c] = X_train[c].fillna(med)
        X_test[c]  = X_test[c].fillna(med)

    for c in categorical_cols:
        X_train[c] = X_train[c].astype(str).fillna("unknown")
        X_test[c]  = X_test[c].astype(str).fillna("unknown")

    pos = int((y_train == 1).sum())
    neg = int((y_train == 0).sum())
    scale_pos_weight = neg / max(pos, 1)

    preprocessor = ColumnTransformer(
        transformers=[("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols)],
        remainder="passthrough"
    )

    base_model = XGBClassifier(
        objective="binary:logistic",
        eval_metric="auc",
        tree_method="hist",
        random_state=42,
        scale_pos_weight=scale_pos_weight
    )

    pipe = Pipeline(steps=[("prep", preprocessor), ("model", base_model)])

    param_dist = {
        "model__n_estimators":   [300, 600, 1000],
        "model__learning_rate":  [0.03, 0.05, 0.1],
        "model__max_depth":      [3, 4, 5],
        "model__min_child_weight": [1, 2, 5],
        "model__subsample":      [0.8, 0.95, 1.0],
        "model__colsample_bytree": [0.8, 1.0],
        "model__reg_lambda":     [0.5, 1.0, 2.0],
        "model__gamma":          [0.0, 0.1, 0.3],
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    search = RandomizedSearchCV(
        pipe, param_distributions=param_dist, n_iter=30,
        scoring="roc_auc", cv=cv, random_state=42, n_jobs=-1, verbose=1
    )

    print("[TRAIN] Running hyperparameter search...")
    search.fit(X_train, y_train)

    best = search.best_estimator_
    print(f"[TRAIN] Best CV AUC: {search.best_score_:.4f}")
    print(f"[TRAIN] Best params: {search.best_params_}")

    # Metrics
    y_prob = best.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    auc  = float(roc_auc_score(y_test, y_prob))
    ap   = float(average_precision_score(y_test, y_prob))
    acc  = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec  = float(recall_score(y_test, y_pred, zero_division=0))
    cm   = confusion_matrix(y_test, y_pred).tolist()

    # False positives/negatives
    y_test_arr = np.array(y_test)
    fp_idx = np.where((y_pred == 1) & (y_test_arr == 0))[0].tolist()
    fn_idx = np.where((y_pred == 0) & (y_test_arr == 1))[0].tolist()

    metrics = {
        "roc_auc": auc, "avg_precision": ap,
        "accuracy": acc, "precision": prec, "recall": rec,
        "confusion_matrix": cm,
        "false_positives_count": len(fp_idx),
        "false_negatives_count": len(fn_idx),
        "best_cv_auc": float(search.best_score_),
        "best_params": {str(k): str(v) for k, v in search.best_params_.items()},
        "train_size": len(X_train),
        "test_size": len(X_test),
    }

    with open(os.path.join(OUTPUT_DIR, "model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[TRAIN] Metrics → AUC={auc:.4f} AP={ap:.4f} Acc={acc:.4f}")

    # SHAP
    print("[TRAIN] Computing SHAP...")
    prep_step = best.named_steps["prep"]
    xgb_step  = best.named_steps["model"]

    X_test_t = prep_step.transform(X_test)
    feature_names = []
    if categorical_cols:
        ohe = prep_step.named_transformers_["cat"]
        feature_names.extend(ohe.get_feature_names_out(categorical_cols).tolist())
    feature_names.extend(numeric_cols)

    n_sample = min(200, X_test_t.shape[0])
    rng = np.random.RandomState(42)
    idx = rng.choice(X_test_t.shape[0], size=n_sample, replace=False)
    Xs = X_test_t[idx]

    explainer   = shap.TreeExplainer(xgb_step)
    shap_values = explainer.shap_values(Xs)

    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, Xs, feature_names=feature_names, plot_type="bar", show=False)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "shap_summary_bar.png"), dpi=150)
    plt.close()

    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, Xs, feature_names=feature_names, show=False)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "shap_summary_beeswarm.png"), dpi=150)
    plt.close()

    mean_abs = np.mean(np.abs(shap_values), axis=0)
    top_idx  = np.argsort(mean_abs)[::-1][:10]
    top_features = [{"feature": feature_names[i], "importance": float(mean_abs[i])} for i in top_idx]
    metrics["top_shap_features"] = top_features

    # Save model artifacts
    with open(os.path.join(OUTPUT_DIR, "model.pkl"), "wb") as f:
        pickle.dump(best, f)
    with open(os.path.join(OUTPUT_DIR, "feature_names.json"), "w") as f:
        json.dump(feature_names, f)
    with open(os.path.join(OUTPUT_DIR, "numeric_cols.json"), "w") as f:
        json.dump(numeric_cols, f)
    with open(os.path.join(OUTPUT_DIR, "categorical_cols.json"), "w") as f:
        json.dump(categorical_cols, f)
    with open(os.path.join(OUTPUT_DIR, "model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"[TRAIN] ✓ model.pkl saved")
    print(f"[TRAIN] ✓ Top SHAP features: {[f['feature'] for f in top_features[:5]]}")
    return metrics


if __name__ == "__main__":
    train()
