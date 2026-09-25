# Comprehensive Correction Implementation Plan: SafeRoute+ Full-Stack Fixes

This document serves as the master implementation plan to resolve all UI/UX issues, blank screens, non-functioning placeholders, broken microphone/voice flows, API/WebSocket communication errors, CORS restrictions, and missing dashboard navigation across SafeRoute+.

---

## 1. Executive Summary & Root Causes

| # | Component | Symptom / Issue | Root Cause |
|---|---|---|---|
| **1** | **Backend CORS** | All fetch calls fail with `body stream already read` or opaque errors | `backend/app/main.py` only allows origins `5175` & `8081`. The PWA runs on `5173`. |
| **2** | **API Error Handling** | Red `[object Object]` error on `/plan` and crashes on `/contacts` | `fetchApi` in `pwa/src/services/api.ts` calls `await res.text()` after `res.json()` fails on the consumed stream; also passes JSON object directly to `new ApiError(..., detail)`. |
| **3** | **Active Trip (`/trip/:id`)** | Completely blank black screen on `/trip/:id` | `useParams<{ tripId }>` in `ActiveTripScreen.tsx` does not match `<Route path="/trip/:id">` (`id` is undefined); parent layout flex container has 0 height. |
| **4** | **Voice / Microphone** | "Permission taken but does not work"; test words pass without speaking | `VoiceSetupScreen.tsx` tests input string against itself in-memory and never invokes microphone. `services/voice.ts` in-memory config is never persisted to backend or `localStorage`. |
| **5** | **WebSocket Telemetry** | Active trip WebSocket immediately disconnects on connect | `backend/app/api/ws_stream.py` expects flat `{ "lat", "lon" }`, but client sends `{ "type": "heartbeat" }` and `{ "type": "ping", "payload": {...} }`, raising unhandled `KeyError: 'lon'`. |
| **6** | **Navigation & Endpoints** | Dashboard, SOS, and Active Trip cannot be accessed from navbar | `pwa/src/components/layout/Header.tsx` only links Plan, Contacts, Voice, Settings. |
| **7** | **Route Planning** | Walking mode fails or produces empty routes on public OSRM | Public OSRM does not support `/walk`. Missing precomputed `route_cache` demo pairs. |
| **8** | **Theme / Contrast** | Washed-out headers ("Plan Your Route"), black backgrounds, high contrast clashing | `variables.css` flips `--color-white` to `#121212` on system dark mode while inline styles use `#fff` and dark text. |
| **9** | **Public Live Share** | `/share/:token` returns 404 / fails JSON parse | Missing proxy for `/share` in `vite.config.ts`; backend route is mounted at `/trips/share/{token}` rather than root `/share/{token}`. |
| **10** | **Settings & Placeholders** | Toggles, permission requests, and buttons are inert | `SettingsScreen.tsx` has empty `onChange={() => {}}` handlers and mock buttons. |
| **11** | **Leaflet Marker Icons** | Missing marker icons / 404s on pins | Default Leaflet asset URLs not resolved in Vite bundler. |

---

## 2. Detailed Technical Fixes

### Phase 1: Backend Infrastructure & Routing Fixes

#### 1.1 Update CORS Middleware (`backend/app/main.py`)
- Change `CORSMiddleware` in `backend/app/main.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5174",
          "http://localhost:5175",
          "http://127.0.0.1:5175",
          "http://localhost:8081",
          "http://127.0.0.1:8081",
          "http://localhost:3000",
      ],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- Add top-level alias route for live-share:
  ```python
  from app.api.trips import get_share_trip
  app.add_api_route("/share/{token}", get_share_trip, methods=["GET"], tags=["LiveShare"])
  ```

#### 1.2 Robust WebSocket Protocol (`backend/app/api/ws_stream.py`)
- Support polymorphic incoming messages without crashing on `KeyError`:
  ```python
  data = await websocket.receive_json()
  msg_type = data.get("type")

  if msg_type == "heartbeat":
      await websocket.send_json({"type": "heartbeat_ack"})
      continue

  # Extract ping coordinates
  ping_data = data.get("payload") if msg_type == "ping" else data
  if not isinstance(ping_data, dict) or "lat" not in ping_data or "lon" not in ping_data:
      await websocket.send_json({"status": "ignored", "reason": "invalid_ping_data"})
      continue
  ```

#### 1.3 Implement Precomputed Route Cache & Public OSRM Fallback (`backend/app/services/osrm_client.py`)
- Add fixed demo routes for Kolkata:
  - **Short Walk**: Park Street (`88.3524, 22.5513`) → Victoria Memorial (`88.3426, 22.5448`)
  - **Medium Walk**: Howrah Station (`88.3426, 22.5851`) → B.B.D. Bagh (`88.3512, 22.5726`)
  - **Drive**: Salt Lake Sector V (`88.4332, 22.5744`) → Esplanade (`88.3528, 22.5647`)
- When public OSRM is used, if `mode == 'walk'`, call `/route/v1/driving/...` as fallback geometry with walking speed calculations (~5 km/h) instead of returning empty `[]`.

#### 1.4 Voice Config Retrieval (`backend/app/api/voice.py`)
- Add `GET /users/voice-config` endpoint:
  ```python
  @router.get("/users/voice-config")
  async def get_voice_config_endpoint(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
      config = db.query(VoiceConfig).filter(VoiceConfig.user_id == user_id).first()
      if not config:
          return {"safe_word_hash": "", "duress_word_hash": "", "enabled": True}
      return {
          "safe_word_hash": config.safe_word_hash,
          "duress_word_hash": config.duress_word_hash,
          "enabled": config.enabled
      }
  ```

#### 1.5 Trip Geometry Persistence (`backend/app/api/trips.py`)
- In `start_trip`: Save `req.planned_route_geom` into `trip.planned_route_geom` using GeoAlchemy `from_shape(LineString(...))`.
- In `get_share_trip`: Convert `trip.origin_geom` and `trip.dest_geom` using `to_shape(trip.origin_geom)` so `origin: [lat, lon]` returns real numbers, not `[0, 0]`.

---

### Phase 2: Frontend Core Services & Styling Fixes

#### 2.1 Fix Stream Reading & Error Parsing (`pwa/src/services/api.ts`)
- Never call `await res.json()` and then `await res.text()` on the same response. Read as text once:
  ```typescript
  if (!res.ok) {
    const rawText = await res.text()
    let errorDetail: any
    try {
      errorDetail = JSON.parse(rawText)
    } catch {
      errorDetail = rawText
    }

    let errorMessage = `HTTP ${res.status}`
    if (typeof errorDetail === 'string') {
      errorMessage = errorDetail
    } else if (errorDetail && typeof errorDetail === 'object') {
      if (typeof errorDetail.detail === 'string') {
        errorMessage = errorDetail.detail
      } else if (Array.isArray(errorDetail.detail)) {
        errorMessage = errorDetail.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
      } else {
        errorMessage = JSON.stringify(errorDetail)
      }
    }
    throw new ApiError(res.status, errorMessage, errorDetail)
  }
  ```

#### 2.2 Standardize Styling & Remove Inverted Dark Mode (`pwa/src/styles/variables.css` & `globals.css`)
- Remove the broken `@media (prefers-color-scheme: dark)` that sets `--color-white: #121212`.
- Enforce clean, uniform light background `--color-white: #ffffff` and dark text `--text-primary: #1a1a1a`.
- Fix Leaflet marker CSS asset loading so markers don't 404 in Vite.

#### 2.3 Add Proxy in `pwa/vite.config.ts`
- Add `/share` to proxy table:
  ```typescript
  '/share': { target: 'http://localhost:8000', changeOrigin: true },
  ```

---

### Phase 3: Screen Improvements & Interactive Capabilities

#### 3.1 Top Navigation Bar (`pwa/src/components/layout/Header.tsx`)
- Add links to `📊 Dashboard` (`/dashboard`), `🚨 SOS` (`/sos`), and show an active trip badge when a trip is active.
- Ensure all screen routes are accessible directly from the UI without manual URL typing.

#### 3.2 Full-Height Map Container (`pwa/src/components/layout/Layout.tsx` & Screen Containers)
- Fix `<main>` style in `Layout.tsx` to ensure `flex: 1; display: flex; flex-direction: column; min-height: 0;` so maps in `PlanScreen`, `RouteCompareScreen`, `ActiveTripScreen`, and `DashboardScreen` expand to full visible height rather than collapsing to 0px (which caused the blank black screen).

#### 3.3 Active Trip Screen (`pwa/src/screens/ActiveTripScreen.tsx`)
- Fix route parameter: `const { id } = useParams<{ id: string }>()`.
- Initialize `useTrip(id)` and display active trip status.
- Add Demo Simulation buttons:
  - **"Simulate Deviation"**: sends 3 off-route pings to trigger L1 then L2 check-in.
  - **"Simulate Stop"**: sends stationary pings to trigger prolonged stop detection.
  - **"End Trip & Feedback"**: navigates cleanly to `/trip/:id/report`.

#### 3.4 Interactive Voice Setup (`pwa/src/screens/VoiceSetupScreen.tsx` & `pwa/src/services/voice.ts`)
- Implement real Web Speech API microphone testing:
  - Add "🎙️ Speak to Test Safe Word" and "🎙️ Speak to Test Duress Word" buttons.
  - On click, start `SpeechRecognition`, prompt browser microphone permission, show an active listening indicator and live spoken transcription.
  - Normalize spoken text and verify whether the target word is contained in the utterance.
  - Save configuration via `POST /users/voice-config` and `localStorage`.

#### 3.5 Plan Screen (`pwa/src/screens/PlanScreen.tsx`)
- Add quick demo presets for Kolkata:
  - Preset 1: Park Street → Victoria Memorial (Walking)
  - Preset 2: Howrah Station → B.B.D. Bagh (Walking)
  - Preset 3: Salt Lake Sector V → Esplanade (Driving)
- Fix map coordinate selection; ensure error messages display cleanly.

#### 3.6 Route Compare Screen (`pwa/src/screens/RouteCompareScreen.tsx`)
- Default map center to Kolkata `[22.5726, 88.3639]`.
- Auto-fit map bounds to route geometries.
- Add safety fallback redirect to `/plan` if accessed directly without routes state.

#### 3.7 Trusted Contacts Screen (`pwa/src/screens/ContactsScreen.tsx`)
- Connect seamlessly with fixed CORS and error parsing.
- Support Add / Edit / Delete of primary and secondary contacts with visual priority tags.

#### 3.8 Settings Screen (`pwa/src/screens/SettingsScreen.tsx`)
- Replace mock checkboxes with live state connected to `localStorage`.
- Wire permission request buttons for Geolocation, Microphone, and Notifications.

---

## 3. Step-by-Step Execution Sequence

1. **Step 1: Backend Fixes**:
   - Update CORS in `backend/app/main.py`.
   - Add `/share/{token}` and `GET /users/voice-config`.
   - Update `backend/app/api/ws_stream.py` to handle heartbeats and polymorphic pings without crashing.
   - Update `backend/app/services/osrm_client.py` with precomputed Kolkata demo cache and driving fallback for walk mode.
   - Update `backend/app/api/trips.py` for route geometry and origin/dest extraction.
2. **Step 2: PWA Core Services & Config**:
   - Fix `pwa/src/services/api.ts` response parsing and error formatting.
   - Add `/share` proxy to `pwa/vite.config.ts`.
   - Remove broken dark mode CSS overrides in `variables.css`.
3. **Step 3: Layout & Navigation**:
   - Fix `pwa/src/components/layout/Header.tsx` to link Dashboard and SOS.
   - Fix `pwa/src/components/layout/Layout.tsx` for proper flexbox height.
4. **Step 4: Screens & Feature Wiring**:
   - Fix `ActiveTripScreen.tsx` (`:id` param, full height, demo simulation controls).
   - Fix `VoiceSetupScreen.tsx` (real microphone testing with `SpeechRecognition`).
   - Fix `PlanScreen.tsx` (Kolkata presets, error formatting).
   - Fix `RouteCompareScreen.tsx` (Kolkata bounds, null state guard).
   - Fix `SettingsScreen.tsx` (real toggle handlers).
5. **Step 5: Verification**:
   - Run `npm run typecheck` in `pwa/` (0 errors).
   - Start backend (`python -m uvicorn app.main:app --port 8000`) and PWA (`npm run dev`).
   - Run full E2E flow in browser.

