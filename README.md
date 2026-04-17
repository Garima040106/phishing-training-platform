# PhishGuard AI

An adaptive phishing awareness and email risk detection platform built for hands-on cyber safety training.

## Academic Submission

Institution: Dayananda Sagar University
Course: AICS Minor Project

Team:

- Pranav CP (ENG24CY0144)
- Garima Varma (ENG24CY0105)
- Debayan Nath (ENG24CY0097)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Backend | Django, Django REST Framework, SimpleJWT |
| Frontend | React, Vite, Axios, Tailwind CSS |
| ML | scikit-learn, pandas, NumPy, joblib |
| Datasets | CEAS_08, Enron, Ling, Nazario, Nigerian_Fraud, phishing_email, SpamAssasin |

## Setup Instructions

1. Create and activate virtual environment, then install Python dependencies.

	python3 -m venv phishenv
	source phishenv/bin/activate
	pip install -r requirements.txt

2. Create environment file.

	cp .env.example .env

3. Apply database migrations.

	python manage.py migrate

4. Seed phishing scenarios.

	python manage.py seed_scenarios

5. Start backend server.

	python manage.py runserver

6. In a new terminal, start frontend dev server.

	cd frontend
	npm install
	npm run dev

Local development URLs:

- Backend: http://127.0.0.1:8000
- Frontend: http://127.0.0.1:5173

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/csrf/ | Returns CSRF cookie bootstrap response for browser clients. |
| POST | /api/register/ | Creates a new user account and returns JWT tokens. |
| POST | /api/login/ | Authenticates user and returns JWT tokens. |
| POST | /api/logout/ | Stateless logout acknowledgement for authenticated users. |
| POST | /api/progress/reset/ | Resets attempts, recommendations, and adaptive progress for current user. |
| GET | /api/me/ | Returns current user profile and baseline completion status. |
| GET | /api/quiz/baseline/ | Fetches 10 baseline scenarios (if baseline not already completed). |
| POST | /api/quiz/submit/ | Submits baseline answers and initializes adaptive profile state. |
| GET | /api/dashboard/ | Returns skill/confidence, anomaly insights, trends, and recommendations. |
| GET | /api/report/stats/ | Returns structured analytics used by reporting charts. |
| GET | /api/report/generate/ | Generates and downloads user performance PDF report. |
| GET | /api/practice/ | Returns next adaptive or manually requested practice scenario. |
| POST | /api/practice/submit/ | Submits one practice attempt and updates profile/adaptive engine. |
| POST | /api/feedback/session/ | Closes current practice session and returns session-level feedback. |
| GET | /api/leaderboard/ | Returns leaderboard with masked usernames for other users. |
| GET | /api/methodology/ | Returns methodology cards and stack metadata for info page. |
| POST | /api/detect-email/ | Runs ML phishing prediction on custom email text input. |

## Architecture Diagram

	+-------------------+
	|  Learner Browser  |
	+---------+---------+
			  |
			  v
	+-------------------+
	| React Frontend    |
	| (Vite SPA)        |
	+---------+---------+
			  |
	  HTTPS / JSON API
			  |
			  v
	+-------------------+      +-------------------------+
	| Django Backend    |----->| SQLite (users, attempts,|
	| DRF + JWT         |      | profiles, scenarios)    |
	+---------+---------+      +-------------------------+
			  |
			  v
	+-------------------+      +-------------------------+
	| ML Engine         |<-----| Local + Kaggle datasets |
	| (scikit-learn)    |      | in datasets/            |
	+-------------------+      +-------------------------+

## Known Issues

- Model quality improves only after enough user attempts; very small data can produce unstable recommendations.
- First startup can be slower because model loading/training is triggered during app initialization.
- Practice scenarios may repeat once unseen scenarios in a chosen difficulty are exhausted.
- SQLite and local model files are suitable for academic/demo usage, not multi-instance production scaling.

## License

Educational and academic demonstration use.
