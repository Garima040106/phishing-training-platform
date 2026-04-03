# PhishGuard AI

PhishGuard AI is an adaptive phishing training platform built with Django, React, and scikit-learn.

It helps users learn how to identify phishing emails through baseline assessments, guided practice, personalized recommendations, and ML-based skill progression.

---

## Why this project exists

Most phishing training is static. Real users are not.

PhishGuard AI adapts to each user by tracking accuracy, response time, and behavior consistency. It then adjusts difficulty and recommendations so users improve faster on the areas where they struggle.

---

## Core Features

- Adaptive baseline + practice workflow
- Skill classification (`beginner`, `intermediate`, `advanced`)
- Anomaly detection for suspicious behavior patterns
- Personalized recommendation engine based on missed indicators
- Leaderboard for engagement
- Methodology page to explain model logic and architecture
- Complete React frontend with protected routes
- JSON API backend for SPA integration

---

## Tech Stack

### Backend
- Django 6
- SQLite (default)
- Django auth + sessions

### Machine Learning
- scikit-learn
- RandomForestClassifier (skill classification)
- IsolationForest (anomaly detection)
- joblib (model persistence)

### Frontend
- React + Vite
- React Router
- Axios
- Chart.js
- Tailwind CSS

---

## Kaggle Dataset Integration

This project is trained with the exact datasets below:

1. Phishing Email Dataset  
   https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset

2. Enron Email Dataset  
   https://www.kaggle.com/datasets/wcukierski/enron-email-dataset

### What is used from the datasets

- Phishing corpus (`phishing_email.csv`) and Enron corpus (`emails.csv`) are loaded and normalized.
- Email-level features are extracted (urgency, suspicious links, attachment signals, grammar noise, caps ratio, length, etc.).
- A benchmark classifier is run to verify signal quality.
- Feature distributions are used to generate realistic behavior patterns for skill + anomaly model training.

A training quality report is written to:

`ml_engine/saved_models/training_report.json`

---

## Project Structure

```text
phishing-training-platform/
├── core/
│   ├── models.py
│   ├── views.py
│   ├── api_views.py
│   ├── urls.py
│   ├── signals.py
│   └── templates/
├── ml_engine/
│   ├── kaggle_trainer.py
│   ├── recommender.py
│   └── saved_models/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── api/
│   └── package.json
├── datasets/
├── phishtrainer/
├── manage.py
└── requirements.txt
```

---

## Local Setup

### 1) Backend setup

```bash
python3 -m venv phishenv
source phishenv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_scenarios
```

### 2) Frontend setup

```bash
cd frontend
npm install
cd ..
```

### 3) Run both apps

Terminal A:
```bash
source phishenv/bin/activate
python manage.py runserver
```

Terminal B:
```bash
cd frontend
npm run dev
```

- Backend: http://127.0.0.1:8000
- Frontend: http://127.0.0.1:5173

---

## Retrain models with Kaggle data

Make sure datasets are in `datasets/` and run:

```bash
source phishenv/bin/activate
python manage.py retrain_models --kaggle
```

This updates:
- `ml_engine/saved_models/rf_skill.pkl`
- `ml_engine/saved_models/iso_forest.pkl`
- `ml_engine/saved_models/training_report.json`

---

## API Endpoints (React SPA)

- `GET  /api/csrf/`
- `POST /api/register/`
- `POST /api/login/`
- `POST /api/logout/`
- `GET  /api/me/`
- `GET  /api/quiz/baseline/`
- `POST /api/quiz/submit/`
- `GET  /api/dashboard/`
- `GET  /api/practice/`
- `POST /api/practice/submit/`
- `GET  /api/leaderboard/`
- `GET  /api/methodology/`

---

## Quality Checks before release

- `python manage.py check`
- `python manage.py migrate`
- `python manage.py retrain_models --kaggle`
- `npm run build` (inside `frontend/`)

---

## Roadmap

- Add Docker + production deployment profile
- Add pytest-based API tests
- Add model monitoring metrics and drift checks
- Add organization/team mode with role-based dashboards

---

## License

Educational / portfolio use.

---

If you want, I can also add CI (GitHub Actions) so every push auto-runs backend checks, model sanity checks, and frontend build.
