# PhishGuard AI - Adaptive Phishing Training Platform

An AI-powered Django application designed to provide personalized phishing awareness training using machine learning classification and anomaly detection.

## Overview

PhishGuard AI is a comprehensive phishing training platform that adapts to users' skill levels and identifies weaknesses to provide targeted training recommendations. The system uses ensemble machine learning methods to classify user skill levels and detect anomalous behavior patterns.

## Features

- **Adaptive Training**: Difficulty levels automatically adjust based on user performance
- **Skill Classification**: Random Forest classifier categorizes users as Beginner, Intermediate, or Advanced
- **Anomaly Detection**: Isolation Forest detects unusual user behavior patterns
- **Personalized Recommendations**: Identifies user weaknesses and provides targeted training tips
- **Real-time Performance Tracking**: Response time and accuracy metrics for continuous improvement
- **Leaderboard System**: Competitive element to encourage engagement
- **Responsive UI**: Bootstrap 4 frontend with Chart.js visualizations

## Project Structure

```
phishing-training-platform/
├── phishtrainer/             # Main Django project
│   ├── settings.py           # Project settings
│   ├── urls.py               # URL routing
│   └── wsgi.py               # WSGI configuration
│
├── core/                     # Main application
│   ├── models.py             # Database models
│   ├── views.py              # View functions
│   ├── urls.py               # App URL routing
│   ├── admin.py              # Django admin configuration
│   ├── signals.py            # Django signals
│   ├── management/
│   │   └── commands/
│   │       └── seed_scenarios.py  # Database seeding
│   └── templates/core/       # HTML templates
│
├── ml_engine/                # Machine Learning module
│   ├── classifier.py         # Random Forest & Isolation Forest models
│   ├── recommender.py        # Recommendation engine
│   ├── saved_models/         # Trained ML models
│   │   ├── rf_skill.pkl      # Random Forest model
│   │   └── iso_forest.pkl    # Isolation Forest model
│   └── apps.py               # ML app config with model loading
│
├── phishenv/                 # Python virtual environment
├── manage.py                 # Django management script
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## Installation & Setup

### Prerequisites
- Python 3.8+
- pip package manager

### Step 1: Create Virtual Environment
```bash
python3 -m venv phishenv
source phishenv/bin/activate  # On Windows: phishenv\Scripts\activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 4: Seed Training Scenarios
```bash
python manage.py seed_scenarios
```

### Step 5: Create Superuser (Optional)
```bash
python manage.py createsuperuser
```

### Step 6: Start Development Server
```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000`

## Models

### UserProfile
- OneToOne relationship with Django User
- **Fields**: skill_level, total_attempts, correct_answers, avg_response_time, is_anomalous, last_updated
- **Methods**: accuracy() - calculates accuracy percentage

### PhishingScenario
- Represents email training scenarios
- **Fields**: title, sender_email, subject, body, is_phishing, difficulty, phishing_indicators
- **Methods**: get_indicators() - parses and returns list of phishing indicators

### UserAttempt
- Records individual user attempts on scenarios
- **Fields**: user, scenario, user_answer, is_correct, response_time, timestamp, confidence_score

### TrainingRecommendation
- Personalized recommendations for users
- **Fields**: user, weakness_type, recommendation, created_at, is_read

## Machine Learning Components

### Skill Classifier (RandomForest)
- **Model**: RandomForestClassifier (n_estimators=100)
- **Features**: accuracy, avg_response_time, total_attempts, hard_accuracy, medium_accuracy
- **Output Classes**: 
  - 0: Beginner (10-45% accuracy, 20-60s response time)
  - 1: Intermediate (45-75% accuracy, 10-35s response time)
  - 2: Advanced (75-100% accuracy, 3-15s response time)
- **Training Data**: 300 synthetic samples (100 per class)

### Anomaly Detector (IsolationForest)
- **Model**: IsolationForest (contamination=0.05)
- **Features**: accuracy, response_time, consistency_score
- **Purpose**: Detect unusual user behavior patterns
- **Training Data**: 500 synthetic normal behavior samples

## Key Views

- **register_view**: User registration with auto-profile creation
- **login_view**: User authentication
- **baseline_quiz**: Initial 10-scenario assessment
- **submit_quiz**: Process quiz responses and update profile
- **dashboard**: Main user dashboard with stats and recommendations
- **practice**: Single scenario practice mode
- **submit_practice**: Record practice attempt and update profile
- **leaderboard**: Display top 10 users
- **methodology**: Explain platform architecture and tech stack

## Templates

All templates use Bootstrap 4 CDN and Chart.js for visualizations:

- **base.html**: Navigation and layout template
- **register.html**: User registration form
- **login.html**: User login form
- **dashboard.html**: Main dashboard with statistics and chart
- **quiz.html**: Baseline assessment with 10 scenarios
- **practice.html**: Single scenario practice mode
- **result.html**: Attempt result with explanation
- **leaderboard.html**: Top 10 users ranking
- **methodology.html**: Platform documentation

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | Django 6.0 | Web framework |
| Database | SQLite 3 | Data persistence |
| ML Models | scikit-learn | RandomForest, IsolationForest |
| Data Processing | Pandas, NumPy | Data manipulation |
| Model Persistence | Joblib | Serialize ML models |
| Frontend | Bootstrap 4 | Responsive UI |
| Charting | Chart.js | Performance visualization |
| Forms | Django Crispy Forms | Form rendering |

## Seed Data

The platform includes 12 pre-seeded phishing scenarios:

**Easy (4 scenarios)**
- 2 Phishing: Fake Prize Win, Bank Suspension
- 2 Legitimate: GitHub Newsletter, Library Reminder

**Medium (4 scenarios)**
- 2 Phishing: IT Password Reset, Fake DocuSign
- 2 Legitimate: Amazon Order, Zoom Meeting

**Hard (4 scenarios)**
- 2 Phishing: Microsoft Security Alert, HR Appraisal Spear Phishing
- 2 Legitimate: Google Security Alert, LinkedIn Connection

## Workflow

1. **User Registration**: New users create account, which triggers auto-creation of UserProfile
2. **Baseline Assessment**: 10 random scenarios to establish initial skill level
3. **ML Classification**: Random Forest classifier determines skill level based on performance
4. **Adaptive Practice**: System recommends appropriate difficulty level
5. **Anomaly Detection**: Isolation Forest monitors for suspicious behavior
6. **Recommendations**: System analyzes weaknesses and provides targeted training tips
7. **Leaderboard**: Users can compare progress with others

## Environment Variables

Create a `.env` file for production (not needed for development):
```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
```

## API Endpoints

### Authentication
- `POST /register/` - User registration
- `POST /login/` - User login
- `GET /logout/` - User logout

### Training
- `GET /quiz/` - Baseline assessment page
- `POST /quiz/submit/` - Submit quiz responses
- `GET /dashboard/` - User dashboard
- `GET /practice/` - Single scenario practice
- `POST /practice/submit/` - Submit practice attempt
- `GET /leaderboard/` - View rankings
- `GET /methodology/` - Platform documentation

## Development Notes

- ML models are trained on startup via `ml_engine/apps.py`
- User profiles are auto-created via Django signals
- Response times are tracked in seconds
- All timestamps in UTC
- SQLite database file: `db.sqlite3`

## Future Enhancements

- Integration with real Kaggle datasets (Phishing Email Dataset, Enron Email Dataset)
- API endpoints for programmatic access
- Email simulation with actual SMTP
- Team/organization management
- Advanced analytics dashboard
- Integration with security information systems

## License

This project is provided for educational purposes.

## Support

For issues or questions, please contact the development team.

---

**PhishGuard AI** - Making Phishing Awareness Training Adaptive and Effective
