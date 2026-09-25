# SafeRoute+ — Project Context

## Project Overview
**SafeRoute+** is a real-time women's safety & navigation platform merging two problem statements:
- **Module A (PS-B07)**: Safe Route Planner — pre-trip route comparison ranked by safety score
- **Module B (PS-B06)**: Live Journey Guardian — in-trip monitoring, deviation/stop detection, tiered escalation, discreet SOS

Continuous safety loop: **Plan → Travel → Monitor → Alert → Reroute/Rescue**

---

## Architecture Stack

| Layer | Technology |
|-------|------------|
| **Mobile** | React Native + Expo (Plan, RouteCompare, ActiveTrip, SOS screens) |
| **Dashboard** | React + Vite + Leaflet (trip status, alert log, live-share page) |
| **Backend** | FastAPI (Python 3.11+) — single worker, in-process state (no Redis) |
| **Routing** | OSRM (self-hosted Docker, Kolkata extract) — walking/driving only |
| **Database** | PostgreSQL 16 + PostGIS + `h3-pg` (H3 resolution 9 = ~170m hexagons) |
| **Scheduling** | APScheduler (in-process, replaces worker containers) |
| **ML** | scikit-learn only (IsolationForest, RandomForest, GradientBoosting, TF-IDF) — **no API keys, no epochs** |
| **Alerts** | Twilio (SMS) + FCM (push) |
| **Voice** | `@react-native-voice/voice` (OS STT) + `expo-speech` (TTS) — no key for MVP |

---

## Core Algorithm (The IP)

**Time-aware safe routing** (spec §6):
1. Generate 3 route candidates via OSRM (`alternatives=true`)
2. Split each into ~200m segments
3. Estimate **per-segment arrival time** from departure time + mode speed
4. Look up `risk_score(h3_cell, predicted_arrival_hour, dow)` — **time-shifted**, not departure-time
5. Route score = **minimum (worst) segment score** (bottleneck/maximin)
6. Rank lexicographically: `(worst_segment, mean_segment, -total_time)`
7. Live re-evaluation if pace diverges from ETA

---

## Data Layer

Central table: `risk_cells(h3_index, hour, dow) → risk_score, confidence, sample_count`

Three data sources feeding it:
1. **Passive app-location aggregation** (anonymized crowd density)
2. **Post-trip one-tap reports** (🟢/🟡/🔴 + tags)
3. **SOS/anomaly events** (highest trust)

**Cold-start mitigation**: H3 neighbour-fill (ring-1 distance-weighted average, flagged `confidence='estimated'`)

---

## Tiered Escalation (L0–L4)

| Level | Trigger | Contacts Notified |
|-------|---------|-------------------|
| L0 Normal | Default | None |
| L1 Watch | One unconfirmed signal | None (silent, logging only) |
| L2 Check-in | Confirmed anomaly | **Primary only** — soft heads-up |
| L3 Alert | No response / duress word / manual SOS | **All contacts** — full SMS + live-share |
| L4 Sustained | L3 unresolved 5 min | Re-notify + nearest police station |

- **Never skips L2** for automatic signals (prevents panic false alarms)
- **De-escalation only on explicit user action** (tap/voice safe word)
- **Server-side timer is authoritative** — phone dying still escalates

---

## Voice Assistant (MVP Scope)

1. **Duress word** → immediate L3, **no screen change** (discreet)
2. **Safe word** → de-escalate to L0
3. **Spoken check-in** → TTS speaks "Are you okay?", listens for reply
4. **On-device only** — backend receives hashed events, never audio
5. `@react-native-voice/voice` (no key); Porcupine optional upgrade

---

## Current Implementation State

**Completed:**
- ✅ PostgreSQL + PostGIS schema (`schema.py`) — all tables defined
- ✅ FastAPI scaffold with APScheduler + in-process state (`state.py`)
- ✅ Route planning API with time-shifted scoring (`routes_plan.py`, `route_scorer.py`, `time_shift.py`)
- ✅ Anomaly detectors (`deviation.py`, `stop_detector.py`) with mitigations
- ✅ Tiered escalation state machine (`escalation.py`)
- ✅ WebSocket ingestion (`ws_stream.py`)
- ✅ Voice backend (`voice.py`)
- ✅ Workers: `monitor.py`, `aggregator.py`
- ✅ Mobile app navigation + API/WS services
- ✅ Dashboard pages (DashboardPage, LiveSharePage)

**Remaining:**
1. Frontend integration (wire UI to live endpoints)
2. Dashboard logic (dynamic trip list via polling/WS)
3. **ML pipelines** — stubbed only (`build_static_features.py`, `generate_synthetic.py`, `build_risk_table.py`)
4. Post-trip reporting feedback loop (Phase 9)

---

## Key Constraints (Must Know)

| Constraint | Detail |
|------------|--------|
| **Single worker** | `uvicorn --workers 1` — in-process state doesn't cross workers |
| **No Redis** | All state in Postgres + memory (`state.py`) |
| **No Docker** | Native/external services for demo |
| **OSRM = walking/driving only** | No public transit (GTFS not available for Kolkata) |
| **Power-button SOS impossible** | Use shake + voice duress + visible button |
| **GPS noise mitigation mandatory** | Accuracy gate (≤50m) + hysteresis (N≥3) + OSRM `/match` |
| **Synthetic data circularity** | Hold out slice, report honestly, state it validates pipeline not conclusions |
| **Bias toward over-triggering** | False alarm > missed emergency |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `saferoute-plus-spec-v2.md` | Full unified spec (646 lines) |
| `implementation-plan.md` | Phase-by-phase build plan with tests |
| `backend-prompt.md` | Self-contained backend build instructions |
| `tech-stack-and-api-keys.md` | Stack decisions + when to ask for each key |
| `backend/app/core/` | Risk engine, route scorer, time shift, escalation, deviation, stop detector, voice |
| `backend/app/api/` | Routes, trips, SOS, voice, WebSocket |
| `mobile/src/screens/` | Plan, RouteCompare, ActiveTrip, SOS |

---

**Project is ~60-70% complete** — core backend logic and mobile/dashboard scaffolding done; main gaps are **ML data pipelines** (populating `risk_cells`/`static_features`) and **full frontend-backend integration**.