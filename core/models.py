from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    SKILL_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    skill_level = models.CharField(max_length=20, choices=SKILL_CHOICES, default='beginner')
    total_attempts = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)
    avg_response_time = models.FloatField(default=0.0)
    is_anomalous = models.BooleanField(default=False)
    last_updated = models.DateTimeField(auto_now=True)
    
    def accuracy(self):
        """Returns accuracy percentage"""
        if self.total_attempts == 0:
            return 0.0
        return (self.correct_answers / self.total_attempts) * 100
    
    def __str__(self):
        return f"{self.user.username} - {self.skill_level}"


class PhishingScenario(models.Model):
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    
    title = models.CharField(max_length=255)
    sender_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    is_phishing = models.BooleanField()
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    phishing_indicators = models.TextField(help_text="Comma-separated indicators")
    
    def get_indicators(self):
        """Returns list of phishing indicators"""
        return [ind.strip() for ind in self.phishing_indicators.split(',') if ind.strip()]

    def get_display_body(self, max_chars=500):
        """Returns a trimmed body preview for UI rendering."""
        text = (self.body or "").strip()
        if len(text) <= max_chars:
            return text
        return f"{text[:max_chars].rstrip()}..."
    
    def __str__(self):
        return f"{self.title} ({self.difficulty})"


class UserAttempt(models.Model):
    ASSESSMENT_CHOICES = [
        ('baseline', 'Baseline'),
        ('practice', 'Practice'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    scenario = models.ForeignKey(PhishingScenario, on_delete=models.CASCADE)
    user_answer = models.BooleanField()  # True = Phishing, False = Legitimate
    is_correct = models.BooleanField()
    response_time = models.FloatField()  # in seconds
    assessment_type = models.CharField(max_length=20, choices=ASSESSMENT_CHOICES, default='practice')
    attempted_difficulty = models.CharField(max_length=20, default='easy')
    mistake_types = models.JSONField(default=list, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    confidence_score = models.FloatField(default=0.5)
    
    def __str__(self):
        return f"{self.user.username} - {self.scenario.title}"


class TrainingRecommendation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    weakness_type = models.CharField(max_length=255)
    recommendation = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Recommendation for {self.user.username}: {self.weakness_type}"


class BehavioralDatasetRecord(models.Model):
    SOURCE_CHOICES = [
        ('baseline', 'Baseline'),
        ('practice', 'Practice'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    sample_count = models.IntegerField(default=0)
    accuracy = models.FloatField(default=0.0)
    avg_response_time = models.FloatField(default=0.0)
    mistake_type_counts = models.JSONField(default=dict, blank=True)
    difficulty_distribution = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Behavioral record for {self.user.username} ({self.source})"


class AdaptiveLearningState(models.Model):
    TREND_CHOICES = [
        ('improving', 'Improving'),
        ('stable', 'Stable'),
        ('declining', 'Declining'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    current_difficulty = models.CharField(max_length=20, default='easy')
    trend_status = models.CharField(max_length=20, choices=TREND_CHOICES, default='stable')
    accuracy_delta = models.FloatField(default=0.0)
    response_time_delta = models.FloatField(default=0.0)
    correct_streak = models.IntegerField(default=0)
    incorrect_streak = models.IntegerField(default=0)
    last_feedback = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Adaptive state for {self.user.username}: {self.current_difficulty}/{self.trend_status}"
