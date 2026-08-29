# Curb -- working prototype

Pre-arrival carpark reservation demo. React (Vite) frontend + Python (FastAPI) backend.
Backend proxies LTA DataMall's Carpark Availability API server-side, so your API key
never touches the browser, and implements the reservation state machine (ETA-linked
hold window, 5-min extend/cancel prompt, auto-release on no-show).

## Why this stack
- **FastAPI backend** keeps your DataMall AccountKey server-side (a plain HTML/JS demo
  can't do this safely -- the key would be visible in page source).
- **SQLite** for reservations -- zero setup, swap for Postgres later without changing
  the app logic (SQLAlchemy).
- **Vite + React** -- fast dev loop, standard structure you can keep building on.

## Run it locally

Requires internet access to install packages (this project was scaffolded in a
network-restricted sandbox, so dependencies haven't been installed/tested yet --
do that on your own machine).

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your real DATAMALL_ACCOUNT_KEY
uvicorn main:app --reload --port 8000
```
Check it's alive: `curl http://localhost:8000/api/health` should show
`"datamall_key_configured": true` once your key is in `.env`.

Without a key configured, `/api/carparks` still works using a small built-in sample
dataset (5 malls, realistic lot counts) so the app is demoable offline.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Vite proxies `/api` requests to the backend on :8000
(see `vite.config.js`), so both need to be running.

## What's implemented
- Search -> live (or sample) carpark availability for Curb's Phase 1 mall list
  (VivoCity, ION Orchard, Marina Square, Jem, Westgate, etc. -- the malls LTA
  DataMall actually covers under its "LTA agency" carpark category)
- Reserve a lot with a driver-reported ETA
- ETA-linked hold window: countdown starts from reservation time, expires at
  ETA + reservation window (see `RESERVATION_WINDOW_MIN` in `.env`)
- 5-minutes-remaining prompt: extend (+10 min, simulated fee) or cancel
- Grace period then auto-release (computed lazily server-side, no scheduler needed)
- Navigation handoff to Google Maps
- "I've arrived" to close out a reservation cleanly

## What's not implemented (by design, for a demo)
- Auth / user accounts
- Real payments (extend fee is display-only)
- Actual carpark-side lot locking / sensor integration
- Push notifications (the 5-min prompt is driven by polling while the app is open)
- Deployment config

## Project structure
```
backend/
  main.py         FastAPI app, reservation endpoints
  datamall.py     DataMall client + Phase 1 mall filter + sample fallback
  models.py       Reservation SQLAlchemy model
  database.py     SQLite session setup
  .env.example
frontend/
  src/
    App.jsx               screen state machine
    api.js                 backend client
    components/
      SearchScreen.jsx
      CarparkList.jsx
      EtaPicker.jsx
      ReservationPanel.jsx
```

## Next real steps (post-demo)
- Confirm which mall "Development" names actually appear in a live DataMall
  response and adjust `TARGET_MALLS` in `datamall.py` accordingly
- For malls outside Orchard/Marina/HarbourFront/JLD, you'll need direct
  operator/BMS integration -- DataMall doesn't cover them
- Move reservation expiry off lazy-compute onto a real background job before
  this becomes anything customer-facing
