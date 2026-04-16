from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from core.models import BehavioralDatasetRecord, UserAttempt, UserProfile


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "saved_models"
PROFILE_MODEL_PATH = MODEL_DIR / "rf_user_profile.pkl"

FEATURE_COLUMNS = [
    "accuracy",
    "avg_response_time",
    "total_attempts",
    "hard_accuracy",
    "medium_accuracy",
    "false_positive_rate",
    "false_negative_rate",
    "baseline_accuracy",
    "practice_accuracy",
]


def _safe_ratio(numerator, denominator):
    return float(numerator / denominator) if denominator else 0.0


def _difficulty_accuracy(user, difficulty):
    attempts = UserAttempt.objects.filter(user=user, scenario__difficulty=difficulty)
    total = attempts.count()
    correct = attempts.filter(is_correct=True).count()
    return _safe_ratio(correct, total)


def _error_rates(user):
    attempts = UserAttempt.objects.filter(user=user).select_related("scenario")

    phishing_total = attempts.filter(scenario__is_phishing=True).count()
    legit_total = attempts.filter(scenario__is_phishing=False).count()
    false_negative = attempts.filter(scenario__is_phishing=True, user_answer=False).count()
    false_positive = attempts.filter(scenario__is_phishing=False, user_answer=True).count()

    return (
        _safe_ratio(false_positive, legit_total),
        _safe_ratio(false_negative, phishing_total),
    )


def _source_accuracy(user, source):
    records = BehavioralDatasetRecord.objects.filter(user=user, source=source).order_by("-created_at")[:10]
    if not records:
        return 0.0
    return float(sum(record.accuracy for record in records) / len(records)) / 100.0


def _window_feature_snapshot(user, attempt_window):
    total = len(attempt_window)
    correct = sum(1 for attempt in attempt_window if attempt.is_correct)
    avg_response = sum(float(attempt.response_time) for attempt in attempt_window) / max(total, 1)

    hard_attempts = [attempt for attempt in attempt_window if attempt.scenario.difficulty == "hard"]
    medium_attempts = [attempt for attempt in attempt_window if attempt.scenario.difficulty == "medium"]
    hard_accuracy = _safe_ratio(sum(1 for attempt in hard_attempts if attempt.is_correct), len(hard_attempts))
    medium_accuracy = _safe_ratio(sum(1 for attempt in medium_attempts if attempt.is_correct), len(medium_attempts))

    phishing = [attempt for attempt in attempt_window if attempt.scenario.is_phishing]
    legitimate = [attempt for attempt in attempt_window if not attempt.scenario.is_phishing]
    false_positive = sum(1 for attempt in legitimate if attempt.user_answer)
    false_negative = sum(1 for attempt in phishing if not attempt.user_answer)

    baseline_attempts = [attempt for attempt in attempt_window if attempt.assessment_type == "baseline"]
    practice_attempts = [attempt for attempt in attempt_window if attempt.assessment_type == "practice"]
    baseline_accuracy = _safe_ratio(sum(1 for attempt in baseline_attempts if attempt.is_correct), len(baseline_attempts))
    practice_accuracy = _safe_ratio(sum(1 for attempt in practice_attempts if attempt.is_correct), len(practice_attempts))

    return {
        "accuracy": _safe_ratio(correct, total),
        "avg_response_time": avg_response,
        "total_attempts": int(total),
        "hard_accuracy": hard_accuracy,
        "medium_accuracy": medium_accuracy,
        "false_positive_rate": _safe_ratio(false_positive, len(legitimate)),
        "false_negative_rate": _safe_ratio(false_negative, len(phishing)),
        "baseline_accuracy": baseline_accuracy,
        "practice_accuracy": practice_accuracy,
    }


def extract_user_performance_features(user):
    profile = user.userprofile
    false_positive_rate, false_negative_rate = _error_rates(user)

    return {
        "accuracy": float(profile.accuracy()) / 100.0,
        "avg_response_time": float(profile.avg_response_time),
        "total_attempts": int(profile.total_attempts),
        "hard_accuracy": _difficulty_accuracy(user, "hard"),
        "medium_accuracy": _difficulty_accuracy(user, "medium"),
        "false_positive_rate": false_positive_rate,
        "false_negative_rate": false_negative_rate,
        "baseline_accuracy": _source_accuracy(user, "baseline"),
        "practice_accuracy": _source_accuracy(user, "practice"),
    }


def _derive_skill_label(features):
    score = (
        0.45 * features["accuracy"]
        + 0.2 * features["hard_accuracy"]
        + 0.15 * features["medium_accuracy"]
        + 0.1 * features["baseline_accuracy"]
        + 0.1 * features["practice_accuracy"]
    )

    penalty = (0.12 * features["false_positive_rate"]) + (0.15 * features["false_negative_rate"])
    response_penalty = 0.0
    if features["avg_response_time"] > 40:
        response_penalty = 0.1
    elif features["avg_response_time"] > 25:
        response_penalty = 0.05

    final_score = max(0.0, min(1.0, score - penalty - response_penalty))

    if final_score < 0.45:
        return 0
    if final_score < 0.75:
        return 1
    return 2


def _build_training_frame():
    rows = []
    labels = []
    records = BehavioralDatasetRecord.objects.select_related("user", "user__userprofile").order_by("created_at")

    for record in records:
        user = record.user
        profile = user.userprofile
        false_positive_rate, false_negative_rate = _error_rates(user)
        features = {
            "accuracy": float(record.accuracy) / 100.0,
            "avg_response_time": float(record.avg_response_time),
            "total_attempts": int(profile.total_attempts),
            "hard_accuracy": _difficulty_accuracy(user, "hard"),
            "medium_accuracy": _difficulty_accuracy(user, "medium"),
            "false_positive_rate": false_positive_rate,
            "false_negative_rate": false_negative_rate,
            "baseline_accuracy": _source_accuracy(user, "baseline"),
            "practice_accuracy": _source_accuracy(user, "practice"),
        }
        rows.append([features[column] for column in FEATURE_COLUMNS])
        labels.append(_derive_skill_label(features))

    users = UserProfile.objects.select_related("user").filter(total_attempts__gte=5)
    for profile in users:
        attempts = list(
            UserAttempt.objects.filter(user=profile.user)
            .select_related("scenario")
            .order_by("timestamp")
        )
        if len(attempts) < 5:
            continue

        window_size = 5
        stride = 3
        for start in range(0, len(attempts) - window_size + 1, stride):
            window = attempts[start : start + window_size]
            features = _window_feature_snapshot(profile.user, window)
            rows.append([features[column] for column in FEATURE_COLUMNS])
            labels.append(_derive_skill_label(features))

    if not rows:
        return None, None
    return pd.DataFrame(rows, columns=FEATURE_COLUMNS), np.array(labels)


def train_user_profile_classifier(min_samples=5):
    X, y = _build_training_frame()
    if X is None or len(X) < min_samples:
        return None

    model = RandomForestClassifier(
        n_estimators=250,
        max_depth=18,
        min_samples_split=3,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, PROFILE_MODEL_PATH)
    return {
        "samples": int(len(X)),
        "features": int(X.shape[1]),
        "train_accuracy": round(float(model.score(X, y)), 4),
        "artifact": str(PROFILE_MODEL_PATH),
    }


def _load_profile_model():
    if not PROFILE_MODEL_PATH.exists():
        return None
    return joblib.load(PROFILE_MODEL_PATH)


def classify_user_with_profile_model(user, retrain_threshold=None):
    model = _load_profile_model()
    if model is None:
        training_info = train_user_profile_classifier()
        if not training_info:
            return None
        model = _load_profile_model()
        if model is None:
            return None

    feature_dict = extract_user_performance_features(user)
    X = pd.DataFrame([[feature_dict[column] for column in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    pred = int(model.predict(X)[0])
    confidence = float(max(model.predict_proba(X)[0]))

    mapping = {0: "beginner", 1: "intermediate", 2: "advanced"}
    return mapping[pred], confidence, feature_dict
