# SafeRoute+ Progress Summary

*Last Updated: 2026-09-20*

## Completed Milestones

### 1. Infrastructure & Database setup
- Configured PostgreSQL 16 + PostGIS (local).
- Defined SQLAlchemy models (`schema.py`) — all tables including escalation_state, alert_cooldowns, voice_config, voice_events.
- Initialized tables via `init_db.py`.
- Replaced Docker/Redis with in-process memory state (`state.py`).
- JWT_SECRET_KEY generated and set in `.env`.

### 2. Backend Core (FastAPI) — **Complete ✅**
- FastAPI app with APScheduler + single-worker constraint (`--workers 1`).
- `/routes/plan` endpoint — **time-aware segment-level scoring with H3 indices** ✅
- Anomaly detectors (`deviation.py`, `stop_detector.py`) implemented and **connected to monitor**.
- Tiered escalation state machine (`escalation.py`) — L0→L4 logic works via API.
- WebSocket `/trips/{id}/stream` — accepts pings, persists to DB, **broadcasts escalation updates**.
- Voice backend (`voice.py`) — hash matching, confidence rules (low-confidence safe_word ignored, low-confidence duress_word escalates).
- Workers (`monitor.py`, `aggregator.py`) registered with APScheduler — **monitor fully implemented**.
- `state.py` rehydration — loads active trips + recent pings from DB on startup.
- `risk_cells` / `static_features` — **populated via ML pipelines (Phase B)** ✅
- Alert cooldown/dedupe — **not yet implemented**.
- New endpoints: `/trips` (list), `/trips/alerts` (log), `/trips/share/{token}` (public), `/contacts` (CRUD), `/trips/{id}/report` (post-trip).

#### Backend Scenario Tests (All Passing ✅)
| Scenario | Expected | Result |
|----------|----------|--------|
| `normal` | L0 (no alerts) | ✅ L0 |
| `deviation` | L0→L1→L2→L3 (after check-in timeout) | ✅ L0→L1→L2→L3 |
| `prolonged_stop` | L0→L1→L2 (with 60s threshold for testing) | ✅ L0→L1→L2 |
| `voice_duress` | Silent L3 (reason: voice_duress) | ✅ L3 |
| `phone_dies` | Server-side timer: L2→L3 after check-in timeout | ✅ Verified via deviation trip |
| `check-in timeout` | L2→L3 after 45s | ✅ L2→L3 |

- Ladder order enforced: automatic signals never skip L1→L2
- Jump rules: manual SOS / duress_word jump directly to L3
- No auto-de-escalation
- Server-side timer authoritative (phone death still escalates)

### 3. ML Data Pipelines (Phase B) — **Complete ✅**
- **`ml/pipelines/build_static_features.py`** — OSM → H3 res-9 static features: lit_ratio, police_dist_m, shop_density, road_class, transit_dist_m (7,441 cells for Kolkata).
- **`ml/pipelines/generate_synthetic.py`** — 100 SOS/anomaly events + 500 post-trip reports + passive crowd density, biased towards Kolkata hotspots.
- **`ml/pipelines/build_risk_table.py`** — GROUP BY (h3_index, hour, dow) → weighted risk_score from 3 sources (passive 0.3, reports 0.4, incidents 0.3). **H3 neighbour-fill** for cold-start cells (ring-1 distance-weighted average, flagged `confidence='estimated'`).
- Risk table: **926,245 cells** covering Kolkata at H3 res-9 × 24h × 7dow.
- Risk scores range 0.22–0.81, properly varying by hour/day.
- Risk engine queries by exact (h3, hour, dow) → returns structured {score, confidence, factors}.

### 4. Time-Aware Route Scoring (Phase C) — **Complete ✅**
- **Route segmentation** (`route_segmenter.py`) — splits OSRM GeoJSON LineString into ~200m segments with H3 indices using pyproj for metric projection.
- **Time-shifted scoring** — per-segment predicted arrival time → risk lookup at arrival hour/dow.
- **Lexicographic ranking** — (worst_segment, mean_segment, -total_time).
- Route API returns segments with: geometry, H3 index, predicted arrival, score_data {score, confidence, factors}.
- Scores vary by segment (0.30–0.44) based on predicted arrival time — **core IP working**.

### 5. Frontend Integration (Phase D) — **In Progress**
- **Dashboard**: Vite + React + Leaflet (`DashboardPage.tsx`, `LiveSharePage.tsx`) — **fetches real data** from `/trips`, `/trips/alerts`, `/share/{token}`.
- **Mobile**: Expo + React Native — screens for Plan, RouteCompare, ActiveTrip, SOS, **Report, Contacts, VoiceSetup**.
- Mobile services: `api.ts` (all endpoints), `ws.ts` (exponential backoff + resync), `location.ts` (GPS + accuracy), `sensors.ts` (shake-to-SOS), `voice.ts` (`@react-native-voice/voice` + local hash match + `expo-speech` TTS).
- **ActiveTrip**: Map with route polyline, `EscalationBanner`, `CheckInPrompt` (spoken via `expo-speech`), L3 discretion rule (duress-triggered L3 shows no screen change).
- **WebSocket**: Exponential backoff reconnect + escalation resync on reconnect.
- **RouteCompare**: Live `/routes/plan`, `RiskOverlay` (green/yellow/red segments), `SafetyBadge` (score + confidence), factor modal on tap.
- **VoiceSetup**: Safe/duress word setup with local hash testing, TTS integration ready.
- **TypeScript**: All screens compile cleanly (no errors).

### 6. Simulator
- `trip_simulator.py` loads scenarios from JSON files.
- Scenarios: `normal.json`, `deviation.json`, `prolonged_stop.json`, `voice_duress.json`, `phone_dies.json`.
- Supports voice events at specific ping indices.

---

## Next Steps (Priority Order)

### Phase E — Post-Trip Feedback Loop (Implementation Plan Phase 9)
1. Aggregator integration — 🔴/🟡/🟢 + tags update `risk_cells` dynamically.
2. TF-IDF + LogisticRegression tag suggestion from free-text notes.

### Phase F — Deployment Prep (Implementation Plan Phase D)
3. Supabase setup guide (PostGIS, direct/session pooler URI).
4. Backend deploy config (single worker, env vars).
5. Dashboard static build → Vercel/Netlify/Cloudflare Pages.
6. Mobile EAS dev build / APK.

---

## Key Constraints Enforced
- **Single worker only** — `uvicorn --workers 1` everywhere.
- **No Redis** — all state in Postgres + memory.
- **No Docker** — native/external services.
- **OSRM walking/driving only** — no transit.
- **GPS noise mitigation** — accuracy ≤50m, hysteresis N≥3, OSRM `/match` (TODO).
- **Bias toward over-triggering** — false alarm > missed emergency.
- **Voice on-device only** — backend receives hashes, never audio/transcripts.
- **L3 discretion** — duress_word L3 must not change screen (branch on `trigger_source`).

---

## Immediate Next Action
Start **Phase E, Step 1**: Aggregator integration — 🔴/🟡/🟢 + tags update `risk_cells` dynamically.