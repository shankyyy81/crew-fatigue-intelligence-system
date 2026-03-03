import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import roc_auc_score, average_precision_score, confusion_matrix
from sklearn.pipeline import Pipeline

from xgboost import XGBClassifier
import shap

CANDIDATE_FILES = ["train_samples.csv", "train_sampels.csv"]
OUTPUT_UPDATED = "train_samples_with_layer1.csv"
LABEL_CANDIDATES = ["label_called_unfit", "label", "target", "y"]


def load_train_file():
    for f in CANDIDATE_FILES:
        if os.path.exists(f):
            print(f"[OK] Loading: {f}")
            return pd.read_csv(f)
    raise FileNotFoundError(f"Could not find any of these files: {CANDIDATE_FILES}")


def pick_col(df, names):
    for n in names:
        if n in df.columns:
            return n
    return None


def find_label(df):
    for c in LABEL_CANDIDATES:
        if c in df.columns:
            return c
    # fallback: find a binary column
    binary_cols = [c for c in df.columns if df[c].dropna().nunique() <= 2]
    for c in binary_cols:
        lc = c.lower()
        if "label" in lc or "target" in lc or "unfit" in lc:
            return c
    if binary_cols:
        return binary_cols[0]
    raise ValueError("No label column found (need 0/1 column like label_called_unfit).")


def safe_bool01(s: pd.Series) -> pd.Series:
    if s.dtype == object:
        return s.astype(str).str.lower().isin(["1", "true", "yes", "y"]).astype(int)
    return (pd.to_numeric(s, errors="coerce").fillna(0) > 0).astype(int)


# -------- Layer 1 --------
def compute_layer1_fatigue_score(df: pd.DataFrame) -> pd.Series:
    duty_col = pick_col(df, ["duty_hours", "duty_duration_hours", "hours_flown_24h", "hours_flown"])
    rest_col = pick_col(df, ["sleep_opportunity_hours", "rest_hours", "sleep_hours"])
    consec_col = pick_col(df, ["consecutive_duty_days", "consecutive_days"])
    night_col = pick_col(df, ["night_duty", "is_night_duty", "crosses_midnight"])
    circ_col = pick_col(df, ["circadian_misalignment"])

    duty = pd.to_numeric(df[duty_col], errors="coerce").fillna(8.0) if duty_col else pd.Series(8.0, index=df.index)
    rest = pd.to_numeric(df[rest_col], errors="coerce").fillna(8.0) if rest_col else pd.Series(8.0, index=df.index)
    consec = pd.to_numeric(df[consec_col], errors="coerce").fillna(0.0) if consec_col else pd.Series(0.0, index=df.index)

    night = safe_bool01(df[night_col]) if night_col else pd.Series(0, index=df.index)
    circ = pd.to_numeric(df[circ_col], errors="coerce").fillna(0.0).clip(0, 1) if circ_col else pd.Series(0.0, index=df.index)

    score = pd.Series(100.0, index=df.index)
    score -= np.maximum(0, duty - 8.0) * 6.0
    score -= (rest < 7.0).astype(float) * 14.0
    score -= np.maximum(0, 7.0 - rest) * 2.0
    score -= np.maximum(0, consec - 3.0) * 6.0
    score -= night * 10.0
    score -= circ * 12.0
    return score.clip(0, 100)


def main():
    df = load_train_file()

    # Layer 1 -> fatigue_score
    df["fatigue_score"] = compute_layer1_fatigue_score(df)
    df.to_csv(OUTPUT_UPDATED, index=False)
    print(f"[OK] Layer 1 added/updated 'fatigue_score' -> saved: {OUTPUT_UPDATED}")
    print(f"     fatigue_score range: {df['fatigue_score'].min():.1f} .. {df['fatigue_score'].max():.1f}")

    # Label + basic sanity prints
    label_col = find_label(df)
    y = pd.to_numeric(df[label_col], errors="coerce").fillna(0).astype(int)

    print("\n[DATA CHECK]")
    print("Rows:", len(df))
    print("Label column:", label_col)
    print("Class counts:", dict(pd.Series(y).value_counts()))
    if y.nunique() != 2:
        raise ValueError("Label is not binary (0/1). Fix label_called_unfit to contain only 0 and 1.")

    # Build X
    X = df.drop(columns=[label_col]).copy()
    for id_col in ["crew_id", "duty_id"]:
        if id_col in X.columns:
            X.drop(columns=[id_col], inplace=True)

    # Split once for final holdout report (still keep CV for model selection)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_cols = X_train.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in X_train.columns if c not in numeric_cols]

    # Fill missing (important)
    for c in numeric_cols:
        X_train[c] = pd.to_numeric(X_train[c], errors="coerce")
        X_test[c] = pd.to_numeric(X_test[c], errors="coerce")
        med = X_train[c].median()
        X_train[c] = X_train[c].fillna(med)
        X_test[c] = X_test[c].fillna(med)

    for c in categorical_cols:
        X_train[c] = X_train[c].astype(str).fillna("unknown")
        X_test[c] = X_test[c].astype(str).fillna("unknown")

    # imbalance weight
    pos = int((y_train == 1).sum())
    neg = int((y_train == 0).sum())
    scale_pos_weight = neg / max(pos, 1)

    preprocessor = ColumnTransformer(
        transformers=[("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols)],
        remainder="passthrough"
    )

    # Base model
    base = XGBClassifier(
        objective="binary:logistic",
        eval_metric="auc",
        tree_method="hist",
        random_state=42,
        scale_pos_weight=scale_pos_weight
    )

    pipe = Pipeline(steps=[("prep", preprocessor), ("model", base)])

    # Parameter search focused on AUC (kept compact for hackathon)
    param_dist = {
        "model__n_estimators": [300, 600, 1000, 1500],
        "model__learning_rate": [0.01, 0.03, 0.05, 0.1],
        "model__max_depth": [3, 4, 5, 6],
        "model__min_child_weight": [1, 2, 5, 10],
        "model__subsample": [0.7, 0.85, 0.95, 1.0],
        "model__colsample_bytree": [0.7, 0.85, 0.95, 1.0],
        "model__reg_lambda": [0.5, 1.0, 2.0, 5.0],
        "model__gamma": [0.0, 0.1, 0.3, 1.0],
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    search = RandomizedSearchCV(
        pipe,
        param_distributions=param_dist,
        n_iter=35,
        scoring="roc_auc",
        cv=cv,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )

    print("\n[INFO] Running CV hyperparameter search for better AUC...")
    search.fit(X_train, y_train)

    print("\n[OK] Best CV ROC-AUC:", round(search.best_score_, 4))
    print("[OK] Best params:", search.best_params_)

    best_model = search.best_estimator_

    # Final holdout metrics
    y_prob = best_model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_prob)
    ap = average_precision_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred)

    print("\n========= HOLDOUT PERFORMANCE =========")
    print(f"ROC-AUC            : {auc:.4f}")
    print(f"Avg Precision (AP) : {ap:.4f}")
    print("Confusion Matrix [ [TN FP] [FN TP] ]:")
    print(cm)
    print("======================================\n")

    # -------- SHAP (use underlying trained xgb + transformed features) --------
    print("[INFO] Computing SHAP explanations...")

    # Transform test set for SHAP
    prep = best_model.named_steps["prep"]
    xgb = best_model.named_steps["model"]

    X_test_trans = prep.transform(X_test)

    # feature names
    feature_names = []
    if categorical_cols:
        ohe = prep.named_transformers_["cat"]
        feature_names.extend(ohe.get_feature_names_out(categorical_cols).tolist())
    feature_names.extend(numeric_cols)

    # sample for speed
    sample_size = min(300, X_test_trans.shape[0])
    rng = np.random.RandomState(42)
    idx = rng.choice(X_test_trans.shape[0], size=sample_size, replace=False)
    Xs = X_test_trans[idx]

    explainer = shap.TreeExplainer(xgb)
    shap_values = explainer.shap_values(Xs)

    plt.figure()
    shap.summary_plot(shap_values, Xs, feature_names=feature_names, plot_type="bar", show=False)
    plt.tight_layout()
    plt.savefig("shap_summary_bar.png", dpi=200)
    plt.close()

    plt.figure()
    shap.summary_plot(shap_values, Xs, feature_names=feature_names, show=False)
    plt.tight_layout()
    plt.savefig("shap_summary_beeswarm.png", dpi=200)
    plt.close()

    print("[OK] SHAP plots saved: shap_summary_bar.png, shap_summary_beeswarm.png")

    mean_abs = np.mean(np.abs(shap_values), axis=0)
    top_idx = np.argsort(mean_abs)[::-1][:10]
    print("\nTop 10 features (by mean |SHAP|):")
    for i in top_idx:
        print(f"  {feature_names[i]} : {mean_abs[i]:.4f}")


if __name__ == "__main__":
    main()