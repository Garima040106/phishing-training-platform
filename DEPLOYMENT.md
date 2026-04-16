# PhishGuard AI - Deployment Log

## Environment Variables (Required)

Set this variable in your deployment environment before starting the app:

DJANGO_SECRET_KEY=your-unique-production-secret

## Deployment Date
April 3, 2026

## Migrations Status: ✅ COMPLETE

### Database Initialization
- Django migrations applied successfully
- Tables created for:
  - UserProfile
  - PhishingScenario
  - UserAttempt
  - TrainingRecommendation
- SQLite database: `db.sqlite3` (168 KB)

## Machine Learning Models: ✅ TRAINED & LOADED ON STARTUP

### Skill Classifier (Random Forest)
- Model: RandomForestClassifier
- Estimators: 100
- Training data: 300 synthetic samples
- Output file: `ml_engine/saved_models/rf_skill.pkl` (86 KB)
- Status: Loaded successfully on app startup

### Anomaly Detector (Isolation Forest)
- Model: IsolationForest
- Contamination: 0.05
- Training data: 500 synthetic normal behavior samples
- Output file: `ml_engine/saved_models/iso_forest.pkl` (1.8 MB)
- Status: Loaded successfully on app startup

## Seed Data: ✅ 12 SCENARIOS SEEDED

### Difficulty Distribution
- Easy: 4 scenarios (2 phishing, 2 legitimate)
- Medium: 4 scenarios (2 phishing, 2 legitimate)
- Hard: 4 scenarios (2 phishing, 2 legitimate)

### Scenarios Loaded
1. Fake Prize Win Email (Easy Phishing)
2. Fake Bank Suspension Email (Easy Phishing)
3. GitHub Newsletter (Easy Legitimate)
4. Library Book Reminder (Easy Legitimate)
5. Fake IT Password Reset (Medium Phishing)
6. Fake DocuSign Request (Medium Phishing)
7. Amazon Order Confirmation (Medium Legitimate)
8. Zoom Meeting Invite (Medium Legitimate)
9. Convincing Microsoft Security Alert (Hard Phishing)
10. Spear Phishing HR Appraisal Email (Hard Phishing)
11. Real Google Security Alert (Hard Legitimate)
12. LinkedIn Connection Acceptance (Hard Legitimate)

## Features Available
✅ User registration with auto-profile creation
✅ Email/password authentication
✅ Baseline assessment (10 random scenarios)
✅ Adaptive practice mode (easy/medium/hard)
✅ Real-time response time tracking
✅ Skill level classification (Beginner/Intermediate/Advanced)
✅ Anomaly detection and alerts
✅ Personalized training recommendations
✅ Performance dashboard with charts
✅ Leaderboard rankings
✅ Responsive Bootstrap 4 UI
✅ Pre-trained ML models loaded on startup

## Ready to Start Training!

Run: `python manage.py runserver`
Visit: http://localhost:8000
