# Phishing Training Platform

A full-stack phishing awareness training app built with Django and React.

Users complete quiz and practice scenarios, receive performance feedback, and get adaptive difficulty based on behavioral and model-driven signals.

## Project Overview

This project combines:

- A Django backend with JWT-based API endpoints
- A React frontend for learner flows and dashboards
- A machine learning layer for user profiling and anomaly detection

Core flow:

1. User takes a baseline quiz.
2. The system records behavior (accuracy, response patterns, and timing).
3. Models classify user skill and flag suspicious or low-quality attempt behavior.
4. Practice recommendations and difficulty are adjusted over time.

## Tech Stack

- Backend: Django, Django REST Framework, SimpleJWT
- Frontend: React, Vite, Axios, Tailwind CSS
- ML/Data: scikit-learn, pandas, numpy, joblib
- Database: SQLite (default)
- Training data: Kaggle phishing/email datasets stored under `datasets/`

## Repository Structure

- `core/`: app models, API/web views, serializers, management commands
- `ml_engine/`: model training, inference, profiling, recommendation logic
- `phishtrainer/`: Django project settings and URL routing
- `frontend/`: React client
- `datasets/`: local datasets used for model training

## Prerequisites

- Python 3.12+
- Node.js 18+
- npm

## Setup

### 1) Clone and create Python environment

```bash
git clone <your-repo-url>
cd phishing-training-platform
python3 -m venv phishenv
source phishenv/bin/activate
pip install -r requirements.txt
```

### 2) Configure environment variables

```bash
cp .env.example .env
```

Set this required value in `.env`:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
```

Notes:

- `DJANGO_SECRET_KEY` is required. The app will not start without it.
- Frontend environment variables are not required for local development with the current Vite proxy setup.

### 3) Initialize database and seed scenarios

```bash
python manage.py migrate
python manage.py seed_scenarios
```

### 4) Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

## Running the App

Run backend (terminal 1):

```bash
source phishenv/bin/activate
python manage.py runserver
```

Run frontend (terminal 2):

```bash
cd frontend
npm run dev
```

Local URLs:

- Backend: http://127.0.0.1:8000
- Frontend: http://127.0.0.1:5173

## Useful Commands

- Django system check: `python manage.py check`
- Run tests: `python manage.py test`
- Retrain email/anomaly models: `python manage.py retrain_models --kaggle`
- Retrain user profiling model: `python manage.py retrain_models --profiles`
- Frontend build: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`

## API Snapshot

- `POST /api/register/`
- `POST /api/login/`
- `GET /api/me/`
- `GET /api/quiz/baseline/`
- `POST /api/quiz/submit/`
- `GET /api/practice/`
- `POST /api/practice/submit/`
- `GET /api/dashboard/`
- `POST /api/detect-email/`

## Datasets

- https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset
- https://www.kaggle.com/datasets/wcukierski/enron-email-dataset

## License

Educational/portfolio use.
