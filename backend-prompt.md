# SafeRoute+ — Backend Build Prompt

*This is a self-contained build prompt. Everything needed to build the backend is either explained inline here or referenced from `tech-stack-and-api-keys.md` and `implementation-plan.md`. Read all three before writing code.*

---

## 0. What You're Building

You are building the backend for **SafeRoute+**, a women's safety navigation and journey-monitoring platform, merging two problem statements into one system:

- **Module A — Safe Route Planner**: given origin, destination, time, and mode, return 2–3 routes ranked by a *time-aware, explainable Safety Score* — not just distance/time.
- **Module B — Live Journey Guardian**: once a trip starts, ingest live GPS, detect deviations/unexpected stops, run a **tiered escalation ladder** with a **voice-assistant check-in**, and alert trusted contacts progressively.

Both modules share **one backend**, **one risk engine**, and **one database**. Do not build them as two separate services — the whole point of the merge is shared infrastructure.

The backend is **FastAPI (Python 3.11+)**, backed by **PostgreSQL 16 + PostGIS + h3-pg**, with **OSRM** (self-hosted, Docker) for raw route geometry. Full stack and every required credential is listed in `tech-stack-and-api-keys.md` — **do not deviate from that stack**.

### 0.1 Two Changes From the Previous Version of This Prompt

**1. There is no Redis.** The project deploys on free tiers. Every responsibility Redis had moves to Postgres or in-process memory — see §3.1. If you find yourself reaching for a cache, use a table.

**2. The voice assistant is in scope, and escalation is now tiered.** Abnormal-activity detection no longer produces a binary "flag or SOS." It drives a four-level ladder that notifies trusted contacts progressively, with a spoken check-in as the primary resolution path — see §5.5.

---

## 1. How to Work Through This Prompt

1. Build in the phase order defined in `implementation-plan.md`. Each phase there has a pass/fail test — treat those as acceptance criteria, not suggestions.
2. **Ask the user for API keys only when the phase that needs them is reached.** The "Quick Reference" table at the bottom of `implementation-plan.md` tells you exactly when. Never request Twilio/FCM/Mapbox credentials while working on database schema or routing logic.
3. **No ML or NLP component in this backend requires an API key.** Everything is scikit-learn running locally. If a task seems to need a hosted model, that task is off-spec — stop and confirm.
4. When a credential isn't provided, implement the documented fallback (log instead of send, OSM tiles instead of Mapbox) so the phase stays testable.
5. After every phase, run the real-time test specified for it before moving on.
6. If you need a design decision this document doesn't cover, prefer the most boring, most testable option, and note the assumption inline in code comments.

---

## 2. Core Algorithm — Explain This Before Writing Any Routing Code

This is the actual intellectual core of the backend. Get this right before anything else in Module A.

### 2.1 The problem being solved

Standard navigation only checks safety at the moment of the query. A 40-minute walk starting at 8:30 PM ends at 9:10 PM — if a segment's risk profile worsens after 9:00 PM (shops closing, streets emptying), a route that looked safe at query time can become unsafe mid-journey. The system must score the *entire time-shifted path*, not a single snapshot.

### 2.2 The algorithm, step by step

1. **Generate candidates**: call OSRM with `alternatives=true&alternatives.max_paths=3` for the requested mode. OSRM optimizes for time/distance only — it has no concept of safety, so treat its output as raw geometry candidates, not final routes.
2. **Segment each candidate**: split each returned route into ~200 m segments.
3. **Estimate arrival time per segment**: walk the route from departure time, accumulating segment traversal time based on mode + distance + typical speed, so each segment boundary has a *predicted arrival timestamp*, not just the total ETA.
4. **Time-shifted risk lookup**: for each segment, look up `risk_score(h3_index(segment), hour_of(predicted_arrival), day_of_week)` from `risk_cells` — using the segment's *predicted arrival hour*, never the query-time hour.
5. **Aggregate per route**: `route_score = min(segment_scores)`. The worst segment defines the whole route's score, not the average.
6. **Rank candidates** using a lexicographic tuple to avoid tie-breaking on `min()` alone:
   ```python
   sort_key = (worst_segment_score, mean_segment_score, -total_time_sec)
   ```
7. **Live re-evaluation**: once a trip is active, if the user's actual pace diverges from the original ETA, recompute remaining segments' risk using *new* predicted arrival times, and trigger a reroute suggestion if risk has materially risen (with a cooldown — see §5.4).

### 2.3 Non-negotiable implementation rules

- `risk_engine.score(cell, timestamp)` must **always return a structured object**, never a bare float:
  ```python
  {"score": 0.62, "confidence": "estimated",
   "factors": {"lit_ratio": -0.3, "police_dist": 0.1, "crowd": -0.2}}
  ```
  Required for the "why is this route safer" explainability requirement. Retrofitting it later means rewriting the engine.
- Never score all segments at departure time.
- Use **H3 hexagons at resolution 9** for all spatial bucketing.

---

## 3. Database Schema

Implement exactly this schema (PostgreSQL + PostGIS + h3-pg):

```sql
users(id, phone, name, created_at)

trusted_contacts(id, user_id, name, phone,
                 tier,            -- 'primary' | 'secondary'
                 priority)

trips(id, user_id, origin_geom, dest_geom, mode,
      planned_route_geom, planned_segments jsonb,
      started_at, eta, status)

gps_pings(trip_id, geom, speed, accuracy, ts)      -- partitioned by day

risk_cells(h3_index, hour, dow,
           risk_score, confidence, sample_count)

static_features(h3_index, lit_ratio, police_dist_m,
                shop_density, road_class, transit_dist_m)

reports(id, trip_id, h3_index, rating, tags[], note, ts)

incidents(id, type, geom, ts, source, trust_weight)

safe_points(id, geom, type, opening_hours)

alerts(id, trip_id, level, type, triggered_at,
       resolved_at, payload jsonb)

-- NEW: replaces Redis cooldown keys
alert_cooldowns(trip_id, alert_type, cooldown_until,
                UNIQUE (trip_id, alert_type))

-- NEW: tiered escalation state machine (§5.5)
escalation_state(trip_id PRIMARY KEY, level, entered_at,
                 reason, checkin_deadline, last_notified_at)

-- NEW: voice assistant events (§5.10)
voice_events(id, trip_id, kind,     -- 'duress_word' | 'safe_word'
                                    -- | 'checkin_spoken' | 'no_response'
             transcript_hash, confidence, ts)

-- NEW: user's voice phrases (never store plaintext)
voice_config(user_id PRIMARY KEY, safe_word_hash,
             duress_word_hash, enabled)
```

Notes:
- `risk_cells` is the single most important table — everything reads from `(h3_index, hour, dow) → risk_score`. Don't let any module compute risk ad hoc outside `risk_engine.py`.
- `gps_pings` should be partitioned by day from the start.
- `confidence` must distinguish `'high'` from `'estimated'` — this is surfaced in the UI.
- **Store only hashes of voice phrases.** The duress word is a credential. Hash it client-side, compare hashes server-side, and never log a raw transcript. `transcript_hash` exists so you can audit that a match occurred without retaining what was said.

### 3.1 State Without Redis

Redis is not in the stack. Implement its five former jobs as follows:

| Former Redis job | Implementation |
|---|---|
| Active-trip state | `trips.status` + in-process `dict[trip_id, TripRuntime]`, rebuilt from Postgres in a FastAPI `startup` event so a restart mid-demo recovers |
| GPS ping rolling buffer | `gps_pings` table + in-process `collections.deque(maxlen=N)` per active trip for the hot path |
| Alert cooldown / dedupe | `alert_cooldowns` table. `INSERT ... ON CONFLICT (trip_id, alert_type) DO UPDATE` and check `cooldown_until` before sending. **This is more reliable than a cache**, because dedupe survives a process restart. |
| Rate limiting | `slowapi`, in-memory backend |
| WebSocket fan-out for live-share | In-process registry: `dict[trip_id, set[WebSocket]]` |
| Scheduled aggregator / escalation timers | **APScheduler inside the FastAPI process** — no separate worker container |

> ⚠️ **Hard constraint: run exactly one worker process.** `uvicorn app.main:app --workers 1`.
> In-process state does not cross workers. With two workers, a trip's WebSocket lands on process A while its escalation timer runs on process B, and the check-in never fires. This fails **silently**, only under load, and is nearly impossible to debug on demo day. Put the constraint in the Dockerfile CMD, the deploy config, and the README.

---

## 4. Endpoints to Build

```
POST  /routes/plan            → 3 scored candidates + per-segment factor breakdown
POST  /trips/start            → creates trip, returns WebSocket token
WS    /trips/{id}/stream      → GPS in; status, check-in prompts, alerts out
POST  /trips/{id}/checkin     → "I'm okay" response, clears pending escalation
                                body: {method: "tap" | "voice", phrase_hash?}
POST  /trips/{id}/voice-event → NEW: on-device voice trigger (§5.10)
                                body: {kind, phrase_hash, confidence}
POST  /trips/{id}/sos         → immediate manual escalation (jumps to L3)
GET   /trips/{id}/reroute     → re-scores remaining path from current position
GET   /trips/{id}/escalation  → NEW: current level + reason (dashboard polls this)
GET   /share/{token}          → public live-tracking view, auto-expires when trip ends
POST  /trips/{id}/report      → post-trip one-tap rating + optional tags/notes
GET   /safe-points/nearest    → shortlist via PostGIS ST_Distance, rank via OSRM
POST  /users/voice-config     → NEW: set safe/duress phrase hashes
```

For each endpoint: validate input with Pydantic, return structured errors (not bare 500s), and write a `pytest` test against a seeded test database before considering it done.

---

## 5. Module-by-Module Detail

### 5.1 Risk Engine (`core/risk_engine.py`)

Single service consumed by both route planning and live monitoring. Given `(h3_index, timestamp)`, returns the structured score object from §2.3. This is the one place risk is computed — route scorer, monitor worker, and reroute logic all call into this; none reimplement scoring.

### 5.2 Route Scorer (`core/route_scorer.py`, `core/time_shift.py`)

Implements §2.2 end to end. Depends on `osrm_client.py` for candidate geometry and `risk_engine.py` for per-segment scoring.

> Note on free-tier deployment: `osrm_client.py` should support a **cached mode** that reads precomputed geometry from a `route_cache` table, per `tech-stack-and-api-keys.md` §4. Structure it so swapping live OSRM for cache is a config flag, not a rewrite.

### 5.3 Deviation Detection (`core/deviation.py`)

- Compute perpendicular distance of each live GPS point from the planned route polyline.
- **Required mitigations, all three, not optional:**
  1. **Accuracy gating** — discard any ping with `accuracy > 50 m`.
  2. **Hysteresis** — require N ≈ 3–5 consecutive confirming pings before raising a flag, and a separate lower threshold to clear it.
  3. **Map matching** — snap the live trail to the road network via OSRM's `/match` *before* measuring divergence.
- Without all three, urban GPS noise (20–50 m routinely, worse near tall buildings) fires false deviations constantly. Verify against the `normal` simulator scenario in Phase 6 — zero false positives over a full trail is the pass condition.

### 5.4 Stop Detection (`core/stop_detector.py`)

Rule-based baseline: speed ≈ 0 for more than X minutes at a location not marked as a known stop. Upgrade with anomaly detection (Isolation Forest or z-score) fit on the historical stop-duration distribution for that location/hour, so "expected" wait time adapts per place rather than one fixed threshold everywhere. **scikit-learn, no API key, no epochs.**

### 5.5 Tiered Escalation State Machine (`core/escalation.py`) — REWRITTEN

Abnormal activity no longer produces a binary flag-or-SOS. It advances a trip through five levels, each with a defined notification to trusted contacts. State lives in `escalation_state`.

| Level | Trigger | What the user sees | What trusted contacts get |
|---|---|---|---|
| **L0 — Normal** | Default | Nothing | Nothing |
| **L1 — Watch** | One unconfirmed anomaly signal (single deviating ping, brief stop, entering a high-risk cell) | Nothing. Silent. | Nothing. GPS ping rate increases; event logged. |
| **L2 — Check-in** | Confirmed anomaly (hysteresis satisfied, or dwell past adaptive threshold) | Phone **speaks** "Are you okay?" + push + on-screen prompt. `CHECKIN_WINDOW_SEC` (default 45s) to respond. | **Primary contact only**, soft heads-up push/SMS: *"SafeRoute+ noticed something unusual on <name>'s trip and is checking in. No action needed yet."* |
| **L3 — Alert** | No check-in response, **or** duress word detected, **or** manual SOS | Screen stays normal if voice-triggered (discreet). Visible confirmation if tap-triggered. | **All contacts**, full SMS + push: live-share link, last known location, reason, timestamp. Evidence capture begins. |
| **L4 — Sustained** | L3 unresolved after `ESCALATION_SUSTAINED_SEC` (default 300s) | Nothing new | All contacts re-notified with escalating wording + nearest police station from `/safe-points/nearest` + explicit prompt to contact authorities |

**Implementation rules:**

- **Levels advance one step at a time, except manual SOS and duress word, which jump straight to L3.** Never skip L2 for an automatic signal — that's what produces panic-inducing false alarms.
- **De-escalation only happens on explicit user action** (tap check-in or spoken safe word), never automatically because the anomaly stopped. A user who is back on route because she was forced back on route must not be silently de-escalated.
- **Every level transition writes an `alerts` row** with the `level` column set, so the dashboard's alert log is a complete audit trail.
- **Every outbound notification goes through the `alert_cooldowns` check** — L4 re-notification in particular must not loop.
- Bias every threshold toward **over-triggering, not balanced accuracy**. A false alarm is annoying; a missed real emergency is not acceptable. State this reasoning in code comments where thresholds are set.

> ⚠️ **L2's soft heads-up to the primary contact is the single most valuable addition here.** It is the difference between a contact receiving one terrifying SOS with no context, and a contact who was already watching when the SOS arrived. Build L2's notification even if you cut L4.

### 5.6 Alert Service (`services/twilio_client.py`, `services/fcm_client.py`)

- SMS via Twilio, push via FCM, with a per-level message template + live-location link.
- **Retry + dedupe built in from the start** — a duplicate-SMS storm and a silently dropped alert both look like a broken product under demo conditions. Dedupe now reads `alert_cooldowns`, not a cache.
- Message templates must differ by level. L2 should read as reassuring; L3 must be unambiguous and lead with the location link; L4 must state how long the situation has been unresolved.
- Ask the user for Twilio/FCM credentials at Phase 7 per the implementation plan; if not provided, log the outgoing payload instead of sending.

### 5.7 Aggregator Worker (`workers/aggregator.py`)

Runs on **APScheduler inside the FastAPI process**, not a separate container. Periodically rebuilds `risk_cells` from three sources:

1. Passive aggregated app-location pings → `(h3_index, hour, dow) → avg_crowd_level`
2. Post-trip one-tap reports (🟢/🟡/🔴 + tags), geo/time-bucketed
3. SOS/anomaly-triggered events — highest-trust signal, tied to real incidents

Also implement **H3 neighbour-fill**: any cell with `sample_count = 0` inherits a distance-weighted average of its ring-1 neighbours, flagged `confidence = 'estimated'`. Without this, most of the map is blank on demo day.

### 5.8 Safe-Point Guidance (`GET /safe-points/nearest`)

- Shortlist ~10 candidates by straight-line `ST_Distance` (fast).
- Re-rank by **actual OSRM walking distance** — straight-line distance can point a user across a railway line or river.
- Parse `opening_hours` and exclude closed locations.
- **Called automatically at L4** to include the nearest police station in the escalation message.

### 5.9 Evidence Capture

- Buffer a rolling window of recent GPS points continuously (in-process deque + `gps_pings`).
- Record audio **only** at L3 or above, never continuously.
- Encrypt at rest; the server never holds plaintext audio.
- Auto-delete after a fixed retention window (e.g. 72 hours) unless escalated further.
- Depends on MinIO/Supabase credentials — optional per `tech-stack-and-api-keys.md` §2.3. Skip cleanly (trail-only evidence) if not configured.

### 5.10 Voice Assistant Backend (`core/voice.py`) — NEW

Speech recognition happens **entirely on the device**. The backend never receives audio and never runs a speech model. It receives events.

**`POST /trips/{id}/voice-event`** accepts:
```python
{"kind": "duress_word" | "safe_word" | "checkin_spoken" | "no_response",
 "phrase_hash": "<sha256 of normalized transcript + user salt>",
 "confidence": 0.0-1.0}
```

Handling:

| `kind` | Backend action |
|---|---|
| `duress_word` (hash matches `voice_config.duress_word_hash`) | **Jump immediately to L3.** Do not send a check-in. Do not change anything visible on the user's screen — the response must be indistinguishable from a no-op. |
| `safe_word` (hash matches `safe_word_hash`) | De-escalate to L0, resolve the open `alerts` row, clear `checkin_deadline` |
| `checkin_spoken` | Treated as a tap check-in: de-escalate from L2 to L0 |
| `no_response` | Device reporting the listen window elapsed. Backend ignores this as authoritative and relies on its own `checkin_deadline` timer, so a dead phone still escalates |

**Non-negotiable rules:**

- **Never trust the device to be the escalation timer.** The backend's `checkin_deadline` is authoritative. If the phone dies, loses signal, or is taken, the backend must still escalate at the deadline. This is the whole reason the timer is server-side.
- **Hash comparison only.** The backend never sees the phrase. Never log `phrase_hash` alongside anything that could reverse it, and never log a transcript.
- **`confidence` below a threshold (suggest 0.6) on `safe_word` does not de-escalate.** Ambiguity must resolve toward the safe direction, which here means *staying escalated*. A low-confidence `duress_word`, by contrast, *does* escalate — same principle, opposite direction.
- **Rate-limit `voice-event`** to prevent a compromised token from spamming de-escalations.

### 5.11 ML Components — What's Actually Trained

None of this is a neural network. No epochs anywhere in this backend. **No component requires an API key.**

| Feature | Method | Library | Key? |
|---|---|---|---|
| Risk score per (cell, hour, dow) | SQL `GROUP BY` + weighted average | Postgres | No — not a model |
| Stop anomaly detection | Isolation Forest / z-score | scikit-learn | No |
| Deviation classification (optional upgrade) | Rule + hysteresis, or Random Forest | scikit-learn | No |
| Route weight learning (optional upgrade) | Ridge / GradientBoostingRegressor | scikit-learn | No |
| Post-trip tag suggestion | TF-IDF + LogisticRegression | scikit-learn | No |
| Voice code-word matching | SHA-256 hash comparison | stdlib | No — recognition is on-device |

If asked "what did you train," the honest answer: a statistical risk surface via time-bucketed aggregation, plus one small supervised model that learns factor blend weights. Not a deep model, and nothing that calls out to a hosted service.

---

## 6. Reliability & Safety Constraints (Non-Negotiable)

- **Route scoring never silently falls back to distance/time only.** If the risk engine can't score a segment, mark it `confidence: 'estimated'` and keep going.
- **Alert dedupe is mandatory** before this backend is SOS-capable — fire `/trips/{id}/sos` twice rapidly, confirm exactly one outbound alert per contact.
- **The escalation timer is server-side.** A client that stops sending pings must still escalate. Test this by killing the simulator mid-trip and confirming L2 → L3 still fires.
- **Single worker process.** See §3.1. Document it everywhere.
- **Synthetic-data circularity**: if risk weights are learned from synthetic incidents generated from your own assumptions, the model has only learned those assumptions. Hold out a slice, report accuracy honestly, and say explicitly in docs that synthetic data validates the *pipeline*, not the *conclusions*.
- **OSRM does not route public transit.** Do not silently claim bus/metro routing. Either hardcode a metro-station graph or return `mode_unsupported` and say so in the response.
- **Voice phrases are credentials.** Hashed only, never logged, never returned by any endpoint.

---

## 7. Folder Structure

```
backend/
├── app/
│   ├── main.py                  # includes APScheduler startup + state rehydration
│   ├── config.py
│   ├── deps.py
│   ├── state.py                 # NEW: in-process registries (replaces Redis)
│   ├── api/
│   │   ├── routes_plan.py
│   │   ├── trips.py
│   │   ├── sos.py
│   │   ├── voice.py             # NEW: /voice-event, /users/voice-config
│   │   ├── contacts.py
│   │   ├── reports.py
│   │   ├── safe_points.py
│   │   └── ws_stream.py
│   ├── core/
│   │   ├── risk_engine.py
│   │   ├── time_shift.py
│   │   ├── route_scorer.py
│   │   ├── deviation.py
│   │   ├── stop_detector.py
│   │   ├── escalation.py        # REWRITTEN: L0–L4 ladder
│   │   └── voice.py             # NEW: hash matching, event handling
│   ├── services/
│   │   ├── osrm_client.py       # live + cached modes
│   │   ├── twilio_client.py     # per-level templates
│   │   ├── fcm_client.py
│   │   └── storage.py
│   ├── models/          # SQLAlchemy
│   ├── schemas/         # Pydantic
│   └── workers/
│       ├── monitor.py
│       └── aggregator.py        # scheduled via APScheduler, not a container
├── alembic/
├── tests/
└── requirements.txt

ml/
├── notebooks/
├── data/{raw,synthetic,processed}/
├── pipelines/
│   ├── build_static_features.py
│   ├── generate_synthetic.py
│   ├── build_risk_table.py
│   └── train_weights.py
├── models/               # .pkl only, kept small
└── eval/

simulator/
├── trip_simulator.py
└── scenarios/{normal,deviation,prolonged_stop,voice_duress,phone_dies}.json
```

Two new simulator scenarios: `voice_duress` (duress word mid-trip) and `phone_dies` (pings stop entirely, verifying the server-side timer).

---

## 8. Testing Requirements

Follow `implementation-plan.md` phase by phase. In addition, across the whole backend:

- Every new endpoint gets a `pytest` test against a seeded test database.
- The five simulator scenarios are the primary integration test — run all five after any change to `core/deviation.py`, `core/stop_detector.py`, `core/escalation.py`, or `core/voice.py`.
- **Escalation ladder test**: assert that an automatic anomaly produces L1 → L2 → L3 in order and never skips L2, while `POST /sos` and a duress event both land directly on L3.
- **Restart-resilience test**: start a trip, restart the backend process, confirm in-process state rehydrates from Postgres and the escalation timer resumes. This test exists because removing Redis moved state into memory.
- Before Phase 10 is complete, run the full demo script twice on a clean `docker-compose down && up` cycle.

---

## 9. What NOT to Build for MVP

- Power-button SOS trigger — not implementable on iOS/Android. Use shake gesture + voice duress word + visible button.
- Real authority/police-system integration (L4 *suggests* contacting authorities; it does not dial them)
- Full multimodal transit routing (OpenTripPlanner/GTFS)
- Wearable integration
- Any of the four future data sources (scraping, community sourcing, gig-worker network, IoT feeds)
- **Server-side speech recognition.** All voice processing is on-device. Do not add a speech-to-text service.

> Voice code-word activation has been **moved out of this list and into MVP scope** — see §5.10. It was previously listed here as out of scope; that is no longer the case.

If a task seems to require something still on this list, stop and confirm with the user rather than quietly implementing a stripped-down version.
