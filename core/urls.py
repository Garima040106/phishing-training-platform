from django.urls import path

from . import views  # DRF API + SPA asset views

urlpatterns = [
    path('', views.spa_index, name='spa_home'),
    path('app/', views.spa_index, name='spa_app'),
    path('app/<path:path>', views.spa_index, name='spa_app_path'),
    path('assets/<path:path>', views.spa_assets, name='spa_assets'),

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
    path('api/report/stats/', views.report_stats, name='api_report_stats'),
    path('api/report/generate/', views.generate_report, name='api_generate_report'),
    path('api/practice/', views.practice, name='api_practice'),
    path('api/practice/submit/', views.submit_practice, name='api_submit_practice'),
    path('api/feedback/session/', views.session_feedback, name='api_session_feedback'),
    path('api/leaderboard/', views.leaderboard, name='api_leaderboard'),
    path('api/methodology/', views.methodology, name='api_methodology'),
    path('api/detect-email/', views.detect_email, name='api_detect_email'),
]
