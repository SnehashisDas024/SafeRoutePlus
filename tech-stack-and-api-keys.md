# SafeRoute+ — Tech Stack & API Keys

*Derived from the locked stack decisions in `saferoute-plus-spec-v2.md` (§8.2), with two deliberate departures recorded in §0. This is the stack to actually build with — not the v1 "suggested" stack.*

---

## 0. Changes From the Previous Version of This Document

| Change | Reason |
|---|---|
| **Redis removed entirely** | The project must deploy on free tiers, which generally give one process and no managed Redis. All Redis responsibilities move to Postgres + in-process state. See §1.1. |
| **Voice assistant pulled into MVP scope** | Voice code-word SOS + spoken check-in response are now in scope, not future work. See §1.2 and §2.1. |
| **Tiered escalation added** | Abnormal-activity detection now drives a graded notification ladder to trusted contacts, not a single binary SOS. See `backend-prompt.md` §5.5. |
| **`openWakeWord` demoted** | It is a Python library with no React Native SDK. It cannot run on the phone. Corrected in §2.2. |

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **React Native + Expo** | Single app, two modules (Route Planner, Journey Guardian) + voice assistant |
| Web dashboard | **React + Vite + Leaflet** | Journey status, safety score, alert log, public live-share page |
| Backend API | **FastAPI (Python 3.11+)** | REST + WebSocket, same language as ML pipelines |
| Routing engine | **OSRM (self-hosted, Docker)** | Kolkata `.osm.pbf` extract from Geofabrik; walking/driving/cycling only — no public transit. Deployment caveat in §4. |
| Database | **PostgreSQL 16 + PostGIS + `h3-pg`** | Central `risk_cells` (H3 res-9), `static_features`, `safe_points`, trips, users, **plus all state Redis used to hold** |
| Trip state / buffers / cooldowns | **Postgres + in-process memory** | **No Redis.** See §1.1 |
| Background scheduling | **APScheduler (in-process)** | Replaces the separate worker process; aggregator + escalation timers run inside the FastAPI app |
| ML | **scikit-learn only** | Isolation Forest (stop anomaly), Random Forest / Gradient Boosting (deviation + weight learning), TF-IDF + Logistic Regression (tag suggestion). No PyTorch, no epochs — see spec §10 |
| Voice assistant (on-device) | **`@react-native-voice/voice`** (OS built-in STT) | **No API key.** MVP default. Upgrade path: Porcupine — see §2.2 |
| Voice prompts (TTS) | **`expo-speech`** | **No API key.** Speaks the check-in prompt aloud |
| SMS / voice alerts | **Twilio** | Trusted-contact + authority alerts |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Check-in prompts, reroute suggestions, alerts |
| Object storage | **MinIO (self-hosted)** or **Supabase Storage** | Encrypted SOS audio clips only, auto-delete after retention window |
| Auth | **JWT (FastAPI + `passlib`/`python-jose`)** | Simple user + trusted-contacts model |
| Containerization | **docker-compose** | Postgres, OSRM, MinIO run locally — no network dependency on demo day |
| Testing | **pytest** (backend), **Jest** (mobile/dashboard) | See implementation plan for per-phase test steps |

### 1.1 What Replaces Redis

Redis held five things. Each has a direct replacement that costs nothing and deploys on a free tier:

| Was in Redis | Now |
|---|---|
| Active-trip state | `trips.status` column + an in-process `dict[trip_id, TripRuntime]` rebuilt from Postgres on startup |
| GPS ping rolling buffer | `gps_pings` table (already in schema) + an in-process `deque(maxlen=N)` per active trip for the hot path |
| Alert cooldowns / dedupe | New `alert_cooldowns` table with a `UNIQUE (trip_id, alert_type)` constraint and a `cooldown_until` timestamp — dedupe becomes a DB constraint instead of a cache check, which is **more** reliable, not less |
| Rate limiting | `slowapi` with its in-memory backend |
| WebSocket pub/sub fan-out (live-share) | In-process connection registry: `dict[trip_id, set[WebSocket]]` |

> ⚠️ **The one hard constraint this creates: you must run a single worker process.**
> `uvicorn app.main:app --workers 1`. In-process state does not survive across workers, so two workers would mean a trip's WebSocket lands on process A while its escalation timer runs on process B, and the check-in silently never fires.
> This is not a problem in practice — free tiers give you one small instance anyway — but it must be written in the deploy config and in the README, because it will not fail loudly. It will fail silently and only under load.

### 1.2 Voice Assistant — Scope

Three distinct capabilities, all on-device, none requiring a paid service:

1. **Duress code word** — while a trip is active, the app listens for a pre-set code word. Detection fires an immediate silent SOS with no screen change.
2. **Spoken check-in response** — when the backend raises a check-in, the phone *speaks* "Are you okay?" (TTS) and listens for a reply. `"I'm fine"` resolves it; the duress word escalates; silence escalates.
3. **Safe word vs. duress word** — two separate phrases. The safe word clears the alert. The duress word looks like a normal reply to a bystander but escalates silently. This distinction is the whole point of a voice trigger; do not build only one phrase.

---

## 2. API Keys & Credentials Needed

### 2.0 Direct answer: does the NLP model need an API key?

**No.** Every NLP and ML component in this project runs locally:

| Component | Library | Key? |
|---|---|---|
| Post-trip tag suggestion (§7.13) | scikit-learn `TfidfVectorizer` + `LogisticRegression` | **No** |
| Stop anomaly detection | scikit-learn `IsolationForest` | **No** |
| Route weight learning | scikit-learn `GradientBoostingRegressor` | **No** |
| Risk table aggregation | SQL `GROUP BY` | **No** — not a model at all |
| Voice code-word matching | On-device STT + string match | **No** (see §2.2) |

There is no OpenAI, Hugging Face Inference, Google NLP, or any other hosted model call anywhere in this system. If a build process asks for an ML API key, it has gone off-spec — stop and check.

### 2.1 Required for MVP

| Credential | Used for | Where to get it | If you don't have it yet |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS alerts to trusted contacts at escalation levels L2–L4 (§7.4) | [twilio.com/console](https://www.twilio.com/console) → free trial | Mock: log the message to console/DB instead of calling Twilio. **Trial accounts can only SMS verified numbers — verify your demo contact's number a day ahead, not on stage.** |
| `FCM_SERVICE_ACCOUNT_JSON` | Push notifications: check-in prompts, reroute suggestions (§7.11, §7.8) | [Firebase Console](https://console.firebase.google.com/) → Project Settings → Cloud Messaging → service account key | Mock: log the payload; UI shows an in-app banner during the demo |
| `DATABASE_URL` | PostgreSQL + PostGIS connection string | Self-hosted via docker-compose, or a free managed Postgres (Neon / Supabase / Render) | Not a third-party key; an env var you define |
| `JWT_SECRET_KEY` | Signing auth tokens | Generate yourself (`openssl rand -hex 32`) | Not a third-party key |
| OSM extract (no key) | Base map data for OSRM + static features (`lit`, `shop`, `police`, `transit` tags) | [download.geofabrik.de](https://download.geofabrik.de/) → Kolkata / West Bengal extract | N/A — free download |

> `REDIS_URL` has been **removed**. If it still appears anywhere in the codebase or `.env`, that code is stale — delete it.

### 2.2 Voice Assistant — Key Decision

| Option | Key? | When to pick it |
|---|---|---|
| **`@react-native-voice/voice`** | **No key** | **MVP default.** Uses iOS `Speech` framework / Android `SpeechRecognizer`. Free, no signup, works in Expo dev build. Trade-off: the mic session must be actively running, which is battery-heavy, so only listen while a trip is active — never in the background. On Android, recognition may route through Google's servers; disclose this in onboarding. |
| **Porcupine (Picovoice)** → `PICOVOICE_ACCESS_KEY` | **Free key required** | Upgrade. True always-on, on-device, low-power wake-word detection with a proper React Native SDK. Get it at [console.picovoice.ai](https://console.picovoice.ai/) → free tier. Ask the user for this key **only at Phase 7b**, and only if they want always-on rather than trip-scoped listening. |
| ~~`openWakeWord`~~ | — | **Do not use.** It is a Python library with no React Native SDK. It cannot run on the phone. It was listed as the key-free option in the previous version of this document; that was wrong. |

`expo-speech` (TTS for speaking the check-in prompt) requires **no key** in all cases.

### 2.3 Optional (nicer demo, not required)

| Credential | Used for | Where to get it | Fallback if skipped |
|---|---|---|---|
| `MAPBOX_ACCESS_TOKEN` | Prettier map tiles instead of default OSM raster tiles | [mapbox.com](https://www.mapbox.com/) → free tier | Free OSM raster tiles via Leaflet — no key needed |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` or `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Encrypted storage for SOS audio clips (§7.12) | Self-hosted MinIO, or [supabase.com](https://supabase.com/) free tier | Skip audio capture; log trail-only evidence to Postgres |

### 2.4 Explicitly not needed

- **No Redis credentials** — Redis is out of the stack entirely.
- **No Google Maps / Directions API key** — routing runs on self-hosted OSRM.
- **No OpenTripPlanner/GTFS key** — transit routing out of scope for MVP.
- **No third-party ML or NLP API key** — see §2.0.
- **No speech-to-text API key** — the MVP voice path uses the OS's built-in recognizer.

---

## 3. Environment Variable Template

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/saferoute

# Auth
JWT_SECRET_KEY=

# Routing
OSRM_BASE_URL=http://localhost:5000

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Firebase Cloud Messaging
FCM_SERVICE_ACCOUNT_JSON_PATH=

# Escalation tuning (see backend-prompt.md §5.5)
CHECKIN_WINDOW_SEC=45
ESCALATION_SUSTAINED_SEC=300
ALERT_COOLDOWN_SEC=300

# Optional
MAPBOX_ACCESS_TOKEN=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
PICOVOICE_ACCESS_KEY=      # only if upgrading from OS STT to Porcupine
```

> **Note for whoever/whatever is implementing this:** don't request all of these up front. Each key is only needed when the feature that depends on it is actually being built — `implementation-plan.md` says exactly when to pause and ask.

---

## 4. Free-Tier Deployment Reality Check

Removing Redis solves one free-tier problem. **OSRM is the other one, and it's harder.** An OSRM instance with a Kolkata extract needs roughly 500 MB–1 GB of RAM, which exceeds most free web-service tiers.

Fallback ladder, in order of preference:

1. **Demo locally via docker-compose.** This is what the spec already assumes, and it is the safest option for a hackathon — no network dependency on stage.
2. **Split the deploy**: backend + Postgres on free tiers, OSRM on a local machine exposed via a tunnel (`cloudflared`, `ngrok`) during the demo window only.
3. **Precompute routes.** For a fixed set of demo origin/destination pairs, cache OSRM's responses into a `route_cache` table at build time and serve from there. The scoring layer — which is the actual IP — runs entirely on cached geometry and works perfectly.
4. **Public OSRM demo server** (`router.project-osrm.org`) — no key, but heavily rate-limited, driving profile only, and terms prohibit production use. Acceptable as a last-resort fallback flag, not a plan.

Pick option 1 or 3 and write it down before Phase 1, because it changes how `osrm_client.py` is structured.
