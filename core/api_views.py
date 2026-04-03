from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.db import transaction
from django.db.models import Avg
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from pathlib import Path
from collections import Counter

from .models import AdaptiveLearningState, BehavioralDatasetRecord, PhishingScenario, TrainingRecommendation, UserAttempt
from ml_engine.kaggle_trainer import classify_user_skill, detect_anomaly, predict_email_phishing
from ml_engine.user_profiling import classify_user_with_profile_model, extract_user_performance_features
from ml_engine.recommender import get_recommendations


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


def _scenario_payload(scenario):
    return {
        "id": scenario.id,
        "title": scenario.title,
        "sender_email": scenario.sender_email,
        "subject": scenario.subject,
        "body": scenario.body,
        "difficulty": scenario.difficulty,
    }


def _baseline_attempts_count(user):
    return UserAttempt.objects.filter(user=user, assessment_type="baseline").count()


def _baseline_completed(user):
    return _baseline_attempts_count(user) >= 10


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
        fallback = (
            PhishingScenario.objects.exclude(id__in=selected_ids)
            .order_by("?")[: 10 - len(selected)]
        )
        selected.extend(list(fallback))

    return selected[:10]


def _mistake_types_for_attempt(scenario, user_answer, is_correct):
    if is_correct:
        return []
    if scenario.is_phishing and not user_answer:
        return scenario.get_indicators()
    if (not scenario.is_phishing) and user_answer:
        return ["false_positive", "over_suspicious"]
    return ["classification_error"]


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


def _compute_difficulty_accuracy(user, difficulty):
    attempts = UserAttempt.objects.filter(user=user, scenario__difficulty=difficulty)
    total = attempts.count()
    if total == 0:
        return 0.0
    return attempts.filter(is_correct=True).count() / total


def _compute_detection_analysis(user):
    attempts = UserAttempt.objects.filter(user=user).select_related("scenario")

    phishing_total = attempts.filter(scenario__is_phishing=True).count()
    legit_total = attempts.filter(scenario__is_phishing=False).count()

    true_positive = attempts.filter(scenario__is_phishing=True, user_answer=True).count()
    false_negative = attempts.filter(scenario__is_phishing=True, user_answer=False).count()
    true_negative = attempts.filter(scenario__is_phishing=False, user_answer=False).count()
    false_positive = attempts.filter(scenario__is_phishing=False, user_answer=True).count()

    phishing_recall = (true_positive / phishing_total) if phishing_total else 0.0
    legitimate_accuracy = (true_negative / legit_total) if legit_total else 0.0
    false_positive_rate = (false_positive / legit_total) if legit_total else 0.0
    false_negative_rate = (false_negative / phishing_total) if phishing_total else 0.0
    overall_accuracy = (attempts.filter(is_correct=True).count() / attempts.count()) if attempts.exists() else 0.0

    capability_score = (
        0.45 * overall_accuracy
        + 0.35 * phishing_recall
        + 0.20 * (1.0 - false_positive_rate)
    ) * 100
    capability_score = max(0.0, min(100.0, capability_score))

    return {
        "phishing_recall": round(phishing_recall * 100, 2),
        "legitimate_accuracy": round(legitimate_accuracy * 100, 2),
        "false_positive_rate": round(false_positive_rate * 100, 2),
        "false_negative_rate": round(false_negative_rate * 100, 2),
        "capability_score": round(capability_score, 2),
        "samples": int(attempts.count()),
    }


def _anomaly_personalization_analysis(user):
    attempts = list(
        UserAttempt.objects.filter(user=user)
        .select_related("scenario")
        .order_by("-timestamp")[:20]
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

    skill_accuracy = user.userprofile.accuracy() / 100.0
    if len(attempts) < 12:
        isolation_anomaly = False
    else:
        isolation_anomaly = bool(detect_anomaly(skill_accuracy, user.userprofile.avg_response_time, consistency_score))

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


def _skill_base_difficulty(skill_level):
    return {
        "beginner": "easy",
        "intermediate": "medium",
        "advanced": "hard",
    }.get(skill_level, "easy")


def _compute_improvement_trend(user, window_size=10):
    attempts = list(
        UserAttempt.objects.filter(user=user)
        .order_by("-timestamp")[:window_size]
    )
    if len(attempts) < 6:
        return {
            "trend": "stable",
            "accuracy_delta": 0.0,
            "response_time_delta": 0.0,
        }

    midpoint = len(attempts) // 2
    recent = attempts[:midpoint]
    previous = attempts[midpoint:]

    recent_accuracy = sum(1 for item in recent if item.is_correct) / max(len(recent), 1)
    previous_accuracy = sum(1 for item in previous if item.is_correct) / max(len(previous), 1)
    recent_response = sum(item.response_time for item in recent) / max(len(recent), 1)
    previous_response = sum(item.response_time for item in previous) / max(len(previous), 1)

    accuracy_delta = recent_accuracy - previous_accuracy
    response_delta = previous_response - recent_response

    trend = "stable"
    if accuracy_delta >= 0.12 and response_delta >= 1.5:
        trend = "improving"
    elif accuracy_delta <= -0.12:
        trend = "declining"

    return {
        "trend": trend,
        "accuracy_delta": round(accuracy_delta * 100, 2),
        "response_time_delta": round(response_delta, 2),
    }


def _feedback_message(state):
    if state.trend_status == "improving":
        return "Great improvement. Difficulty is increased to keep you challenged."
    if state.trend_status == "declining":
        return "Performance declined recently. Difficulty is reduced and recommendations are refreshed."
    if state.correct_streak >= 3:
        return "Consistent correct answers detected. You are ready for higher complexity scenarios."
    if state.incorrect_streak >= 2:
        return "Multiple misses detected. Focus on indicator feedback before moving to harder scenarios."
    return "Adaptive engine is monitoring your trend and tuning scenario difficulty continuously."


def _update_adaptive_learning_state(user, profile_skill_level, latest_results=None):
    state, _ = AdaptiveLearningState.objects.get_or_create(
        user=user,
        defaults={"current_difficulty": _skill_base_difficulty(profile_skill_level)},
    )

    for result in (latest_results or []):
        if result:
            state.correct_streak += 1
            state.incorrect_streak = 0
        else:
            state.incorrect_streak += 1
            state.correct_streak = 0

    trend_data = _compute_improvement_trend(user)
    state.trend_status = trend_data["trend"]
    state.accuracy_delta = trend_data["accuracy_delta"]
    state.response_time_delta = trend_data["response_time_delta"]

    levels = ["easy", "medium", "hard"]
    base_index = levels.index(_skill_base_difficulty(profile_skill_level))
    shift = 0

    if state.trend_status == "improving":
        shift += 1
    elif state.trend_status == "declining":
        shift -= 1

    if state.correct_streak >= 3:
        shift += 1
    if state.incorrect_streak >= 2:
        shift -= 1

    target_index = max(0, min(2, base_index + shift))
    state.current_difficulty = levels[target_index]
    state.last_feedback = _feedback_message(state)
    state.save()
    return state


def _next_difficulty_for_user(user, profile_skill_level):
    state, _ = AdaptiveLearningState.objects.get_or_create(
        user=user,
        defaults={"current_difficulty": _skill_base_difficulty(profile_skill_level)},
    )
    return state.current_difficulty


def _update_profile_ml(profile):
    accuracy = profile.accuracy() / 100
    hard_accuracy = _compute_difficulty_accuracy(profile.user, "hard")

    profile_result = classify_user_with_profile_model(profile.user)
    if profile_result is not None:
        skill_label, confidence, _ = profile_result
    else:
        medium_accuracy = _compute_difficulty_accuracy(profile.user, "medium")
        skill_label, confidence = classify_user_skill(
            accuracy,
            profile.avg_response_time,
            profile.total_attempts,
            hard_accuracy,
            medium_accuracy,
        )
    profile.skill_level = skill_label

    anomaly_analysis = _anomaly_personalization_analysis(profile.user)
    anomaly_signal_count = int(anomaly_analysis["isolation_anomaly"]) + int(anomaly_analysis["random_clicking"]) + int(anomaly_analysis["sudden_drop"])
    enough_history = profile.total_attempts >= 10
    profile.is_anomalous = bool(enough_history and anomaly_signal_count >= 2)
    profile.save()
    return confidence


def _refresh_anomaly_flag(profile):
    anomaly_analysis = _anomaly_personalization_analysis(profile.user)
    anomaly_signal_count = int(anomaly_analysis["isolation_anomaly"]) + int(anomaly_analysis["random_clicking"]) + int(anomaly_analysis["sudden_drop"])
    enough_history = profile.total_attempts >= 10
    fresh_flag = bool(enough_history and anomaly_signal_count >= 2)
    if profile.is_anomalous != fresh_flag:
        profile.is_anomalous = fresh_flag
        profile.save(update_fields=["is_anomalous", "last_updated"])


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


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"ok": True})


@require_POST
def register(request):
    form = UserCreationForm(request.POST)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    user = form.save()
    login(request, user)
    return JsonResponse({"ok": True, "username": user.username})


@require_POST
def login_view(request):
    username = request.POST.get("username", "")
    password = request.POST.get("password", "")
    user = authenticate(request, username=username, password=password)
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    login(request, user)
    return JsonResponse({"ok": True, "username": user.username})


@require_POST
@login_required
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_POST
@login_required
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

    return JsonResponse(
        {
            "ok": True,
            "message": "Progress reset successfully. Start with the 10-question baseline quiz.",
            "baseline_required": True,
        }
    )


@require_GET
@login_required
def me(request):
    profile = request.user.userprofile
    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "baseline_attempts": _baseline_attempts_count(request.user),
            "baseline_completed": _baseline_completed(request.user),
            "profile": _profile_payload(profile),
        }
    )


@require_GET
@login_required
def baseline_quiz(request):
    if _baseline_completed(request.user):
        return JsonResponse(
            {
                "completed": True,
                "message": "Baseline already completed. Continue with adaptive practice.",
            }
        )
    scenarios = _baseline_scenarios()
    if len(scenarios) < 10:
        return JsonResponse({"error": "At least 10 scenarios are required for baseline quiz."}, status=400)
    return JsonResponse({"completed": False, "scenarios": [_scenario_payload(s) for s in scenarios]})


@require_POST
@login_required
def submit_quiz(request):
    if _baseline_completed(request.user):
        return JsonResponse({"error": "Baseline quiz already completed."}, status=400)

    scenario_ids = request.POST.getlist("scenario_ids[]")
    if not scenario_ids:
        return JsonResponse({"error": "No scenarios submitted"}, status=400)
    if len(scenario_ids) != 10:
        return JsonResponse({"error": "Baseline must include exactly 10 scenarios."}, status=400)

    scenarios = list(PhishingScenario.objects.filter(id__in=scenario_ids))
    attempts = []
    attempts_meta = []
    correct_count = 0

    for scenario in scenarios:
        answer_raw = request.POST.get(f"answer_{scenario.id}")
        if answer_raw is None:
            continue

        user_answer = answer_raw == "phishing"
        is_correct = user_answer == scenario.is_phishing
        response_time = float(request.POST.get(f"time_{scenario.id}", 30))
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
                assessment_type='baseline',
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
        return JsonResponse({"error": "Answer all 10 baseline scenarios before submitting."}, status=400)

    UserAttempt.objects.bulk_create(attempts)

    profile = request.user.userprofile
    profile.total_attempts += len(attempts)
    profile.correct_answers += correct_count
    profile.avg_response_time = (
        UserAttempt.objects.filter(user=request.user).aggregate(avg=Avg("response_time"))["avg"] or 0
    )

    _update_profile_ml(profile)
    behavioral_record = _persist_behavioral_record(request.user, "baseline", attempts_meta)
    _refresh_recommendations(request.user, profile)
    adaptive_state = _update_adaptive_learning_state(
        request.user,
        profile.skill_level,
        latest_results=[item["is_correct"] for item in attempts_meta],
    )

    return JsonResponse(
        {
            "ok": True,
            "profile": _profile_payload(profile),
            "behavioral_record_id": behavioral_record.id if behavioral_record else None,
            "adaptive_feedback": adaptive_state.last_feedback,
            "next_difficulty": adaptive_state.current_difficulty,
        }
    )


@require_GET
@login_required
def dashboard(request):
    profile = request.user.userprofile
    _refresh_anomaly_flag(profile)
    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:10]
    recommendations = list(
        TrainingRecommendation.objects.filter(user=request.user, is_read=False).values(
            "id", "weakness_type", "recommendation"
        )[:3]
    )

    attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:20]
    correct_series = [1 if a.is_correct else 0 for a in reversed(attempts)]

    detection_analysis = _compute_detection_analysis(request.user)
    anomaly_analysis = _anomaly_personalization_analysis(request.user)
    next_difficulty = _next_difficulty_for_user(request.user, profile.skill_level)
    adaptive_state, _ = AdaptiveLearningState.objects.get_or_create(
        user=request.user,
        defaults={"current_difficulty": _skill_base_difficulty(profile.skill_level)},
    )

    return JsonResponse(
        {
            "profile": _profile_payload(profile),
            "baseline_attempts": _baseline_attempts_count(request.user),
            "baseline_completed": _baseline_completed(request.user),
            "next_difficulty": next_difficulty,
            "detection_analysis": detection_analysis,
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
                for a in recent_attempts
            ],
            "recommendations": recommendations,
        }
    )


@require_GET
@login_required
def practice(request):
    if not _baseline_completed(request.user):
        return JsonResponse(
            {
                "error": "Complete the 10-question baseline quiz first.",
                "baseline_required": True,
            },
            status=400,
        )

    profile_skill = request.user.userprofile.skill_level
    requested_difficulty = request.GET.get("difficulty")
    if requested_difficulty in {"easy", "medium", "hard"}:
        difficulty = requested_difficulty
        assigned_by = "manual_override"
    else:
        difficulty = _next_difficulty_for_user(request.user, profile_skill)
        assigned_by = "adaptive_engine"

    seen_ids = UserAttempt.objects.filter(user=request.user).values_list("scenario_id", flat=True)
    scenario = PhishingScenario.objects.filter(difficulty=difficulty).exclude(id__in=seen_ids).order_by("?").first()
    if not scenario:
        scenario = PhishingScenario.objects.filter(difficulty=difficulty).order_by("?").first()

    if not scenario:
        return JsonResponse({"error": "No scenarios available"}, status=404)

    return JsonResponse({"scenario": _scenario_payload(scenario), "difficulty": difficulty, "assigned_by": assigned_by})


@require_POST
@login_required
def submit_practice(request):
    if not _baseline_completed(request.user):
        return JsonResponse(
            {
                "error": "Complete the 10-question baseline quiz first.",
                "baseline_required": True,
            },
            status=400,
        )

    scenario_id = request.POST.get("scenario_id")
    answer_raw = request.POST.get("answer")
    if not scenario_id or answer_raw not in {"phishing", "legitimate"}:
        return JsonResponse({"error": "Invalid payload"}, status=400)

    scenario = PhishingScenario.objects.filter(id=scenario_id).first()
    if not scenario:
        return JsonResponse({"error": "Scenario not found"}, status=404)

    user_answer = answer_raw == "phishing"
    is_correct = user_answer == scenario.is_phishing
    response_time = float(request.POST.get("response_time", 30))
    mistake_types = _mistake_types_for_attempt(scenario, user_answer, is_correct)

    UserAttempt.objects.create(
        user=request.user,
        scenario=scenario,
        user_answer=user_answer,
        is_correct=is_correct,
        response_time=response_time,
        assessment_type='practice',
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

    return JsonResponse(
        {
            "ok": True,
            "is_correct": is_correct,
            "scenario_is_phishing": scenario.is_phishing,
            "indicators": scenario.get_indicators(),
            "profile": _profile_payload(profile),
            "scenario": _scenario_payload(scenario),
            "behavioral_record_id": behavioral_record.id if behavioral_record else None,
            "adaptive_feedback": adaptive_state.last_feedback,
            "next_difficulty": adaptive_state.current_difficulty,
        }
    )


@require_GET
@login_required
def leaderboard(request):
    top = list(
        UserAttempt.objects.none()
    )
    profiles = list(
        request.user.userprofile.__class__.objects.select_related("user")
        .order_by("-correct_answers", "avg_response_time")[:10]
    )

    for index, profile in enumerate(profiles, start=1):
        top.append(
            {
                "rank": index,
                "username": profile.user.username,
                "skill_level": profile.skill_level,
                "accuracy": round(profile.accuracy(), 2),
                "attempts": profile.total_attempts,
                "avg_response_time": round(profile.avg_response_time, 2),
                "is_current": profile.user_id == request.user.id,
            }
        )

    return JsonResponse({"leaders": top})


@require_GET
def methodology(request):
    cards = [
        {
            "title": "Assessment",
            "description": "Baseline + continuous attempts are tracked for accuracy and speed.",
        },
        {
            "title": "Random Forest",
            "description": "Classifies skill level from user behavioral features.",
        },
        {
            "title": "Adaptive Engine",
            "description": "Chooses next difficulty and recommendations based on weak points.",
        },
        {
            "title": "Isolation Forest",
            "description": "Detects anomalous user behavior patterns for risk alerts.",
        },
    ]
    stack = [
        {"layer": "Backend", "tech": "Django"},
        {"layer": "ML", "tech": "scikit-learn"},
        {"layer": "Data", "tech": "Pandas + NumPy"},
        {"layer": "Frontend", "tech": "React + Tailwind + Chart.js"},
    ]
    return JsonResponse({"cards": cards, "stack": stack})


@require_POST
@login_required
def detect_email(request):
    email_text = (request.POST.get("email_text") or "").strip()
    if len(email_text) < 20:
        return JsonResponse({"error": "Please provide a longer email body for analysis."}, status=400)

    result = predict_email_phishing(email_text)
    return JsonResponse({"ok": True, "result": result})


@require_GET
def spa_index(request, path=""):
    dist_index = Path(settings.BASE_DIR) / "frontend" / "dist" / "index.html"
    if not dist_index.exists():
        return HttpResponse(
            "Frontend build not found. Run: cd frontend && npm run build",
            status=503,
            content_type="text/plain",
        )
    return FileResponse(dist_index.open("rb"), content_type="text/html")


@require_GET
def spa_assets(request, path):
    asset_path = Path(settings.BASE_DIR) / "frontend" / "dist" / "assets" / path
    if not asset_path.exists() or not asset_path.is_file():
        return HttpResponse("Asset not found", status=404)
    return FileResponse(asset_path.open("rb"))
