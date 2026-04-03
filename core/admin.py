from django.contrib import admin
from .models import UserProfile, PhishingScenario, UserAttempt, TrainingRecommendation


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'skill_level', 'total_attempts', 'correct_answers', 'avg_response_time', 'is_anomalous')
    list_filter = ('skill_level', 'is_anomalous')
    search_fields = ('user__username',)


@admin.register(PhishingScenario)
class PhishingScenarioAdmin(admin.ModelAdmin):
    list_display = ('title', 'sender_email', 'difficulty', 'is_phishing')
    list_filter = ('difficulty', 'is_phishing')
    search_fields = ('title', 'subject')


@admin.register(UserAttempt)
class UserAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'scenario', 'is_correct', 'response_time', 'timestamp')
    list_filter = ('is_correct', 'timestamp')
    search_fields = ('user__username',)


@admin.register(TrainingRecommendation)
class TrainingRecommendationAdmin(admin.ModelAdmin):
    list_display = ('user', 'weakness_type', 'created_at', 'is_read')
    list_filter = ('is_read', 'created_at')
    search_fields = ('user__username',)
