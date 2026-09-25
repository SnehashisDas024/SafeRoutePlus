# SafeRoute+ — Frontend Build Prompt

*This prompt covers the mobile app and web dashboard. Read `backend-prompt.md` first — every screen here is a thin client over the endpoints defined there. Read `tech-stack-and-api-keys.md` for which credentials (if any) touch the frontend.*

---

## 0. Explicit Styling Instruction — Read This First

**Keep the UI deliberately minimal for now.** This is a functional pass, not a design pass — a real visual design will be done later, separately. While building:

- Use **one primary color + one accent color, nothing else** (e.g. a single blue for primary actions/links, a single red reserved *only* for SOS/danger states — do not introduce a third brand color).
- Everything else stays **black/white/grey**: system default font, plain backgrounds, standard system spacing. No gradients, no custom icon sets, no illustration, no shadows/elevation beyond whatever the component library gives for free.
- Risk overlays on the map (green/yellow/red segments) are the one place color-coding is functionally required, not decorative — keep those three colors and don't add more risk tiers.
- Layout should be correct and usable (things aligned, tappable targets big enough, no overlapping elements) — just not *styled*. Think "internal tool," not "polished product."
- Do not spend time on animations, transitions, custom fonts, or empty-state illustrations. A plain "No trips yet" text label is enough.
- Every screen below should be buildable and functional with this minimal treatment — do not block a screen on visual design.

**One exception, added in this version:** the escalation level indicator (§2.6) needs to be *readable at a glance* — plain text and the existing red accent are fine, but don't bury it.

---

## 0.1 Changes From the Previous Version of This Prompt

1. **Voice assistant added** — a new `services/voice.ts`, a spoken check-in flow, and a duress/safe word setup screen. See §2.4 and §2.7.
2. **Escalation is now tiered (L0–L4)** — `ActiveTrip` shows the current level, and the check-in prompt is one rung on a ladder rather than a standalone event. See §2.6.
3. **No Redis anywhere** — irrelevant to the frontend directly, but it means the backend runs a single process, so **the WebSocket must reconnect cleanly after a backend restart**. See §2.3.

---

## 1. What You're Building

Two clients, both thin wrappers over the backend from `backend-prompt.md`:

1. **Mobile app** — React Native + Expo. The primary product: Module A (route planning) + Module B (live journey monitoring, voice assistant, SOS).
2. **Web dashboard** — React + Vite + Leaflet. Secondary surface: trip status, escalation level, alert log, and the public live-share view a trusted contact opens (no login).

Both talk to the same FastAPI backend over REST + WebSocket. **Neither client owns any safety logic** — all scoring, detection, escalation timing, and phrase matching happen server-side. The frontend displays what the backend sends and forwards user actions (GPS pings, check-in responses, voice events, SOS taps) back to it.

---

## 2. Mobile App (React Native + Expo)

### 2.1 Screens

| Screen | Purpose | Backend calls |
|---|---|---|
| **Plan** | Enter origin, destination, time, mode | `POST /routes/plan` |
| **RouteCompare** | Show 2–3 returned routes, colour-coded by risk, tap a route to see its `factors` breakdown, select one to start | (uses response from Plan) |
| **ActiveTrip** | Live map showing current position vs. planned route, current safety status, **current escalation level**, and a visible "I'm okay" check-in button when prompted | `POST /trips/start`, `WS /trips/{id}/stream`, `POST /trips/{id}/checkin` |
| **SOS** | One large, unmissable SOS button (MVP is one-tap, not hidden — see §2.4) | `POST /trips/{id}/sos` |
| **Report** | Post-trip one-tap 🟢/🟡/🔴 rating + optional tags | `POST /trips/{id}/report` |
| **Contacts** | Add/edit trusted contacts, **set each as primary or secondary** | plain CRUD against `trusted_contacts` |
| **VoiceSetup** | **NEW** — record/enter the safe word and duress word, test recognition, enable/disable | `POST /users/voice-config` |

Keep these as seven separate, simple screens — don't combine Plan+RouteCompare or ActiveTrip+SOS into one clever screen. Simple and correct beats compact right now.

### 2.2 Components

- `MapView` — thin wrapper around `react-native-maps`, renders a polyline + current-position marker.
- `RiskOverlay` — renders the route polyline in segments, colour-coded green/yellow/red from the backend's per-segment scores. The one place color is functional, not decorative.
- `SafetyBadge` — small text/badge showing overall route score + confidence (`high` vs `estimated`), plain text, no icon set.
- `EscalationBanner` — **NEW.** Plain text strip at the top of `ActiveTrip` showing the current level. See §2.6 for exact wording rules.
- `CheckInPrompt` — **NEW.** Modal with a countdown, an "I'm okay" button, and a note that the phone is also listening for the spoken response.

### 2.3 Services layer

- `services/api.ts` — typed wrapper around the REST endpoints in `backend-prompt.md` §4. One function per endpoint, no business logic here.
- `services/ws.ts` — WebSocket management for `/trips/{id}/stream`: connect, send GPS pings, receive status/escalation/alert messages, **reconnect with exponential backoff on drop**. The backend runs a single process, so a restart or redeploy drops every socket at once — reconnection is not an edge case here, it's the normal path. On reconnect, re-fetch `GET /trips/{id}/escalation` to resync level rather than assuming L0.
- `services/location.ts` — device GPS (`expo-location`), sampling interval, and the accuracy field the backend's deviation gating needs (`backend-prompt.md` §5.3 — **the ping payload must include `accuracy`**, or server-side gating cannot work).
- `services/sensors.ts` — shake-gesture detection (accelerometer threshold) for the discreet-SOS trigger. **Do not attempt a power-button trigger** — not implementable on iOS or Android (`backend-prompt.md` §9).
- `services/voice.ts` — **NEW.** See §2.7.

### 2.4 SOS Triggers — Be Explicit About MVP Scope

Three triggers for MVP, no more:

1. **Visible one-tap SOS button** — the honestly-scoped MVP version, not a compromise to hide.
2. **Shake gesture** (`services/sensors.ts`) — discreet, works with the phone in a pocket.
3. **Spoken duress word** (`services/voice.ts`) — discreet, works without touching the phone at all. **New in this version.**

Do **not** build a power-button or hidden-unlock-pattern trigger.

### 2.5 State

Simple local state (React state + context, or Zustand) is enough. Four pieces need to survive screen navigation: trip status, current route, **current escalation level**, and voice-listening status.

### 2.6 Escalation Level Display — NEW

The backend pushes escalation level changes over the WebSocket. `ActiveTrip` reflects them:

| Level | What the app shows |
|---|---|
| **L0 Normal** | No banner. Normal map view. |
| **L1 Watch** | **Nothing.** L1 is deliberately silent — do not show a banner, do not vibrate, do not change anything. Showing L1 would make the app feel jumpy and train users to ignore it. |
| **L2 Check-in** | `CheckInPrompt` modal + spoken prompt + countdown. Banner: "Checking in — tap or say you're okay." |
| **L3 Alert** | **Depends on how it was triggered.** Tap/shake-triggered: show clear confirmation that contacts were alerted. **Voice-duress-triggered: change nothing on screen.** The screen must look identical to L0 — that is the entire point of a duress word. |
| **L4 Sustained** | Same discretion rule as L3. If already visible, update to show nearest safe point. |

> ⚠️ **The L3 discretion rule is the easiest thing to get wrong here.** If the duress word flashes a red "SOS SENT" banner, the feature is worse than useless — it tells whoever is standing over her that she called for help. The app must branch on the trigger source the backend sends in the WebSocket message, not on the level alone.

### 2.7 Voice Assistant (`services/voice.ts`) — NEW

**Library: `@react-native-voice/voice`** for recognition, **`expo-speech`** for prompts. Both are free and require **no API key** (see `tech-stack-and-api-keys.md` §2.2). Do not use `openWakeWord` — it is a Python library with no React Native SDK and cannot run on the phone.

**What this service does:**

1. **Listens while a trip is active**, and only then. Never in the background, never between trips. Stop the mic session the moment the trip ends or the app backgrounds — this is both a battery constraint and a privacy commitment you should state in onboarding.
2. **Matches locally, sends hashes.** On each recognized utterance: normalize (lowercase, strip punctuation), hash with the user's salt, compare against the locally stored `safe_word_hash` / `duress_word_hash`. Only on a match, POST to `/trips/{id}/voice-event` with the hash and confidence. **Raw transcripts never leave the device and are never logged.**
3. **Speaks the check-in prompt.** On an L2 message from the WebSocket, `expo-speech` says "Are you okay?" and the recognizer opens a listening window for the configured check-in duration.
4. **Reports the window elapsing** as `kind: "no_response"` — but treats this as informational only. The backend's timer is authoritative, so a dead phone still escalates.

**Non-negotiable rules:**

- **Two phrases, not one.** A safe word ("I'm fine") clears the alert. A duress word (something that sounds natural but isn't what anyone says casually) escalates silently. Building only a safe word defeats the purpose, because a coerced user will be made to say it.
- **Never display the duress word anywhere after setup**, never put it in logs, never include it in a screenshot-able screen during an active trip.
- **Low confidence resolves toward escalation.** An uncertain "I'm fine" does **not** clear the alert. An uncertain duress match **does** escalate. Ambiguity always breaks toward the safe direction, which is not the same as the quiet direction.
- **VoiceSetup must include a test mode** where the user says each phrase and sees whether it matched, without any of it being sent to the backend. On-device speech recognition accuracy in noisy conditions is the main failure mode; let the user discover that during setup, not during an emergency.

**Documented upgrade path:** if always-on, low-power wake-word detection is wanted instead of trip-scoped listening, swap to Porcupine, which needs a free `PICOVOICE_ACCESS_KEY`. Ask the user for it at that point only — see `implementation-plan.md` Phase 7b.

---

## 3. Web Dashboard (React + Vite + Leaflet)

### 3.1 Pages

| Page | Purpose | Backend calls |
|---|---|---|
| **Dashboard** | List of trips (active + past), current safety score, **escalation level per active trip**, full alert log showing every L0→L4 transition | trip list endpoint, `GET /trips/{id}/escalation`, `alerts` data |
| **Live Share** (`/share/{token}`) | Public view a trusted contact opens — **no login required** — live position on a map while the trip is active, auto-expires when the trip ends | `GET /share/{token}` |

Two pages is enough. Don't build account management or settings beyond what's needed to demo the loop: plan → travel → monitor → escalate → alert.

### 3.2 Alert Log Must Show Levels

The alert log is the audit trail for the escalation ladder and it is **the strongest thing to show a judge** — it makes the graded response visible instead of theoretical. Render each `alerts` row with its level, reason, timestamp, and which contacts were notified. A flat list of "SOS sent" rows loses the entire point of the tiering work.

### 3.3 Map

Use Leaflet with default OSM tiles (no API key — `tech-stack-and-api-keys.md` §2.3). Only switch to Mapbox if `MAPBOX_ACCESS_TOKEN` was already provided during backend setup; if you reach this point and no token exists, ask the user once, otherwise proceed with default tiles and move on. Don't block the page on it.

### 3.4 Live-share auto-expiry

This page must stop showing live position once the trip's `status` is no longer active — poll or listen for that change and replace the map with a plain "This trip has ended" message. **Privacy requirement, not a UI nicety.**

---

## 4. What the Frontend Explicitly Does Not Do

- **No client-side risk scoring, deviation math, or escalation timing.** All of it lives in the backend. The frontend sends raw GPS + accuracy and displays what comes back.
- **No client-side escalation timer.** The countdown shown in `CheckInPrompt` is cosmetic — the backend's `checkin_deadline` is authoritative. If the two disagree, the backend wins.
- **No caching/duplicating the risk table client-side.**
- **No raw audio or transcripts sent to the backend.** Only hashes and a confidence score.
- **No Twilio/FCM credentials in the client.** Those live server-side; the app only receives push notifications FCM delivers.
- **No design system, theming, or component library setup** beyond what ships with Expo / Vite — see §0.

---

## 5. Testing (Manual, for Now)

Functional, not visual:

1. **Plan → RouteCompare**: submit an origin/destination, confirm 2–3 routes render with visibly different colour-coded segments and a readable factors breakdown on tap.
2. **ActiveTrip**: start a trip against `simulator/trip_simulator.py --scenario deviation` (implementation plan Phase 6), confirm the live map shows the simulated position moving, the escalation banner goes silent at L1, and the check-in prompt appears at L2.
3. **Voice check-in**: at L2, confirm the phone speaks the prompt, confirm saying the safe word clears it without tapping anything, and confirm a mumbled/unclear response does **not** clear it.
4. **Voice duress**: run `--scenario voice_duress`, say the duress word, and confirm (a) the backend reaches L3 and SMS fires, and (b) **the app screen does not change at all**. Check b by screen-recording, not by memory.
5. **Phone-dies**: run `--scenario phone_dies`, kill the simulator during an L2 window, and confirm the backend escalates to L3 anyway. This verifies the timer is server-side.
6. **SOS**: tap the SOS button, confirm the backend receives it (check `alerts` table or Twilio console per Phase 7).
7. **WebSocket reconnect**: restart the backend mid-trip, confirm the app reconnects and resyncs the escalation level rather than resetting to L0.
8. **Live Share**: open `/share/{token}` in an incognito window during an active simulated trip, confirm position updates, end the trip, confirm the expired state.
9. **Report**: submit a post-trip report and confirm it reaches `POST /trips/{id}/report` (visible in Phase 9's aggregator test).

None of this needs automated frontend tests yet — manual verification against the running backend is enough at this stage.
