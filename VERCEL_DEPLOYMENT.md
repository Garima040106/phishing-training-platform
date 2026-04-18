# Vercel Deployment Guide (Frontend) + Django API Backend

This repository is configured for a split deployment:
- Frontend: Vercel
- Backend API: Render or Railway (recommended)
- Database: Postgres

## What Was Prepared In Code

- Frontend API base URL now uses `VITE_API_BASE_URL` with `/api` fallback.
- Django supports Postgres via `DATABASE_URL`.
- Django CORS + CSRF trusted origins are env-driven.
- Vercel config files were added:
  - `vercel.json` (root import mode)
  - `frontend/vercel.json` (frontend root mode)

## 1. Deploy Backend API (Render or Railway)

Use repo root as service root.

### Build Command

```bash
pip install -r requirements.txt
```

### Start Command

```bash
python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT
```

### Required Environment Variables

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DEBUG=False
ALLOWED_HOSTS=your-backend-domain.onrender.com
DATABASE_URL=postgres://user:password@host:5432/dbname
DB_SSLMODE=require
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app
SECURE_SSL_REDIRECT=True
```

After deployment, confirm these URLs respond:
- `https://your-backend-domain/api/me/` (expects auth)
- `https://your-backend-domain/api/methodology/`

## 2. Deploy Frontend on Vercel

You can use either option.

### Option A: Root Directory `./` (works with included root `vercel.json`)
- Framework Preset: `Other` or `Vite`
- Root Directory: `./`

### Option B: Root Directory `frontend` (works with `frontend/vercel.json`)
- Framework Preset: `Vite`
- Root Directory: `frontend`

### Vercel Environment Variable

```env
VITE_API_BASE_URL=https://your-backend-domain/api
```

Deploy after setting the variable.

## Common Error: "No module named django" during Vercel build

If you see this error right after frontend build completes, Vercel is still treating the project as Django.

Fix it with one of these:

1. Preferred: In Vercel project settings, set Root Directory to `frontend` and Framework Preset to `Vite`.
2. Or keep Root Directory `./` and set Framework Preset to `Other` or `Vite`.

Then trigger a new deployment.

## 3. Post-Deploy Smoke Test

1. Open frontend URL.
2. Register a new account.
3. Login and open dashboard.
4. Open practice page and submit one answer.
5. Verify leaderboard and methodology pages load.

## Notes

- SQLite is not used for production in this setup.
- ML model files are loaded from repository artifacts in `ml_engine/saved_models`.
- If backend start is slow on cold boot, this is expected due to model loading.
