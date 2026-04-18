from __future__ import annotations

from collections import Counter
from datetime import timedelta
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import connection, transaction
from django.db.models import Avg
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import ensure_csrf_cookie
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from rest_framework import status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes,
)
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from ml_engine.kaggle_trainer import predict_email_phishing
from ml_engine.recommender import get_recommendations
from ml_engine.user_profiling import classify_user_with_profile_model, extract_user_performance_features

from .models import (
    AdaptiveLearningState,
    BehavioralDatasetRecord,
    PhishingScenario,
    TrainingRecommendation,
    UserAttempt,
    UserProfile,
)


DIFFICULTY_LEVELS = ("easy", "medium", "hard")
DIFFICULTY_TO_SKILL_LABEL = {
    "easy": "beginner",
    "medium": "intermediate",
    "hard": "advanced",
}

REPORT_DATASET_SOURCES = [
    "kaggle.com/datasets/naserabdullahalam/phishing-email-dataset",
    "kaggle.com/datasets/wcukierski/enron-email-dataset",
]

# Backward-compatible aliases used by seeding/training code in older revisions.
REPORT_DATASET_SOURCE_ALIASES = {
    "kaggle-phishing-email-dataset",
    "kaggle-enron-email-dataset",
    "naserabdullahalam/phishing-email-dataset",
    "wcukierski/enron-email-dataset",
    "kaggle.com/datasets/naserabdullahalam/phishing-email-dataset",
    "kaggle.com/datasets/wcukierski/enron-email-dataset",
    "shivamb/phishing-email-dataset",
    "kaggle.com/datasets/shivamb/phishing-email-dataset",
}


def _base_difficulty(skill_level: str) -> str:
    return {
        "beginner": "easy",
        "intermediate": "medium",
        "advanced": "hard",
    }.get(skill_level, "easy")


def _difficulty_index(level: str) -> int:
    try:
        return DIFFICULTY_LEVELS.index(level)
    except ValueError:
        return 0


def _clamp_difficulty(index: int) -> str:
    return DIFFICULTY_LEVELS[max(0, min(len(DIFFICULTY_LEVELS) - 1, index))]


def _difficulty_to_skill_label(difficulty: str) -> str:
    return DIFFICULTY_TO_SKILL_LABEL.get((difficulty or "").lower(), "beginner")


@lru_cache(maxsize=1)
def _phishing_scenario_columns() -> set[str]:
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, PhishingScenario._meta.db_table)
    return {col.name for col in description}


@lru_cache(maxsize=1)
def _allowed_report_scenario_ids():
    if "source_dataset" not in _phishing_scenario_columns():
        return None

    table_name = PhishingScenario._meta.db_table
    source_values = tuple(sorted(REPORT_DATASET_SOURCE_ALIASES))
    placeholders = ",".join(["%s"] * len(source_values))
    query = f"SELECT id FROM {table_name} WHERE source_dataset IN ({placeholders})"

    with connection.cursor() as cursor:
        cursor.execute(query, source_values)
        rows = cursor.fetchall()
    return {int(row[0]) for row in rows}


def _dataset_scoped_attempts(user, *, assessment_type: str | None = None):
    attempts = UserAttempt.objects.filter(user=user)
    if assessment_type:
        attempts = attempts.filter(assessment_type=assessment_type)

    allowed_ids = _allowed_report_scenario_ids()
    if allowed_ids is not None:
        if not allowed_ids:
            return []
        attempts = attempts.filter(scenario_id__in=allowed_ids)

    return list(attempts.select_related("scenario").order_by("timestamp"))


def _report_attempts(user):
    practice_attempts = _dataset_scoped_attempts(user, assessment_type="practice")
    if practice_attempts:
        return practice_attempts
    return _dataset_scoped_attempts(user)


def _sessionize_attempts(attempts, *, gap_minutes: int = 20):
    sessions = []
    current_session = []

    for attempt in attempts:
        if not current_session:
            current_session.append(attempt)
            continue

        previous_attempt = current_session[-1]
        if (attempt.timestamp - previous_attempt.timestamp) > timedelta(minutes=gap_minutes):
            sessions.append(current_session)
            current_session = [attempt]
        else:
            current_session.append(attempt)

    if current_session:
        sessions.append(current_session)

    return sessions


def _dominant_session_difficulty_label(session_attempts):
    counter = Counter()
    for attempt in session_attempts:
        attempt_difficulty = (attempt.attempted_difficulty or attempt.scenario.difficulty or "easy").lower()
        counter.update([attempt_difficulty if attempt_difficulty in DIFFICULTY_LEVELS else "easy"])

    dominant = counter.most_common(1)[0][0] if counter else "easy"
    return _difficulty_to_skill_label(dominant)


def _weakness_categories_for_attempt(attempt):
    categories = set()

    for raw_type in attempt.mistake_types or []:
        token = str(raw_type or "").strip().lower()
        if not token:
            continue

        if token == "false_positive":
            categories.add("false_positive")
        elif token == "over_suspicious":
            categories.add("over_suspicious")

        if token == "urgency" or "urgent" in token:
            categories.add("urgency")

        if token in {"links", "url", "url_tricks", "suspicious_links"} or "url" in token or "link" in token:
            categories.add("url_tricks")

    return categories


def _build_report_stats(user):
    attempts = _report_attempts(user)
    sessions = _sessionize_attempts(attempts, gap_minutes=20)

    skill_distribution = {
        "beginner": 0,
        "intermediate": 0,
        "advanced": 0,
    }
    anomaly_breakdown = {
        "random_clicking": 0,
        "sudden_drop": 0,
        "repeated_weakness": 0,
    }
    weakness_categories = {
        "urgency": 0,
        "false_positive": 0,
        "over_suspicious": 0,
        "url_tricks": 0,
    }

    response_time_buckets = {
        "beginner": [],
        "intermediate": [],
        "advanced": [],
    }
    for attempt in attempts:
        difficulty_label = _difficulty_to_skill_label(attempt.attempted_difficulty or attempt.scenario.difficulty)
        response_time_buckets[difficulty_label].append(float(attempt.response_time))

    weakness_counter = Counter()
    for attempt in attempts:
        weakness_counter.update(attempt.mistake_types or [])
    repeated_weakness_types = {key for key, count in weakness_counter.items() if count >= 2}

    accuracy_over_sessions = []
    difficulty_progression = []
    trend_rows = []
    anomaly_rows = []
    previous_session_accuracy = None

    for session_index, session_attempts in enumerate(sessions, start=1):
        session_total = len(session_attempts)
        session_correct = sum(1 for item in session_attempts if item.is_correct)
        session_accuracy = session_correct / max(session_total, 1)

        difficulty_label = _dominant_session_difficulty_label(session_attempts)
        skill_distribution[difficulty_label] += 1

        accuracy_over_sessions.append(
            {
                "session": session_index,
                "accuracy": round(float(session_accuracy), 4),
            }
        )
        difficulty_progression.append(
            {
                "session": session_index,
                "difficulty": difficulty_label,
            }
        )

        random_clicking = False
        for idx in range(1, len(session_attempts)):
            current = session_attempts[idx]
            previous = session_attempts[idx - 1]
            if current.response_time <= 3.5 and current.user_answer != previous.user_answer:
                random_clicking = True
                break

        sudden_drop = bool(
            previous_session_accuracy is not None and (previous_session_accuracy - session_accuracy) >= 0.3
        )
        previous_session_accuracy = session_accuracy

        repeated_weakness = any(
            (attempt.mistake_types and any(item in repeated_weakness_types for item in attempt.mistake_types))
            for attempt in session_attempts
        )

        reasons = []
        if random_clicking:
            anomaly_breakdown["random_clicking"] += 1
            reasons.append("random clicking")
        if sudden_drop:
            anomaly_breakdown["sudden_drop"] += 1
            reasons.append("sudden drop")
        if repeated_weakness:
            anomaly_breakdown["repeated_weakness"] += 1
            reasons.append("repeated weakness")

        anomaly_flagged = bool(reasons)
        trend_rows.append(
            {
                "session_number": session_index,
                "accuracy_pct": round(float(session_accuracy) * 100.0, 2),
                "difficulty": difficulty_label,
                "anomaly_flagged": anomaly_flagged,
            }
        )

        if anomaly_flagged:
            anomaly_rows.append(
                {
                    "session_number": session_index,
                    "reason": " / ".join(reasons),
                }
            )

    total_incorrect_errors = 0
    for attempt in attempts:
        if attempt.is_correct:
            continue

        total_incorrect_errors += 1
        for category in _weakness_categories_for_attempt(attempt):
            weakness_categories[category] += 1

    weakness_breakdown_rows = []
    for category in ["urgency", "false_positive", "over_suspicious", "url_tricks"]:
        count = int(weakness_categories[category])
        pct_of_errors = round((count / max(total_incorrect_errors, 1)) * 100.0, 2) if total_incorrect_errors else 0.0
        weakness_breakdown_rows.append(
            {
                "category": category,
                "count": count,
                "pct_of_errors": pct_of_errors,
            }
        )

    avg_response_time_by_difficulty = {}
    for label in ["beginner", "intermediate", "advanced"]:
        values = response_time_buckets[label]
        avg_response_time_by_difficulty[label] = round(sum(values) / len(values), 2) if values else 0.0

    stats_payload = {
        "skill_distribution": skill_distribution,
        "accuracy_over_sessions": accuracy_over_sessions,
        "anomaly_breakdown": anomaly_breakdown,
        "difficulty_progression": difficulty_progression,
        "avg_response_time_by_difficulty": avg_response_time_by_difficulty,
        "weakness_categories": weakness_categories,
    }

    return {
        "stats_payload": stats_payload,
        "total_sessions": len(sessions),
        "trend_rows": trend_rows,
        "anomaly_rows": anomaly_rows,
        "weakness_breakdown_rows": weakness_breakdown_rows,
    }


def _compute_recent_trend(user, *, window_size: int = 5):
    attempts = list(
        UserAttempt.objects.filter(user=user, assessment_type="practice")
        .order_by("-timestamp")[: window_size * 2]
    )

    if len(attempts) < window_size + 1:
        return {
            "trend_status": "stable",
            "accuracy_delta_pct": 0.0,
            "response_time_delta": 0.0,
        }

    recent = attempts[:window_size]
    prev = attempts[window_size : window_size * 2]

    def stats(items):
        n = len(items)
        if n == 0:
            return 0.0, 0.0
        acc = sum(1 for a in items if a.is_correct) / n
        rt = sum(float(a.response_time) for a in items) / n
        return float(acc), float(rt)

    recent_acc, recent_rt = stats(recent)
    prev_acc, prev_rt = stats(prev)

    delta_acc = recent_acc - prev_acc
    delta_rt = prev_rt - recent_rt  # positive means faster

    trend_status = "stable"
    if delta_acc >= 0.15:
        trend_status = "improving"
    elif delta_acc <= -0.15:
        trend_status = "declining"

    return {
        "trend_status": trend_status,
        "accuracy_delta_pct": round(delta_acc * 100.0, 2),
        "response_time_delta": round(float(delta_rt), 2),
    }


def _update_state(user, profile_skill_level: str, *, latest_results=None, force_bump: bool = False):
    state, _ = AdaptiveLearningState.objects.get_or_create(
        user=user,
        defaults={"current_difficulty": _base_difficulty(profile_skill_level)},
    )

    for result in (latest_results or []):
        if result:
            state.correct_streak += 1
            state.incorrect_streak = 0
        else:
            state.incorrect_streak += 1
            state.correct_streak = 0

    trend = _compute_recent_trend(user, window_size=5)
    state.trend_status = trend["trend_status"]
    state.accuracy_delta = trend["accuracy_delta_pct"]
    state.response_time_delta = trend["response_time_delta"]

    base_index = _difficulty_index(_base_difficulty(profile_skill_level))
    current_index = _difficulty_index(state.current_difficulty)

    shift = 0
    if state.trend_status == "improving":
        shift += 1
    elif state.trend_status == "declining":
        shift -= 1

    if state.correct_streak >= 3:
        shift += 1
    if state.incorrect_streak >= 2:
        shift -= 1
    if force_bump:
        shift += 1

    target_index = max(0, min(len(DIFFICULTY_LEVELS) - 1, base_index + shift))

    # Avoid large oscillations; move at most 1 step per update.
    if target_index > current_index:
        target_index = current_index + 1
    elif target_index < current_index:
        target_index = current_index - 1

    state.current_difficulty = _clamp_difficulty(target_index)
    state.last_feedback = "Adaptive engine updated difficulty based on your recent performance."
    state.save()

    return state, trend


def pick_practice_scenario(*, user, difficulty: str, exclude_ids=None):
    exclude_ids = exclude_ids or []
    queryset = PhishingScenario.objects.filter(difficulty=difficulty).exclude(id__in=exclude_ids)
    scenario = queryset.order_by("?").first()
    if scenario is not None:
        return scenario

    # Fallback: if pool exhausted at target difficulty, allow any difficulty.
    return PhishingScenario.objects.exclude(id__in=exclude_ids).order_by("?").first()


def log_session_feedback(*args, **kwargs):
    # This project version does not persist sessions; kept for API compatibility.
    return None
from .serializers import (
    AuthOkResponseSerializer,
    BaselineQuizResponseSerializer,
    CsrfResponseSerializer,
    DashboardResponseSerializer,
    EmailDetectRequestSerializer,
    EmailDetectResponseSerializer,
    LeaderboardResponseSerializer,
    MeResponseSerializer,
    MethodologyResponseSerializer,
    PracticeGetResponseSerializer,
    PracticeSubmitRequestSerializer,
    PracticeSubmitResponseSerializer,
    QuizSubmitNormalizedRequestSerializer,
    QuizSubmitResponseSerializer,
    ReportStatsResponseSerializer,
    RegisterRequestSerializer,
    ResetProgressResponseSerializer,
    ScenarioSerializer,
    SessionFeedbackResponseSerializer,
)


TARGETED_MODULE_MAP = {
    "urgency": "Urgency Resistance Module",
    "sender": "Sender Verification Module",
    "links": "Safe Link Inspection Module",
    "attachments": "Attachment Risk Module",
    "grammar": "Language Quality Module",
    "false_positive": "Decision Calibration Module",
    "over_suspicious": "Trust Calibration Module",
    "classification_error": "Phishing Pattern Fundamentals",
}


def _tokens_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def _baseline_attempts_count(user):
    return UserAttempt.objects.filter(user=user, assessment_type="baseline").count()


def _baseline_completed(user):
    return _baseline_attempts_count(user) >= 10


def _mistake_types_for_attempt(scenario, user_answer, is_correct):
    if is_correct:
        return []
    if scenario.is_phishing and not user_answer:
        return scenario.get_indicators()
    if (not scenario.is_phishing) and user_answer:
        return ["false_positive", "over_suspicious"]
    return ["classification_error"]


def _baseline_scenarios():
    difficulty_targets = [("easy", 4), ("medium", 3), ("hard", 3)]
    selected_ids = set()
    selected = []

    for difficulty, required_count in difficulty_targets:
        subset = list(PhishingScenario.objects.filter(difficulty=difficulty).order_by("?")[:required_count])
        for scenario in subset:
            if scenario.id not in selected_ids:
                selected.append(scenario)
                selected_ids.add(scenario.id)

    if len(selected) < 10:
        fallback = PhishingScenario.objects.exclude(id__in=selected_ids).order_by("?")[: 10 - len(selected)]
        selected.extend(list(fallback))

    return selected[:10]


def _persist_behavioral_record(user, source, attempts_meta):
    if not attempts_meta:
        return None

    sample_count = len(attempts_meta)
    correct_count = sum(1 for attempt in attempts_meta if attempt["is_correct"])
    avg_response_time = sum(attempt["response_time"] for attempt in attempts_meta) / sample_count

    mistake_counter = Counter()
    difficulty_counter = Counter()
    for attempt in attempts_meta:
        difficulty_counter.update([attempt["difficulty"]])
        mistake_counter.update(attempt["mistake_types"])

    return BehavioralDatasetRecord.objects.create(
        user=user,
        source=source,
        sample_count=sample_count,
        accuracy=round((correct_count / sample_count) * 100, 2),
        avg_response_time=round(float(avg_response_time), 2),
        mistake_type_counts=dict(mistake_counter),
        difficulty_distribution=dict(difficulty_counter),
    )


def _anomaly_personalization_analysis(user):
    attempts = list(
        UserAttempt.objects.filter(user=user).select_related("scenario").order_by("-timestamp")[:20]
    )
    if not attempts:
        return {
            "isolation_anomaly": False,
            "random_clicking": False,
            "sudden_drop": False,
            "repeated_weaknesses": [],
            "fast_click_ratio": 0.0,
            "answer_switch_rate": 0.0,
            "recent_accuracy": 0.0,
            "previous_accuracy": 0.0,
            "consistency_score": 0.6,
            "recommended_modules": [],
        }

    ordered = list(reversed(attempts))
    fast_click_ratio = sum(1 for item in attempts if item.response_time <= 3.5) / len(attempts)

    switches = 0
    for index in range(1, len(ordered)):
        if ordered[index].user_answer != ordered[index - 1].user_answer:
            switches += 1
    answer_switch_rate = switches / max(len(ordered) - 1, 1)
    random_clicking = len(attempts) >= 10 and fast_click_ratio >= 0.6 and answer_switch_rate >= 0.7

    midpoint = max(len(attempts) // 2, 1)
    recent = attempts[:midpoint]
    previous = attempts[midpoint:]
    recent_accuracy = sum(1 for item in recent if item.is_correct) / max(len(recent), 1)
    previous_accuracy = sum(1 for item in previous if item.is_correct) / max(len(previous), 1)
    sudden_drop = len(recent) >= 4 and len(previous) >= 4 and (previous_accuracy - recent_accuracy) >= 0.3

    weakness_counter = Counter()
    for item in attempts:
        if item.mistake_types:
            weakness_counter.update(item.mistake_types)
    repeated_weaknesses = [
        {"type": key, "count": int(count)}
        for key, count in weakness_counter.most_common(4)
        if count >= 2
    ]

    correctness = [1 if item.is_correct else 0 for item in attempts]
    mean_correctness = sum(correctness) / max(len(correctness), 1)
    variance = sum((value - mean_correctness) ** 2 for value in correctness) / max(len(correctness), 1)
    consistency_score = max(0.0, min(1.0, 1.0 - (2 * variance)))

    # Note: we intentionally avoid calling the ML anomaly detector here to keep this endpoint lightweight.
    isolation_anomaly = False

    recommended_modules = []
    seen_modules = set()
    for weakness in repeated_weaknesses:
        module_name = TARGETED_MODULE_MAP.get(weakness["type"], "General Phishing Defense Module")
        if module_name not in seen_modules:
            recommended_modules.append(
                {
                    "module": module_name,
                    "reason": f"Repeated weakness in {weakness['type']} ({weakness['count']} times)",
                }
            )
            seen_modules.add(module_name)

    if random_clicking and "Decision Calibration Module" not in seen_modules:
        recommended_modules.append(
            {
                "module": "Decision Calibration Module",
                "reason": "Random-clicking pattern detected from fast and inconsistent responses",
            }
        )
    if sudden_drop and "Performance Recovery Module" not in seen_modules:
        recommended_modules.append(
            {
                "module": "Performance Recovery Module",
                "reason": "Sudden accuracy drop detected across recent attempts",
            }
        )

    return {
        "isolation_anomaly": isolation_anomaly,
        "random_clicking": random_clicking,
        "sudden_drop": sudden_drop,
        "repeated_weaknesses": repeated_weaknesses,
        "fast_click_ratio": round(fast_click_ratio * 100, 2),
        "answer_switch_rate": round(answer_switch_rate * 100, 2),
        "recent_accuracy": round(recent_accuracy * 100, 2),
        "previous_accuracy": round(previous_accuracy * 100, 2),
        "consistency_score": round(consistency_score, 4),
        "recommended_modules": recommended_modules[:3],
    }


def _refresh_recommendations(user, profile):
    recent_attempts = UserAttempt.objects.filter(user=user).order_by("-timestamp")[:10]
    recs = get_recommendations(profile, recent_attempts)
    anomaly_analysis = _anomaly_personalization_analysis(user)

    personalized_recs = []
    if anomaly_analysis["random_clicking"]:
        personalized_recs.append(
            {
                "weakness": "Behavioral Risk: Random Clicking",
                "tip": "Pause-before-click protocol enabled. Complete the Decision Calibration Module before next hard scenario.",
            }
        )
    if anomaly_analysis["sudden_drop"]:
        personalized_recs.append(
            {
                "weakness": "Performance Drop Detected",
                "tip": "Recent performance declined. Recommended: Performance Recovery Module with medium-difficulty retraining.",
            }
        )
    for module_item in anomaly_analysis["recommended_modules"]:
        personalized_recs.append(
            {
                "weakness": f"Targeted Module: {module_item['module']}",
                "tip": module_item["reason"],
            }
        )

    merged_recs = personalized_recs + recs
    TrainingRecommendation.objects.filter(user=user, is_read=False).delete()
    for rec in merged_recs[:5]:
        TrainingRecommendation.objects.create(
            user=user,
            weakness_type=rec["weakness"],
            recommendation=rec["tip"],
        )


def _update_adaptive_learning_state(user, profile_skill_level, latest_results=None, force_bump=False):
    state, _trend = _update_state(
        user=user,
        profile_skill_level=profile_skill_level,
        latest_results=latest_results,
        force_bump=force_bump,
    )
    return state


def _next_difficulty_for_user(user, profile_skill_level):
    state, _ = AdaptiveLearningState.objects.get_or_create(
        user=user,
        defaults={"current_difficulty": _base_difficulty(profile_skill_level)},
    )
    return state.current_difficulty


def _profile_payload(profile):
    feature_snapshot = extract_user_performance_features(profile.user)
    return {
        "skill_level": profile.skill_level,
        "accuracy": float(round(profile.accuracy(), 2)),
        "total_attempts": int(profile.total_attempts),
        "correct_answers": int(profile.correct_answers),
        "avg_response_time": float(round(profile.avg_response_time, 2)),
        "is_anomalous": bool(profile.is_anomalous),
        "performance_features": {
            "hard_accuracy": round(feature_snapshot["hard_accuracy"] * 100, 2),
            "medium_accuracy": round(feature_snapshot["medium_accuracy"] * 100, 2),
            "false_positive_rate": round(feature_snapshot["false_positive_rate"] * 100, 2),
            "false_negative_rate": round(feature_snapshot["false_negative_rate"] * 100, 2),
            "baseline_accuracy": round(feature_snapshot["baseline_accuracy"] * 100, 2),
            "practice_accuracy": round(feature_snapshot["practice_accuracy"] * 100, 2),
        },
    }


def _update_profile_ml(profile):
    # Prefer the profile-model (trained from BehavioralDatasetRecord) if available.
    result = classify_user_with_profile_model(profile.user, retrain_threshold=1_000_000)
    if result is not None:
        skill_label, confidence, _ = result
        profile.skill_level = skill_label
        profile.save(update_fields=["skill_level", "last_updated"])
        return float(confidence)

    # Fallback: no profile model available yet.
    feature_dict = extract_user_performance_features(profile.user)
    from ml_engine.kaggle_trainer import classify_user_skill  # local import to avoid circular import

    skill_label, confidence = classify_user_skill(
        feature_dict["accuracy"],
        profile.avg_response_time,
        profile.total_attempts,
        feature_dict["hard_accuracy"],
        feature_dict["medium_accuracy"],
    )
    profile.skill_level = skill_label
    profile.save(update_fields=["skill_level", "last_updated"])
    return float(confidence)


def _refresh_anomaly_flag(profile):
    anomaly_analysis = _anomaly_personalization_analysis(profile.user)
    anomaly_signal_count = int(anomaly_analysis["isolation_anomaly"]) + int(anomaly_analysis["random_clicking"]) + int(
        anomaly_analysis["sudden_drop"]
    )
    enough_history = profile.total_attempts >= 10
    fresh_flag = bool(enough_history and anomaly_signal_count >= 2)
    if profile.is_anomalous != fresh_flag:
        profile.is_anomalous = fresh_flag
        profile.save(update_fields=["is_anomalous", "last_updated"])


def _scenario_dict(scenario: PhishingScenario) -> dict:
    return ScenarioSerializer(
        {
            "id": scenario.id,
            "title": scenario.title,
            "sender_email": scenario.sender_email,
            "subject": scenario.subject,
            "body": scenario.get_display_body(),
            "difficulty": scenario.difficulty,
        }
    ).data


def _anomaly_reason(anomaly_analysis: dict) -> str:
    if anomaly_analysis.get("random_clicking"):
        return "Random-clicking pattern detected (fast + inconsistent responses)."
    if anomaly_analysis.get("sudden_drop"):
        return "Sudden accuracy drop detected across recent attempts."
    if anomaly_analysis.get("isolation_anomaly"):
        return "IsolationForest anomaly signal detected from behavior features."

    repeated = anomaly_analysis.get("repeated_weaknesses") or []
    if repeated:
        types = ", ".join(sorted({item.get("type") for item in repeated if item.get("type")}))
        return f"Repeated weaknesses detected: {types}."

    return ""


def _weakness_pattern_summary(anomaly_analysis: dict) -> str:
    repeated = anomaly_analysis.get("repeated_weaknesses") or []
    if not repeated:
        return ""

    segments = []
    for item in repeated[:3]:
        weakness_type = (item or {}).get("type")
        weakness_count = int((item or {}).get("count", 0))
        if weakness_type:
            segments.append(f"{weakness_type} ({weakness_count}x)")

    if not segments:
        return ""
    return f"Weakness pattern: {', '.join(segments)}"


def _recent_session_accuracy_points(user, *, limit: int = 5, gap_minutes: int = 20):
    attempts = list(
        UserAttempt.objects.filter(user=user, assessment_type="practice")
        .order_by("timestamp")
    )

    if not attempts:
        attempts = list(UserAttempt.objects.filter(user=user).order_by("timestamp"))
    if not attempts:
        return []

    sessions = []
    current_session = []

    for attempt in attempts:
        if not current_session:
            current_session.append(attempt)
            continue

        previous = current_session[-1]
        if (attempt.timestamp - previous.timestamp) > timedelta(minutes=gap_minutes):
            sessions.append(current_session)
            current_session = [attempt]
        else:
            current_session.append(attempt)

    if current_session:
        sessions.append(current_session)

    points = []
    for idx, session_attempts in enumerate(sessions, start=1):
        session_total = len(session_attempts)
        session_correct = sum(1 for item in session_attempts if item.is_correct)
        session_accuracy = round((session_correct / max(session_total, 1)) * 100.0, 2)
        points.append(
            {
                "session_number": idx,
                "accuracy_pct": session_accuracy,
            }
        )

    return points[-limit:]


def _build_session_analytics(user):
    attempts = list(
        UserAttempt.objects.filter(user=user, assessment_type="practice")
        .select_related("scenario")
        .order_by("timestamp")
    )

    weakness_counter = Counter()
    for item in attempts:
        weakness_counter.update(item.mistake_types or [])
    repeated_weakness_types = {key for key, count in weakness_counter.items() if count >= 2}

    trend_rows = []
    anomaly_rows = []
    running_correct = 0

    for idx, item in enumerate(attempts, start=1):
        if item.is_correct:
            running_correct += 1
        running_accuracy = round((running_correct / idx) * 100.0, 2)

        random_clicking = False
        if idx > 1:
            previous_item = attempts[idx - 2]
            random_clicking = bool(item.response_time <= 3.5 and item.user_answer != previous_item.user_answer)

        sudden_drop = False
        if idx >= 6:
            previous_window = attempts[idx - 6 : idx - 3]
            recent_window = attempts[idx - 3 : idx]
            previous_accuracy = sum(1 for val in previous_window if val.is_correct) / max(len(previous_window), 1)
            recent_accuracy = sum(1 for val in recent_window if val.is_correct) / max(len(recent_window), 1)
            sudden_drop = bool((previous_accuracy - recent_accuracy) >= 0.3)

        repeated_weakness = bool(
            item.mistake_types and any(mt in repeated_weakness_types for mt in item.mistake_types)
        )

        reasons = []
        if random_clicking:
            reasons.append("random clicking")
        if sudden_drop:
            reasons.append("sudden drop")
        if repeated_weakness:
            reasons.append("repeated weakness")

        anomaly_flag = bool(reasons)
        anomaly_reason = " / ".join(reasons)
        difficulty = item.attempted_difficulty or item.scenario.difficulty

        trend_rows.append(
            {
                "session_number": idx,
                "accuracy_pct": running_accuracy,
                "difficulty": difficulty,
                "anomaly_flagged": anomaly_flag,
            }
        )

        if anomaly_flag:
            anomaly_rows.append(
                {
                    "session_number": idx,
                    "reason": anomaly_reason,
                }
            )

    top_weaknesses = [
        {
            "category": category,
            "count": int(count),
        }
        for category, count in weakness_counter.most_common(3)
    ]

    return {
        "total_sessions": len(attempts),
        "trend_rows": trend_rows,
        "anomaly_rows": anomaly_rows,
        "top_weaknesses": top_weaknesses,
    }


def _collect_report_recommendations(user, anomaly_analysis):
    module_rows = anomaly_analysis.get("recommended_modules") or []
    recommendations = [
        f"{item.get('module', 'Module')}: {item.get('reason', '').strip()}"
        for item in module_rows
        if item.get("module") and item.get("reason")
    ]

    if recommendations:
        return recommendations[:5]

    fallback = list(
        TrainingRecommendation.objects.filter(user=user)
        .order_by("-created_at")
        .values("weakness_type", "recommendation")[:5]
    )
    return [f"{item['weakness_type']}: {item['recommendation']}" for item in fallback]


def _table_style():
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )


def _build_user_performance_pdf(
    *,
    username,
    generated_on,
    skill_label,
    confidence_score,
    total_sessions,
    trend_rows,
    anomaly_rows,
    weakness_breakdown_rows,
    recommendations,
):
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontSize=18, leading=22, alignment=1)
    section_style = ParagraphStyle("SectionHeader", parent=styles["Heading2"], fontSize=12, leading=14, spaceAfter=6)
    body_style = ParagraphStyle("BodyTextSmall", parent=styles["BodyText"], fontSize=10, leading=13)

    story = []

    # Cover
    story.append(Paragraph("Dayananda Sagar University", styles["Heading3"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("PhishGuard AI — Performance Report", title_style))
    story.append(Spacer(1, 0.18 * inch))
    story.append(Paragraph(f"Username: {xml_escape(str(username))}", body_style))
    story.append(Paragraph(f"Date Generated: {xml_escape(str(generated_on))}", body_style))
    story.append(Spacer(1, 0.14 * inch))
    story.append(Paragraph("Datasets In Use", section_style))
    for idx, source in enumerate(REPORT_DATASET_SOURCES, start=1):
        story.append(Paragraph(f"{idx}. {xml_escape(source)}", body_style))
    story.append(Spacer(1, 0.22 * inch))

    # Skill Profile
    story.append(Paragraph("Section 1: Skill Profile", section_style))
    story.append(Paragraph(f"Classification Label: {xml_escape(str(skill_label))}", body_style))
    story.append(Paragraph(f"Confidence Score: {round(float(confidence_score), 4)}", body_style))
    story.append(Paragraph(f"Total Sessions Completed: {total_sessions}", body_style))
    story.append(Spacer(1, 0.2 * inch))

    # Accuracy Trend
    story.append(Paragraph("Section 2: Accuracy Trend", section_style))
    trend_table_data = [["Session #", "Accuracy %", "Difficulty", "Anomaly Flagged"]]
    for row in trend_rows[-10:]:
        trend_table_data.append(
            [
                str(row["session_number"]),
                f"{row['accuracy_pct']:.2f}",
                str(row["difficulty"]).title(),
                "Yes" if row["anomaly_flagged"] else "No",
            ]
        )

    if len(trend_table_data) == 1:
        trend_table_data.append(["-", "-", "-", "No data"])

    trend_table = Table(trend_table_data, colWidths=[0.9 * inch, 1.15 * inch, 1.15 * inch, 1.35 * inch])
    trend_table.setStyle(_table_style())
    story.append(trend_table)
    story.append(Spacer(1, 0.2 * inch))

    # Anomaly Log
    story.append(Paragraph("Section 3: Anomaly Log", section_style))
    anomaly_table_data = [["Session #", "Reason"]]
    for row in anomaly_rows:
        anomaly_table_data.append([str(row["session_number"]), row["reason"]])

    if len(anomaly_table_data) == 1:
        anomaly_table_data.append(["-", "No anomalies flagged"])

    anomaly_table = Table(anomaly_table_data, colWidths=[0.9 * inch, 4.2 * inch])
    anomaly_table.setStyle(_table_style())
    story.append(anomaly_table)
    story.append(Spacer(1, 0.2 * inch))

    # Weakness Analysis
    story.append(Paragraph("Section 4: Weakness Breakdown", section_style))
    weakness_table_data = [["Category", "Count", "% of Errors"]]
    for row in weakness_breakdown_rows:
        weakness_table_data.append([str(row["category"]), str(row["count"]), f"{row['pct_of_errors']:.2f}%"])

    if len(weakness_table_data) == 1:
        weakness_table_data.append(["No repeated categories", "0", "0.00%"])

    weakness_table = Table(weakness_table_data, colWidths=[2.6 * inch, 1.3 * inch, 1.2 * inch])
    weakness_table.setStyle(_table_style())
    story.append(weakness_table)
    story.append(Spacer(1, 0.2 * inch))

    # Recommendations
    story.append(Paragraph("Section 5: Recommended Modules", section_style))
    if recommendations:
        for idx, item in enumerate(recommendations, start=1):
            story.append(Paragraph(f"{idx}. {xml_escape(str(item))}", body_style))
    else:
        story.append(Paragraph("No recommendations available yet. Complete more sessions for adaptive guidance.", body_style))

    document.build(story)
    value = buffer.getvalue()
    buffer.close()
    return value


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    payload = {"ok": True}
    return Response(CsrfResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([FormParser, MultiPartParser, JSONParser])
def register(request):
    serializer = RegisterRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    email = (serializer.validated_data.get("email") or "").strip().lower()
    password = serializer.validated_data["password1"]

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if email and User.objects.filter(email__iexact=email).exists():
        return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    payload = {
        "ok": True,
        "username": user.username,
        "user_id": user.id,
        "tokens": _tokens_for_user(user),
    }
    return Response(AuthOkResponseSerializer(payload).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([FormParser, MultiPartParser, JSONParser])
def login_view(request):
    from .serializers import LoginRequestSerializer

    serializer = LoginRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    credential = serializer.validated_data["username"].strip()
    password = serializer.validated_data["password"]

    username = credential
    resolved_user = None
    if "@" in credential:
        resolved_user = User.objects.filter(email__iexact=credential).first()
        if resolved_user:
            username = resolved_user.username

    user = authenticate(request, username=username, password=password)
    if not user:
        # Some deployments can return None from authenticate() despite valid local
        # credentials. Fall back to an explicit password check against the
        # resolved user to keep username/email login reliable.
        if resolved_user is None:
            resolved_user = User.objects.filter(username=username).first()
        if resolved_user and resolved_user.is_active and resolved_user.check_password(password):
            user = resolved_user

    if not user:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

    payload = {
        "ok": True,
        "username": user.username,
        "user_id": user.id,
        "tokens": _tokens_for_user(user),
    }
    return Response(AuthOkResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Stateless JWT: client should delete tokens. (Blacklist support can be added if desired.)
    payload = {"ok": True}
    return Response(AuthOkResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_progress(request):
    with transaction.atomic():
        UserAttempt.objects.filter(user=request.user).delete()
        BehavioralDatasetRecord.objects.filter(user=request.user).delete()
        TrainingRecommendation.objects.filter(user=request.user).delete()
        AdaptiveLearningState.objects.filter(user=request.user).delete()

        profile = request.user.userprofile
        profile.skill_level = "beginner"
        profile.total_attempts = 0
        profile.correct_answers = 0
        profile.avg_response_time = 0.0
        profile.is_anomalous = False
        profile.save()

    payload = {
        "ok": True,
        "message": "Progress reset successfully. Start with the 10-question baseline quiz.",
        "baseline_required": True,
    }
    return Response(ResetProgressResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    profile = request.user.userprofile
    payload = {
        "id": request.user.id,
        "username": request.user.username,
        "baseline_attempts": _baseline_attempts_count(request.user),
        "baseline_completed": _baseline_completed(request.user),
        "profile": _profile_payload(profile),
    }
    return Response(MeResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def baseline_quiz(request):
    if _baseline_completed(request.user):
        payload = {
            "completed": True,
            "message": "Baseline already completed. Continue with adaptive practice.",
        }
        return Response(BaselineQuizResponseSerializer(payload).data)

    scenarios = _baseline_scenarios()
    if len(scenarios) < 10:
        return Response(
            {"error": "At least 10 scenarios are required for baseline quiz."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = {"completed": False, "scenarios": [_scenario_dict(s) for s in scenarios]}
    return Response(BaselineQuizResponseSerializer(payload).data)


def _normalize_quiz_submit_payload(data):
    # Frontend sends x-www-form-urlencoded with scenario_ids[] + dynamic answer_{id}/time_{id}.
    scenario_ids = data.getlist("scenario_ids[]") if hasattr(data, "getlist") else data.get("scenario_ids")
    if scenario_ids is None:
        scenario_ids = []

    ids = [int(x) for x in scenario_ids]

    answers = {}
    times = {}
    for scenario_id in ids:
        answers[str(scenario_id)] = data.get(f"answer_{scenario_id}")
        if data.get(f"time_{scenario_id}") is not None:
            times[str(scenario_id)] = float(data.get(f"time_{scenario_id}") or 30)

    return {"scenario_ids": ids, "answers": answers, "times": times}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([FormParser, MultiPartParser, JSONParser])
def submit_quiz(request):
    if _baseline_completed(request.user):
        return Response({"error": "Baseline quiz already completed."}, status=status.HTTP_400_BAD_REQUEST)

    normalized = _normalize_quiz_submit_payload(request.data)
    serializer = QuizSubmitNormalizedRequestSerializer(data=normalized)
    serializer.is_valid(raise_exception=True)

    scenario_ids = serializer.validated_data["scenario_ids"]
    answers = serializer.validated_data["answers"]
    times = serializer.validated_data.get("times") or {}

    scenarios = list(PhishingScenario.objects.filter(id__in=scenario_ids))
    if len(scenarios) != 10:
        return Response({"error": "Invalid scenario_ids submitted."}, status=status.HTTP_400_BAD_REQUEST)

    attempts = []
    attempts_meta = []
    correct_count = 0

    # Ensure stable ordering for attempt processing.
    scenarios_by_id = {s.id: s for s in scenarios}
    ordered_scenarios = [scenarios_by_id[sid] for sid in scenario_ids if sid in scenarios_by_id]

    for scenario in ordered_scenarios:
        answer_raw = answers.get(str(scenario.id))
        if answer_raw not in {"phishing", "legitimate"}:
            return Response({"error": "Answer all 10 baseline scenarios before submitting."}, status=status.HTTP_400_BAD_REQUEST)

        user_answer = answer_raw == "phishing"
        is_correct = user_answer == scenario.is_phishing
        response_time = float(times.get(str(scenario.id), 30))
        mistake_types = _mistake_types_for_attempt(scenario, user_answer, is_correct)

        if is_correct:
            correct_count += 1

        attempts.append(
            UserAttempt(
                user=request.user,
                scenario=scenario,
                user_answer=user_answer,
                is_correct=is_correct,
                response_time=response_time,
                assessment_type="baseline",
                attempted_difficulty=scenario.difficulty,
                mistake_types=mistake_types,
                confidence_score=0.5,
            )
        )
        attempts_meta.append(
            {
                "is_correct": is_correct,
                "response_time": response_time,
                "mistake_types": mistake_types,
                "difficulty": scenario.difficulty,
            }
        )

    if len(attempts) != 10:
        return Response({"error": "Answer all 10 baseline scenarios before submitting."}, status=status.HTTP_400_BAD_REQUEST)

    UserAttempt.objects.bulk_create(attempts)

    profile = request.user.userprofile
    profile.total_attempts += len(attempts)
    profile.correct_answers += correct_count
    profile.avg_response_time = (
        UserAttempt.objects.filter(user=request.user).aggregate(avg=Avg("response_time"))["avg"] or 0
    )
    profile.save(update_fields=["total_attempts", "correct_answers", "avg_response_time", "last_updated"])

    confidence = _update_profile_ml(profile)
    behavioral_record = _persist_behavioral_record(request.user, "baseline", attempts_meta)
    _refresh_recommendations(request.user, profile)

    adaptive_state = _update_adaptive_learning_state(
        request.user,
        profile.skill_level,
        latest_results=[item["is_correct"] for item in attempts_meta],
    )

    payload = {
        "ok": True,
        "profile": _profile_payload(profile),
        "behavioral_record_id": behavioral_record.id if behavioral_record else None,
        "adaptive_feedback": adaptive_state.last_feedback,
        "next_difficulty": adaptive_state.current_difficulty,
        # legacy clients may still read from profile; confidence is returned on dashboard endpoint
    }
    return Response(QuizSubmitResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    profile = request.user.userprofile

    # Refresh anomaly flag using latest attempts.
    _refresh_anomaly_flag(profile)
    anomaly_analysis = _anomaly_personalization_analysis(request.user)

    # Skill confidence (from profile model when available).
    model_result = classify_user_with_profile_model(request.user, retrain_threshold=1_000_000)
    if model_result is not None:
        skill_label, confidence_score, _ = model_result
        if profile.skill_level != skill_label:
            profile.skill_level = skill_label
            profile.save(update_fields=["skill_level", "last_updated"])
    else:
        skill_label = profile.skill_level
        confidence_score = 0.5

    recent_accuracy_points = _recent_session_accuracy_points(request.user, limit=5, gap_minutes=20)
    recent_accuracy_trend = [float(point["accuracy_pct"]) for point in recent_accuracy_points]

    recommendations = list(
        TrainingRecommendation.objects.filter(user=request.user, is_read=False)
        .values("id", "weakness_type", "recommendation")[:3]
    )

    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:10]
    attempts = list(UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:20])
    correct_series = [1 if a.is_correct else 0 for a in reversed(attempts)]

    adaptive_state, _ = AdaptiveLearningState.objects.get_or_create(
        user=request.user,
        defaults={"current_difficulty": _base_difficulty(profile.skill_level)},
    )

    anomaly_reason = _anomaly_reason(anomaly_analysis)
    weakness_pattern = _weakness_pattern_summary(anomaly_analysis)

    recommended_modules = []
    for module_item in anomaly_analysis.get("recommended_modules", []):
        module_name = module_item.get("module")
        if not module_name:
            continue

        reason = str(module_item.get("reason") or "").strip()
        why_recommended = reason or anomaly_reason or weakness_pattern
        recommended_modules.append(
            {
                "module": module_name,
                "reason": reason,
                "why_recommended": why_recommended,
                "weakness_pattern": weakness_pattern,
            }
        )

    next_difficulty = adaptive_state.current_difficulty

    payload = {
        # Required fields
        "skill_label": skill_label,
        "confidence_score": float(round(confidence_score, 4)),
        "anomaly_flag": bool(profile.is_anomalous),
        "anomaly_reason": anomaly_reason,
        "recent_accuracy_trend": recent_accuracy_trend,
        "recent_accuracy_points": recent_accuracy_points,
        "recommended_modules": recommended_modules,
        "total_attempts": int(profile.total_attempts),
        "weakness_pattern": weakness_pattern,
        "recent_attempt_window": len(attempts),

        # Legacy payload (kept)
        "profile": _profile_payload(profile),
        "baseline_attempts": _baseline_attempts_count(request.user),
        "baseline_completed": _baseline_completed(request.user),
        "next_difficulty": next_difficulty,
        "anomaly_personalization": anomaly_analysis,
        "adaptive_engine": {
            "current_difficulty": adaptive_state.current_difficulty,
            "trend_status": adaptive_state.trend_status,
            "accuracy_delta": round(adaptive_state.accuracy_delta, 2),
            "response_time_delta": round(adaptive_state.response_time_delta, 2),
            "correct_streak": int(adaptive_state.correct_streak),
            "incorrect_streak": int(adaptive_state.incorrect_streak),
            "feedback": adaptive_state.last_feedback,
        },
        "correct_series": correct_series,
        "recent_attempts": [
            {
                "id": a.id,
                "title": a.scenario.title,
                "difficulty": a.scenario.difficulty,
                "is_correct": a.is_correct,
                "response_time": round(a.response_time, 2),
                "timestamp": a.timestamp.isoformat(),
            }
            for a in recent_attempts.select_related("scenario")
        ],
        "recommendations": recommendations,
    }

    return Response(DashboardResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_stats(request):
    report_data = _build_report_stats(request.user)
    payload = report_data["stats_payload"]
    return Response(ReportStatsResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def generate_report(request):
    profile = request.user.userprofile

    model_result = classify_user_with_profile_model(request.user, retrain_threshold=1_000_000)
    if model_result is not None:
        skill_label, confidence_score, _ = model_result
    else:
        skill_label = profile.skill_level
        confidence_score = 0.5

    report_data = _build_report_stats(request.user)
    anomaly_analysis = _anomaly_personalization_analysis(request.user)
    recommendations = _collect_report_recommendations(request.user, anomaly_analysis)

    generated_on = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M:%S")
    pdf_bytes = _build_user_performance_pdf(
        username=request.user.username,
        generated_on=generated_on,
        skill_label=skill_label,
        confidence_score=confidence_score,
        total_sessions=report_data["total_sessions"],
        trend_rows=report_data["trend_rows"],
        anomaly_rows=report_data["anomaly_rows"],
        weakness_breakdown_rows=report_data["weakness_breakdown_rows"],
        recommendations=recommendations,
    )

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    safe_user = slugify(request.user.username) or f"user-{request.user.id}"
    response["Content-Disposition"] = f'attachment; filename="phishguard_report_{safe_user}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def practice(request):
    profile = UserProfile.objects.filter(user=request.user).first()
    profile_skill = profile.skill_level if profile is not None else "beginner"

    requested_difficulty = request.GET.get("difficulty")
    if requested_difficulty in {"easy", "medium", "hard"}:
        difficulty = requested_difficulty
        assigned_by = "manual_override"
    else:
        difficulty = _next_difficulty_for_user(request.user, profile_skill)
        assigned_by = "adaptive_engine"

    seen_ids = list(UserAttempt.objects.filter(user=request.user).values_list("scenario_id", flat=True))
    scenario = pick_practice_scenario(user=request.user, difficulty=difficulty, exclude_ids=seen_ids)

    # If the user has exhausted the unseen pool, recycle scenarios rather than returning empty.
    if not scenario:
        scenario = pick_practice_scenario(user=request.user, difficulty=difficulty)

    if not scenario:
        return Response({"error": "No scenarios available"}, status=status.HTTP_404_NOT_FOUND)

    sender_value = (scenario.sender_email or "").strip() or "unknown@example.com"

    scenario_payload = {
        "id": scenario.id,
        "subject": scenario.subject,
        "sender": sender_value,
        "sender_email": sender_value,
        "body": scenario.get_display_body(),
        "difficulty": scenario.difficulty,
        "scenario_type": "phishing" if scenario.is_phishing else "legitimate",
    }
    payload = {"scenario": scenario_payload, "difficulty": difficulty, "assigned_by": assigned_by}
    return Response(PracticeGetResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([FormParser, MultiPartParser, JSONParser])
def submit_practice(request):
    serializer = PracticeSubmitRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    scenario_id = serializer.validated_data["scenario_id"]
    answer_raw = serializer.validated_data["answer"]
    response_time = float(serializer.validated_data.get("response_time", 30.0))

    scenario = PhishingScenario.objects.filter(id=scenario_id).first()
    if not scenario:
        return Response({"error": "Scenario not found"}, status=status.HTTP_404_NOT_FOUND)

    user_answer = answer_raw == "phishing"
    is_correct = user_answer == scenario.is_phishing
    mistake_types = _mistake_types_for_attempt(scenario, user_answer, is_correct)

    UserAttempt.objects.create(
        user=request.user,
        scenario=scenario,
        user_answer=user_answer,
        is_correct=is_correct,
        response_time=response_time,
        assessment_type="practice",
        attempted_difficulty=scenario.difficulty,
        mistake_types=mistake_types,
        confidence_score=0.7,
    )

    profile = request.user.userprofile
    profile.total_attempts += 1
    if is_correct:
        profile.correct_answers += 1
    profile.avg_response_time = (
        UserAttempt.objects.filter(user=request.user).aggregate(avg=Avg("response_time"))["avg"] or 0
    )
    profile.save(update_fields=["total_attempts", "correct_answers", "avg_response_time", "last_updated"])

    _update_profile_ml(profile)

    behavioral_record = _persist_behavioral_record(
        request.user,
        "practice",
        [
            {
                "is_correct": is_correct,
                "response_time": response_time,
                "mistake_types": mistake_types,
                "difficulty": scenario.difficulty,
            }
        ],
    )

    _refresh_recommendations(request.user, profile)

    adaptive_state = _update_adaptive_learning_state(
        request.user,
        profile.skill_level,
        latest_results=[is_correct],
    )

    _refresh_anomaly_flag(profile)

    payload = {
        "ok": True,
        "is_correct": is_correct,
        "scenario_is_phishing": bool(scenario.is_phishing),
        "indicators": scenario.get_indicators(),
        "profile": _profile_payload(profile),
        "scenario": _scenario_dict(scenario),
        "behavioral_record_id": behavioral_record.id if behavioral_record else None,
        "adaptive_feedback": adaptive_state.last_feedback,
        "next_difficulty": adaptive_state.current_difficulty,
        "anomaly_detected": bool(profile.is_anomalous),
    }

    return Response(PracticeSubmitResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def session_feedback(request):
    profile = request.user.userprofile
    session = log_session_feedback(user=request.user, profile_skill_level=profile.skill_level, session_type="practice")

    adaptive_state, _ = AdaptiveLearningState.objects.get_or_create(
        user=request.user,
        defaults={"current_difficulty": _base_difficulty(profile.skill_level)},
    )

    if not session:
        payload = {
            "ok": True,
            "message": "No new practice attempts to close into a session.",
            "adaptive_feedback": adaptive_state.last_feedback,
            "next_difficulty": adaptive_state.current_difficulty,
        }
        return Response(SessionFeedbackResponseSerializer(payload).data)

    payload = {
        "ok": True,
        "session": {
            "id": session.id,
            "session_type": session.session_type,
            "started_at": session.started_at.isoformat(),
            "ended_at": session.ended_at.isoformat(),
            "attempt_count": int(session.attempt_count),
            "correct_count": int(session.correct_count),
            "accuracy": float(session.accuracy),
            "avg_response_time": float(session.avg_response_time),
            "accuracy_delta": float(session.accuracy_delta),
            "response_time_delta": float(session.response_time_delta),
            "trend_status": session.trend_status,
            "plateau_detected": bool(session.plateau_detected),
            "adaptive_score": float(session.adaptive_score),
            "difficulty_before": session.difficulty_before,
            "difficulty_after": session.difficulty_after,
        },
        "adaptive_feedback": adaptive_state.last_feedback,
        "next_difficulty": adaptive_state.current_difficulty,
    }
    return Response(SessionFeedbackResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def leaderboard(request):
    profiles = list(
        UserProfile.objects.select_related("user")
        .order_by("-correct_answers", "avg_response_time", "user__username")
    )

    def mask_username(username: str) -> str:
        return f"{username[:3]}***"

    def serialize_entry(profile: UserProfile, rank: int) -> dict:
        is_current_user = profile.user_id == request.user.id
        return {
            "rank": rank,
            "username": profile.user.username if is_current_user else mask_username(profile.user.username),
            "skill_label": profile.skill_level,
            "accuracy": round(profile.accuracy(), 2),
            "total_attempts": int(profile.total_attempts),
            "avg_response_time": round(float(profile.avg_response_time), 2),
            "is_current_user": is_current_user,
        }

    leaders = [serialize_entry(profile, rank) for rank, profile in enumerate(profiles[:10], start=1)]

    current_user_entry = None
    for rank, profile in enumerate(profiles, start=1):
        if profile.user_id == request.user.id:
            current_user_entry = serialize_entry(profile, rank)
            break

    payload = {
        "leaders": leaders,
        "your_rank": current_user_entry if current_user_entry and current_user_entry["rank"] > 10 else None,
    }
    return Response(LeaderboardResponseSerializer(payload).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def methodology(request):
    cards = [
        {"title": "Assessment", "description": "Baseline + continuous attempts are tracked for accuracy and speed."},
        {"title": "Random Forest", "description": "Classifies skill level from user behavioral features."},
        {"title": "Adaptive Engine", "description": "Chooses next difficulty and recommendations based on weak points."},
        {"title": "Isolation Forest", "description": "Detects anomalous user behavior patterns for risk alerts."},
    ]
    stack = [
        {"layer": "Backend", "tech": "Django"},
        {"layer": "ML", "tech": "scikit-learn"},
        {"layer": "Data", "tech": "Pandas + NumPy"},
        {"layer": "Frontend", "tech": "React + Tailwind + Chart.js"},
    ]
    payload = {"cards": cards, "stack": stack}
    return Response(MethodologyResponseSerializer(payload).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([FormParser, MultiPartParser, JSONParser])
def detect_email(request):
    req = EmailDetectRequestSerializer(data=request.data)
    req.is_valid(raise_exception=True)

    email_text = (req.validated_data["email_text"] or "").strip()

    result = predict_email_phishing(email_text)
    payload = {"is_phishing": bool(result["is_phishing"]), "confidence": float(result["confidence"])}
    return Response(EmailDetectResponseSerializer(payload).data)


# ===== SPA serving (kept as plain Django responses) =====


def spa_index(request, path=""):
    dist_index = Path(settings.BASE_DIR) / "frontend" / "dist" / "index.html"
    if not dist_index.exists():
        return HttpResponse(
            "Frontend build not found. Run: cd frontend && npm run build",
            status=503,
            content_type="text/plain",
        )
    return FileResponse(dist_index.open("rb"), content_type="text/html")


def spa_assets(request, path):
    asset_path = Path(settings.BASE_DIR) / "frontend" / "dist" / "assets" / path
    if not asset_path.exists() or not asset_path.is_file():
        return HttpResponse("Asset not found", status=404)
    return FileResponse(asset_path.open("rb"))
