# SafeRoute+ — Women's Safety Navigation Platform

A real-time women's safety & navigation platform merging **Safe Route Planner** (pre-trip safety-ranked routing) and **Live Journey Guardian** (in-trip monitoring, tiered escalation, discreet SOS).

## Architecture

| Layer | Technology |
|-------|------------|
| **Mobile PWA** | React + Vite + TypeScript + Leaflet (Plan, RouteCompare, ActiveTrip, SOS, Report, Contacts, VoiceSetup, Settings, LiveShare, Dashboard) |
| **Backend** | FastAPI (Python 3.11+) — single worker, in-process state (no Redis) |
| **Routing** | OSRM (public `router.project-osrm.org` or self-hosted) — walking/driving only |
| **Database** | PostgreSQL 16 + PostGIS + `h3-pg` (H3 resolution 9 = ~170m hexagons) |
| **Scheduling** | APScheduler (in-process, replaces worker containers) |
| **ML** | scikit-learn only (IsolationForest, RandomForest, GradientBoosting, TF-IDF) — **no API keys, no epochs** |
| **Alerts** | Twilio (SMS) + FCM (push) — runs in mock mode if credentials absent |
| **Voice** | Web Speech API (`SpeechRecognition` + `speechSynthesis`) — on-device only |

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
5. Web Speech API (`@react-native-voice/voice` for mobile) — no key for MVP

---

## Frontend Screens (PWA)

| Route | Screen | Description |
|-------|--------|-------------|
| `/plan` | **PlanScreen** | Tap map for origin/destination, choose walk/drive, get 3 safety-ranked routes |
| `/compare` | **RouteCompareScreen** | 3 route cards: worst-segment score, avg score, ETA, segment breakdown; "Start This Route" |
| `/trip/:tripId` | **ActiveTripScreen** | Live map with position + planned route; escalation banner (L0-L4, hidden for L3 duress); SOS button; check-in modal with countdown |
| `/sos` | **SOSScreen** | Big red SOS button (200px circle); shake-to-SOS; voice duress word; cancel button; demo test mode |
| `/report` | **ReportScreen** | Post-trip: 🟢/🟡/🔴 rating, 10 predefined tags, free-text notes with AI tag suggestions (debounced), submit |
| `/contacts` | **ContactsScreen** | List primary/secondary contacts with priority; add/edit/delete modal; E.164 phone validation |
| `/voice-setup` | **VoiceSetupScreen** | Set safe word (de-escalate) + duress word (silent SOS); hash preview; test buttons with confidence %; toggle enabled |
| `/settings` | **SettingsScreen** | Voice/shake/location/notification permission status; shake sensitivity (low/med/high); danger zone buttons |
| `/share/:token` | **LiveShareScreen** | Public live location page: animated user marker, planned route (dashed), start/destination pins, live indicator |
| `/dashboard` | **DashboardScreen** | Trip list (polling `/trips`), alert log (`/trips/alerts`), live share links |

---

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 16 + PostGIS
- Git

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Copy .env.example to .env and edit DATABASE_URL, JWT_SECRET_KEY, OSRM_BASE_URL
cp .env.example .env

# Initialize database (creates all tables)
python init_db.py

# Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

**Backend runs at**: `http://127.0.0.1:8000`  
**Health check**: `GET /health` → `{"status":"healthy"}`  
**Swagger UI**: `http://127.0.0.1:8000/docs`

### 2. PWA Frontend Setup

```bash
cd pwa

# Install dependencies
npm install

# Configure environment (uses backend at localhost:8000 by default)
cp .env.example .env

# Start dev server
npm run dev
```

**PWA runs at**: `http://localhost:5173` (Vite default)

### 3. Verify End-to-End

```bash
# Test route planning
curl -X POST http://127.0.0.1:8000/routes/plan \
  -H "Content-Type: application/json" \
  -d '{"origin":[88.36,22.57],"destination":[88.40,22.60],"mode":"walk","depart_at":"2026-09-20T20:30:00"}'

# Open PWA in browser
# Navigate: /plan → /compare → /trip/:id → /sos → /report → /contacts → /voice-setup
```

---

## Key API Endpoints

### Routes
- `POST /routes/plan` — Plan 3 safety-ranked routes

### Trips
- `POST /trips/start` — Start trip with planned route
- `GET /trips/{trip_id}/stream` — WebSocket for live pings + escalation
- `GET /trips/{trip_id}/escalation` — Current escalation state
- `POST /trips/{trip_id}/checkin` — Check-in (tap/voice)
- `POST /trips/{trip_id}/sos` — Manual SOS trigger
- `POST /trips/{trip_id}/voice-event` — Voice duress/safe/checkin
- `POST /trips/{trip_id}/report` — Post-trip safety report

### Contacts
- `GET /contacts` — List user contacts
- `POST /contacts` — Add contact
- `PUT /contacts/{id}` — Update contact
- `DELETE /contacts/{id}` — Delete contact

### Reports (Feedback Loop)
- `POST /reports/suggest-tags` — AI tag suggestions from note text
- `POST /reports/retrain` — Retrain tag suggester (auto-called by aggregator)

### Voice Config
- `POST /users/voice-config` — Save voice config (hashes)
- `GET /users/voice-config` — Load voice config

### Live Share
- `GET /share/{token}` — Public live trip data

---

## ML Pipelines (Run Once / Periodic)

```bash
cd backend

# 1. Build static features (H3 cells with lit_ratio, police_dist, etc.)
python -m app.workers.build_static_features

# 2. Generate synthetic training data (incidents + reports)
python -m app.workers.generate_synthetic

# 3. Build risk table (time-shifted scores per H3 cell/hour/dow)
python -m app.workers.build_risk_table

# 4. Aggregator (runs every 60min via APScheduler)
# Rebuilds risk_cells from 3 sources: passive density + reports + SOS events
```

---

## Environment Variables

### Backend (`.env`)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/saferoute
JWT_SECRET_KEY=32-byte-hex
OSRM_BASE_URL=http://router.project-osrm.org

# Optional (mock mode if empty)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
FCM_SERVICE_ACCOUNT_JSON_PATH=
```

### PWA (`.env`)
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_APP_NAME=SafeRoute+
```

---

## Deployment Constraints (Hard Requirements)

1. **Single Worker Process**: FastAPI MUST run with `--workers 1`. All trip state, ping buffers, alert cooldowns, and WebSocket registries are in-process memory. Multiple workers cause silent failures.

2. **No Redis**: All caching and state in PostgreSQL + FastAPI memory.

3. **No Docker**: Run PostgreSQL, OSRM natively or use hosted services.

4. **HTTPS Required for Mobile**: Voice (`SpeechRecognition`) and Geolocation need secure context. Use `localhost` or `ngrok`/`cloudflared` tunnel for mobile testing.

---

## Mock Mode (Default for Local Dev)

| Service | Behavior if Credentials Missing |
|---------|--------------------------------|
| Twilio SMS | Logs to console: `📱 MOCK SMS: {to, body}` |
| FCM Push | Shows in-app banner + console log |
| OSRM | Uses public `router.project-osrm.org` (rate-limited) |

---

## Project Structure

```
SafeRoute/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers
│   │   ├── core/          # Risk engine, escalation, deviation, voice, routing
│   │   ├── models/        # SQLAlchemy models (PostGIS)
│   │   ├── workers/       # APScheduler jobs (monitor, aggregator)
│   │   └── services/      # OSRM, Twilio, FCM clients
│   ├── init_db.py         # Table creation
│   └── requirements.txt
├── pwa/
│   ├── src/
│   │   ├── components/    # Layout, Map, UI
│   │   ├── hooks/         # useTrip, useVoice, useShake, useLocation, useNotifications
│   │   ├── screens/       # 10 route components
│   │   ├── services/      # api, ws, voice, sensors, notifications, offlineQueue
│   │   └── types/         # Shared TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── mobile/                # React Native + Expo (separate codebase)
├── dashboard/             # React + Vite + Leaflet admin dashboard
└── .env                   # Shared backend config
```

---

## License

Hackathon project — SafeRoute+ team