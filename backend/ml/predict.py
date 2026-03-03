"""
Prediction pipeline — Three-Layer Fatigue Intelligence
Given a crew's feature dict, returns final_fatigue_score, tier, SHAP drivers.
"""
import os
import json
import pickle
import numpy as np
import pandas as pd
import shap

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_artifacts():
    with open(os.path.join(BASE_DIR, "model.pkl"), "rb") as f:
        model = pickle.load(f)
    with open(os.path.join(BASE_DIR, "feature_names.json")) as f:
        feature_names = json.load(f)
    with open(os.path.join(BASE_DIR, "numeric_cols.json")) as f:
        numeric_cols = json.load(f)
    with open(os.path.join(BASE_DIR, "categorical_cols.json")) as f:
        categorical_cols = json.load(f)
    return model, feature_names, numeric_cols, categorical_cols


# Cache artifacts
_model = None
_feature_names = None
_numeric_cols = None
_categorical_cols = None


def _ensure_loaded():
    global _model, _feature_names, _numeric_cols, _categorical_cols
    if _model is None:
        _model, _feature_names, _numeric_cols, _categorical_cols = _load_artifacts()


def compute_layer1(row: dict) -> float:
    duty   = float(row.get("hours_flown_24h") or row.get("duty_hours") or 8.0)
    rest   = float(row.get("sleep_opportunity_hours") or row.get("rest_hours") or 8.0)
    consec = float(row.get("consecutive_duty_days") or 0.0)
    night  = float(row.get("night_duty") or 0.0)
    circ   = float(row.get("circadian_misalignment") or 0.0)
    tz     = abs(float(row.get("timezone_displacement_hours") or 0.0))

    score = 100.0
    score -= max(0, duty - 8.0) * 6.0
    score -= (14.0 if rest < 7.0 else 0.0)
    score -= max(0, 7.0 - rest) * 2.0
    score -= max(0, consec - 3.0) * 6.0
    score -= night * 10.0
    score -= min(circ, 1.0) * 12.0
    score -= min(tz, 5.0) * 2.0
    return float(np.clip(score, 0, 100))


def compute_layer3(row: dict) -> float:
    swap  = min(float(row.get("swap_request_count_7d") or 0), 4)
    well  = float(row.get("wellness_score") or 0.5)
    late  = min(float(row.get("late_checkin_count_30d") or 0), 4)
    fat_r = min(float(row.get("fatigue_report_count") or 0), 4)
    boost = swap * 2.0 + (1 - well) * 5.0 + late * 1.0 + fat_r * 1.5
    return float(np.clip(boost, 0, 15))


def get_tier(score: float) -> str:
    if score <= 60:
        return "GREEN"
    elif score <= 80:
        return "AMBER"
    else:
        return "RED"


def predict(row: dict) -> dict:
    """
    Given a dict of crew features, returns:
    {
        fatigue_base_score, fatigue_ml_score, behavioral_boost,
        final_fatigue_score, tier,
        shap_drivers: [{feature, value, impact}×10]
    }
    """
    _ensure_loaded()

    # Layer 1
    l1 = compute_layer1(row)

    # Layer 3
    l3 = compute_layer3(row)

    # Prepare row for ML
    df = pd.DataFrame([row])

    # Add derived columns that training expects
    df["fatigue_base_score"] = l1
    df["behavioral_boost"]   = l3

    # Season
    if "duty_start" in df.columns and pd.notna(df["duty_start"].iloc[0]):
        try:
            month = pd.to_datetime(df["duty_start"].iloc[0]).month
        except Exception:
            month = 1
    else:
        month = 1
    df["season"] = "winter" if month in [12,1,2] else ("summer" if month in [3,4,5] else ("monsoon" if month in [6,7,8,9] else "autumn"))

    # Drop non-feature columns
    drop_cols = ["label_called_unfit","label","target","y",
                 "crew_id","duty_id","route","layover_start","layover_end",
                 "duty_start","duty_end","timestamp","hotel_tier",
                 "habitual_sleep_start","habitual_sleep_end","report_time_local"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    # Fill missing columns
    for c in _numeric_cols:
        if c not in df.columns:
            df[c] = 0.0
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    for c in _categorical_cols:
        if c not in df.columns:
            df[c] = "unknown"
        df[c] = df[c].astype(str).fillna("unknown")

    # Layer 2 — XGBoost probability
    try:
        ml_prob = float(_model.predict_proba(df)[:, 1][0])
    except Exception:
        ml_prob = 0.5
    l2 = ml_prob * 100.0

    # Final score
    final = float(np.clip(0.45 * l1 + 0.45 * l2 + l3, 0, 100))
    tier  = get_tier(final)

    # SHAP per-crew top drivers
    drivers = []
    try:
        prep = _model.named_steps["prep"]
        xgb  = _model.named_steps["model"]
        X_t  = prep.transform(df)
        explainer   = shap.TreeExplainer(xgb)
        shap_values = explainer.shap_values(X_t)
        sv = shap_values[0] if len(shap_values.shape) == 2 else shap_values
        top_idx = np.argsort(np.abs(sv))[::-1][:10]
        for i in top_idx:
            fname = _feature_names[i] if i < len(_feature_names) else f"f_{i}"
            drivers.append({
                "feature": fname,
                "impact": float(sv[i]),
                "abs_impact": float(abs(sv[i]))
            })
    except Exception as e:
        print(f"[PREDICT] SHAP failed: {e}")

    return {
        "fatigue_base_score":  round(l1, 2),
        "fatigue_ml_score":    round(l2, 2),
        "behavioral_boost":    round(l3, 2),
        "final_fatigue_score": round(final, 2),
        "tier":                tier,
        "unfit_risk_probability": round(ml_prob, 4),
        "shap_drivers":        drivers,
    }
