# TraceForge — Reliability & Chaos Engineering Console

This starter includes a dark observability dashboard and a real FastAPI latency-injection experiment.

## What works
- Start and stop a controlled latency experiment (default 500ms).
- Apply delay only to `GET /api/demo/payment`.
- Automatically expire experiments after the selected duration.
- Measure actual server-side request latency and browser round-trip time.
- View request samples, service status, experiment events and a simple latency chart.
- Refresh dashboard data every 1.5 seconds.

## Requirements
- Python 3.10+
- Node.js 18+

## Windows setup

### Terminal 1 — Backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
If PowerShell blocks activation:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```
Keep this terminal running. Check `http://localhost:8000/` and API docs at `http://localhost:8000/docs`.

### Terminal 2 — Frontend
Open a second VS Code terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the local URL Vite prints, normally `http://localhost:5173`.

## Test the 500ms experiment
1. Click **Send Test Payment Request** with no experiment active. Note the browser request time (usually around 35–100ms on localhost).
2. Keep delay at 500ms and duration at 1 minute.
3. Click **Run Experiment**.
4. Click **Send Test Payment Request** again. It should now take roughly 500ms longer.
5. Click **Stop Experiment**, then send another request. Latency should return near baseline.
6. The experiment also stops automatically after its configured duration.

## API
- `POST /api/experiments/latency` — body `{"delay_ms":500,"duration_seconds":60}`
- `DELETE /api/experiments/latency` — stop injection
- `GET /api/demo/payment` — demo target endpoint
- `GET /api/metrics` — current metrics, request samples, events and services

## Deploy later
- Frontend: deploy `frontend` directory to Vercel; set `VITE_API_URL` to your deployed backend URL.
- Backend: deploy `backend` directory to Render as a Python web service; build command `pip install -r requirements.txt`; start command `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Before making this public, configure CORS for your exact Vercel domain and add authentication/authorization, rate limits, audit logs and strict experiment isolation. Do not expose an unauthenticated fault-injection endpoint publicly.

## Honest MVP limitations
This is a single-process demo. Experiment state and samples are in memory and reset when the backend restarts. Some dashboard values (request rate, uptime, and non-payment service topology latencies) are illustrative demo values, not production telemetry. The payment endpoint's latency and captured traces are measured. The chart is a compact recent-sample visualization, not a full time-series database.
