Sentinel — Disaster Response System
A full-stack disaster command system with three parts:
Citizen App — people in danger send an SOS with their location and photo
Rescuer Dashboard — responders see incoming SOS calls, monitor risk zones on a map, and dispatch resources
Backend API — scores every geographic zone's disaster risk using a transparent, rule-based formula (not a black-box ML model), tracks resource inventory, and stores everything in a database
Both frontends talk to the same backend, so a citizen's SOS appears on the rescuer's dashboard in near real time (polling every few seconds).
Live Deployments
App
URL
Hosted on
Backend API
https://disaster-response-system-pf6j.onrender.com
Render
Citizen App
https://disaster-response-user.vercel.app
Vercel
Rescuer Dashboard
https://disaster-response-rescuer.vercel.app
Vercel
These are three separate deployed apps that form one project. The two Vercel frontends are independent React apps that both call the same Render backend over HTTPS. Neither frontend talks to the other directly — the backend + database is the shared source of truth.
Note: DEPLOY.md describes deploying the backend on Railway; the live instance is actually hosted on Render instead (functionally equivalent — a Node host running npm start).
Repo Structure
Code
Both frontends are separate Vite React apps with their own package.json, so they deploy independently on Vercel as two separate Vercel projects pointed at the same GitHub repo, with different "Root Directory" settings.
Database
The backend supports two database engines via one shared query() function in db.js:
PostgreSQL — used in production (Render sets a DATABASE_URL env var)
SQLite (node:sqlite) — used automatically for local dev if no DATABASE_URL is set; zero setup required
The same SQL (using $1, $2... placeholders) is written once and rewritten to ? placeholders for SQLite behind the scenes.
Tables
zones — 6 disaster-risk sectors, seeded with real Indian Northeast locations (Assam, Meghalaya, Sikkim, Arunachal Pradesh, Nagaland/Manipur, Mizoram). Each row stores rainfall, soil saturation %, slope instability, hill-cutting risk, isolated villages count, flood level, population, road status, and x/y/w/h pixel coordinates for the risk map.
resources — equipment inventory: earthmovers (JCBs), bailey_bridges, mountain_teams (SDRF/NDRF), drone_recon, air_drop_kits, ambulances. Each has a total and available count.
reports — every citizen SOS submission: name, phone, location, people count, emergency type, medical flag, photo (base64 text), GPS lat/lng, status (Pending → Dispatched → Resolved), assigned unit, ETA, and live-tracked rescuer_lat/rescuer_lng.
feedback — post-rescue citizen feedback/ratings, with an action_note a rescuer can attach.
dispatch_log — audit trail of every resource dispatch ("Command Log" panel).
routes — 3 hardcoded road routes per zone with a status (Safe / Damaged / Blocked by Landslide / Flooded).
On backend startup, initDb() creates tables if they don't exist, then seeds zones/resources/routes/feedback only if each table is empty — restarting the server never wipes real data.
Risk Scoring — How It Works
This is a transparent, rule-based formula, not a machine learning model — a deliberate design choice: explainable, auditable, and instantly recalculable. All logic lives in backend/priority.js.
Step 1 — Composite risk score per zone
Code
Step 2 — Priority label
score ≥ 15 → Critical
score ≥ 10 → High
score ≥ 5.5 → Medium
else → Safe
Step 3 — Two supplementary probabilities
Landslide probability — based on rainfall thresholds (>200mm, >120mm, >60mm bands), boosted by soil saturation above 75%, plus slope/hill-cutting factors. Clamped 5–99%.
Flash flood probability — (rainfall/250) × 60, boosted if soil saturation > 80%. Clamped 5–98%.
Step 4 — Early warning alert level
Red Alert (score ≥ 15 or landslide ≥ 75%)
Orange Alert (score ≥ 10 or landslide ≥ 50%)
Yellow Alert (score ≥ 5.5 or landslide ≥ 30%)
Green (normal monitoring)
Step 5 — Resource recommendation engine
recommendAllocation() takes a zone's priority label plus flags (road blocked? isolated villages? high landslide risk?) and returns recommended dispatch counts per resource type. E.g., a Critical zone with a blocked road gets 2 earthmovers, 1 bailey bridge, 2 mountain teams, 1 drone, 2+ air-drop kits (scaled to isolated village count), and 2 ambulances.
Possible next iteration: swap the rule-based scorer for a trained model (e.g., a CNN classifying satellite/drone imagery for flood/landslide damage detection), while keeping the explainable scoring layer as a sanity-check/fallback.
Live Demo Feature — Weather Simulator
On the rescuer dashboard, under the Priority Table, a "Real-Time Sensor & Climate Simulation" panel has sliders for rainfall, soil saturation, slope fragility, hill-cutting risk, isolated villages, and road status — plus a "⚡ Cloudburst Scenario" button.
Clicking Cloudburst instantly sets rainfall to 320mm, saturation to 96%, slope to Extreme, hill-cutting to Critical, road to Blocked, and calls PATCH /api/zones/:id with those values. The backend recalculates the score live, and the zone jumps to Critical / Red Alert in real time.
API Reference
Base URL in production: https://disaster-response-system-pf6j.onrender.com/api
Zones
Method
Route
Description
GET
/zones
All 6 zones, enriched with score, priority, landslide_prob, flash_flood_prob, early_warning — sorted highest-risk first
GET
/zones/:id
Single zone, same enrichment
PATCH
/zones/:id
Updates any subset of a zone's live conditions (used by the Weather Simulator)
GET
/zones/:id/recommendation
Runs recommendAllocation() for that zone
GET
/zones/:id/routes
Returns the 3 hardcoded road routes for that zone with their status
Early Warning Bulletins
Method
Route
Description
GET
/earlywarningbulletins
Filters zones with score ≥ 5.5, returns an alert message + recommended action per zone
Resources
Method
Route
Description
GET
/resources
All 6 resource types with total/available counts
PATCH/POST
/resources/:key
Adds count units to both total and available. key = 'reset' restocks everything to full
Dispatch
Method
Route
Description
POST
/dispatch
Core dispatch action. Body: { zoneId, earthmovers, bailey_bridges, mountain_teams, drone_recon, air_drop_kits, ambulances }. Runs in a DB transaction: validates stock, decrements availability, logs to dispatch_log, returns updated resources + latest 10 log entries
GET
/dispatchlog
Last 20 dispatch log entries
Citizen Reports (SOS)
Method
Route
Description
GET
/reports?all=true
All reports, latest 50 (rescuer dashboard)
GET
/reports?user_id=X
Only that citizen's own reports, latest 30
POST
/reports
Citizen submits an SOS. Requires location, people, emergency_type. Auto-generates a ticket_id like SOS-482. Accepts optional GPS lat/lng, base64 photo, medical flag/details, notes
PATCH
/reports/:id
Rescuer updates a report, e.g. { status: 'Dispatched', unit_name, eta_mins }. Setting status to Dispatched auto-decrements 1 unit from ambulances (medical) or mountain_teams (otherwise), logs the dispatch, and seeds rescuer_lat/lng at HQ (26.1445, 91.7362 — Guwahati)
PATCH
/reports/:id/rescuerlocation
Updates the rescuer's live lat/lng for a report (called by the movement simulator)
Feedback
Method
Route
Description
GET
/feedback
Latest 50 feedback entries
POST
/feedback
Citizen submits a rating/comment
PATCH
/feedback/:id/actionnote
Rescuer attaches a follow-up note
Summary
Method
Route
Description
GET
/summary
Dashboard stats: critical/high/safe zone counts, active SOS count, pending vs dispatched reports, running "citizens rescued" total, isolated village totals, and full resource list
Misc
Method
Route
Description
GET
/
Plain text health check: "National Disaster Response Portal API is running."
CORS: server.js reads ALLOWED_ORIGINS from an env var (comma-separated) to whitelist the two Vercel frontend domains in production. If unset, it allows all origins (local-dev fallback).
How the Frontends Talk to the Backend
Both frontend-user/src/api.js and frontend-rescuer/src/api.js follow the same pattern:
Js
BASE comes from the Vite env variable VITE_API_URL, set in Vercel's project settings to the Render backend URL. Locally it defaults to http://localhost:4000/api.
Polling, not WebSockets
Neither app uses WebSockets or server-sent events — both poll on an interval:
Citizen app — refreshData() runs on mount, then every 4 seconds
Rescuer app — refreshCore() runs on mount, then every 5 seconds
This is why an SOS submitted on the citizen app appears on the rescuer dashboard within ~5 seconds, and a status change appears back on the citizen app within ~4 seconds.
Live-Tracking Map
There's no real GPS device on any rescue vehicle — "live tracking" is simulated:
Citizen submits an SOS; the browser Geolocation API grabs their real lat/lng (or they tap "Auto-Lock GPS").
Rescuer dispatches a unit via DispatchModal.jsx → PATCH /reports/:id sets status to Dispatched. The backend seeds rescuer_lat/lng at a fixed HQ point (26.1445, 91.7362).
On the rescuer app, a setInterval ticker (startRescuerTicker) moves the simulated rescuer coordinates 4% of the remaining distance closer to the citizen every 5 seconds (linear interpolation), saving via PATCH /reports/:id/rescuerlocation. When close enough, it snaps to the citizen's exact location.
Both apps render this with Leaflet.js (loaded from CDN, no API key) — a red pulsing marker for the citizen, a navy marker for the rescuer, and a dashed polyline connecting them.
The citizen app never runs the ticker itself — it just polls /reports every 4s and re-renders with whatever rescuer_lat/lng the backend currently has.
The movement only advances while the rescuer's dashboard tab is open, since the ticker is client-side JS, not a backend cron job. If GPS wasn't shared, LiveMap.jsx falls back to hardcoded approximate coordinates keyed off "Sector X" in the location text.
Walkthrough: Citizen SOS Flow
On the citizen app, CitizenFeed.jsx renders a form: name, phone, disaster type, location text, people count, medical checkbox + details, notes, and an optional photo (converted to base64 via FileReader, stored directly in the Postgres photo_data column).
GPS coordinates are grabbed at submit time (or pre-locked).
POST /api/reports validates required fields, generates a ticket_id, inserts the row, returns it with status 201.
The citizen sees a confirmation banner with the ticket ID; the report appears in their "My Requests" feed (scoped to a random user_id stored in sessionStorage).
Within 5 seconds, the rescuer dashboard's next poll picks it up via GET /reports?all=true, color-coded by urgency.
Rescuer picks a unit + ETA in DispatchModal → PATCH /reports/:id sets status to Dispatched.
Within 4 seconds, the citizen's app shows the "Rescue Unit Mobilized!" modal and the live tracking map appears.
Rescuer marks the report "Resolved" → the ticker stops and the citizen sees a resolved note.
Walkthrough: Rescuer Dispatch Flow
Rescuer selects a zone on the Risk Map or Priority Table.
The app fetches GET /zones/:id/recommendation and GET /zones/:id/routes.
ResourcePanel.jsx shows the recommended unit counts and checks them against current stock.
If everything's in stock, "Authorize & Dispatch Recommended Units" fires POST /api/dispatch.
If something's short, "Restock Reserves & Dispatch Immediately" resets stock first, then dispatches.
The backend runs the whole operation inside a DB transaction: validates stock, decrements availability, logs to dispatch_log, and commits (or rolls back entirely on failure).
The Resource Panel bars update and the new entry appears at the top of the Command Log.
Known Limitations / Non-Obvious Details
No ML model — the scoring is 100% transparent arithmetic in priority.js, a deliberate design choice, not a shortcut.
Photos stored as base64 text directly in the database, not in cloud object storage. Fine for a small-scale build, but wouldn't scale — a production version would upload to object storage (e.g., S3) and store just a URL.
"Citizens rescued" counter has a hardcoded +56 offset baked into /api/summary to keep demo stats populated even with few real resolved reports.
Zone IDs are single letters A–F, tied to real Northeast India locations (Dima Hasao/Assam, Sohra/Meghalaya, Teesta Valley/Sikkim, Kameng-Tawang/Arunachal Pradesh, Kohima-Imphal/Nagaland-Manipur, Aizawl/Mizoram) — a deliberate regional focus on landslide/flash-flood-prone hill states, not generic placeholder data.
Report-to-zone linking for dispatch logging is regex-based — PATCH /reports/:id matches "Sector X" out of the free-text location field to decide which zone's dispatch log to write to, defaulting to zone A if no match. Not a real foreign key relationship.
English/Hindi language toggling via a translations.js dictionary per frontend and a lang state — no i18n library, just a plain object lookup.
No authentication anywhere — no login, no tokens. Any API route is fully open. A natural next step would be JWT-based rescuer login and rate-limiting the SOS endpoint.
CORS is env-driven (ALLOWED_ORIGINS) — production locks requests to the two Vercel domains; local dev allows everything.
Troubleshooting
Render cold start — if the backend hasn't had traffic recently, the first request can take 15–50 seconds while the instance spins up. Warm it up with a request before a demo or presentation.
"online: false" banner — both apps show an online/offline indicator based on whether the last poll succeeded; this is almost always the Render cold-start issue above.
GPS permission denied — the SOS still submits (lat/lng stay null), and the map falls back to hardcoded zone-based coordinates.
Tech Stack
Backend: Node.js, Express, PostgreSQL / SQLite (node:sqlite)
Frontend (both apps): React + Vite
Mapping: Leaflet.js (via CDN)
Hosting: Render (backend), Vercel (both frontends)
Sync: REST API + interval polling (no WebSockets)
Quick Reference
Question
Answer
How is risk calculated?
Weighted sum of rainfall, soil saturation, slope instability, hill-cutting risk, road status, isolated villages, and population — transparent, in priority.js
How does dispatch work?
A DB transaction checks stock, decrements resource counts, and logs the action, all via one POST /api/dispatch call
How do the two frontends sync?
Both poll the same REST API every 4–5 seconds; no WebSockets
How does live tracking work?
Client-side JS on the rescuer's browser moves a simulated coordinate 4% closer to the citizen every 5 seconds and saves it via a PATCH call; both maps render it with Leaflet
What database?
PostgreSQL in production, SQLite automatically for local dev, via one shared query layer
Any auth?
None currently — open API, planned as a next step