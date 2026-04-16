from django.urls import path

from . import views  # DRF API + SPA asset views
from . import web_views

urlpatterns = [
    path('', views.spa_index, name='spa_home'),
    path('app/', views.spa_index, name='spa_app'),
    path('app/<path:path>', views.spa_index, name='spa_app_path'),
    path('assets/<path:path>', views.spa_assets, name='spa_assets'),

    # HTML (session-auth) pages
    path('register/', web_views.register_view, name='register'),
    path('login/', web_views.login_view, name='login'),
    path('logout/', web_views.logout_view, name='logout'),
    path('quiz/', web_views.baseline_quiz, name='baseline_quiz'),
    path('quiz/submit/', web_views.submit_quiz, name='submit_quiz'),
    path('dashboard/', web_views.dashboard, name='dashboard'),
    path('practice/', web_views.practice, name='practice'),
    path('practice/submit/', web_views.submit_practice, name='submit_practice'),
    path('feedback/session/', web_views.session_feedback, name='session_feedback'),
    path('leaderboard/', web_views.leaderboard, name='leaderboard'),
    path('methodology/', web_views.methodology, name='methodology'),

    # JSON API (JWT-auth)
    path('api/csrf/', views.csrf, name='api_csrf'),
    path('api/register/', views.register, name='api_register'),
    path('api/login/', views.login_view, name='api_login'),
    path('api/logout/', views.logout_view, name='api_logout'),
    path('api/progress/reset/', views.reset_progress, name='api_progress_reset'),
    path('api/me/', views.me, name='api_me'),
    path('api/quiz/baseline/', views.baseline_quiz, name='api_baseline_quiz'),
    path('api/quiz/submit/', views.submit_quiz, name='api_submit_quiz'),
    path('api/dashboard/', views.dashboard, name='api_dashboard'),
    path('api/report/generate/', views.generate_report, name='api_generate_report'),
    path('api/practice/', views.practice, name='api_practice'),
    path('api/practice/submit/', views.submit_practice, name='api_submit_practice'),
    path('api/feedback/session/', views.session_feedback, name='api_session_feedback'),
    path('api/leaderboard/', views.leaderboard, name='api_leaderboard'),
    path('api/methodology/', views.methodology, name='api_methodology'),
    path('api/detect-email/', views.detect_email, name='api_detect_email'),
]
