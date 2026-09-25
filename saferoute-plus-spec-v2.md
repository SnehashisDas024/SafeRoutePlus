# SafeRoute+ — Real-Time Women's Safety & Navigation Platform

**Unified build spec, v2**
*Merging PS-B06 (Real-Time Public-Transport Safety) + PS-B07 (Dynamic Safe-Route Planning)*

---

## How to Read This Document

| Part | Sections | Purpose |
|---|---|---|
| **I — Pitch** | 1–3 | Why this exists, what it is, how to sell it |
| **II — Core Engine** | 4–6 | The risk model and time-aware routing (the actual IP) |
| **III — Features** | 7 | Every feature: what, how, ML, reality check |
| **IV — Build** | 8–11 | Stack, backend design, folder structure, ML truth |
| **V — Execution** | 12–15 | Risk register, MVP scope, build order, deliverables |

Two callout types appear throughout:

> ⚠️ **REALITY CHECK** — something in the original plan that does not survive contact with the real world. Read these before writing code.

> 💡 **PITCH NOTE** — something worth saying out loud to judges.

---
---

# PART I — PITCH

## 1. Why Merge These Two Problem Statements

- Both solve the same core problem: keeping a woman safe **while she is moving** — before the trip (route planning) and during the trip (live monitoring).
- PS-B07 = "which route/mode should I take" (pre-trip + adaptive).
- PS-B06 = "am I safe right now on this journey" (in-trip monitoring + SOS).
- Combined, they form one continuous safety loop: **Plan → Travel → Monitor → Alert → Reroute/Rescue**.
- One shared backend (risk engine + location + contacts) serves both instead of building two separate systems.

---

## 2. Unified Problem Statement

> Women travelling in cities — whether walking, using public transport, or shared/private vehicles — lack a single system that helps them choose the safest route *and* continuously monitors their journey for unusual conditions (deviations, unsafe stops, isolation), while enabling silent, fast escalation to trusted contacts or authorities when something feels wrong — without disrupting a normal journey.

---

## 3. One-Line Pitch (for submission)

> "SafeRoute+ helps women choose the safest route before they travel, and silently watches over them while they do — turning two separate safety problems into one continuous protection loop."

> 💡 **PITCH NOTE — how to frame the project.**
> This is **90% a geospatial systems project and 10% machine learning**. The intelligence lives in the risk table, the time-shifted scoring function, and the route candidate generation — not in a neural network. If you present it as "an ML project," judges will poke at the model and find it thin. Present it as **"a risk-aware routing engine with a live anomaly monitor"** and the exact same work reads as substantial and well-scoped.

---
---

# PART II — CORE ENGINE

## 4. System Architecture

A mobile-first safety platform with two connected modules sharing one risk engine.

```
┌─────────────────────────────────────────────────────────┐
│                     MOBILE APP                          │
│   Module A: Route Planner    Module B: Journey Guardian  │
└────────────────┬────────────────────┬───────────────────┘
                 │ REST               │ WebSocket
┌────────────────▼────────────────────▼───────────────────┐
│                     API LAYER (FastAPI)                 │
├─────────────────────────────────────────────────────────┤
│  Route Scorer  │  Monitor Worker  │  Alert Service       │
│       │        │        │         │       │              │
│       └────────┴────►  RISK ENGINE  ◄─────┘              │
│                         │                                │
│   ┌─────────────────────┼──────────────────────┐         │
│   │  risk_cells   static_features   safe_points │         │
│   │        PostgreSQL + PostGIS + H3            │         │
│   └─────────────────────────────────────────────┘        │
│   OSRM (routing)   Redis (trip state)   Twilio/FCM       │
└─────────────────────────────────────────────────────────┘
```

### 4.1 Module A — Safe Route Planner (from PS-B07)

- Input: source, destination, time of day, mode (walk/bus/metro/auto/cab)
- Output: 2–3 route options ranked by a **Safety Score**, not just distance/time
- Safety Score factors: lighting data, crowd density, verified incident history, proximity to help points (police, open shops), transport availability
- Shows *why* a route is safer (explainable, not a black box)
- Reroutes live if conditions change mid-journey

### 4.2 Module B — Live Journey Guardian (from PS-B06)

- Activated once user starts travelling (any mode)
- Tracks GPS against the *expected route* chosen in Module A
- Detects: route deviation, unusually long/unexpected stop, drop in movement, entering low-safety zone
- Silent SOS trigger: power-button pattern, shake gesture, or voice code word (no need to unlock/open app)
- On trigger: shares live location + audio snippet with trusted contacts and/or authorities, no visible alert on screen (discreet)

> ⚠️ **REALITY CHECK — the power-button trigger is not implementable.**
> On **iOS** you cannot intercept hardware buttons at all; the API does not exist. On **Android**, the power button is reserved by the OS and already mapped to Android's own Emergency SOS. Volume buttons *can* be captured, but only while your app holds focus or runs a foreground service, and behaviour varies wildly by OEM (Xiaomi, Oppo, Vivo, Samsung all differ).
> **What to build instead:** shake gesture (accelerometer threshold) + a lock-screen widget/quick-settings tile + optional volume-button pattern on Android only.
> **What to say in the report:** hardware-button triggers require OS-level partnership or accessibility-service permissions, and are listed as a platform-integration dependency rather than a claimed feature. Scoping this honestly is stronger than claiming a feature you cannot demo.

### 4.3 Shared Backend (used by both modules)

- **Risk Engine**: single anomaly/risk-scoring service consumed by both route planning and live monitoring
- **Geo Data Layer**: OpenStreetMap + synthetic incident/lighting/crowd datasets (as provided by organizers)
- **Trusted Contacts & Alerts Service**: one contact list, one alert pipeline for both "reroute suggestion" and "SOS"
- **Evidence Capture**: timestamped location trail + optional audio, used for both post-trip safety report and emergency evidence

### 4.4 Feature Map (which PS each feature satisfies)

| Feature | PS-B06 | PS-B07 |
|---|---|---|
| Route deviation detection | ✅ | ✅ |
| Prolonged/unexpected stop detection | ✅ | ✅ (triggers reroute) |
| Discreet SOS activation | ✅ | — |
| Trusted contact + authority alerts | ✅ | ✅ |
| Live location sharing | ✅ | ✅ |
| Safety-scored route comparison | — | ✅ |
| Lighting/crowd/incident overlays | — | ✅ |
| Automatic rerouting on risk change | — | ✅ |
| Crowd/stop-risk indicators | ✅ | ✅ |
| Nearest safe-location guidance | ✅ | ✅ (help points) |
| Emergency check-in prompts | ✅ | ✅ |
| Evidence capture (trail + audio) | ✅ | — |

> 💡 **PITCH NOTE.** This overlap table is your strongest pitch point — you're not doing two projects, you're building shared infrastructure for one continuous safety experience.

---

## 5. The Risk Data Layer

### 5.1 The Central Data Structure

Everything in this system reads from one table:

```
risk_cells: (h3_index, hour_of_day, day_of_week)
          → risk_score, confidence, sample_count
```

> ⚠️ **REALITY CHECK — use H3 hexagons, not a square grid.**
> The original spec says `location_grid_cell`. Use **H3 resolution 9** (~170 m edge) instead of square cells. Hexagons have uniform distance to all six neighbours, which makes neighbour-smoothing and cold-start fill mathematically clean. With square cells, diagonal neighbours are 1.41× farther than edge neighbours and every smoothing operation gets distorted. `h3-pg` is a Postgres extension, so this costs you nothing.

Supporting static layer, derived once from OSM:

```
static_features: h3_index → lit_ratio, police_dist_m,
                            shop_density, road_class, transit_dist_m
```

### 5.2 Data Sources — Building for Hackathon (pick these 3)

**1. Passive App-Location Aggregation**
- While the app runs, anonymized location pings from active users are aggregated per road/transit segment
- Builds `(location_grid_cell, hour_of_day, day_of_week) → avg_crowd_level` over time
- No manual effort from user; foundation layer of the risk engine

**2. Post-Trip One-Tap Reports**
- After each trip: 🟢 Safe / 🟡 Okay / 🔴 Unsafe, plus optional quick tags ("Poorly lit", "Empty street", "Harassment", "Crowded")
- Low friction (1 tap, no typing), structured output — easy to aggregate and moderate
- Geo-tagged + time-bucketed automatically into the same schema as passive data

**3. SOS / Anomaly-Triggered Events**
- Every SOS activation or system-detected anomaly (deviation, prolonged stop) is logged as a data point (location + time + type)
- Free byproduct of the safety feature already running — no extra ask
- Highest-trust data since it's tied to real incidents, not opinions

### 5.3 Confidence Weighting

- Every segment's Safety Score carries a **confidence level**: "high confidence" (backed by real reports/events) vs. "estimated" (proxy/synthetic data only)
- Shown in UI — builds user trust and demonstrates awareness of the cold-start limitation to judges

> ⚠️ **REALITY CHECK — cold start is this project's weakest point, and confidence weighting alone doesn't fix it.**
> Section 5.3 is the right *instinct* but it must be **visible in the UI, not just described in the report**. Also implement **H3 neighbour-fill**: a cell with `sample_count = 0` inherits a distance-weighted average of its ring-1 neighbours and is flagged `confidence = 'estimated'`. Without this, most of your map is blank on demo day. With it, your map is fully covered and honestly labelled.

### 5.4 Future Data Plan (post-hackathon roadmap — mention, don't build now)

- **Public/Social Data Scraping**: local news APIs, location-tagged public social posts, city open-data portals (police incident logs, streetlight maintenance records) — solves cold start for areas with zero app users
- **Partner/Community Sourcing**: verified reports submitted via a simple web form by NGOs, women's safety collectives, college safety committees — weighted higher as "trusted reporter" input
- **Gig/Delivery Worker Network**: opt-in SDK/plugin for delivery and ride-share apps to passively log lighting/crowd conditions — far greater street coverage than early app users alone
- **IoT/Existing Infrastructure Feeds**: public CCTV footfall counters, smart streetlight sensors, real-time transit occupancy APIs — fills gaps with zero manual effort

---

## 6. Time-Aware Safe Route Prediction (Critical Logic)

A route that is safe *right now* may not stay safe for the *entire duration* of the journey. The system must predict safety across the whole travel window, not just at departure time.

### 6.1 The Problem

- Standard routing checks safety only at the moment of query (departure time)
- A journey taking 40 minutes starting at 8:30 PM may end at 9:10 PM — if the risk profile of a segment worsens after 9:00 PM (e.g., shops close, crowd thins, lighting reduces), the "safe" route becomes unsafe mid-journey
- Naive systems ignore this time-drift entirely

### 6.2 Required Logic

- **Step 1 — Estimate segment-wise arrival time**: for each candidate route, calculate expected arrival time at *each segment* (not just total ETA), based on mode + distance + typical speed/wait times
- **Step 2 — Time-shifted risk lookup**: for each segment, fetch the Safety Score using its *predicted arrival time*, not the current time — e.g., a segment reached at 9:05 PM is scored using the 9 PM risk profile of that segment, even if the query was made at 8:30 PM
- **Step 3 — Whole-route safety aggregation**: the final route Safety Score = the **minimum (worst-case) segment score across the entire time-shifted path**, not an average — a single unsafe stretch mid-route should pull down the whole route's rating, since the journey is only as safe as its weakest point
- **Step 4 — Compare across full journey window**: when ranking route options, compare them on this time-shifted, worst-segment basis — a slightly longer but consistently safe route should be preferred over a shorter route that turns risky partway through
- **Step 5 — Live re-evaluation**: if the user's actual pace falls behind/ahead of the original ETA (tracked by Module B), recompute remaining segments' risk using the *new* predicted arrival times and trigger a reroute suggestion if risk has risen

### 6.3 Worked Example

- Query at 8:30 PM, route takes 40 min (arrival 9:10 PM)
- Segment 1 (reached ~8:35 PM): well-lit, market open → low risk
- Segment 2 (reached ~8:55 PM): moderately lit, shops closing → medium risk
- Segment 3 (reached ~9:05 PM): poorly lit, isolated stretch, low activity at this hour → high risk
- **Final route score = high risk** (driven by Segment 3's *time-adjusted* score), even though the route looked "safe" if only evaluated at the 8:30 PM query time

### 6.4 Data/Model Implication

- The `(location_grid_cell, hour_of_day, day_of_week) → risk_score` table from Section 5.2 is exactly what enables this — it's already time-bucketed by design
- Route scoring function becomes: `route_score = min(risk_score(segment_i, predicted_arrival_time_i) for all segments i in route)`

### 6.5 How Routes Are Actually Generated

> ⚠️ **REALITY CHECK — OSRM cannot optimise for safety.**
> OSRM and GraphHopper optimise for time or distance. There is no "safety" cost function to configure. You cannot simply ask the routing engine for the safest path.

**Hackathon approach — generate then score:**

1. Call OSRM with `alternatives=true&alternatives.max_paths=3`
2. Split each returned route into segments at ~200 m intervals
3. Compute cumulative arrival time at each segment boundary (Step 1 above)
4. Look up `risk_score(h3_cell(segment), hour_of(arrival), dow)` per segment (Step 2)
5. Aggregate and rank (Steps 3–4)

**Never score all segments at departure time.** That defeats the entire purpose of Section 6.

> ⚠️ **REALITY CHECK — pure `min()` produces ties.**
> Many candidate routes will share the same worst-segment score, especially early on when much of the map is `estimated`. Rank on a lexicographic tuple instead:
> ```python
> sort_key = (worst_segment_score, mean_segment_score, -total_time_sec)
> ```
> This keeps the spec's worst-case philosophy as the primary criterion while breaking ties sensibly.

> 💡 **PITCH NOTE — name the algorithm.**
> Minimising the worst segment is the **bottleneck shortest path** (maximin) problem. It *is* solvable directly with a modified Dijkstra that relaxes on `max(path_bottleneck, edge_weight)` instead of summing edge costs. Say this out loud, then explain you used candidate-generate-then-score for the hackathon because **time-dependent edge weights** turn it into a time-dependent bottleneck path problem, which is substantially harder to implement under a deadline. Demonstrating you know the correct formulation and made a deliberate engineering trade-off is much stronger than appearing to have just wrapped an API.

---
---

# PART III — FEATURE SPECIFICATIONS

## 7. Feature Achievement Guide (All Features, with ML/NLP)

Short description of every feature + exactly how to build it. ML/NLP marked where used.

### 7.1 Route Deviation Detection
- **What**: flags when live GPS trail diverges from the planned route
- **How**: calculate perpendicular distance of current GPS point from the route polyline (point-to-line-segment distance); if distance > threshold (e.g., 100m) for N consecutive pings → flag deviation
- **ML (optional upgrade)**: train a simple classifier (or use DTW — Dynamic Time Warping) on GPS trail patterns to distinguish "normal wandering" (entering a shop) vs. "true deviation" (forced route change)

> ⚠️ **REALITY CHECK — raw GPS noise will fire this constantly.**
> Urban canyon error is routinely 20–50 m and worse near tall buildings. A bare 100 m threshold produces a stream of false alarms. Required mitigations:
> 1. **Accuracy gating** — discard any ping with reported `accuracy > 50 m`
> 2. **Hysteresis** — require N consecutive confirming pings (N ≈ 3–5) to raise a flag, and a separate lower threshold to clear it
> 3. **Map matching** — run the trail through OSRM's `/match` service to snap it to the road network *before* measuring divergence
> Without all three, your live demo will alarm while walking in a straight line.

### 7.2 Prolonged/Unexpected Stop Detection
- **What**: flags when user stays stationary longer than expected at a non-stop location
- **How**: rule-based — if speed ≈ 0 for > X minutes at a point not marked as a known stop (bus stop/station) → flag
- **ML**: anomaly detection (Isolation Forest / simple statistical z-score) on stop-duration distribution learned from historical trips at that location/hour, so "expected" wait time adapts per place instead of one fixed threshold

### 7.3 Discreet SOS Activation
- **What**: trigger emergency alert without visibly opening/unlocking the app
- **How (MVP)**: hardware button pattern (e.g., 3x volume-down) or shake gesture (accelerometer threshold) using native mobile APIs
- **Future**: voice code-word detection — lightweight on-device keyword-spotting model (not full speech-to-text, just wake-word style detection to preserve battery/privacy)

> ⚠️ **REALITY CHECK.** See §4.2 for why power-button patterns cannot be built. Additionally: **do not train your own wake-word model.** Use a pretrained one — **openWakeWord** (free, open source) or **Porcupine** (free tier). Training a keyword spotter from scratch is a multi-day project on its own and contributes nothing to your score.

### 7.4 Trusted Contact + Authority Alerts
- **What**: notify pre-selected contacts (and optionally authorities) with location + context on trigger
- **How**: backend alert service → Twilio (SMS) / Firebase Cloud Messaging (push) with a pre-filled message template + live location link
- **No ML needed** — this is a notification pipeline, keep it simple and reliable

> ⚠️ **REALITY CHECK — Twilio trial accounts can only send to verified numbers.** Verify your demo contact's number the day before, not on stage. Also build **retry + dedupe** into the alert service; a duplicate-SMS storm during the demo looks like a bug, and a silently dropped alert looks like a broken product.

### 7.5 Live Location Sharing
- **What**: real-time location visible to trusted contacts during an active/SOS trip
- **How**: WebSocket connection streaming GPS coordinates from app → backend → shareable live-tracking link (map view), auto-expires after trip ends

### 7.6 Safety-Scored Route Comparison
- **What**: shows 2–3 routes ranked by safety, not just time/distance
- **How**: weighted scoring function combining lighting, crowd density, incident history, help-point proximity, transport availability (see Section 6 for time-aware version)
- **ML (upgrade)**: instead of hand-tuned weights, train a regression model on historical incident/report data to learn optimal feature weights automatically

> ⚠️ **REALITY CHECK — build the explainability in from day one.**
> Section 4.1 promises "shows *why* a route is safer (explainable, not a black box)." That is only cheap if the scorer returns its factor breakdown from the very first version. Make `score_segment()` return `{score, confidence, factors: {lit: -0.3, police_dist: +0.1, ...}}`, never a bare float. Retrofitting this later means rewriting the engine.

### 7.7 Lighting/Crowd/Incident Overlays
- **What**: visual map layer showing risk factors segment-by-segment
- **How**: OSM `lit=yes/no` tags + aggregated crowd-density table (Section 5.2 data sources) rendered as color-coded polyline overlay on the map (green/yellow/red)

> ⚠️ **REALITY CHECK — OSM `lit=*` coverage in Indian cities is sparse.** Many roads simply have no lighting tag at all. Treat missing as `unknown`, not as `unlit`, and fall back to a proxy (road classification + shop density + transit proximity), flagged as `estimated` confidence.

### 7.8 Automatic Rerouting on Risk Change
- **What**: mid-journey reroute suggestion if the current path's risk rises
- **How**: periodically re-run the route-scoring function (Section 6) against the *remaining* path using live time; if new worst-segment score crosses a threshold worse than the alternate route, push a reroute suggestion

> ⚠️ **REALITY CHECK — add a cooldown.** Without one, a user hovering near a threshold gets reroute prompts every polling cycle. Enforce a minimum interval (e.g. 5 minutes) between suggestions and require a *material* improvement in the alternative, not a marginal one.

### 7.9 Crowd/Stop-Risk Indicators
- **What**: shows how "populated"/safe a specific stop or segment currently is
- **How**: same aggregated crowd-density table, displayed as a simple indicator (Low/Medium/High) on stop/segment tap

### 7.10 Nearest Safe-Location Guidance
- **What**: on risk detection, guide user to nearest safe point (police station, open shop, well-lit public spot)
- **How**: geospatial nearest-neighbor query (PostGIS `ST_Distance` or simple haversine) against a pre-tagged safe-locations dataset (OSM `amenity=police`, `shop=*` with `opening_hours`)

> ⚠️ **REALITY CHECK — "nearest" must mean nearest *by road*, and it must be *open*.** Straight-line `ST_Distance` can point a user across a railway line or a river. Use `ST_Distance` to shortlist the top 10 candidates, then call OSRM for actual walking distance to pick the winner. Also parse `opening_hours` — a shuttered shop at 11 PM is not a safe point.

### 7.11 Emergency Check-In Prompts
- **What**: system proactively asks "Are you okay?" when it detects a risk signal (deviation/stop/time-based risk rise), auto-escalates if unanswered
- **How**: triggered by the same anomaly rules as 7.1/7.2 → push notification with 30–60 sec response window → no response = auto-SOS

### 7.12 Evidence Capture (Trail + Audio)
- **What**: records location trail and optional short audio clips during a flagged/SOS event for safety reporting
- **How**: buffer last N minutes of GPS points continuously (rolling window); on trigger, save trail + start short audio recording, upload securely, timestamp-tagged for the incident log

> ⚠️ **REALITY CHECK — audio recording is a legal exposure, not just a feature.**
> Recording third parties without consent is unlawful in many jurisdictions, including several Indian states. Required design constraints:
> - Record **only** on an explicit SOS trigger, never continuously
> - Encrypt at rest; the server should not hold plaintext audio
> - Auto-delete after a fixed retention window (e.g. 72 hours) unless escalated
> - Disclose clearly in onboarding
> Stating these constraints unprompted signals maturity and usually earns credit rather than costing it.

### 7.13 NLP Usage (Cross-Cutting)
- **Post-trip report tag suggestion**: lightweight text classifier/keyword model to auto-suggest tags from any free-text notes a user adds ("felt unsafe near the market" → tag: "Isolated area")
- **Social/news data filtering (future, Section 5.4)**: NLP keyword + sentiment filtering on scraped public posts/news to identify genuine safety-relevant mentions vs. noise
- **Voice code-word detection (Section 7.3 above)**: small on-device keyword-spotting model, not full NLP — keeps it fast and private

---
---

# PART IV — BUILD

## 8. Tech Stack

### 8.1 Original Suggested Stack (from v1)

- **Frontend (mobile)**: Flutter or React Native — single app, two screens/modules
- **Maps/Routing**: OpenStreetMap + OSRM/GraphHopper for route generation, custom scoring layer on top
- **Backend**: Node.js/Python (FastAPI) — REST/WebSocket for live location streaming
- **Risk/Anomaly Engine**: simple rule-based scoring for MVP (weighted factors) → optional ML anomaly model (isolation forest / clustering on GPS trail) if time allows
- **Database**: PostgreSQL + PostGIS (geospatial queries) or Firebase for rapid prototyping
- **Alerts**: Twilio/Firebase Cloud Messaging for SMS/push to trusted contacts
- **Auth/Contacts**: simple user profile + trusted contacts list

### 8.2 Locked Stack Decisions

| Layer | Choice | Why this over the alternative |
|---|---|---|
| Mobile | **React Native + Expo** | Flutter means learning Dart under deadline for zero benefit |
| Web dashboard | **React + Vite + Leaflet** | Direct reuse of existing RescueRoute map code |
| Backend | **FastAPI (Python)** | Same language as the ML/data pipelines; no context switching |
| Routing | **OSRM in Docker**, Kolkata `.osm.pbf` from Geofabrik | Self-hosted, no rate limits, works offline on demo day |
| Database | **PostgreSQL 16 + PostGIS + `h3-pg`** | Firebase cannot do the spatial queries this project needs |
| Trip state | **Redis** | Active-trip state, ping buffer, rate limiting |
| ML | **scikit-learn only** | No PyTorch in this project — see §10 |
| Alerts | **Twilio (SMS) + FCM (push)** | As specified |
| Object storage | **MinIO** or Supabase Storage | Encrypted audio clips |
| Deploy | **docker-compose**, all local | No network dependency during the demo |

> ⚠️ **REALITY CHECK — do not use Firebase as the primary database.**
> The v1 spec offers it as a rapid-prototyping option. It cannot serve this system: you need PostGIS for `ST_Distance`, nearest-neighbour queries, and polyline operations. Using Firebase means splitting your data layer across two stores and syncing them, which is more work than just using Postgres.

> ⚠️ **REALITY CHECK — OSRM does not do public transport.**
> OSRM handles walking, cycling, and driving profiles only. Bus and metro routing requires **OpenTripPlanner + a GTFS feed**, and Kolkata's GTFS coverage is patchy at best. Two honest options:
> 1. Scope transit to **metro only**, with a hardcoded station graph and fixed inter-station times
> 2. State plainly that transit routing uses a simplified model and that full multimodal routing is a GTFS-integration dependency
> Either is fine. Silently claiming bus routing that isn't there is not.

---

## 9. Backend Design

### 9.1 Services

1. **API service (FastAPI)** — REST for routing, auth, contacts, reports
2. **WebSocket service** — live GPS ingest and live-share broadcast
3. **Routing service (OSRM, Docker)** — raw geometry, no safety awareness
4. **Risk engine (Python module)** — scores a cell at a given timestamp, returns factor breakdown
5. **Monitor worker** — consumes GPS pings, runs deviation/stop detection, fires check-ins
6. **Alert service** — Twilio + FCM, with retry and dedupe
7. **Aggregator worker** — periodically rebuilds `risk_cells` from pings, reports, and incidents

### 9.2 Database Schema

```sql
users(id, phone, name, created_at)

trusted_contacts(id, user_id, name, phone, priority)

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

alerts(id, trip_id, type, triggered_at, resolved_at, payload jsonb)
```

### 9.3 Core Endpoints

```
POST  /routes/plan          → 3 scored candidates + per-segment breakdown
POST  /trips/start          → creates trip, returns WebSocket token
WS    /trips/{id}/stream    → GPS in; status + alerts out
POST  /trips/{id}/checkin   → "I'm okay" response
POST  /trips/{id}/sos       → immediate escalation
GET   /trips/{id}/reroute   → re-scores remaining path
GET   /share/{token}        → public live-tracking view, auto-expires
POST  /trips/{id}/report    → post-trip one-tap rating
GET   /safe-points/nearest  → shortlist via PostGIS, rank via OSRM
```

### 9.4 Folder Structure

```
saferoute-plus/
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── deps.py
│   │   ├── api/
│   │   │   ├── routes_plan.py
│   │   │   ├── trips.py
│   │   │   ├── sos.py
│   │   │   ├── contacts.py
│   │   │   ├── reports.py
│   │   │   ├── safe_points.py
│   │   │   └── ws_stream.py
│   │   ├── core/
│   │   │   ├── risk_engine.py        # score(cell, ts) → risk + factors
│   │   │   ├── time_shift.py         # segment arrival-time estimation
│   │   │   ├── route_scorer.py       # candidate scoring + lexicographic rank
│   │   │   ├── deviation.py          # point-to-polyline + hysteresis
│   │   │   ├── stop_detector.py      # dwell-time anomaly
│   │   │   └── escalation.py         # check-in → SOS state machine
│   │   ├── services/
│   │   │   ├── osrm_client.py
│   │   │   ├── twilio_client.py
│   │   │   ├── fcm_client.py
│   │   │   └── storage.py
│   │   ├── models/                   # SQLAlchemy
│   │   ├── schemas/                  # Pydantic
│   │   └── workers/
│   │       ├── monitor.py
│   │       └── aggregator.py         # rebuilds risk_cells periodically
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
│
├── ml/
│   ├── notebooks/
│   ├── data/
│   │   ├── raw/                      # OSM extract, organizer datasets
│   │   ├── synthetic/
│   │   └── processed/
│   ├── pipelines/
│   │   ├── build_static_features.py  # OSM → per-cell lit/police/shops
│   │   ├── generate_synthetic.py
│   │   ├── build_risk_table.py
│   │   └── train_weights.py          # the one supervised model
│   ├── models/                       # .pkl only, small
│   └── eval/
│
├── mobile/
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/                  # Plan, RouteCompare, ActiveTrip, SOS, Report
│   │   ├── components/               # MapView, RiskOverlay, SafetyBadge
│   │   ├── services/                 # api.ts, ws.ts, location.ts, sensors.ts
│   │   ├── state/
│   │   └── theme/
│   └── package.json
│
├── dashboard/                        # React + Vite + Leaflet
│   └── src/
│
├── simulator/
│   ├── trip_simulator.py             # replays GPS trails over WebSocket
│   └── scenarios/
│       ├── normal.json
│       ├── deviation.json
│       └── prolonged_stop.json
│
└── docs/
    ├── architecture.md
    ├── demo_script.md
    └── report/
```

> ⚠️ **REALITY CHECK — `simulator/` is not optional.**
> You cannot demo this by walking around with a phone. The simulator replaying scripted GPS trails over the WebSocket **is** the demo. Build it early, not the night before.

---

## 10. What Is Actually Being Trained (and Why There Are No Epochs)

### 10.1 Short Answer

**No epochs. None of this is a neural network.**

"Epochs" exist only for models trained by repeated gradient-descent passes over a dataset. Every model in this project is either a closed-form aggregation or a tree ensemble that fits in a single pass.

### 10.2 Every "ML" Item in This Spec

| Feature | Actual method | Fit time | Epochs? |
|---|---|---|---|
| Risk score per (cell, hour, day) — §5.1 | `GROUP BY` + weighted average | instant (SQL) | No — it's a query |
| Stop anomaly detection — §7.2 | Isolation Forest / z-score | ~2 s | No |
| Deviation classification — §7.1 | Rule + hysteresis, or Random Forest | ~1 s | No |
| Route weight learning — §7.6 | Ridge / GradientBoostingRegressor | ~1 s | No |
| Post-trip tag suggestion — §7.13 | TF-IDF + LogisticRegression | ~1 s | No |
| Voice code word — §7.3 | **Pretrained** openWakeWord / Porcupine | n/a | Don't train it |

Isolation Forest, Random Forest, and gradient boosting are **tree ensembles**. They have no epoch parameter, need no GPU, and produce no checkpoints. The GPU stays idle for this entire project and that is the correct outcome.

### 10.3 What to Say When Asked "What Did You Train?"

Be precise, because this is the question a sharp judge asks:

> "We fit a **statistical risk surface**, not a deep model. The core is a time-bucketed aggregation over three weighted data streams. On top of that we train one supervised model — a gradient-boosted regressor that **learns the blend weights** for our safety factors instead of us hand-picking them, using held-out incident labels. Its `feature_importances_` is what powers our explainability layer."

That is a real, defensible ML contribution, it takes under a second to fit, and it directly feeds the explainability requirement in §4.1.

---
---

# PART V — EXECUTION

## 11. Risk Register — Mistakes and Hard Problems

Consolidated from the callouts above, ordered by how likely each is to hurt you.

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Power-button silent SOS is impossible on iOS/Android | **Blocker** | Shake gesture + lock-screen widget; reframe as platform dependency (§4.2) |
| 2 | Background location killed by Doze / iOS suspension / OEM battery managers | **Blocker** | Android foreground service; demo via simulator (see below) |
| 3 | GPS noise triggers constant false deviations | **High** | Accuracy gating + N-ping hysteresis + OSRM map matching (§7.1) |
| 4 | OSRM can't route public transport | **High** | Metro-only hardcoded graph, or declare the limitation (§8.2) |
| 5 | Scope creep — 13 features cannot be built | **High** | Hold the line on §13; cut ruthlessly |
| 6 | Cold start leaves the map empty | **High** | H3 neighbour-fill + visible confidence badges (§5.3) |
| 7 | Synthetic-data circularity | **Medium** | Hold out a slice, report honestly (see below) |
| 8 | Audio recording legal exposure | **Medium** | Trigger-only, encrypted, auto-delete, disclosed (§7.12) |
| 9 | `min()` ranking produces ties | **Medium** | Lexicographic sort key (§6.5) |
| 10 | Risk engine becomes a black box | **Medium** | Return factor breakdown from v1 of the scorer (§7.6) |
| 11 | Twilio trial restrictions on demo day | **Low but fatal** | Verify numbers in advance; retry + dedupe (§7.4) |
| 12 | Reroute suggestion spam | **Low** | Cooldown + material-improvement threshold (§7.8) |

### 11.1 Background Location — Detail

iOS aggressively suspends background apps. Android's Doze mode plus per-OEM battery killers (Xiaomi, Oppo, Vivo are notorious in India) will silently kill a background tracker. Android requires a **foreground service with a persistent notification**, which directly conflicts with the "discreet" requirement in §4.2.

**Name this tension in your report.** It is a genuine product-design constraint, and articulating it is better than pretending it doesn't exist. For the demo, use the simulator.

### 11.2 The Synthetic-Data Circularity Trap — Detail

If you generate synthetic incidents from your own assumptions, then "learn" factor weights from those synthetic incidents, the model has learned nothing except your assumptions. A judge will catch this.

**Defence:** hold out a slice of the synthetic data, report accuracy on it honestly, and state clearly that synthetic data validates the **pipeline**, not the **conclusions**. Real validation requires real reports, which is exactly what §5.2's data strategy is designed to bootstrap.

### 11.3 Optimise for False Positives, Not Balanced Accuracy

For most ML systems you tune toward balanced accuracy. **Not here.** Missing a real emergency is catastrophic; a false alarm is merely annoying. Bias every threshold toward over-triggering, and say why out loud.

> 💡 **PITCH NOTE.** This single framing point reliably lands well with judges, because it shows you understand the *domain*, not just the technique.

---

## 12. MVP Scope for Hackathon (Keep It Buildable)

- [ ] Route input → 2 route options with mock Safety Score (use synthetic dataset), scored using time-shifted worst-segment logic (Section 6)
- [ ] Map view showing chosen route + risk overlay (color-coded segments)
- [ ] Demo showing all 3 MVP data sources (passive aggregation, post-trip reports, SOS events) feeding the same risk table
- [ ] Simulated live GPS trail (since no real hardware) with deviation detection demo
- [ ] One-tap (not fully "hidden" for MVP) SOS button → sends mock alert to a dummy trusted contact + shows location-share screen
- [ ] Dashboard screen: journey status, safety score, alert log
- [ ] Short demo script simulating: safe start → deviation → auto-alert → reroute suggestion

**Cut for MVP** (mention as "future work" in report): wearable integration, voice-code activation, real authority integration, full ML anomaly model.

> ⚠️ **REALITY CHECK — this MVP list is still roughly 40% too large for a typical hackathon window.**
> Treat items 1–4 as committed and 5–7 as stretch. If you run short, the order to sacrifice is: dashboard polish → third data source → reroute suggestion. Never sacrifice the time-shifted scoring (item 1) or the deviation demo (item 4); those are the two things that make this project distinctive.

---

## 13. Build Order

1. `docker-compose`: Postgres + PostGIS + `h3-pg`, Redis, OSRM with Kolkata extract
2. OSM → H3 static-features pipeline, then synthetic risk table
3. `/routes/plan` with time-shifted worst-segment scoring, verified via `curl`
4. Map UI showing 3 routes with colour-coded risk overlay
5. WebSocket ingest + trip simulator
6. Deviation and stop detection wired to the simulator
7. Check-in → auto-SOS escalation + Twilio alert
8. Dashboard and live-share page
9. Post-trip reports feeding back into the risk table (closing the loop visually is a strong demo moment)
10. Polish, demo script, report

**Milestone:** finishing step 4 means you have something demoable. Everything after that is upside.

---

## 14. Deliverables (satisfies both PS-B06 & PS-B07 output requirements)

- Working prototype (mobile/web) demonstrating both modules
- Route-anomaly + deviation detection demo
- Discreet SOS / live-location-sharing demo
- Safe-route comparison + rerouting demo
- Dashboard showing journey status + incident/risk indicators
- Codebase + short report explaining architecture, dataset use, and how both problem statements are addressed by one system

---

## 15. Future Work (explicitly out of scope for the hackathon)

- Wearable integration
- Voice code-word activation (on-device keyword spotting)
- Real authority/police-system integration
- Full ML anomaly model on GPS trails (DTW or sequence classifier)
- True time-dependent bottleneck-path routing via modified Dijkstra (§6.5)
- Multimodal transit routing via OpenTripPlanner + GTFS
- The four future data sources in §5.4 (scraping, community sourcing, gig-worker network, IoT feeds)
