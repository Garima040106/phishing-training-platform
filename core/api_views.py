from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.db.models import Avg
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import PhishingScenario, TrainingRecommendation, UserAttempt
from ml_engine.kaggle_trainer import classify_user_skill, detect_anomaly
from ml_engine.recommender import get_recommendations


def _scenario_payload(scenario):
    return {
        "id": scenario.id,
        "title": scenario.title,
        "sender_email": scenario.sender_email,
        "subject": scenario.subject,
        "body": scenario.body,
        "difficulty": scenario.difficulty,
    }


def _compute_difficulty_accuracy(user, difficulty):
    attempts = UserAttempt.objects.filter(user=user, scenario__difficulty=difficulty)
    total = attempts.count()
    if total == 0:
        return 0.0
    return attempts.filter(is_correct=True).count() / total


def _update_profile_ml(profile):
    accuracy = profile.accuracy() / 100
    hard_accuracy = _compute_difficulty_accuracy(profile.user, "hard")
    medium_accuracy = _compute_difficulty_accuracy(profile.user, "medium")

    skill_label, confidence = classify_user_skill(
        accuracy,
        profile.avg_response_time,
        profile.total_attempts,
        hard_accuracy,
        medium_accuracy,
    )
    profile.skill_level = skill_label

    consistency_score = 0.8 if hard_accuracy > 0.7 else 0.6
    profile.is_anomalous = bool(detect_anomaly(accuracy, profile.avg_response_time, consistency_score))
    profile.save()
    return confidence


def _profile_payload(profile):
    return {
        "skill_level": profile.skill_level,
        "accuracy": float(round(profile.accuracy(), 2)),
        "total_attempts": int(profile.total_attempts),
        "correct_answers": int(profile.correct_answers),
        "avg_response_time": float(round(profile.avg_response_time, 2)),
        "is_anomalous": bool(profile.is_anomalous),
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


@require_GET
@login_required
def me(request):
    profile = request.user.userprofile
    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "profile": _profile_payload(profile),
        }
    )


@require_GET
@login_required
def baseline_quiz(request):
    scenarios = PhishingScenario.objects.order_by("?")[:10]
    return JsonResponse({"scenarios": [_scenario_payload(s) for s in scenarios]})


@require_POST
@login_required
def submit_quiz(request):
    scenario_ids = request.POST.getlist("scenario_ids[]")
    if not scenario_ids:
        return JsonResponse({"error": "No scenarios submitted"}, status=400)

    scenarios = list(PhishingScenario.objects.filter(id__in=scenario_ids))
    attempts = []
    correct_count = 0

    for scenario in scenarios:
        answer_raw = request.POST.get(f"answer_{scenario.id}")
        if answer_raw is None:
            continue

        user_answer = answer_raw == "phishing"
        is_correct = user_answer == scenario.is_phishing
        response_time = float(request.POST.get(f"time_{scenario.id}", 30))

        if is_correct:
            correct_count += 1

        attempts.append(
            UserAttempt(
                user=request.user,
                scenario=scenario,
                user_answer=user_answer,
                is_correct=is_correct,
                response_time=response_time,
                confidence_score=0.5,
            )
        )

    if not attempts:
        return JsonResponse({"error": "No valid answers submitted"}, status=400)

    UserAttempt.objects.bulk_create(attempts)

    profile = request.user.userprofile
    profile.total_attempts += len(attempts)
    profile.correct_answers += correct_count
    profile.avg_response_time = (
        UserAttempt.objects.filter(user=request.user).aggregate(avg=Avg("response_time"))["avg"] or 0
    )

    _update_profile_ml(profile)

    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:10]
    recs = get_recommendations(profile, recent_attempts)
    TrainingRecommendation.objects.filter(user=request.user, is_read=False).delete()
    for rec in recs:
        TrainingRecommendation.objects.create(
            user=request.user,
            weakness_type=rec["weakness"],
            recommendation=rec["tip"],
        )

    return JsonResponse({"ok": True, "profile": _profile_payload(profile)})


@require_GET
@login_required
def dashboard(request):
    profile = request.user.userprofile
    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:10]
    recommendations = list(
        TrainingRecommendation.objects.filter(user=request.user, is_read=False).values(
            "id", "weakness_type", "recommendation"
        )[:3]
    )

    attempts = UserAttempt.objects.filter(user=request.user).order_by("-timestamp")[:20]
    correct_series = [1 if a.is_correct else 0 for a in reversed(attempts)]

    skill_map = {"beginner": "easy", "intermediate": "medium", "advanced": "hard"}

    return JsonResponse(
        {
            "profile": _profile_payload(profile),
            "next_difficulty": skill_map.get(profile.skill_level, "easy"),
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
    difficulty = request.GET.get("difficulty") or {
        "beginner": "easy",
        "intermediate": "medium",
        "advanced": "hard",
    }.get(request.user.userprofile.skill_level, "easy")

    seen_ids = UserAttempt.objects.filter(user=request.user).values_list("scenario_id", flat=True)
    scenario = PhishingScenario.objects.filter(difficulty=difficulty).exclude(id__in=seen_ids).order_by("?").first()
    if not scenario:
        scenario = PhishingScenario.objects.filter(difficulty=difficulty).order_by("?").first()

    if not scenario:
        return JsonResponse({"error": "No scenarios available"}, status=404)

    return JsonResponse({"scenario": _scenario_payload(scenario), "difficulty": difficulty})


@require_POST
@login_required
def submit_practice(request):
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

    UserAttempt.objects.create(
        user=request.user,
        scenario=scenario,
        user_answer=user_answer,
        is_correct=is_correct,
        response_time=response_time,
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

    return JsonResponse(
        {
            "ok": True,
            "is_correct": is_correct,
            "scenario_is_phishing": scenario.is_phishing,
            "indicators": scenario.get_indicators(),
            "profile": _profile_payload(profile),
            "scenario": _scenario_payload(scenario),
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
