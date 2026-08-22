# ── National Disaster Response Portal — Deployment Guide ─────────────────────
#
# STACK:  Backend → Railway (Node.js + PostgreSQL)
#         Frontends → Vercel (2 separate projects, both free)
#
# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Get a free PostgreSQL database (pick ONE)
# ─────────────────────────────────────────────────────────────────────────────
#
# Option A — Neon (recommended, fully free serverless PostgreSQL):
#   1. Sign up at https://neon.tech
#   2. Create a new project → copy the "Connection string"
#      (looks like: postgres://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require)
#
# Option B — Supabase (free tier):
#   1. Sign up at https://supabase.com → New Project
#   2. Settings → Database → "Connection string" (URI tab)
#
# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Deploy the Backend on Railway
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. Sign up at https://railway.app
#   2. New Project → Deploy from GitHub Repo → select your repo
#   3. Railway will auto-detect Node.js. Set the Root Directory to: backend
#   4. Add the following Environment Variables in Railway dashboard:
#
#        DATABASE_URL      = <paste connection string from Step 1>
#        ALLOWED_ORIGINS   = https://your-citizen-app.vercel.app,https://your-rescuer-app.vercel.app
#        NODE_ENV          = production
#
#   5. Railway will auto-set PORT. The app will be live at:
#        https://your-project.up.railway.app
#
# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Deploy Citizen Frontend on Vercel
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. Sign up at https://vercel.com → New Project → Import GitHub repo
#   2. Set:
#        Root Directory:   frontend-user
#        Build Command:    npm run build
#        Output Directory: dist
#   3. Add Environment Variable:
#        VITE_API_URL = https://your-project.up.railway.app/api
#   4. Click Deploy → you get a URL like: https://disaster-citizen.vercel.app
#
# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Deploy Rescuer Frontend on Vercel
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. In Vercel → New Project → same GitHub repo (Vercel supports multi-root)
#   2. Set:
#        Root Directory:   frontend-rescuer
#        Build Command:    npm run build
#        Output Directory: dist
#   3. Add Environment Variable:
#        VITE_API_URL = https://your-project.up.railway.app/api
#   4. Click Deploy → you get a URL like: https://disaster-rescuer.vercel.app
#
# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Update CORS on Railway
# ─────────────────────────────────────────────────────────────────────────────
#
#   Go back to Railway → your backend → Variables tab, and update:
#     ALLOWED_ORIGINS = https://disaster-citizen.vercel.app,https://disaster-rescuer.vercel.app
#   (use the actual Vercel URLs from Steps 3 & 4)
#   Railway will auto-redeploy.
#
# ─────────────────────────────────────────────────────────────────────────────
# LOCAL DEVELOPMENT (no changes needed)
# ─────────────────────────────────────────────────────────────────────────────
#
#   1. cp backend/.env.example backend/.env
#      → Edit DATABASE_URL to your local PostgreSQL or Neon connection string
#   2. cd backend && npm install && node server.js
#   3. cd frontend-user && npm install && npm run dev   (port 5174)
#   4. cd frontend-rescuer && npm install && npm run dev (port 5173)
