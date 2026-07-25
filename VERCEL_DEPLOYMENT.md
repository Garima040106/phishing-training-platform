# Vercel Deployment Guide (Frontend) + Django API Backend

This repository is configured for a split deployment:
- Frontend: Vercel
- Backend API: Render or Railway (recommended)
- Database: Postgres

## What Was Prepared In Code

- Frontend API base URL now uses `VITE_API_BASE_URL` with `/api` fallback (see the warning below - set this explicitly for any real deployment).
- Django supports Postgres via `DATABASE_URL`.
- Django CORS + CSRF trusted origins are env-driven.
- Vercel config: root `vercel.json` installs and builds `frontend/` directly via `npm --prefix frontend`, with `outputDirectory` set to `frontend/dist`. This works with Vercel's Root Directory left at the repo root (the default/empty setting) - no dashboard changes needed.

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

- Framework Preset: `Other` (the root `vercel.json` supplies its own install/build commands, so leave the preset generic).
- Root Directory: leave empty / `./` (the default). Do not point Root Directory at `frontend` - the root `vercel.json` already builds `frontend/` for you, and pointing Root Directory there too would make Vercel look for a second, conflicting config.

### Vercel Environment Variable

```env
VITE_API_BASE_URL=https://your-backend-domain/api
```

**This must be set explicitly.** Without it, the frontend falls back to a relative `/api` path that only works for local `vite dev` (which proxies to Django). On Vercel there's no such proxy, so requests get silently caught by the SPA rewrite instead of reaching your backend - register/login will look like they succeed while doing nothing.

Deploy after setting the variable.

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
