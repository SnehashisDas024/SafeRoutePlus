# Community Route Safety Reporting Implementation Plan

## Objective

Allow users to report safety problems they experienced on a route, even when the automated risk engine did not detect the problem.

Community reports should be stored in PostgreSQL and used as additional evidence when future routes are scored.

The system should:

- Allow a traveler to report a route or route segment as safe, concerning, or unsafe.
- Store the report with its user, trip, time, location, and selected tags.
- Combine community evidence with the existing risk and ML signals.
- Lower the score of routes with credible unsafe reports.
- Suppress a route only when there is sufficient recent, independent evidence.
- Avoid hiding a route because of one accidental, stale, duplicated, or malicious report.
- Explain route warnings to users without exposing reporter identities.

This document is an implementation plan only. It does not include application code changes.

## Project Tech Stack

Use the existing project stack:

- Backend: FastAPI, SQLAlchemy, PostgreSQL/PostGIS
- Risk engine: H3 cells, route segmentation, time-aware risk scoring
- ML: existing scikit-learn route/risk pipeline
- Main web client: React, TypeScript, Vite, React Router, Leaflet
- PWA client: React, TypeScript, Vite, React Router, Leaflet
- Mobile client: React Native/Expo
- Notifications: existing Twilio/FCM mock-capable services
- Authentication: existing `get_current_user` dependency
- Database setup: current `Base.metadata.create_all()` development flow, with Alembic recommended for production migrations

## Existing Code Paths

Relevant files:

- `backend/app/models/schema.py`
- `backend/app/schemas/core.py`
- `backend/app/api/reports.py`
- `backend/app/api/routes_plan.py`
- `backend/app/api/safe_routes.py`
- `backend/app/core/risk_engine.py`
- `backend/app/core/risk_aggregator.py`
- `backend/app/core/risk_constants.py`
- `backend/app/core/route_scorer.py`
- `backend/app/deps.py`
- `backend/init_db.py`
- `frontend/src/screens/ReportScreen.tsx`
- `frontend/src/screens/PlanScreen.tsx`
- `frontend/src/screens/RouteCompareScreen.tsx`
- `frontend/src/services/api.ts`
- `pwa/src/screens/ReportScreen.tsx`
- `pwa/src/screens/PlanScreen.tsx`
- `pwa/src/screens/RouteCompareScreen.tsx`
- `pwa/src/services/api.ts`
- `mobile/src/screens/Plan.tsx`
- `mobile/src/services/api.ts`

The current report flow stores a report against one H3 cell derived from the last GPS ping or trip destination. The feature should improve that behavior by identifying the actual affected route segment whenever possible.

The route paths must be unified. The PWA currently uses `/routes/plan`, while the main frontend uses the ML-oriented `/routes/safe-plan`. Community evidence must affect both paths, or users could bypass warnings by using a different client.

## User Experience

### Report flow

After or during a journey, the user can open **Report Route Safety** and submit:

- Safe
- Some concern
- Unsafe

The user can select one or more tags:

- Poorly lit
- Harassment
- Suspicious activity
- Isolated area
- Unsafe crowd
- Road blocked
- Construction or obstruction
- Police or security concern
- Other

The user may add an optional note.

The report screen should show the journey route on a map. The user should be able to select the affected segment. If the user does not select a segment, the app should use the most recent GPS position or the nearest route segment as a fallback.

### Route display flow

When routes are compared, show community evidence for affected routes:

- Community safety badge
- Number of recent reports, without reporter identities
- Main reported concerns
- Report recency
- Whether the route score was reduced by community evidence

If a route is suppressed, do not silently remove it. Show a message such as:

```text
This route is temporarily excluded because multiple recent travelers reported safety concerns on part of the route.
```

If all available routes contain reported risk, show the routes with a strong warning instead of returning an empty result.

## Data Model

Add a `RouteHistory`-independent community report model or extend the existing `Report` model in `backend/app/models/schema.py`.

The report record should contain:

| Field | Type | Purpose |
|---|---|---|
| `id` | String/UUID | Primary key |
| `user_id` | String | Authenticated reporter |
| `trip_id` | String | Source journey, nullable for future standalone reports |
| `h3_index` | String | Affected H3 resolution-9 cell |
| `segment_index` | Integer, nullable | Affected route segment when known |
| `rating` | String | Safe, concern, or unsafe |
| `tags` | Array[String] | Structured safety observations |
| `note` | String, nullable | Optional user description |
| `reported_at` | DateTime | Submission time |
| `route_context` | JSONB, nullable | Optional mode, route hash, and position metadata |
| `status` | String | Pending, accepted, rejected, or moderated |

Do not store unnecessary personal information in the report.

Recommended indexes:

- `(h3_index, reported_at)`
- `(user_id, reported_at)`
- `(trip_id, segment_index)`
- Optional index for report status

The current `Report` model may be extended rather than replaced, but the migration must preserve existing report data.

## Data Quality and Deduplication

Before storing a report:

1. Require an authenticated user.
2. Confirm the trip belongs to that user.
3. Confirm the trip exists and is active or recently completed.
4. Validate the rating and tags against allowed values.
5. Validate the selected segment index if supplied.
6. Normalize the H3 cell and route context.
7. Reject or merge duplicate reports from the same user, trip, and segment within a cooldown window.
8. Rate-limit submissions per user and per trip.

A user should not be able to submit unlimited reports for the same location during one journey.

## Risk Semantics

Before integrating community evidence, verify the direction of all risk scores.

The current code appears to have a possible inversion:

- A red report may produce a higher numeric risk value.
- Some route ranking code treats higher values as safer.

Define one clear convention:

```text
safety_score: higher is safer
risk_score: higher is more dangerous
```

Convert between the two only at explicit boundaries. Add tests before changing the aggregator so unsafe reports cannot accidentally improve route ranking.

## Community Evidence Calculation

Add a reusable service or helper near the risk engine, for example:

```text
backend/app/core/community_risk.py
```

The helper should calculate evidence for an H3 cell and relevant time window:

- Total accepted reports
- Unsafe report count
- Concern report count
- Safe report count
- Distinct reporter count
- Distinct trip count
- Unsafe ratio
- Most recent report time
- Report age decay
- Confidence level
- Suppression eligibility

Use accepted/moderated reports only for route decisions.

Recommended time behavior:

- Recent reports have stronger weight.
- Old reports decay gradually.
- Severe tags may receive additional weight, but should not independently block a route without corroboration.
- Reports should be evaluated for the relevant arrival time when the existing time-aware risk model supports it.

## Suppression Policy

A single report must not remove a route.

Recommended initial suppression rule:

A segment becomes suppressible only when all of the following are true:

- At least 3 reports from independent users or independent trips.
- At least 60% of accepted reports for the cell are concern/unsafe.
- At least one unsafe report is recent, such as within 7 days.
- Reports are not all duplicates from one journey.
- The evidence confidence is high enough according to configured thresholds.

Make all thresholds configurable in `backend/app/core/risk_constants.py`.

Suggested constants:

```text
COMMUNITY_REPORT_WINDOW_DAYS
COMMUNITY_MIN_INDEPENDENT_REPORTERS
COMMUNITY_MIN_INDEPENDENT_TRIPS
COMMUNITY_UNSAFE_RATIO_THRESHOLD
COMMUNITY_SUPPRESSION_CONFIDENCE_THRESHOLD
COMMUNITY_REPORT_COOLDOWN_SECONDS
```

Suppression should be segment-specific, not an automatic permanent block of an entire road or destination.

## Route Scoring Integration

Update both route-scoring paths:

- `backend/app/core/route_scorer.py`
- `backend/app/api/safe_routes.py`
- `backend/app/core/risk_engine.py`
- `backend/app/api/routes_plan.py`

Each route segment should receive:

```text
safety_score
community_score_adjustment
community_report_count
community_confidence
blocked
suppression_reason
```

Behavior:

1. Calculate the existing ML/static/time-aware score.
2. Calculate community evidence for the segment H3 cell.
3. Apply a confidence-weighted penalty when evidence is insufficient for blocking.
4. Mark the segment blocked only when suppression thresholds are met.
5. Mark the entire route blocked if any important segment is blocked.
6. Exclude blocked routes when unblocked alternatives exist.
7. If every alternative is blocked, return the routes with a warning and suppression metadata.

Do not duplicate community-risk logic in the two route paths. Both should call the same helper.

## API Changes

### Report submission

Continue using:

```text
POST /trips/{trip_id}/report
```

Extend the request with optional route context:

```json
{
  "rating": "unsafe",
  "tags": ["Poorly lit", "Isolated area"],
  "note": "Very isolated section after the crossing",
  "h3_index": "reported-h3-cell",
  "segment_index": 4,
  "reported_position": [88.36, 22.57]
}
```

The server must derive or verify the H3 cell rather than trusting arbitrary client input.

### Route warnings

Add community metadata to route responses without breaking existing consumers:

```json
{
  "worst_segment_score": 0.42,
  "mean_segment_score": 0.58,
  "total_time_sec": 900,
  "community_status": "penalized",
  "community_warning": "Recent safety concerns reported on one segment",
  "segments": []
}
```

Possible `community_status` values:

- `none`
- `informational`
- `penalized`
- `suppressed`

Optionally add:

```text
GET /routes/community-risk?h3_index=...
```

This endpoint must be authenticated and should return aggregated, anonymous evidence only.

## Backend Files to Change

Planned backend changes:

- `backend/app/models/schema.py`: report fields, indexes, and status
- `backend/app/schemas/core.py`: request and response schemas
- `backend/app/api/reports.py`: validation, ownership, deduplication, and storage
- `backend/app/api/routes_plan.py`: integrate community evidence
- `backend/app/api/safe_routes.py`: integrate community evidence
- `backend/app/core/community_risk.py`: shared evidence calculation
- `backend/app/core/risk_engine.py`: expose community metadata
- `backend/app/core/risk_aggregator.py`: aggregate accepted reports correctly
- `backend/app/core/risk_constants.py`: thresholds and decay settings
- `backend/app/core/route_scorer.py`: penalty and suppression behavior
- `backend/app/deps.py`: preserve user scoping when real authentication replaces the demo user
- `backend/init_db.py`: import new models for local table creation

Use Alembic migrations for production. Keep `create_all()` support for the current local development workflow until migrations are introduced.

## Main Frontend Changes

Update:

- `frontend/src/screens/ReportScreen.tsx`
- `frontend/src/screens/PlanScreen.tsx`
- `frontend/src/screens/RouteCompareScreen.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`

Add:

- Route segment selection on the report map.
- Report status and submit feedback.
- Community warning badges in route comparison.
- Details for recent anonymous community evidence.
- Clear explanation when a route was penalized or suppressed.

Do not reveal reporter identity, phone number, or exact personal travel history.

## PWA Changes

Update the equivalent PWA files:

- `pwa/src/screens/ReportScreen.tsx`
- `pwa/src/screens/PlanScreen.tsx`
- `pwa/src/screens/RouteCompareScreen.tsx`
- `pwa/src/services/api.ts`
- `pwa/src/types/`

The PWA must consume the same backend response contract as the main frontend.

The PWA currently uses `/routes/plan`, so verify that this path receives community penalties and suppression metadata.

## Mobile Changes

Update:

- `mobile/src/screens/Plan.tsx`
- `mobile/src/screens/RouteCompare.tsx`
- `mobile/src/services/api.ts`
- Add or update a mobile report screen if required by navigation.

The first mobile version can use the current route coordinates and selected segment index. A later version can add a richer map selector.

The mobile client must use the same backend community-risk policy rather than implementing separate thresholds locally.

## Abuse Prevention and Safety Controls

Implement the following protections:

- Authentication required for report submission.
- Verify the trip belongs to the submitting user.
- Rate-limit reports per user, trip, and H3 cell.
- Deduplicate repeated reports from the same user/trip/segment.
- Require independent users or trips for suppression.
- Use report expiration or time decay.
- Store moderation status and exclude rejected reports from scoring.
- Keep an audit trail for moderation changes.
- Add an admin review path for suspicious mass reporting.
- Do not expose reporter identities.
- Do not allow a client to directly set `blocked` or confidence.
- Never silently remove all routes without a user-visible explanation.
- Preserve an emergency fallback route when every route has concerns.
- Add a user action to dispute or flag an incorrect community warning.
- Keep report notes sanitized and length-limited.
- Avoid logging sensitive coordinates and free-text notes unnecessarily.

## Testing Plan

### Report validation tests

1. Authenticated users can submit a report.
2. Unauthenticated users receive `401`.
3. A user cannot report another user's trip.
4. Unknown trips return `404`.
5. Invalid ratings are rejected.
6. Invalid tags are rejected or normalized.
7. Notes have a maximum length.
8. Invalid segment indexes are rejected.
9. The server derives or verifies the H3 cell.
10. Reports without a selected segment use a safe fallback location.

### Deduplication and abuse tests

11. Duplicate reports from the same user, trip, and segment within the cooldown are rejected or merged.
12. A user cannot exceed the report rate limit.
13. Reports from one trip do not count as independent reports.
14. Reports from multiple users count as independent evidence.
15. Rejected or moderated reports do not affect route scoring.
16. Suspicious mass reports can be marked for review.
17. Free-text report content is length-limited and safely stored.

### Aggregation tests

18. Unsafe reports lower safety rather than improve it.
19. Safe reports do not incorrectly create high risk.
20. Concern reports have an intermediate effect.
21. Recent reports have greater influence than stale reports.
22. Old reports decay or expire according to policy.
23. Report evidence is calculated per H3 cell.
24. Evidence is calculated for the relevant time window where supported.
25. Distinct users and distinct trips are counted separately.
26. A single unsafe report does not suppress a segment.
27. Sufficient independent unsafe reports make a segment suppressible.
28. An unsafe ratio below the threshold does not suppress a segment.

### Route planning tests

29. Community evidence affects `/routes/plan`.
30. Community evidence affects `/routes/safe-plan`.
31. Both endpoints use the same community-risk helper.
32. A penalized route remains available but ranks below safer alternatives.
33. A suppressed route is excluded when an unblocked alternative exists.
34. A route with one blocked segment is marked suppressed.
35. Suppressed-route metadata contains a user-safe explanation.
36. If all alternatives are suppressed, routes are returned with a strong warning rather than an empty response.
37. Existing route ranking behavior remains unchanged when there are no reports.
38. Existing route response consumers remain compatible with added metadata.
39. Route scoring remains correct when the report database is empty.
40. Database or aggregation failure does not silently make unsafe routes appear safe.

### Frontend tests

41. The report screen displays the route and selectable segments.
42. The user can submit safe, concern, and unsafe reports.
43. The report screen displays submission success and failure states.
44. Route comparison displays community badges and warnings.
45. Penalized routes remain visibly available but lower-ranked.
46. Suppressed routes are explained and not silently hidden.
47. The all-routes-warning state is rendered correctly.
48. Reporter identity is never shown.
49. Existing manual route planning still works when community APIs fail.
50. API response metadata is handled without breaking older route data.

### Validation commands

Use focused validation after implementation:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
.\venv\Scripts\python.exe -m pip check

cd ..\frontend
npm run typecheck
npm run build

cd ..\pwa
npm run typecheck
npm run build

cd ..\mobile
npx tsc --noEmit
```

## Recommended Implementation Order

1. Correct and test safety/risk score direction.
2. Extend the report model and request schema.
3. Add ownership validation, rate limits, deduplication, and moderation status.
4. Add route-segment selection and H3 verification.
5. Implement shared community evidence calculation.
6. Add configurable recency and suppression thresholds.
7. Integrate community penalties into both route-scoring paths.
8. Add suppression metadata and all-routes-warning behavior.
9. Add backend tests for validation, aggregation, suppression, and abuse prevention.
10. Update the main frontend report and route comparison screens.
11. Update the PWA using the same API contract.
12. Update mobile with coordinate/segment reporting.
13. Run database migration and full build/test validation.
14. Add moderation, dispute, and retention tools before production rollout.

## Acceptance Criteria

The feature is complete when:

- A traveler can report a specific route segment as safe, concerning, or unsafe.
- Reports are stored in PostgreSQL with authenticated user and trip ownership.
- Duplicate and abusive submissions are controlled.
- Reports are aggregated by H3 cell and recency.
- Community evidence affects both route-planning endpoints.
- A single report cannot suppress a route.
- Multiple independent recent unsafe reports can suppress a segment.
- Penalized and suppressed routes are explained to users.
- If all routes have concerns, the system shows a warning instead of silently failing.
- The existing ML and time-aware safety signals continue to work.
- Tests cover report validation, privacy, abuse prevention, score direction, aggregation, route ranking, suppression, and frontend rendering.
