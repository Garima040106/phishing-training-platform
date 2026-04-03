# PhishGuard AI - Quick Start Guide

## Overview
PhishGuard AI is an adaptive phishing training platform that uses machine learning to provide personalized training based on your skill level and weaknesses.

## Quick Start (60 seconds)

### 1. Start the Server
```bash
source phishenv/bin/activate
python manage.py runserver
```

### 2. Open in Browser
Navigate to: `http://localhost:8000/register/`

### 3. Create Your Account
- Register with username and password
- You'll be redirected to the baseline assessment

### 4. Take the Baseline Quiz
- Evaluate 10 random email scenarios
- Identify whether each is phishing or legitimate
- The system will calculate your initial skill level

### 5. Explore Features
After the baseline quiz:
- **Dashboard**: View your statistics and recommendations
- **Practice**: Train on scenarios at your difficulty level
- **Leaderboard**: See how you compare to others
- **Methodology**: Learn about the ML technology behind the platform

## Key Concepts

### Skill Levels
- 🟨 **Beginner**: Learning to identify obvious red flags
- 🟦 **Intermediate**: Recognizing sophisticated social engineering
- 🟥 **Advanced**: Spotting subtle phishing attempts

### How It Works
1. Your answers train the system
2. Machine learning classifier evaluates your skill
3. System recommends appropriate difficulty
4. Recommendations target your weak areas
5. Anomaly detection flags unusual behavior

### Your Metrics
- **Accuracy**: Percentage of correct identifications
- **Response Time**: How quickly you make decisions
- **Skill Level**: Current classification (Beginner/Intermediate/Advanced)
- **Total Attempts**: How many scenarios you've evaluated

## Features

✨ **Adaptive Learning**
- Difficulty adjusts to your performance
- Personalized recommendations
- Real-time skill assessment

🔒 **Security Focused**
- Anomaly detection for account concerns
- Real-world phishing scenario patterns
- Best practices guidance

📊 **Performance Tracking**
- Charts showing your progress
- Comparison leaderboard
- Detailed attempt history

🎯 **Targeted Training**
- Weaknesses identified automatically
- Tips for improvement provided
- Difficulty progression

## Troubleshooting

**Forgot password?**
- Use Django admin at `/admin/` (superuser required)

**Models not loading?**
- Run: `python manage.py migrate`
- Models auto-train on startup

**Database errors?**
- Delete `db.sqlite3` and re-run migrations
- Run: `python manage.py seed_scenarios`

## Admin Access

If you have superuser credentials:
```bash
python manage.py createsuperuser
# Then visit http://localhost:8000/admin/
```

From admin panel you can:
- Manage users and profiles
- View/edit scenarios
- Inspect user attempts
- Monitor recommendations

## Technology Stack

- **Backend**: Django 6.0 (Python)
- **Database**: SQLite
- **ML**: scikit-learn (Random Forest + Isolation Forest)
- **Frontend**: Bootstrap 4 + Chart.js
- **Data Processing**: Pandas + NumPy

## Next Steps

1. **Take the Assessment**: Complete your baseline to establish starting point
2. **Practice Regularly**: Use different difficulty levels to improve
3. **Review Recommendations**: Follow tips to address weaknesses
4. **Check Progress**: Visit dashboard to track improvement
5. **Compare Performance**: See how you rank on leaderboard

## Support & Documentation

- See `README.md` for full documentation
- See `DEPLOYMENT.md` for deployment details
- See `phishtrainer/settings.py` for configuration

---

**PhishGuard AI** - Real Phishing, Real Learning, Real Security


## Default URLs

- Register: `http://localhost:8000/register/`
- Login: `http://localhost:8000/login/`
- Dashboard: `http://localhost:8000/dashboard/`
- Quiz: `http://localhost:8000/quiz/`
- Practice: `http://localhost:8000/practice/`
- Leaderboard: `http://localhost:8000/leaderboard/`
- Methodology: `http://localhost:8000/methodology/`
- Admin: `http://localhost:8000/admin/`
