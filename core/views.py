from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Q
import time

from .models import UserProfile, PhishingScenario, UserAttempt, TrainingRecommendation
from ml_engine.kaggle_trainer import classify_user_skill, detect_anomaly
from ml_engine.recommender import get_recommendations


# ===== Authentication Views =====

@require_http_methods(["GET", "POST"])
def register_view(request):
    """User registration view"""
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            # Signal will auto-create UserProfile
            login(request, user)
            return redirect('baseline_quiz')
    else:
        form = UserCreationForm()
    
    return render(request, 'core/register.html', {'form': form})


@require_http_methods(["GET", "POST"])
def login_view(request):
    """User login view"""
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('dashboard')
    else:
        form = AuthenticationForm()
    
    return render(request, 'core/login.html', {'form': form})


@login_required(login_url='login')
def logout_view(request):
    """User logout view"""
    logout(request)
    return redirect('login')


# ===== Quiz Views =====

@login_required(login_url='login')
def baseline_quiz(request):
    """Baseline quiz - 10 random scenarios"""
    scenarios = PhishingScenario.objects.all().order_by('?')[:10]
    return render(request, 'core/quiz.html', {'scenarios': scenarios, 'title': 'Baseline Assessment'})


@login_required(login_url='login')
@require_http_methods(["POST"])
def submit_quiz(request):
    """Process quiz submission"""
    scenarios = PhishingScenario.objects.all().order_by('?')[:10]
    attempts = []
    correct_count = 0
    total_time = 0
    
    # Process answers
    for scenario in scenarios:
        answer_key = f'answer_{scenario.id}'
        if answer_key in request.POST:
            user_answer = request.POST[answer_key] == 'phishing'
            is_correct = user_answer == scenario.is_phishing
            
            if is_correct:
                correct_count += 1
            
            # Get response time (approximate from form submission)
            response_time = float(request.POST.get(f'time_{scenario.id}', 30))
            total_time += response_time
            
            attempt = UserAttempt(
                user=request.user,
                scenario=scenario,
                user_answer=user_answer,
                is_correct=is_correct,
                response_time=response_time,
                confidence_score=0.5
            )
            attempts.append(attempt)
    
    # Bulk create attempts
    UserAttempt.objects.bulk_create(attempts)
    
    # Update profile stats
    profile = request.user.userprofile
    profile.total_attempts += len(attempts)
    profile.correct_answers += correct_count
    
    if len(attempts) > 0:
        profile.avg_response_time = total_time / len(attempts)
    
    # Calculate accuracy components for skill classification
    accuracy = profile.accuracy() / 100
    hard_scenarios = PhishingScenario.objects.filter(difficulty='hard')
    medium_scenarios = PhishingScenario.objects.filter(difficulty='medium')
    
    hard_attempts = UserAttempt.objects.filter(
        user=request.user,
        scenario__in=hard_scenarios
    )
    medium_attempts = UserAttempt.objects.filter(
        user=request.user,
        scenario__in=medium_scenarios
    )
    
    hard_accuracy = hard_attempts.filter(is_correct=True).count() / max(hard_attempts.count(), 1)
    medium_accuracy = medium_attempts.filter(is_correct=True).count() / max(medium_attempts.count(), 1)
    
    # Classify skill level
    skill_label, confidence = classify_user_skill(
        accuracy,
        profile.avg_response_time,
        profile.total_attempts,
        hard_accuracy,
        medium_accuracy
    )
    profile.skill_level = skill_label
    
    # Detect anomaly
    consistency_score = 0.8 if hard_accuracy > 0.7 else 0.6
    is_anomalous = detect_anomaly(accuracy, profile.avg_response_time, consistency_score)
    profile.is_anomalous = is_anomalous
    
    profile.save()
    
    # Generate recommendations
    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by('-timestamp')[:10]
    recommendations_data = get_recommendations(profile, recent_attempts)
    
    # Save recommendations
    TrainingRecommendation.objects.filter(user=request.user, is_read=False).delete()
    for rec in recommendations_data:
        TrainingRecommendation.objects.create(
            user=request.user,
            weakness_type=rec['weakness'],
            recommendation=rec['tip']
        )
    
    return redirect('dashboard')


# ===== Dashboard Views =====

@login_required(login_url='login')
def dashboard(request):
    """Main dashboard view"""
    profile = request.user.userprofile
    recent_attempts = UserAttempt.objects.filter(user=request.user).order_by('-timestamp')[:10]
    recommendations = list(
        TrainingRecommendation.objects.filter(user=request.user, is_read=False).order_by('-created_at')[:3]
    )

    # Mark selected recommendations as read
    if recommendations:
        recommendation_ids = [recommendation.id for recommendation in recommendations]
        TrainingRecommendation.objects.filter(id__in=recommendation_ids).update(is_read=True)
    
    # Get skill map for next difficulty
    skill_map = {
        'beginner': 'easy',
        'intermediate': 'medium',
        'advanced': 'hard'
    }
    next_difficulty = skill_map.get(profile.skill_level, 'easy')
    
    # Get last 20 attempts for chart (correct_series)
    attempts = UserAttempt.objects.filter(user=request.user).order_by('-timestamp')[:20]
    correct_series = [1 if att.is_correct else 0 for att in reversed(attempts)]
    
    context = {
        'profile': profile,
        'recent_attempts': recent_attempts,
        'recommendations': recommendations,
        'next_difficulty': next_difficulty,
        'correct_series': correct_series,
        'accuracy': round(profile.accuracy(), 2),
        'total_attempts': profile.total_attempts,
        'avg_response_time': round(profile.avg_response_time, 2),
        'total_scenarios': profile.correct_answers,
    }
    
    return render(request, 'core/dashboard.html', context)


# ===== Practice Views =====

@login_required(login_url='login')
def practice(request):
    """Practice with a single scenario"""
    difficulty = request.GET.get('difficulty', 'easy')
    
    # Get unclicked scenarios
    clicked_ids = UserAttempt.objects.filter(user=request.user).values_list('scenario_id', flat=True)
    
    scenario = PhishingScenario.objects.filter(
        difficulty=difficulty
    ).exclude(id__in=clicked_ids).order_by('?').first()
    
    if not scenario:
        # If all scenarios at this difficulty are done, pick any
        scenario = PhishingScenario.objects.filter(difficulty=difficulty).order_by('?').first()
    
    if not scenario:
        return redirect('dashboard')
    
    return render(request, 'core/practice.html', {
        'scenario': scenario,
        'difficulty': difficulty
    })


@login_required(login_url='login')
@require_http_methods(["POST"])
def submit_practice(request):
    """Submit practice attempt"""
    scenario_id = request.POST.get('scenario_id')
    user_answer = request.POST.get('answer') == 'phishing'
    response_time = float(request.POST.get('response_time', 30))
    
    scenario = PhishingScenario.objects.get(id=scenario_id)
    is_correct = user_answer == scenario.is_phishing
    
    # Create attempt
    attempt = UserAttempt.objects.create(
        user=request.user,
        scenario=scenario,
        user_answer=user_answer,
        is_correct=is_correct,
        response_time=response_time,
        confidence_score=0.7
    )
    
    # Update profile
    profile = request.user.userprofile
    profile.total_attempts += 1
    if is_correct:
        profile.correct_answers += 1
    
    # Update average response time
    all_attempts = UserAttempt.objects.filter(user=request.user)
    profile.avg_response_time = all_attempts.aggregate(
        avg=__import__('django.db.models', fromlist=['Avg']).Avg('response_time')
    )['avg'] or 0
    
    # Re-classify skill
    accuracy = profile.accuracy() / 100
    hard_attempts = UserAttempt.objects.filter(user=request.user, scenario__difficulty='hard')
    medium_attempts = UserAttempt.objects.filter(user=request.user, scenario__difficulty='medium')
    
    hard_accuracy = hard_attempts.filter(is_correct=True).count() / max(hard_attempts.count(), 1)
    medium_accuracy = medium_attempts.filter(is_correct=True).count() / max(medium_attempts.count(), 1)
    
    skill_label, _ = classify_user_skill(
        accuracy,
        profile.avg_response_time,
        profile.total_attempts,
        hard_accuracy,
        medium_accuracy
    )
    profile.skill_level = skill_label
    
    # Check anomaly
    consistency_score = 0.8 if hard_accuracy > 0.7 else 0.6
    profile.is_anomalous = detect_anomaly(accuracy, profile.avg_response_time, consistency_score)
    
    profile.save()
    
    return render(request, 'core/result.html', {
        'attempt': attempt,
        'scenario': scenario,
        'is_correct': is_correct,
        'profile': profile,
        'accuracy': round(profile.accuracy(), 2)
    })


# ===== Leaderboard View =====

@login_required(login_url='login')
def leaderboard(request):
    """Display top 10 users"""
    top_users = UserProfile.objects.all().order_by('-correct_answers', 'avg_response_time')[:10]
    
    # Add rank
    ranked_users = []
    for i, user_profile in enumerate(top_users, 1):
        ranked_users.append({
            'rank': i,
            'user': user_profile.user,
            'profile': user_profile,
            'is_current': user_profile.user == request.user
        })
    
    context = {
        'ranked_users': ranked_users,
        'current_user': request.user.userprofile
    }
    
    return render(request, 'core/leaderboard.html', context)


# ===== Methodology View =====

def methodology(request):
    """Display methodology page"""
    return render(request, 'core/methodology.html')
