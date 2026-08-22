<<<<<<< HEAD
# Sentinel — AI-based Intelligent Disaster Response & Resource Allocation System

A full-stack demonstration project: a command-center dashboard that ingests
disaster zone data, computes an explainable AI-style priority score per zone,
recommends resource allocations, plans safe routes, and accepts citizen
emergency reports — all backed by a real REST API and a SQL database.

## Stack

- **Frontend:** React 19 + Vite (plain CSS, no UI framework, so every line is yours to explain)
- **Backend:** Node.js + Express (REST API)
- **Database:** SQLite, via Node's **built-in** `node:sqlite` module (requires Node.js 22.5+) — a real relational database, zero server setup and zero native compilation required
- **No external services, API keys, or cloud accounts required to run it locally.**

> **Note:** you'll see `ExperimentalWarning: SQLite is an experimental feature` printed
> when the backend starts. That's expected and harmless — it's Node.js telling you
> its built-in SQLite support is still marked experimental, not an error.

## Project structure

```
disaster-response-system/
├── backend/
│   ├── server.js       # Express app + all API routes
│   ├── db.js            # SQLite connection + schema
│   ├── priority.js      # The "AI" scoring + recommendation logic
│   ├── seed.js           # Populates the database with demo data
│   └── data/disaster.db  # SQLite database file (created automatically)
└── frontend/
    └── src/
        ├── App.jsx        # Main dashboard layout + data fetching
        ├── api.js         # Talks to the backend REST API
        └── components/    # One component per dashboard panel
```

## How the "AI" works

This project uses a transparent, rule-based scoring model rather than a
trained machine-learning model — deliberately, so you can explain every part
of it in an interview:

```
score = flood_severity_weight × 4  +  (population / 1000) × 0.9  +  road_penalty × 2
```

- Flood severity: Low=1, Medium=2, High=3
- Road penalty: Open=0, Damaged=1, Blocked=2
- Score ≥ 14 → Critical, ≥ 9 → High, ≥ 5 → Medium, else → Safe

See `backend/priority.js`. This is a genuinely good talking point on a
resume/interview: you can describe it as a rule-based decision-support
system, and mention that swapping in a trained model (e.g. an image
classifier on satellite photos for the "damage detection" step) is the
natural next iteration.

## Full setup instructions

See the step-by-step guide provided separately, or the quick reference below
if you already have Node.js installed.

### Quick start (if Node.js is already installed)

```bash
# 1. Backend
cd backend
npm install
npm run seed     # creates and populates the database
npm start         # starts API on http://localhost:4000

# 2. Frontend (in a NEW terminal window)
cd frontend
npm install
npm run dev        # starts app on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

## Resetting demo data

If you dispatch all the resources and want to start over:

```bash
cd backend
npm run seed
```

This wipes and re-populates the database with the original 6 zones and full
resource counts.
=======
# Disaster-response-system
>>>>>>> origin/main
