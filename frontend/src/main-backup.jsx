import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bell,
  Box,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Code2,
  FlaskConical,
  GitBranch,
  House,
  Layers,
  Network,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function App() {
  const [data, setData] = useState(null),
    [delay, setDelay] = useState(500),
    [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [last, setLast] = useState(null),
    [page, setPage] = useState("Dashboard"),
    [range, setRange] = useState("Last 15 minutes");
  async function refresh() {
    try {
      let r = await fetch(`${API}/api/metrics`);
      if (!r.ok) throw Error("Metrics request failed");
      setData(await r.json());
      setError("");
    } catch (e) {
      setError(`Backend unavailable at ${API}. Start FastAPI on port 8000.`);
    }
  }
  useEffect(() => {
    refresh();
    let t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, []);
  async function start() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      let r = await fetch(`${API}/api/experiments/latency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delay_ms: delay, duration_seconds: duration }),
      });
      let j = await r.json();
      if (!r.ok) throw Error(j.detail || "Could not start experiment");
      setNotice(`Injected ${delay}ms latency into Payment Service.`);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    try {
      let r = await fetch(`${API}/api/experiments/latency`, {
        method: "DELETE",
      });
      if (!r.ok) throw Error("Could not stop experiment");
      setNotice("Experiment stopped. New requests are back to baseline.");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      let t = performance.now(),
        r = await fetch(`${API}/api/demo/payment`),
        j = await r.json();
      setLast({
        ms: Math.round(performance.now() - t),
        status: r.status,
        result: j.result,
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const active = data?.experiment?.active,
    services = data?.services || [],
    traces = [...(data?.latest || [])].reverse().slice(-5).reverse(),
    events = data?.events || [];
  const chart = useMemo(() => {
    let vals = data?.latest || [];
    if (!vals.length) return [35, 36, 34, 37, 35, 36, 35, 34, 36, 35, 36, 35];
    return vals.slice(-12).map((x) => x.latency_ms);
  }, [data]);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">
            <Activity />
          </div>
          <b>TraceForge</b>
        </div>
        <div className="navlabel">WORKSPACE</div>
        {[
          [House, "Dashboard"],
          [Server, "Services"],
          [GitBranch, "Traces"],
          [FlaskConical, "Chaos Lab"],
          [AlertTriangle, "Incidents"],
          [ChartNoAxesCombined, "SLOs & Reliability"],
          [Terminal, "Reports"],
        ].map(([I, n]) => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`navitem ${page === n ? "selected" : ""}`}
          >
            <I size={17} />
            {n}
          </button>
        ))}
        <div className="env">
          <div className="envicon">
            <Cloud />
          </div>
          <div>
            <b>Demo Environment</b>
            <small>5 services · Local cluster</small>
            <span>
              <i /> Running
            </span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header>
          <span>Distributed Systems Reliability & Chaos Engineering</span>
          <div className="headright">
            <span className="system">
              <i className={active ? "amber" : ""} />
              {active ? "System Degraded" : "System Healthy"}
            </span>
            <Bell size={18} />
            <div className="avatar">RP</div>
          </div>
        </header>
        <div className="content">
          <div className="pagehead">
            <div>
              <h1>{page === "Dashboard" ? "System Overview" : page}</h1>
              <p>Real-time metrics, service health and active experiments</p>
            </div>
            <div className="pageactions">
              <button
                className="selectlike"
                onClick={() =>
                  setRange(
                    range === "Last 15 minutes"
                      ? "Last hour"
                      : "Last 15 minutes",
                  )
                }
              >
                <Clock3 size={15} />
                {range}
                <ChevronDown size={14} />
              </button>
              <button className="refresh" onClick={refresh}>
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>
          {error && (
            <div className="alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          {notice && (
            <div className="success">
              <CheckCircle2 size={16} />
              {notice}
            </div>
          )}
          <div className="layout">
            <div className="leftcol">
              <div className="stats">
                <Stat
                  title="AVG. LATENCY"
                  value={`${data?.avg_latency_ms ?? "—"} ms`}
                  sub={`Baseline ${data?.baseline_latency_ms ?? 35} ms`}
                  icon={<Clock3 />}
                  tone={active ? "red" : ""}
                />
                <Stat
                  title="REQUEST RATE"
                  value={`${data?.requests ?? 0} req`}
                  sub="Captured demo requests"
                  icon={<Zap />}
                />
                <Stat
                  title="ERROR RATE"
                  value={`${data?.error_rate ?? 0}%`}
                  sub="Payment service"
                  icon={<AlertTriangle />}
                />
                <Stat
                  title="SERVICE UPTIME"
                  value={`${data?.uptime ?? 99.9}%`}
                  sub="Demo environment"
                  icon={<CheckCircle2 />}
                  tone="green"
                />
              </div>
              <div className="stats percentile-stats">
                <Stat
                  title="P50 LATENCY"
                  value={`${data?.p50_latency_ms ?? "—"} ms`}
                  sub="Median response time"
                  icon={<Clock3 />}
                />
                <Stat
                  title="P95 LATENCY"
                  value={`${data?.p95_latency_ms ?? "—"} ms`}
                  sub="95% of requests at or below"
                  icon={<Clock3 />}
                />
                <Stat
                  title="P99 LATENCY"
                  value={`${data?.p99_latency_ms ?? "—"} ms`}
                  sub="99% of requests at or below"
                  icon={<Clock3 />}
                />
              </div>
              <div className="midgrid">
                <section className="panel chartpanel">
                  <div className="paneltitle">
                    <div>
                      <h2>Service Health & Latency</h2>
                      <p>Measured payment endpoint response time</p>
                    </div>
                    <span className="legend">
                      <i /> Latency (ms)
                    </span>
                  </div>
                  <LatencyChart values={chart} />
                </section>
                <section className="panel topology">
                  <div className="paneltitle">
                    <h2>Service Map</h2>
                    <span className="muted">LIVE</span>
                  </div>
                  <div className="flow">
                    <div className="node">
                      {" "}
                      <Code2 />
                      <b>Frontend</b>
                      <small>12 ms</small>
                    </div>
                    <div className="connector">↓</div>
                    <div className="node gateway">
                      <Layers />
                      <b>API Gateway</b>
                      <small>18 ms</small>
                    </div>
                    <div className="branches">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="nodegrid">
                      {services.slice(2, 5).map((s) => (
                        <div
                          className={`node smallnode ${s.status === "degraded" ? "degraded" : ""}`}
                          key={s.name}
                        >
                          <Server />
                          <b>{s.name}</b>
                          <small>{s.latency_ms} ms</small>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel services">
                <div className="paneltitle">
                  <h2>
                    Services Status <span className="count">(5)</span>
                  </h2>
                  <span className="muted">Updated automatically</span>
                </div>
                <div className="servicegrid">
                  {services.map((s) => (
                    <div
                      className={`service ${s.status === "degraded" ? "bad" : ""}`}
                      key={s.name}
                    >
                      <Server />
                      <div>
                        <b>{s.name}</b>
                        <small>
                          <i
                            className={s.status === "degraded" ? "amber" : ""}
                          />
                          {s.status}
                        </small>
                      </div>
                      <strong>{s.latency_ms} ms</strong>
                    </div>
                  ))}
                </div>
              </section>
              <div className="bottomgrid">
                <section className="panel">
                  <div className="paneltitle">
                    <h2>Recent Traces</h2>
                    <span className="linkish">Latest requests</span>
                  </div>
                  <div className="tracehead">
                    <span>TRACE ID</span>
                    <span>ENDPOINT</span>
                    <span>DURATION</span>
                    <span>STATUS</span>
                  </div>
                  {traces.length ? (
                    traces.map((t) => (
                      <div className="tracerow" key={t.trace_id}>
                        <code>{t.trace_id}</code>
                        <span>{t.endpoint}</span>
                        <b>{t.latency_ms} ms</b>
                        <em className={t.injected_ms ? "slow" : "ok"}>
                          {t.injected_ms ? "SLOW" : "OK"}
                        </em>
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      Send a test request to populate traces.
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="paneltitle">
                    <h2>Incident Timeline</h2>
                    <span className="muted">Recent events</span>
                  </div>
                  <div className="timeline">
                    {events.slice(0, 4).map((e, i) => (
                      <div className="event" key={`${e.at}-${i}`}>
                        <i
                          className={
                            e.type === "experiment_started" ? "amber" : ""
                          }
                        />
                        <div>
                          <b>{e.message}</b>
                          <small>{new Date(e.at).toLocaleTimeString()}</small>
                        </div>
                      </div>
                    ))}
                    {!events.length && (
                      <div className="empty">
                        No incidents or experiment events.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
            <aside className="panel lab">
              <div className="labtitle">
                <div className="flask">
                  <FlaskConical />
                </div>
                <div>
                  <h2>Chaos Experiment Lab</h2>
                  <p>Inject faults and observe system behavior</p>
                </div>
              </div>
              <label>SELECT TARGET SERVICE</label>
              <button className="field">
                <Server size={15} /> Payment Service <ChevronDown size={14} />
              </button>
              <label>FAULT TYPE</label>
              <button className="field">
                <Clock3 size={15} /> Network Latency <ChevronDown size={14} />
              </button>
              <label>
                LATENCY DELAY <strong>{delay} ms</strong>
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={delay}
                disabled={active}
                onChange={(e) => setDelay(+e.target.value)}
              />
              <div className="ticks">
                <span>100 ms</span>
                <span>2,000 ms</span>
              </div>
              <label>DURATION</label>
              <select
                value={duration}
                disabled={active}
                onChange={(e) => setDuration(+e.target.value)}
              >
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
              </select>
              <button
                className={active ? "stop" : "run"}
                disabled={busy || (!active && false)}
                onClick={active ? stop : start}
              >
                {active ? (
                  <>
                    <Square size={15} /> Stop Experiment
                  </>
                ) : (
                  <>
                    <Play size={15} /> Run Experiment
                  </>
                )}
              </button>
              <button className="testrequest" disabled={busy} onClick={test}>
                <Zap size={15} /> Send Test Payment Request
              </button>
              {last && (
                <div className="lastresult">
                  <span>LAST BROWSER REQUEST</span>
                  <b>{last.ms} ms</b>
                  <small>
                    HTTP {last.status} · {last.result}
                  </small>
                </div>
              )}
              <div className={`experimentbox ${active ? "running" : ""}`}>
                <CheckCircle2 />
                <div>
                  <b>{active ? "Experiment Running" : "Ready to Experiment"}</b>
                  <p>
                    {active
                      ? `Injecting ${data.experiment.delay_ms}ms latency into Payment Service.`
                      : "Start a controlled experiment to observe service degradation."}
                  </p>
                  {active && (
                    <small>Auto-expires when its duration ends.</small>
                  )}
                </div>
              </div>
              <div className="safety">
                <ShieldCheck size={15} /> Fault injection is restricted to the
                local demo payment endpoint.
              </div>
            </aside>
          </div>

          <footer>
            TRACEFORGE <span>·</span> OBSERVABILITY & CHAOS ENGINEERING{" "}
            <span>·</span> LOCAL DEMO
          </footer>
        </div>
      </main>
    </div>
  );
}
function Stat({ title, value, sub, icon, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stathead">
        <span>{title}</span>
        {icon}
      </div>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}
function LatencyChart({ values }) {
  let max = Math.max(600, ...values),
    pts = values
      .map(
        (v, i) =>
          `${32 + i * (440 / Math.max(values.length - 1, 1))},${155 - (v / max) * 125}`,
      )
      .join(" ");
  return (
    <svg
      viewBox="0 0 500 190"
      className="chart"
      role="img"
      aria-label="Recent request latency chart"
    >
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9565ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#9565ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[30, 65, 100, 135, 165].map((y) => (
        <g key={y}>
          <line
            x1="32"
            x2="480"
            y1={y}
            y2={y}
            stroke="#233047"
            strokeDasharray="3 5"
          />
          <text x="2" y={y + 4} fill="#8291a8" fontSize="10">
            {Math.round(((165 - y) / 135) * max)}
          </text>
        </g>
      ))}
      <polygon points={`32,165 ${pts} 472,165`} fill="url(#area)" />
      <polyline
        points={pts}
        fill="none"
        stroke="#a47aff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="32" y="184" fill="#8291a8" fontSize="10">
        Earlier
      </text>
      <text x="444" y="184" fill="#8291a8" fontSize="10">
        Now
      </text>
    </svg>
  );
}
createRoot(document.getElementById("root")).render(<App />);
