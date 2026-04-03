from django.urls import path
from . import views

urlpatterns = [
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
]
