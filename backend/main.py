import math
import asyncio
import time
import uuid
from collections import deque
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="TraceForge API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

experiment = {"active": False, "delay_ms": 500, "expires_at": None, "id": None, "started_at": None}
samples = deque(maxlen=120)
events = deque(maxlen=40)
BASELINE_MS = 35.0

def calculate_percentile(values, percentile):
    if not values:
        return 0.0

    sorted_values = sorted(values)

    rank = max(1, math.ceil((percentile / 100) * len(sorted_values)))

    return round(sorted_values[rank - 1], 2)

def now():
    return datetime.now(timezone.utc).isoformat()

def expire_if_needed():
    if experiment["active"] and experiment["expires_at"] and time.time() >= experiment["expires_at"]:
        experiment.update(active=False, expires_at=None)
        events.appendleft({"type": "experiment_expired", "message": "Latency experiment expired automatically", "at": now()})

class ExperimentRequest(BaseModel):
    delay_ms: int = Field(default=500, ge=1, le=2000)
    duration_seconds: int = Field(default=60, ge=5, le=600)

@app.middleware("http")
async def inject_latency(request, call_next):
    started = time.perf_counter()
    injected = 0
    if request.url.path == "/api/demo/payment":
        expire_if_needed()
        if experiment["active"]:
            injected = experiment["delay_ms"]
            await asyncio.sleep(injected / 1000)
    response = await call_next(request)
    elapsed = round((time.perf_counter() - started) * 1000, 2)
    if request.url.path == "/api/demo/payment":
        samples.appendleft({
            "latency_ms": elapsed, "injected_ms": injected,
            "status_code": response.status_code, "at": now(),
            "experiment_active": injected > 0,
            "trace_id": uuid.uuid4().hex[:12],
            "endpoint": "GET /api/demo/payment",
        })
    response.headers["X-TraceForge-Latency-Ms"] = str(elapsed)
    response.headers["X-TraceForge-Injected-Ms"] = str(injected)
    return response

@app.get("/")
async def root():
    return {"name": "TraceForge", "status": "healthy", "version": "0.2.0"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "traceforge-api"}

@app.post("/api/experiments/latency")
async def start_experiment(payload: ExperimentRequest):
    expire_if_needed()
    if experiment["active"]:
        raise HTTPException(status_code=409, detail="An experiment is already active. Stop it first.")
    experiment.update(active=True, delay_ms=payload.delay_ms,
        expires_at=time.time() + payload.duration_seconds, id=str(uuid.uuid4()),
        started_at=now())
    event = {"type": "experiment_started",
        "message": f"Injected {payload.delay_ms}ms latency into Payment Service",
        "experiment_id": experiment["id"], "delay_ms": payload.delay_ms, "at": now()}
    events.appendleft(event)
    return {"status": "running", "experiment": event, "duration_seconds": payload.duration_seconds}

@app.delete("/api/experiments/latency")
async def stop_experiment():
    was_active = experiment["active"]
    experiment.update(active=False, expires_at=None)
    events.appendleft({"type": "experiment_stopped", "message": "Latency injection disabled", "at": now()})
    return {"status": "stopped", "was_active": was_active}

@app.get("/api/demo/payment")
async def demo_payment():
    await asyncio.sleep(0.035)
    return {"service": "payment-service", "result": "payment_authorized",
            "message": "Demo payment request completed"}

@app.get("/api/metrics")
async def metrics():
    expire_if_needed()
    values = list(samples)
    baseline_values = [x["latency_ms"] for x in values if x["injected_ms"] == 0]
    baseline = round(sum(baseline_values) / len(baseline_values), 2) if baseline_values else BASELINE_MS
    avg = round(sum(x["latency_ms"] for x in values) / len(values), 2) if values else 0
    p50 = calculate_percentile(
    [x["latency_ms"] for x in values], 50
    )

    p95 = calculate_percentile(
    [x["latency_ms"] for x in values], 95
    )
  
    p99 = calculate_percentile(
    [x["latency_ms"] for x in values], 99
)

    return {
        "system_status": "degraded" if experiment["active"] else "healthy",
        "experiment": {k: experiment[k] for k in ("active", "delay_ms", "expires_at", "id", "started_at")},
        "requests": len(values),
"avg_latency_ms": avg,
"baseline_latency_ms": baseline,
"p50_latency_ms": p50,
"p95_latency_ms": p95,
"p99_latency_ms": p99,
        "error_rate": 0, "uptime": 99.9,
        "latest": list(reversed(values[-30:])), "events": list(events)[:12],
        "services": [
            {"name":"Frontend","status":"healthy","latency_ms":12},
            {"name":"API Gateway","status":"healthy","latency_ms":18},
            {"name":"User Service","status":"healthy","latency_ms":98},
            {"name":"Payment Service","status":"degraded" if experiment["active"] else "healthy",
             "latency_ms": round((samples[0]["latency_ms"] if samples else BASELINE_MS), 2)},
            {"name":"Order Service","status":"healthy","latency_ms":103}
        ]
    }
