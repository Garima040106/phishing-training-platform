# Changelog

All notable changes to this project are documented in this file.

## [v2.0.4] - 2026-04-03

### Added
- Email authenticity checker flow:
  - Backend endpoint: `POST /api/detect-email/`
  - ML inference helper for direct email classification
  - React page and navigation route for authenticated users
- Collaboration note in `README.md` clarifying project development style.

### Changed
- Methodology page redesigned into documentation-style technical walkthrough.
- `README.md` updated endpoint list to include `/api/detect-email/`.

### Verification
- `python manage.py check` passes
- `python manage.py migrate` up-to-date
- `frontend` builds successfully with `npm run build`

## [v2.0.0] - 2026-04-03

### Added
- Complete React frontend (`frontend/`) with:
  - Auth (register/login/logout)
  - Dashboard with chart
  - Baseline quiz flow
  - Practice + result flow
  - Leaderboard + methodology pages
  - Protected routes and shared layout/components
- Django JSON API endpoints (now in `core/views.py`, with a compatibility shim in `core/api_views.py`):
  - `/api/csrf/`, `/api/register/`, `/api/login/`, `/api/logout/`, `/api/me/`
  - `/api/quiz/baseline/`, `/api/quiz/submit/`
  - `/api/dashboard/`, `/api/practice/`, `/api/practice/submit/`
  - `/api/leaderboard/`, `/api/methodology/`
- Kaggle training quality report artifact:
  - `ml_engine/saved_models/training_report.json`

### Changed
- Refactored `ml_engine/kaggle_trainer.py` to use real Kaggle email feature distributions.
- `retrain_models` command now runs the active Kaggle trainer and prints benchmark metrics.
- Updated `README.md` to a human-friendly, production-style project README.
- Updated `ALLOWED_HOSTS` for local/dev/test compatibility.

### Fixed
- JSON serialization issues from numpy scalar types in API responses.
- Local host/test host errors during API smoke testing.
- Missing local `static/` directory warning from Django checks.

### Verification
- `python manage.py check` passes
- `python manage.py migrate` up-to-date
- `python manage.py retrain_models --kaggle` succeeds
- API smoke flow passes (register → quiz → dashboard → practice)
- `frontend` builds successfully with `npm run build`
