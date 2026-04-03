from django.contrib import admin
from .models import UserProfile, PhishingScenario, UserAttempt, TrainingRecommendation, BehavioralDatasetRecord, AdaptiveLearningState


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
    list_display = ('user', 'scenario', 'assessment_type', 'attempted_difficulty', 'is_correct', 'response_time', 'timestamp')
    list_filter = ('assessment_type', 'attempted_difficulty', 'is_correct', 'timestamp')
    search_fields = ('user__username',)


@admin.register(TrainingRecommendation)
class TrainingRecommendationAdmin(admin.ModelAdmin):
    list_display = ('user', 'weakness_type', 'created_at', 'is_read')
    list_filter = ('is_read', 'created_at')
    search_fields = ('user__username',)


@admin.register(BehavioralDatasetRecord)
class BehavioralDatasetRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'source', 'sample_count', 'accuracy', 'avg_response_time', 'created_at')
    list_filter = ('source', 'created_at')
    search_fields = ('user__username',)


@admin.register(AdaptiveLearningState)
class AdaptiveLearningStateAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_difficulty', 'trend_status', 'correct_streak', 'incorrect_streak', 'updated_at')
    list_filter = ('current_difficulty', 'trend_status', 'updated_at')
    search_fields = ('user__username',)
