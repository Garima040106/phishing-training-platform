from django.urls import path
from . import views
from . import api_views

urlpatterns = [
    path('', api_views.spa_index, name='spa_home'),
    path('app/', api_views.spa_index, name='spa_app'),
    path('app/<path:path>', api_views.spa_index, name='spa_app_path'),
    path('assets/<path:path>', api_views.spa_assets, name='spa_assets'),

    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('quiz/', views.baseline_quiz, name='baseline_quiz'),
    path('quiz/submit/', views.submit_quiz, name='submit_quiz'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('practice/', views.practice, name='practice'),
    path('practice/submit/', views.submit_practice, name='submit_practice'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('methodology/', views.methodology, name='methodology'),

    path('api/csrf/', api_views.csrf, name='api_csrf'),
    path('api/register/', api_views.register, name='api_register'),
    path('api/login/', api_views.login_view, name='api_login'),
    path('api/logout/', api_views.logout_view, name='api_logout'),
    path('api/me/', api_views.me, name='api_me'),
    path('api/quiz/baseline/', api_views.baseline_quiz, name='api_baseline_quiz'),
    path('api/quiz/submit/', api_views.submit_quiz, name='api_submit_quiz'),
    path('api/dashboard/', api_views.dashboard, name='api_dashboard'),
    path('api/practice/', api_views.practice, name='api_practice'),
    path('api/practice/submit/', api_views.submit_practice, name='api_submit_practice'),
    path('api/leaderboard/', api_views.leaderboard, name='api_leaderboard'),
    path('api/methodology/', api_views.methodology, name='api_methodology'),
]
