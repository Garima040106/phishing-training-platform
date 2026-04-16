from __future__ import annotations

from typing import Any

from rest_framework import serializers


class ScenarioSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    sender_email = serializers.EmailField()
    subject = serializers.CharField()
    body = serializers.CharField()
    difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])


class PerformanceFeaturesSerializer(serializers.Serializer):
    hard_accuracy = serializers.FloatField()
    medium_accuracy = serializers.FloatField()
    false_positive_rate = serializers.FloatField()
    false_negative_rate = serializers.FloatField()
    baseline_accuracy = serializers.FloatField()
    practice_accuracy = serializers.FloatField()


class ProfilePayloadSerializer(serializers.Serializer):
    skill_level = serializers.ChoiceField(choices=["beginner", "intermediate", "advanced"])
    accuracy = serializers.FloatField()
    total_attempts = serializers.IntegerField()
    correct_answers = serializers.IntegerField()
    avg_response_time = serializers.FloatField()
    is_anomalous = serializers.BooleanField()
    performance_features = PerformanceFeaturesSerializer()


class CsrfResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class RegisterRequestSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password1 = serializers.CharField(min_length=8, write_only=True)
    password2 = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("password1") != attrs.get("password2"):
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class AuthOkResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    username = serializers.CharField(required=False)
    user_id = serializers.IntegerField(required=False)
    tokens = TokenPairSerializer(required=False)


class ResetProgressResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    message = serializers.CharField()
    baseline_required = serializers.BooleanField()


class MeResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    baseline_attempts = serializers.IntegerField()
    baseline_completed = serializers.BooleanField()
    profile = ProfilePayloadSerializer()


class BaselineQuizResponseSerializer(serializers.Serializer):
    completed = serializers.BooleanField()
    message = serializers.CharField(required=False, allow_blank=True)
    scenarios = ScenarioSerializer(many=True, required=False)


class QuizSubmitNormalizedRequestSerializer(serializers.Serializer):
    scenario_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    answers = serializers.DictField(child=serializers.ChoiceField(choices=["phishing", "legitimate"]))
    times = serializers.DictField(child=serializers.FloatField(), required=False)

    def validate_scenario_ids(self, value):
        if len(value) != 10:
            raise serializers.ValidationError("Baseline must include exactly 10 scenarios.")
        return value


class QuizSubmitResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    profile = ProfilePayloadSerializer()
    behavioral_record_id = serializers.IntegerField(allow_null=True)
    adaptive_feedback = serializers.CharField(allow_blank=True)
    next_difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])


class PracticeGetResponseSerializer(serializers.Serializer):
    scenario = ScenarioSerializer()
    difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])
    assigned_by = serializers.ChoiceField(choices=["manual_override", "adaptive_engine"])


class PracticeSubmitRequestSerializer(serializers.Serializer):
    scenario_id = serializers.IntegerField()
    answer = serializers.ChoiceField(choices=["phishing", "legitimate"])
    response_time = serializers.FloatField(required=False, default=30.0)


class PracticeSubmitResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    is_correct = serializers.BooleanField()
    scenario_is_phishing = serializers.BooleanField()
    indicators = serializers.ListField(child=serializers.CharField())
    profile = ProfilePayloadSerializer()
    scenario = ScenarioSerializer()
    behavioral_record_id = serializers.IntegerField(allow_null=True)
    adaptive_feedback = serializers.CharField(allow_blank=True)
    next_difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])
    anomaly_detected = serializers.BooleanField()


class ModuleRecommendationSerializer(serializers.Serializer):
    module = serializers.CharField()
    reason = serializers.CharField()


class DashboardResponseSerializer(serializers.Serializer):
    # Required by spec
    skill_label = serializers.CharField()
    confidence_score = serializers.FloatField()
    anomaly_flag = serializers.BooleanField()
    anomaly_reason = serializers.CharField(allow_blank=True)
    recent_accuracy_trend = serializers.ListField(child=serializers.FloatField())
    recommended_modules = ModuleRecommendationSerializer(many=True)
    total_attempts = serializers.IntegerField()

    # Legacy payload (kept for compatibility)
    profile = ProfilePayloadSerializer(required=False)
    baseline_attempts = serializers.IntegerField(required=False)
    baseline_completed = serializers.BooleanField(required=False)
    next_difficulty = serializers.CharField(required=False)
    detection_analysis = serializers.DictField(required=False)
    anomaly_personalization = serializers.DictField(required=False)
    adaptive_engine = serializers.DictField(required=False)
    correct_series = serializers.ListField(child=serializers.IntegerField(), required=False)
    recent_attempts = serializers.ListField(child=serializers.DictField(), required=False)
    recommendations = serializers.ListField(child=serializers.DictField(), required=False)


class EmailDetectRequestSerializer(serializers.Serializer):
    email_text = serializers.CharField(min_length=20)


class EmailDetectResponseSerializer(serializers.Serializer):
    is_phishing = serializers.BooleanField()
    confidence = serializers.FloatField()


class SessionFeedbackResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    message = serializers.CharField(required=False)
    session = serializers.DictField(required=False)
    adaptive_feedback = serializers.CharField(allow_blank=True)
    next_difficulty = serializers.CharField()


class LeaderboardResponseSerializer(serializers.Serializer):
    leaders = serializers.ListField(child=serializers.DictField())


class MethodologyResponseSerializer(serializers.Serializer):
    cards = serializers.ListField(child=serializers.DictField())
    stack = serializers.ListField(child=serializers.DictField())
