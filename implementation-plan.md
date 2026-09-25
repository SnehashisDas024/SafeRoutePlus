# SafeRoute+ — Implementation Plan (with Integrated Testing)

*Follows the build order in `saferoute-plus-spec-v2.md` §13, expanded into buildable phases. Each phase has a goal, tasks, the API keys it touches (if any), and a real-time test to run before moving to the next phase.*

---

## 0. Ground Rules for Whoever/Whatever Is Building This

1. **Build in phase order.** Don't start Phase N+1 until Phase N's test passes. This project is a pipeline (data → risk engine → routing → monitoring → escalation → alerts) and later phases silently depend on earlier ones being correct.
2. **Ask for API keys just-in-time, not up front.** The moment a task requires a credential from `tech-stack-and-api-keys.md`, stop and explicitly ask the user for that specific key, explain what it unlocks, and what happens if they skip it (usually: a documented mock/fallback).
3. **No ML or NLP component in this project needs an API key.** Everything is scikit-learn running locally — verified in §0.1 below. If a build step requests an ML/NLP credential, it has gone off-spec.
4. **Every phase ends with a runnable test**, not just "code written." If a phase can't be verified (via `curl`, `pytest`, or the simulator), it isn't done.
5. **Bias toward over-triggering, not balanced accuracy**, for every anomaly/escalation threshold. A false alarm is annoying; a missed emergency is catastrophic.
6. **If a phase's scope starts ballooning, cut toward the MVP list in the spec (§12), not away from it.**
7. **There is no Redis in this project.** If any generated code imports `redis`, reads `REDIS_URL`, or assumes a cache layer, that code is stale — replace it per `backend-prompt.md` §3.1.

---

## 0.1 Verified: Which Phases Touch an ML/NLP API Key

Asked directly: *does the NLP model use any API key?* Verified against every phase below — **no.**

| Phase | ML/NLP component | Library | API key |
|---|---|---|---|
| 2 | Risk table aggregation | SQL `GROUP BY` | **None** — not a model |
| 3 | Route weight learning (optional) | scikit-learn `GradientBoostingRegressor` | **None** |
| 6 | Stop anomaly detection | scikit-learn `IsolationForest` | **None** |
| 6 | Deviation classification (optional) | scikit-learn `RandomForest` | **None** |
| 7b | Voice code-word matching | On-device STT + SHA-256 | **None** (see caveat) |
| 9 | Post-trip tag suggestion (NLP) | scikit-learn `TfidfVectorizer` + `LogisticRegression` | **None** |

**The one caveat, in Phase 7b:** the *voice assistant* is not an NLP model but it does involve speech recognition, and the library choice determines whether a key is needed.

- `@react-native-voice/voice` (OS built-in recognizer) → **no key**. This is the MVP default.
- Porcupine (Picovoice) → **free key required** (`PICOVOICE_ACCESS_KEY`). Optional upgrade only.
- `openWakeWord` → **not usable**. Python-only, no React Native SDK. Previously listed as the key-free option; that was wrong.

---

## 0.2 Changes From the Previous Version of This Plan

| Change | Affected phases |
|---|---|
| Redis removed from infrastructure and all state moved to Postgres + in-process | 1, 5, 7 |
| Phase 7 rewritten as a **tiered escalation ladder** (L0–L4) instead of binary check-in → SOS | 7 |
| **New Phase 7b** — voice assistant (duress word, spoken check-in) | 7b |
| Two new simulator scenarios: `voice_duress`, `phone_dies` | 5, 6, 7b |
| Free-tier deployment decision moved **before** Phase 1 | 0.3 |

## 0.3 Decide This Before Phase 1

Removing Redis fixes one free-tier problem. **OSRM is the other.** An OSRM instance with a Kolkata extract needs ~500 MB–1 GB RAM, more than most free web tiers allow. Pick one now, because it changes how `osrm_client.py` is structured:

1. **Demo locally via docker-compose** (safest for a hackathon — no network dependency on stage)
2. Backend + Postgres on free tiers, OSRM local via `cloudflared`/`ngrok` tunnel during the demo
3. **Precompute routes** for fixed demo pairs into a `route_cache` table — the scoring layer, which is the actual IP, works fine on cached geometry
4. Public `router.project-osrm.org` — rate-limited, driving only, terms prohibit production use. Last-resort flag, not a plan.

Write the choice into the README before writing any code.

---

## Phase 1 — Infrastructure Bootstrap

**Goal:** Everything runs locally via `docker-compose`, no app code yet.

**Tasks**
- `docker-compose.yml`: Postgres 16 + PostGIS + `h3-pg`, OSRM (Kolkata `.osm.pbf` from Geofabrik), MinIO. **No Redis container.**
- Base FastAPI app skeleton (`main.py`, `config.py`, `state.py`, health-check endpoint)
- APScheduler wired into the FastAPI startup event (replaces the separate worker container)
- `uvicorn` configured with `--workers 1`, with a comment in the Dockerfile explaining why (see `backend-prompt.md` §3.1)
- `.env` scaffolded from the template in `tech-stack-and-api-keys.md` — **no `REDIS_URL` line**

**API keys needed:** None — self-hosted services and free OSM downloads only.

**Real-time test**
```bash
docker-compose up -d
curl http://localhost:8000/health          # expect 200
docker exec -it <postgres> psql -c "SELECT h3_get_resolution('8928308280fffff');"
curl http://localhost:5000/route/v1/driving/88.36,22.57;88.40,22.60
grep -ri "redis" . --include=*.py --include=*.yml   # expect zero matches
```
Pass criteria: first three succeed, and the `redis` grep returns nothing.

---

## Phase 2 — Static Geo Data + Synthetic Risk Table

**Goal:** `risk_cells` and `static_features` exist and are populated (spec §5.1, §5.2).

**Tasks**
- `ml/pipelines/build_static_features.py`: OSM → per-H3-cell `lit_ratio`, `police_dist_m`, `shop_density`, `road_class`, `transit_dist_m`
- `ml/pipelines/generate_synthetic.py`: synthetic incidents/crowd/lighting per organizer data
- `ml/pipelines/build_risk_table.py`: `GROUP BY (h3_index, hour, dow)` → weighted `risk_score`, `confidence`, `sample_count`
- H3 neighbour-fill for cold-start cells (ring-1 distance-weighted average, flagged `confidence = 'estimated'`)

**API keys needed:** None — OSM extract and synthetic/organizer data only. **No ML key; this phase has no trained model at all**, just aggregation.

**Real-time test**
```sql
SELECT count(*) FROM static_features;                             -- > 0
SELECT count(*) FROM risk_cells WHERE confidence = 'estimated';   -- cold-start fill ran
SELECT risk_score, confidence FROM risk_cells WHERE h3_index='<cell>' AND hour=21;
```
Also spot-check that **no** cell in the demo area returns `NULL` risk_score — catch the cold-start failure now, not on demo day.

---

## Phase 3 — Route Scoring Core (`/routes/plan`)

**Goal:** Given origin/destination/time, return 2–3 routes with time-shifted, worst-segment safety scores (spec §6).

**Tasks**
- `core/time_shift.py`: per-segment predicted arrival time from cumulative distance/mode speed
- `core/risk_engine.py`: `score(cell, timestamp) → {score, confidence, factors}` — always the structured object, never a bare float
- `core/route_scorer.py`: candidate-generate-then-score against OSRM `alternatives=true`; lexicographic sort key `(worst_segment_score, mean_segment_score, -total_time_sec)`
- `services/osrm_client.py` with **live and cached modes**, per the §0.3 decision
- `POST /routes/plan`

**API keys needed:** None — OSRM is self-hosted. Optional `GradientBoostingRegressor` weight learning is scikit-learn, **no key, no epochs**.

**Real-time test**
```bash
curl -X POST http://localhost:8000/routes/plan \
  -d '{"origin":[22.57,88.36],"destination":[22.60,88.40],"mode":"walk","depart_at":"2026-09-15T20:30:00"}'
```
Pass criteria:
- 2–3 routes, each with `score`, `confidence`, and a per-segment `factors` breakdown
- Re-run the worked example from spec §6.3 (query 8:30 PM, 40-min route) and confirm the route with a high-risk segment at ~9:05 PM scores worse than a same-length alternative without one
- Confirm the lexicographic sort is actually applied, not just `min()`

---

## Phase 4 — Map UI (Route Comparison)

**Goal:** Mobile/web screen showing 2–3 routes with colour-coded risk overlay and factor explanations.

**Tasks**
- Mobile: `screens/Plan.tsx`, `screens/RouteCompare.tsx`, `components/MapView`, `RiskOverlay`, `SafetyBadge`
- Dashboard equivalent in React + Leaflet
- Call `/routes/plan`, render polylines colour-coded by segment score, show the "why" panel from `factors`

**API keys needed:**
- Default OSM tiles: none.
- Mapbox tiles for a nicer demo: **ask for `MAPBOX_ACCESS_TOKEN` now**, explain it's optional, confirm the OSM fallback is acceptable if they don't have one.

**Real-time test**
- Query 2–3 origin/destination pairs and confirm: (a) routes render, (b) colours match backend per-segment scores, (c) tapping a segment shows its factor breakdown, (d) `estimated`-confidence segments are visually distinguishable from `high`.

> **Milestone (spec §13):** finishing this phase means you have something demoable. Everything after is upside.

---

## Phase 5 — WebSocket Ingest + Trip Simulator

**Goal:** A replayable, scripted GPS trail streams into the backend over WebSocket — this **is** the demo mechanism.

**Tasks**
- `POST /trips/start` → creates trip, returns WS token
- `WS /trips/{id}/stream` → accepts GPS pings, echoes trip status
- `app/state.py`: in-process registries — `dict[trip_id, TripRuntime]`, `dict[trip_id, set[WebSocket]]`, per-trip `deque` ping buffer. **This replaces Redis.**
- Startup rehydration: rebuild in-process state from Postgres on boot
- `simulator/trip_simulator.py` + `scenarios/normal.json`, `deviation.json`, `prolonged_stop.json`, `voice_duress.json`, `phone_dies.json`

**API keys needed:** None.

**Real-time test**
```bash
python simulator/trip_simulator.py --scenario normal --trip-id <id>
```
Pass criteria:
- Connect a WS client (`websocat` or a small script), run `normal`, confirm pings arrive in order with correct timestamps and no dropped connection.
- **Restart-resilience check (new, because Redis is gone):** start a trip, `docker-compose restart backend`, reconnect, and confirm the trip's state rehydrates from Postgres instead of vanishing. If this fails, in-process state is being treated as the source of truth somewhere it shouldn't be.

Do this **before** building any detection logic — you need a trustworthy signal source first.

---

## Phase 6 — Deviation & Stop Detection

**Goal:** Detection correctly flags `deviation` and `prolonged_stop` and does **not** false-positive on `normal`.

**Tasks**
- `core/deviation.py`: point-to-polyline distance + accuracy gating (`accuracy > 50m` discarded) + hysteresis (N≈3–5 confirming pings) + OSRM `/match` map-matching before measuring divergence
- `core/stop_detector.py`: dwell-time anomaly (Isolation Forest / z-score) against historical stop-duration distribution per location/hour

**API keys needed:** None. Both models are scikit-learn, fit in seconds, **no epochs, no API key.**

**Real-time test — all three scenarios back to back:**
```bash
python simulator/trip_simulator.py --scenario normal
python simulator/trip_simulator.py --scenario deviation
python simulator/trip_simulator.py --scenario prolonged_stop
```
Pass criteria:
- `normal` → zero deviation flags, zero stop flags over the full trail. If this fails, tighten hysteresis/accuracy gating before doing anything else.
- `deviation` → flag fires within N pings of the actual deviation, not at trip start
- `prolonged_stop` → fires only past the location/hour-adjusted expected wait, not on any stop (a legitimate bus-stop wait shouldn't trigger)

Tune thresholds toward **over-triggering** on ambiguous cases (spec §11.3).

---

## Phase 7 — Tiered Escalation + Alerts to Trusted Contacts

**Goal:** A detected anomaly walks a graded ladder and reliably reaches trusted contacts, with a soft heads-up *before* the emergency, not only during it.

**Tasks**
- `core/escalation.py` — the **L0–L4 ladder** from `backend-prompt.md` §5.5:

  | Level | Trigger | Contacts notified |
  |---|---|---|
  | L0 Normal | default | none |
  | L1 Watch | one unconfirmed signal | none (silent, ping rate up, logged) |
  | L2 Check-in | confirmed anomaly | **primary contact only**, soft heads-up |
  | L3 Alert | no response / duress word / manual SOS | **all contacts**, full SMS + live-share link |
  | L4 Sustained | L3 unresolved 5 min | all contacts re-notified + nearest police station |

- `escalation_state` and `alert_cooldowns` tables (`alert_cooldowns` replaces Redis dedupe keys)
- `trusted_contacts.tier` column (`primary` / `secondary`)
- Server-side `checkin_deadline` timer via APScheduler — **authoritative, never the client's**
- `services/twilio_client.py`, `services/fcm_client.py` with retry + dedupe and **per-level message templates**
- `POST /trips/{id}/sos`, `POST /trips/{id}/checkin`, `GET /trips/{id}/escalation`

**API keys needed:**
- **Stop and ask for `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`** before wiring the real SMS call. Without them the alert service logs instead of sending — functionally testable, just not demo-visible on a real phone.
- **Ask for `FCM_SERVICE_ACCOUNT_JSON`** before wiring real push, same fallback.
- If Twilio keys are provided: remind the user to **verify the demo contact's number in the Twilio console the day before**. Trial accounts reject unverified numbers and this fails silently on stage.

**Real-time test**
```bash
curl -X POST http://localhost:8000/trips/<id>/sos
```
Pass criteria:
- **Ladder order**: run `--scenario deviation` and assert the trip passes L1 → L2 → L3 in order. An automatic anomaly must **never** skip L2.
- **Jump rules**: `POST /sos` lands directly on L3 without passing through L2.
- **L2 soft alert fires**: the primary contact receives the heads-up message, secondary contacts receive nothing.
- **L3 fans out**: all contacts receive the full alert with a working live-share link.
- **Dedupe**: fire `/sos` twice rapidly → exactly one outbound alert per contact. Verify this reads `alert_cooldowns`, not a cache.
- **Retry**: kill the network mid-call, confirm retry rather than silent drop.
- **Server-side timer** (`--scenario phone_dies`): kill the simulator during an L2 window and confirm the backend still escalates to L3. This is the single most important test in this phase — if the client is the timer, the whole feature is fake.
- **No auto-de-escalation**: after L2 fires, resume normal simulator pings without responding, and confirm the level does **not** drop back to L0 on its own.

---

## Phase 7b — Voice Assistant (Duress Word + Spoken Check-In) — NEW

**Goal:** The user can escalate silently by speaking, and can resolve a check-in without touching the phone.

**Tasks**

*Backend:*
- `core/voice.py`: hash matching against `voice_config`, event handling per `backend-prompt.md` §5.10
- `POST /trips/{id}/voice-event`, `POST /users/voice-config`
- `voice_events`, `voice_config` tables — **hashes only, never plaintext phrases, never transcripts in logs**
- Wire `duress_word` → immediate L3, `safe_word` / `checkin_spoken` → de-escalate to L0

*Frontend:*
- `services/voice.ts` using `@react-native-voice/voice` (recognition) + `expo-speech` (prompts)
- `screens/VoiceSetup.tsx`: set safe word + duress word, on-device test mode
- Listening starts on trip start, stops on trip end or app background — never runs in the background
- L3-discretion branch: when L3 was reached via duress word, the UI must **not change at all**

**API keys needed:**
- **None for the MVP path.** `@react-native-voice/voice` uses the OS recognizer (iOS `Speech`, Android `SpeechRecognizer`); `expo-speech` is free. Neither needs signup.
- **Only if the user asks for always-on wake-word detection instead of trip-scoped listening:** stop and ask for `PICOVOICE_ACCESS_KEY` (Porcupine, free tier at console.picovoice.ai). Explain the trade-off — better battery and true always-on, in exchange for a signup — and that the OS-recognizer path already works without it.
- **Do not reach for `openWakeWord`.** Python-only, no React Native SDK.

**Real-time test**
```bash
python simulator/trip_simulator.py --scenario voice_duress
```
Pass criteria:
- Speaking the **duress word** during an active trip → backend reaches L3, all contacts alerted, and **the app screen does not change**. Verify the screen part by screen-recording, not from memory.
- Speaking the **safe word** during an L2 window → de-escalates to L0, no SMS sent, `alerts` row resolved.
- **Low-confidence safe word does not de-escalate.** Mumble it; the check-in must stay open and escalate on timeout. Ambiguity resolving toward escalation is the correct behaviour, not a bug.
- **No plaintext leaves the device:** inspect the `/voice-event` request body and confirm it contains a hash and a confidence score, nothing else. Grep the backend logs for the phrase itself; expect zero matches.
- **Setup test mode works offline:** phrases can be tested in `VoiceSetup` without any backend call.

---

## Phase 8 — Dashboard + Live-Share Page

**Goal:** Journey status, escalation level, and alert log visible; a shareable live-tracking link works.

**Tasks**
- Dashboard: trip status, **alert log showing every L0→L4 transition with level, reason, and which contacts were notified**, live map of active trip
- `GET /share/{token}`: public live-tracking view, auto-expires after trip ends

**API keys needed:** None beyond Phase 4's map tiles.

**Real-time test**
- Start a trip via the simulator, open `/share/{token}` in an incognito window (simulating a trusted contact with no login), confirm live position updates, confirm the link expires once the trip ends.
- Run `--scenario deviation` and confirm the alert log renders the **full ladder** (L1, L2, L3 rows), not a single "SOS sent" entry. A flat log loses the entire point of Phase 7.

---

## Phase 9 — Post-Trip Reports Feeding Back Into the Risk Table

**Goal:** Close the loop — a post-trip report actually changes future risk scores for that cell/hour.

**Tasks**
- `POST /trips/{id}/report`: one-tap rating + optional tags
- `workers/aggregator.py`: rebuilds `risk_cells` incorporating new reports, scheduled via **APScheduler in-process**, not a separate container
- **(NLP) TF-IDF + Logistic Regression tag suggestion** from free-text notes (§7.13)

**API keys needed:** **None.** The tag-suggestion model is scikit-learn fit on local data — no hosted NLP service, no key, no epochs. This is the phase the "does NLP need a key" question was really about; the answer is no.

**Real-time test**
- Submit a 🔴 "Unsafe" report with tag "Poorly lit" for a specific segment/hour, trigger the aggregator, re-query `/routes/plan` for a route through that segment at that hour — confirm the safety score visibly drops and `sample_count`/`confidence` increased. This is the demo's strongest "closing the loop" moment.
- Train the tag suggester on a handful of labelled notes, pass it "felt unsafe near the market," confirm it returns a sensible tag. Time the `.fit()` call and note it in the report — it should be under a second, which is itself the evidence that no epochs are involved.

---

## Phase 10 — Polish, Demo Script, Report

**Goal:** A repeatable, narratable demo and a report that's honest about scope.

**Tasks**
- `docs/demo_script.md`: safe start → L1 watch (silent) → L2 spoken check-in → user stays silent → L3 auto-alert to all contacts → reroute suggestion → post-trip report changes the risk table
- `docs/architecture.md`
- Report sections: what was trained and why there are no epochs (spec §10.3), **why no component needs an ML/NLP API key**, the synthetic-data circularity defence (§11.2), the background-location/discreet-SOS tension (§11.1), **the single-worker constraint from removing Redis**, future work (§15)

**API keys needed:** None — all credential decisions were made in earlier phases.

**Real-time test**
- Run the full demo script **twice**, back to back, on a clean environment (`docker-compose down && docker-compose up -d` in between). A demo that only worked once is not a working demo. This is the single most important test in the plan.
- Include the voice duress path in at least one of the two runs, in a room with realistic background noise. On-device recognition accuracy degrades in noise and you want to discover that in rehearsal.

---

## Quick Reference — When to Ask for Which Key

| Phase | Key to ask for | Ask when... |
|---|---|---|
| 4 | `MAPBOX_ACCESS_TOKEN` (optional) | Building the map UI, only if nicer tiles are wanted |
| 7 | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Wiring the real SMS call in the alert service |
| 7 | `FCM_SERVICE_ACCOUNT_JSON` | Wiring the real push notification call |
| 7b | `PICOVOICE_ACCESS_KEY` (optional) | **Only** if upgrading from OS speech recognition to always-on Porcupine wake-word. The MVP voice path needs no key. |
| — | `MINIO_ACCESS_KEY` / `SUPABASE_SERVICE_KEY` | Only if evidence-capture audio storage (§7.12) is pulled into scope |
| — | ~~`REDIS_URL`~~ | **Never.** Redis is out of the stack. |

**No phase requires an ML or NLP API key.** If a build process asks for one — OpenAI, Hugging Face Inference, Google NLP, a speech-to-text service — it is solving the wrong task. Stop and check against §0.1.
