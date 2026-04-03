"""Kaggle-backed model training for PhishGuard AI.

Trains:
- Skill classifier (RandomForest) for user level prediction
- Anomaly detector (IsolationForest) for behavior anomalies

Also computes real email feature distributions from Kaggle phishing + Enron datasets
and writes a training quality report.
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "saved_models"
DATASETS_DIR = BASE_DIR.parent / "datasets"

RF_MODEL_PATH = MODEL_DIR / "rf_skill.pkl"
ISO_MODEL_PATH = MODEL_DIR / "iso_forest.pkl"
EMAIL_DETECTOR_PATH = MODEL_DIR / "rf_email_detector.pkl"
TRAINING_REPORT_PATH = MODEL_DIR / "training_report.json"


class KaggleDatasetLoader:
    @staticmethod
    def load_phishing_emails(max_rows=5000):
        path = DATASETS_DIR / "phishing_email.csv"
        if not path.exists():
            logger.warning("❌ Phishing dataset not found")
            return None
        logger.info(f"📥 Loading phishing dataset ({path.stat().st_size / 1024 / 1024:.1f}MB)...")
        frame = pd.read_csv(path, nrows=max_rows)
        logger.info(f"✓ Loaded {len(frame)} phishing samples")
        return frame

    @staticmethod
    def load_enron_emails(max_rows=5000):
        path = DATASETS_DIR / "emails.csv"
        if not path.exists():
            logger.warning("❌ Enron dataset not found")
            return None
        logger.info(f"📥 Loading Enron dataset ({path.stat().st_size / 1024 / 1024:.1f}MB)...")
        frame = pd.read_csv(path, nrows=max_rows)
        logger.info(f"✓ Loaded {len(frame)} Enron samples")
        return frame


def _to_text_series(phishing_df, enron_df):
    phishing_text = phishing_df.get("text_combined", pd.Series(dtype=str)).fillna("").astype(str)
    enron_text = enron_df.get("message", pd.Series(dtype=str)).fillna("").astype(str)
    return phishing_text, enron_text


def _extract_email_features(text):
    text = text if isinstance(text, str) else ""
    lower = text.lower()
    words = text.split()
    return {
        "urgency": sum(token in lower for token in ["urgent", "immediately", "asap", "verify", "act now"]),
        "links": sum(token in lower for token in ["http", "www", "bit.ly", "tinyurl", "click here"]),
        "attachments": sum(token in lower for token in ["attachment", "attached", ".zip", ".exe", ".docm"]),
        "grammar_noise": lower.count("!!!") + lower.count("??") + lower.count("...") + lower.count("kindly"),
        "caps_ratio": (sum(ch.isupper() for ch in text) / max(len(text), 1)),
        "length": len(text),
        "avg_word_length": float(np.mean([len(w) for w in words])) if words else 0.0,
    }


def _build_email_feature_frame(phishing_text, enron_text):
    phishing_features = [_extract_email_features(text) for text in phishing_text]
    enron_features = [_extract_email_features(text) for text in enron_text]
    phishing_frame = pd.DataFrame(phishing_features)
    enron_frame = pd.DataFrame(enron_features)
    phishing_frame["label"] = 1
    enron_frame["label"] = 0
    return pd.concat([phishing_frame, enron_frame], ignore_index=True)


def _build_synthetic_email_feature_frame(size=5000):
    rng = np.random.default_rng(7)
    phishing_frame = pd.DataFrame(
        {
            "urgency": rng.integers(1, 5, size=size),
            "links": rng.integers(1, 5, size=size),
            "attachments": rng.integers(0, 3, size=size),
            "grammar_noise": rng.integers(1, 6, size=size),
            "caps_ratio": rng.uniform(0.05, 0.35, size=size),
            "length": rng.integers(100, 1400, size=size),
            "avg_word_length": rng.uniform(4.0, 7.2, size=size),
            "label": np.ones(size, dtype=int),
        }
    )
    legit_frame = pd.DataFrame(
        {
            "urgency": rng.integers(0, 2, size=size),
            "links": rng.integers(0, 2, size=size),
            "attachments": rng.integers(0, 2, size=size),
            "grammar_noise": rng.integers(0, 2, size=size),
            "caps_ratio": rng.uniform(0.01, 0.08, size=size),
            "length": rng.integers(150, 1800, size=size),
            "avg_word_length": rng.uniform(4.2, 6.2, size=size),
            "label": np.zeros(size, dtype=int),
        }
    )
    return pd.concat([phishing_frame, legit_frame], ignore_index=True)


def _train_email_detector(email_feature_df):
    feature_cols = [c for c in email_feature_df.columns if c != "label"]
    X = email_feature_df[feature_cols]
    y = email_feature_df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    detector = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    detector.fit(X_train, y_train)
    y_pred = detector.predict(X_test)
    metrics = {
        "email_benchmark_accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "email_benchmark_f1": round(float(f1_score(y_test, y_pred)), 4),
        "samples": int(len(email_feature_df)),
    }
    return detector, metrics


def _generate_skill_data(email_feature_df, per_class=150):
    rng = np.random.default_rng(42)
    risk = (
        email_feature_df["urgency"]
        + email_feature_df["links"]
        + email_feature_df["attachments"]
        + email_feature_df["grammar_noise"]
    )
    risk_scale = np.clip((risk / max(risk.quantile(0.95), 1)).to_numpy(), 0, 1)

    rows = []
    labels = []
    for skill_label, cfg in enumerate(
        [
            {"acc": (0.10, 0.45), "rt": (20, 60), "attempts": (1, 20), "hard": (0.05, 0.30), "med": (0.10, 0.40)},
            {"acc": (0.45, 0.75), "rt": (10, 35), "attempts": (20, 60), "hard": (0.35, 0.65), "med": (0.50, 0.75)},
            {"acc": (0.75, 1.00), "rt": (3, 15), "attempts": (60, 150), "hard": (0.75, 1.00), "med": (0.85, 1.00)},
        ]
    ):
        for _ in range(per_class):
            r = float(rng.choice(risk_scale))
            accuracy = float(rng.uniform(*cfg["acc"]) - (0.08 * r if skill_label == 0 else 0.02 * r))
            response_time = float(rng.uniform(*cfg["rt"]) + (5 * r if skill_label == 0 else 1.5 * r))
            total_attempts = int(rng.integers(*cfg["attempts"]))
            hard_accuracy = float(rng.uniform(*cfg["hard"]) - (0.05 * r))
            medium_accuracy = float(rng.uniform(*cfg["med"]) - (0.03 * r))
            rows.append(
                [
                    float(np.clip(accuracy, 0, 1)),
                    float(max(response_time, 1.0)),
                    total_attempts,
                    float(np.clip(hard_accuracy, 0, 1)),
                    float(np.clip(medium_accuracy, 0, 1)),
                ]
            )
            labels.append(skill_label)
    return np.array(rows), np.array(labels)


def _generate_anomaly_data(email_feature_df, n_samples=800):
    rng = np.random.default_rng(43)
    risk = (
        email_feature_df["urgency"]
        + email_feature_df["links"]
        + email_feature_df["attachments"]
        + email_feature_df["grammar_noise"]
    )
    risk_scale = np.clip((risk / max(risk.quantile(0.95), 1)).to_numpy(), 0, 1)

    normal = []
    for _ in range(n_samples):
        r = float(rng.choice(risk_scale))
        accuracy = float(np.clip(rng.uniform(0.2, 0.95) - (0.05 * r), 0, 1))
        response_time = float(max(rng.uniform(3, 45) + (2 * r), 1))
        consistency = float(np.clip(rng.uniform(0.6, 0.99) - (0.1 * r), 0, 1))
        normal.append([accuracy, response_time, consistency])
    return np.array(normal)


def train_with_kaggle_datasets(allow_fallback=False):
    logger.info("\n" + "=" * 72)
    logger.info("🚀 PHISHGUARD AI - TRAINING WITH KAGGLE DATASETS")
    logger.info("=" * 72)

    phishing_df = KaggleDatasetLoader.load_phishing_emails(max_rows=5000)
    enron_df = KaggleDatasetLoader.load_enron_emails(max_rows=5000)

    if phishing_df is None or enron_df is None:
        if not allow_fallback:
            raise RuntimeError("Required Kaggle datasets are missing in datasets/ directory")
        logger.warning("⚠️ Kaggle datasets unavailable. Falling back to synthetic email feature data.")
        email_feature_df = _build_synthetic_email_feature_frame(size=5000)
        dataset_summary = {
            "phishing_samples": 5000,
            "enron_samples": 5000,
            "total_email_samples": 10000,
            "source": "synthetic_fallback",
        }
    else:
        phishing_text, enron_text = _to_text_series(phishing_df, enron_df)
        email_feature_df = _build_email_feature_frame(phishing_text, enron_text)
        dataset_summary = {
            "phishing_samples": int(len(phishing_text)),
            "enron_samples": int(len(enron_text)),
            "total_email_samples": int(len(email_feature_df)),
            "source": "kaggle",
        }

    email_detector, benchmark = _train_email_detector(email_feature_df)

    logger.info(f"📊 Email benchmark accuracy: {benchmark['email_benchmark_accuracy']:.2%}")
    logger.info(f"📊 Email benchmark F1: {benchmark['email_benchmark_f1']:.2%}")

    X_skill, y_skill = _generate_skill_data(email_feature_df, per_class=150)
    skill_model = RandomForestClassifier(
        n_estimators=150,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    skill_model.fit(X_skill, y_skill)

    X_anomaly = _generate_anomaly_data(email_feature_df, n_samples=800)
    anomaly_model = IsolationForest(
        n_estimators=150,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    anomaly_model.fit(X_anomaly)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(skill_model, RF_MODEL_PATH)
    joblib.dump(anomaly_model, ISO_MODEL_PATH)
    joblib.dump(email_detector, EMAIL_DETECTOR_PATH)

    report = {
        "datasets": dataset_summary,
        "quality_benchmark": benchmark,
        "skill_training": {
            "samples": int(len(X_skill)),
            "features": int(X_skill.shape[1]),
            "class_distribution": {
                "beginner": int(np.sum(y_skill == 0)),
                "intermediate": int(np.sum(y_skill == 1)),
                "advanced": int(np.sum(y_skill == 2)),
            },
            "train_accuracy": round(float(skill_model.score(X_skill, y_skill)), 4),
        },
        "anomaly_training": {
            "samples": int(len(X_anomaly)),
            "features": int(X_anomaly.shape[1]),
            "contamination": 0.05,
        },
        "artifacts": {
            "rf_model": str(RF_MODEL_PATH),
            "iso_model": str(ISO_MODEL_PATH),
            "email_detector_model": str(EMAIL_DETECTOR_PATH),
        },
    }

    TRAINING_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")

    logger.info(f"✅ Skill model saved: {RF_MODEL_PATH}")
    logger.info(f"✅ Anomaly model saved: {ISO_MODEL_PATH}")
    logger.info(f"✅ Email detector saved: {EMAIL_DETECTOR_PATH}")
    logger.info(f"✅ Training report saved: {TRAINING_REPORT_PATH}")

    return report


def load_or_train_models():
    """Load models from disk or train with Kaggle datasets if missing."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    models_exist = RF_MODEL_PATH.exists() and ISO_MODEL_PATH.exists()
    
    if models_exist:
        logger.info(f"📂 Loading existing models from {MODEL_DIR}")
        skill_clf = joblib.load(RF_MODEL_PATH)
        anomaly_detector = joblib.load(ISO_MODEL_PATH)
        logger.info("✅ Models loaded successfully")
    else:
        logger.info("🏗️ Training models with Kaggle datasets...")
        train_with_kaggle_datasets(allow_fallback=True)
        skill_clf = joblib.load(RF_MODEL_PATH)
        anomaly_detector = joblib.load(ISO_MODEL_PATH)
    
    return skill_clf, anomaly_detector


# Global instances
_skill_classifier = None
_anomaly_detector = None
_email_detector = None


def get_models():
    """Get or initialize models"""
    global _skill_classifier, _anomaly_detector
    if _skill_classifier is None or _anomaly_detector is None:
        _skill_classifier, _anomaly_detector = load_or_train_models()
    return _skill_classifier, _anomaly_detector


def get_email_detector():
    global _email_detector
    if _email_detector is None:
        if not EMAIL_DETECTOR_PATH.exists():
            train_with_kaggle_datasets(allow_fallback=True)
        _email_detector = joblib.load(EMAIL_DETECTOR_PATH)
    return _email_detector


def classify_user_skill(accuracy, avg_response_time, total_attempts, hard_acc, medium_acc):
    """Classify user skill level"""
    skill_clf, _ = get_models()
    
    X = np.array([[accuracy, avg_response_time, total_attempts, hard_acc, medium_acc]])
    prediction = skill_clf.predict(X)[0]
    confidence = max(skill_clf.predict_proba(X)[0])
    
    skill_map = {0: 'beginner', 1: 'intermediate', 2: 'advanced'}
    return skill_map[prediction], float(confidence)


def detect_anomaly(accuracy, avg_response_time, consistency_score):
    """Detect if user behavior is anomalous"""
    _, anomaly_detector = get_models()
    
    X = np.array([[accuracy, avg_response_time, consistency_score]])
    prediction = anomaly_detector.predict(X)[0]
    
    return prediction == -1


def predict_email_phishing(email_text):
    detector = get_email_detector()
    features = _extract_email_features(email_text)
    feature_vector = pd.DataFrame(
        [
            {
                "urgency": features["urgency"],
                "links": features["links"],
                "attachments": features["attachments"],
                "grammar_noise": features["grammar_noise"],
                "caps_ratio": features["caps_ratio"],
                "length": features["length"],
                "avg_word_length": features["avg_word_length"],
            }
        ]
    )

    prediction = int(detector.predict(feature_vector)[0])
    confidence = float(max(detector.predict_proba(feature_vector)[0]))
    label = "phishing" if prediction == 1 else "legitimate"
    return {
        "label": label,
        "is_phishing": prediction == 1,
        "confidence": round(confidence, 4),
        "features": features,
    }


if __name__ == "__main__":
    train_with_kaggle_datasets()
