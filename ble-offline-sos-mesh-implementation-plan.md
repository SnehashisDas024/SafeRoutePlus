# Offline BLE SOS Relay Mesh Implementation Plan

## Objective

Add an offline distress signal that can relay an emergency SOS message from one phone to nearby phones over Bluetooth Low Energy (BLE), across multiple intermediate devices, until a device with internet or cellular connectivity can upload the SOS to the SafeRoute+ backend.

Target flow:

```text
SOS phone
  -> nearby relay phone
  -> nearby relay phone
  -> internet-connected gateway phone
  -> SafeRoute+ backend
  -> trusted contacts and escalation workflow
```

This feature must work as a best-effort store-and-forward emergency channel. It cannot guarantee delivery because mobile operating systems, radio range, battery state, permissions, background execution, and user participation can interrupt the relay path.

This document is an implementation plan only. It does not include application code changes.

## Important Architecture Decision

Do not assume that ordinary phones can join a fully managed Bluetooth Mesh network automatically.

Bluetooth Mesh normally requires provisioned mesh nodes, managed keys, flooding behavior, and a Bluetooth Mesh stack. A consumer phone app using BLE advertisements and GATT is a more practical fit for this project.

The recommended MVP is an application-level BLE store-and-forward relay protocol:

- Phones advertise short SOS envelopes.
- Nearby phones scan for envelopes.
- Relay phones validate, deduplicate, store, and re-advertise them.
- A gateway phone uploads the message to the backend when connectivity is available.
- The backend applies the existing L3/L4 escalation flow.

This is a multi-hop relay at the application layer, not a transparent IP network and not a guarantee of continuous connectivity.

## Existing Project Integration Points

Relevant existing files:

- `mobile/src/screens/ActiveTrip.tsx`
- `mobile/src/screens/SOS.tsx`
- `mobile/src/services/api.ts`
- `mobile/src/services/sensors.ts`
- `mobile/src/services/ws.ts`
- `mobile/app.json`
- `backend/app/api/sos.py`
- `backend/app/core/escalation.py`
- `backend/app/models/schema.py`
- `backend/app/state.py`
- `backend/app/workers/monitor.py`
- `backend/app/services/fcm_client.py`
- `backend/app/services/twilio_client.py`

The current mobile SOS flow sends a request to `POST /trips/{trip_id}/sos`. The BLE feature should preserve that online behavior and add an offline queue when the request cannot reach the backend.

The current backend immediately transitions the trip to L3 with reason `manual_sos`. The BLE gateway should submit to a dedicated authenticated ingestion endpoint that maps to the same escalation behavior while recording the relay metadata.

## Platform and Build Constraints

### Expo

The current mobile app is an Expo project. A managed Expo app is not sufficient for reliable BLE background scanning, advertising, and long-running relay behavior.

Plan for one of these options:

1. Expo prebuild plus a custom development/production build with a native BLE library.
2. A custom native module using Android Bluetooth APIs and iOS CoreBluetooth.
3. Eject/migrate the mobile app to a React Native bare workflow if the selected BLE library requires it.

The final library must support the exact required features:

- BLE central scanning
- BLE peripheral advertising
- GATT read/write or notify exchange
- Background behavior where the operating system permits it
- Android and iOS support, or a documented platform-specific fallback

Do not select a library only because it can scan BLE devices. The relay requires both discovery and data exchange.

### Android permissions

The Android build will need the appropriate permissions for the supported API levels, including the Nearby Devices permissions:

- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`

For older Android versions, location permission may be required for BLE scanning. The app should request only the permissions needed by the installed OS version and explain why they are needed.

Also account for:

- Bluetooth disabled state
- Nearby-device permission denial
- Battery optimization
- Background execution restrictions
- Manufacturer-specific task killing
- Foreground-service requirements for long-running relay behavior

A persistent foreground service may be required on Android for dependable background relay. It must show a visible notification and comply with Android foreground-service rules.

### iOS capabilities

Use CoreBluetooth with the appropriate background modes only where Apple permits it.

Important limitations:

- iOS does not guarantee indefinite background scanning or advertising.
- Advertising data is restricted and may be reduced in the background.
- Apps may be suspended or terminated.
- The user must opt in to Bluetooth permission.
- Bluetooth relay cannot be promised while the app is force-quit.

The product UI must describe BLE relay as best effort on iOS. The app must also preserve native Emergency SOS and ordinary cellular/SMS fallbacks.

## Functional Requirements

### SOS originator

When the user triggers SOS:

1. Create a signed SOS envelope locally.
2. Persist it in an encrypted local queue before attempting transmission.
3. Attempt the normal online API request.
4. If online delivery succeeds, mark the envelope as acknowledged.
5. If online delivery fails, begin BLE advertising and local relay discovery.
6. Continue retrying while the SOS remains unresolved.
7. Allow explicit cancellation only through the existing safe/de-escalation flow and backend authorization rules.

### Relay phone

A relay phone should:

1. Scan for the SafeRoute BLE service identifier.
2. Read or receive an SOS envelope.
3. Validate the envelope signature and schema.
4. Reject expired, malformed, or replayed messages.
5. Store the message in a bounded encrypted relay queue.
6. Decrement the remaining hop count.
7. Re-advertise or forward the message after a randomized delay.
8. Stop relaying after TTL, hop limit, queue expiry, or successful acknowledgement.
9. Avoid exposing the reporter's route, name, phone number, or contacts to nearby devices.

### Gateway phone

A gateway phone should:

1. Detect an SOS envelope in the relay queue.
2. Confirm that it has internet connectivity.
3. Upload the envelope to the backend over HTTPS.
4. Receive a server acknowledgement.
5. Advertise an acknowledgement token so nearby relays can stop forwarding.
6. Retry safely if the upload fails.

The gateway must never trust a relay device to claim that the backend accepted an SOS. Only the backend acknowledgement is authoritative.

## BLE Protocol Design

### Service and characteristic

Reserve a project-specific 128-bit BLE service UUID.

Use characteristics or a GATT exchange for:

- SOS envelope metadata
- Fragmented payload transfer
- Acknowledgement token
- Capability/protocol version

BLE advertisements should contain only a short message identifier, protocol version, and non-sensitive routing metadata. Do not place full personal data or precise location in advertisements.

### Envelope

An SOS envelope should contain conceptually:

```json
{
  "protocol_version": 1,
  "message_id": "random-opaque-id",
  "origin_device_id": "rotating-anonymous-id",
  "trip_id_hash": "optional-hash",
  "created_at": "UTC timestamp",
  "expires_at": "UTC timestamp",
  "hop_limit": 8,
  "hop_count": 2,
  "event_type": "manual_sos|voice_duress|automatic",
  "approximate_location": {
    "lat": 22.57,
    "lon": 88.36,
    "accuracy_m": 500
  },
  "payload_ciphertext": "encrypted payload",
  "signature": "digital-signature"
}
```

Exact fields should be finalized with a versioned schema before implementation.

Security requirements:

- Use cryptographically random message IDs.
- Use authenticated encryption for sensitive payloads.
- Sign the envelope so relays cannot forge SOS messages.
- Use rotating anonymous device identifiers.
- Do not use phone number, user ID, or trip ID as a BLE identifier.
- Keep the envelope small enough for efficient transfer.
- Fragment large payloads with sequence numbers and a checksum.

### Hop and expiry controls

Use both a time-to-live and hop limit:

- Initial TTL: configurable, for example 15 minutes.
- Maximum hops: configurable, for example 8.
- Each relay increments `hop_count` and decrements `hop_limit`.
- Relays stop forwarding expired or exhausted messages.
- Use randomized forwarding delays to reduce radio collisions and broadcast storms.

### Deduplication

Every relay stores recently seen message IDs in a bounded cache.

A relay must not forward the same message repeatedly. Deduplication should survive app restarts for at least the message TTL where feasible.

Use a compact acknowledgement token rather than broadcasting the full original payload again.

## Cryptography and Trust Model

The BLE network is untrusted. Nearby phones may be malicious, compromised, or curious.

Use a key design that does not require every relay to know the user's identity:

- The originator signs the envelope.
- The backend verifies the signature using a registered public key or device key.
- The sensitive payload is encrypted for the backend or a trusted emergency service.
- Relays forward opaque ciphertext and cannot decrypt the report.
- The gateway adds transport metadata but cannot rewrite the origin event.

Prevent:

- Message forgery
- Replay attacks
- Message tampering
- User impersonation
- Route/location disclosure
- Unlimited queue growth
- Relay amplification attacks

Key provisioning and device registration must be defined before production. A first MVP may use a per-installation key pair registered during authenticated online setup, with a controlled recovery path when the app is reinstalled.

## Backend API Design

Add a dedicated ingestion endpoint, for example:

```text
POST /offline-sos/ingest
```

The request should contain:

- Signed SOS envelope
- Gateway device identifier or authenticated session
- Relay metadata
- Protocol version
- Optional receipt timestamp

The backend must:

1. Authenticate the gateway where possible.
2. Verify the origin signature.
3. Validate message expiry and hop limits.
4. Deduplicate by `message_id`.
5. Reject malformed or replayed envelopes.
6. Persist the offline SOS event.
7. Associate it with the correct user/trip when possible.
8. Transition the trip to L3 using the existing escalation service.
9. Trigger the existing contact notification path.
10. Return an idempotent acknowledgement.

Recommended response:

```json
{
  "status": "accepted|duplicate|rejected|expired",
  "message_id": "opaque-id",
  "ack_token": "opaque-ack-token",
  "escalation_level": "L3_Alert"
}
```

Do not make the BLE relay wait indefinitely for the server. The client must handle offline, timeout, duplicate, and retry responses.

## Backend Data Model

Add an `OfflineSosEvent` model in `backend/app/models/schema.py`.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| `message_id` | String | Primary key and idempotency key |
| `trip_id` | String, nullable | Associated trip |
| `user_id` | String, nullable | Origin user when known |
| `origin_device_key_id` | String | Public-key identity reference |
| `event_type` | String | Manual, voice, or automatic SOS |
| `created_at` | DateTime | Original event time |
| `received_at` | DateTime | Backend receipt time |
| `expires_at` | DateTime | Envelope expiry |
| `hop_count` | Integer | Hops already used |
| `gateway_device_id` | String, nullable | Uploading gateway reference |
| `relay_metadata` | JSONB, nullable | Non-sensitive delivery metadata |
| `payload_hash` | String | Tamper/deduplication support |
| `status` | String | Accepted, duplicate, expired, rejected |

Add indexes for:

- `message_id`
- `trip_id`
- `user_id`
- `created_at`
- `status`

Use a migration for production. Include the model in `init_db.py` for local development.

## Escalation Integration

Reuse `backend/app/core/escalation.py` rather than creating a second escalation state machine.

An accepted offline SOS should transition to:

```text
L3_Alert, reason = offline_ble_sos
```

The existing server-side sustained escalation should continue to handle L4 behavior.

The backend must remain authoritative. A relay cannot de-escalate an SOS. De-escalation requires the existing authenticated user action and server-side transition rules.

When the gateway has no internet, it should retain the event and retry. When the backend accepts it, the normal Twilio/FCM notification flow should be used.

## Mobile Files to Change

Planned mobile changes:

- `mobile/app.json`: native BLE plugin, permissions, background capabilities
- `mobile/package.json`: selected BLE/native dependency
- `mobile/src/services/bleMesh.ts`: scan, advertise, connect, transfer, queue
- `mobile/src/services/offlineSosQueue.ts`: encrypted persistence and retry state
- `mobile/src/services/api.ts`: offline ingestion and acknowledgement APIs
- `mobile/src/screens/ActiveTrip.tsx`: trigger and status integration
- `mobile/src/screens/SOS.tsx`: offline delivery status
- `mobile/src/services/ws.ts`: reconcile server acknowledgements
- New permission/settings UI for Bluetooth and background relay

Keep the BLE service independent from the screen lifecycle. The screen may start or stop the user-facing SOS session, but the queue and relay state must be managed by a service/native layer.

## Permission and User Experience Requirements

Explain permissions before requesting them:

- Bluetooth/Nearby Devices: discover and exchange emergency messages with nearby phones.
- Notifications: show relay and emergency status.
- Location: needed for trip location and may be required by older Android BLE scanning rules.
- Background activity/foreground service: needed for best-effort relay while the app is not visible.

Do not request accessibility permission. Accessibility is not required for BLE scanning, advertising, or SOS relay.

The app should show:

- Bluetooth disabled state
- Permission denied state
- Relay enabled/disabled state
- Last successful relay or gateway upload time
- Queue size without revealing sensitive message content
- Clear limitation that delivery is best effort

Keep the native phone Emergency SOS fallback visible and enabled.

## Privacy Requirements

- Do not advertise names, phone numbers, user IDs, trip IDs, or exact coordinates.
- Use rotating anonymous BLE identifiers.
- Encrypt the payload end-to-end where practical.
- Store only the metadata required for delivery, audit, and emergency response.
- Expire relay records after the SOS TTL plus a short cleanup period.
- Allow users to disable participation as a relay, while explaining that disabling it reduces community availability.
- Do not expose relay paths or nearby device identities to the user or backend unless necessary for abuse investigation.
- Use coarse location in the relay payload unless emergency responders explicitly require more precision.

## Abuse and Reliability Protections

Implement:

- Signature verification
- Message expiry
- Hop limits
- Message-ID deduplication
- Per-device queue limits
- Payload size limits
- Rate limits per origin key and gateway
- Randomized relay delays
- Backoff after repeated failures
- No automatic retransmission after backend acknowledgement
- Replay detection
- Malformed-packet rejection
- Protocol-version checks
- Battery-aware relay limits
- User opt-in for relay participation
- Audit logs without sensitive payload logging
- Backend idempotency by `message_id`
- Server-side authorization before linking an event to a trip

Do not allow an arbitrary nearby phone to trigger L3 for a victim's trip without a valid origin signature and an accepted association.

## Testing Plan

### Protocol tests

1. A valid SOS envelope is serialized and parsed correctly.
2. Invalid signatures are rejected.
3. Modified payloads fail verification.
4. Expired messages are rejected.
5. Messages with exhausted hop limits are not relayed.
6. Duplicate message IDs are not forwarded twice.
7. Fragmented payloads reassemble correctly.
8. Missing fragments time out safely.
9. Unsupported protocol versions are rejected.
10. Oversized payloads are rejected.
11. Randomized relay delays stay within configured limits.
12. Queue limits prevent unbounded storage.

### Offline queue tests

13. SOS is persisted before network transmission begins.
14. App restart preserves an unexpired queued SOS.
15. Expired queued SOS records are cleaned up.
16. Network failure schedules retry with backoff.
17. Successful online upload marks the local event acknowledged.
18. Duplicate backend acknowledgement is handled idempotently.
19. Offline SOS does not create multiple server alerts.
20. De-escalation cannot occur from an untrusted relay packet.

### Native platform tests

21. Android requests the correct Nearby Devices permissions.
22. Older Android versions request only their required location permission.
23. Bluetooth-disabled state is detected and shown.
24. Android foreground service behavior is tested under screen lock.
25. Android battery optimization behavior is documented and tested on supported devices.
26. iOS Bluetooth permission denial is handled.
27. iOS background limitations are surfaced to the user.
28. App force-quit behavior does not claim guaranteed delivery.
29. Advertising and scanning stop cleanly when relay participation is disabled.
30. No duplicate native listeners are created after screen remounts.

### Backend tests

31. Valid offline SOS ingestion returns `accepted`.
32. Replayed `message_id` returns `duplicate` without a second escalation.
33. Expired events return `expired`.
34. Invalid signatures return `rejected`.
35. Invalid hop metadata is rejected.
36. Offline SOS transitions the trip to L3 with reason `offline_ble_sos`.
37. Ingested events are persisted in PostgreSQL.
38. Contact notification flow is invoked once after acceptance.
39. Unauthenticated or unauthorized gateway requests are rejected according to policy.
40. Unknown trip association does not allow unauthorized escalation.
41. Server restart preserves event idempotency.
42. Existing online SOS behavior remains unchanged.
43. L4 sustained escalation still works after offline SOS ingestion.
44. Audit metadata does not contain raw sensitive payloads.

### End-to-end tests

45. Phone A creates an SOS while offline.
46. Phone B receives and stores the SOS.
47. Phone C receives it from Phone B and deduplicates it.
48. Phone D with internet uploads the message.
49. Backend accepts it and transitions the correct trip to L3.
50. Duplicate paths converge to one backend event.
51. The originator receives acknowledgement when connectivity returns.
52. A relay with no network still forwards within hop and TTL limits.
53. A path with an unavailable or disabled relay eventually expires cleanly.
54. The app shows a clear offline delivery status throughout the flow.

### Validation commands

Use focused validation after implementation:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
.\venv\Scripts\python.exe -m pip check

cd ..\mobile
npx tsc --noEmit
npm run start
```

Native Android and iOS tests must be run on physical devices. BLE behavior cannot be validated reliably in a normal browser or simulator-only workflow.

## Recommended Implementation Order

1. Finalize the threat model and delivery guarantees.
2. Choose and spike-test a BLE library that supports scanning, advertising, GATT transfer, and custom builds.
3. Define and version the signed SOS envelope.
4. Implement encrypted local SOS queue persistence.
5. Implement single-hop BLE discovery and transfer.
6. Add deduplication, TTL, hop limits, and acknowledgement handling.
7. Add multi-hop store-and-forward relay behavior.
8. Add the backend ingestion endpoint and idempotent event model.
9. Connect accepted events to the existing L3/L4 escalation flow.
10. Add Android permissions, foreground service, and battery behavior.
11. Add iOS CoreBluetooth background capabilities and limitation messaging.
12. Integrate the service with existing mobile SOS triggers.
13. Add protocol, queue, native, backend, and end-to-end tests.
14. Run a controlled field test with multiple physical devices.
15. Add monitoring, abuse controls, key rotation, and retention cleanup before production rollout.

## Acceptance Criteria

The feature is complete for MVP when:

- A user can trigger SOS without internet or cellular service.
- The SOS is durably queued before transmission.
- Nearby opted-in phones can relay the encrypted signed envelope.
- Messages can travel across multiple hops within TTL and hop limits.
- A connected gateway can upload the message to the backend.
- The backend deduplicates repeated deliveries.
- Accepted events invoke the existing L3 escalation flow exactly once.
- Invalid, expired, forged, and replayed messages are rejected.
- Android and iOS permission/background limitations are clearly handled.
- The app does not require accessibility permission.
- The UI communicates that BLE delivery is best effort and keeps native Emergency SOS as a fallback.
- Physical-device tests demonstrate a controlled multi-phone relay scenario.

## Rollout Recommendation

Start with a controlled pilot rather than enabling automatic public relay immediately.

Phase 1 should support:

- Manual SOS only
- One-hop relay
- Authenticated registered devices
- Short TTL
- Backend acknowledgement
- Detailed diagnostics with privacy-safe metadata

Phase 2 can add:

- Multi-hop forwarding
- Opt-in community relay
- Foreground background relay on Android
- Improved iOS background behavior where permitted
- Gateway prioritization
- Operational monitoring and abuse review

A BLE SOS mesh should supplement, not replace, the phone's native Emergency SOS, cellular calls, SMS, and the current online SafeRoute+ escalation flow.
