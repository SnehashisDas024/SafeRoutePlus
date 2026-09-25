# Journey Route History Implementation Plan

## Objective

When a user generates a journey plan, SafeRoute+ should remember the selected source and destination. On future visits to the Plan screen, the user should be able to select:

- Recently used source and destination pairs
- Frequently used source and destination pairs

Selecting a saved pair should restore the source, destination, display names, and travel mode.

Suggestions should appear during source and destination selection, not only after a route has been generated. When the user focuses the Source or Destination field, show recent and frequently used places or route pairs relevant to that field. When the user types, filter the suggestions by place name and coordinate label. Selecting a suggestion should immediately populate the active field and its coordinates. If the suggestion represents a complete saved route pair, provide an option to restore both fields and the saved travel mode.

This document describes the implementation only. It does not include code changes.

## Existing Architecture

The feature should use the existing project stack:

- Backend: FastAPI, SQLAlchemy, PostgreSQL/PostGIS
- Main web client: React, TypeScript, Vite, React Router, Leaflet
- PWA client: React, TypeScript, Vite, Leaflet
- Mobile client: React Native/Expo
- Existing authentication dependency: `get_current_user`
- Existing route endpoint: `POST /routes/plan`

Relevant existing files:

- `backend/app/models/schema.py`
- `backend/app/schemas/core.py`
- `backend/app/api/routes_plan.py`
- `backend/app/deps.py`
- `backend/init_db.py`
- `frontend/src/screens/PlanScreen.tsx`
- `frontend/src/components/PlaceAutocomplete.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `pwa/src/screens/PlanScreen.tsx`
- `pwa/src/services/api.ts`
- `mobile/src/screens/Plan.tsx`

## Product Behavior

### Save behavior

A route history record should be created or updated after `POST /routes/plan` successfully generates ranked routes.

The record should not wait until the user starts a trip. A user may generate a plan without starting it, and that plan should still appear in history.

Repeated use of the same source, destination, and travel mode should increment a usage counter rather than create duplicates.

### Display behavior

The Plan screen should show two sections:

1. **Recent routes**
   - Ordered by most recent use.
   - Recommended limit: 10 records.

2. **Frequently used**
   - Ordered by `use_count DESC`, then `last_used_at DESC`.
   - Recommended limit: 10 records.

Each item should show:

- Source name
- Destination name
- Travel mode
- Usage count for frequent routes
- Optional last-used time

If a place name is unavailable, display a formatted coordinate label.

The suggestion UI should be available from both the Source and Destination controls:

- Focusing Source shows saved origins and saved route pairs containing those origins.
- Focusing Destination shows saved destinations and saved route pairs containing those destinations.
- Typing filters the visible suggestions without blocking normal place autocomplete.
- Selecting a source-only or destination-only suggestion fills only the active field.
- Selecting a saved route pair fills both fields and restores the saved mode.
- Suggestions close after selection and reopen when the field receives focus again.

## Backend Data Model

Add a new SQLAlchemy model named `RouteHistory` in `backend/app/models/schema.py`.

Suggested columns:

| Column | Type | Description |
|---|---|---|
| `id` | String/UUID | Primary key |
| `user_id` | String | Foreign key to `users.id` |
| `origin_name` | String, nullable | User-visible source name |
| `origin_lon` | Float | Source longitude |
| `origin_lat` | Float | Source latitude |
| `destination_name` | String, nullable | User-visible destination name |
| `destination_lon` | Float | Destination longitude |
| `destination_lat` | Float | Destination latitude |
| `mode` | String | `walk` or `drive` |
| `use_count` | Integer | Number of successful plans, default `1` |
| `last_used_at` | DateTime | Most recent successful plan |
| `created_at` | DateTime | First recorded use |

Add a uniqueness constraint over:

```text
user_id + origin coordinates + destination coordinates + mode
```

Coordinates should be normalized before comparison, for example by rounding to 5 or 6 decimal places. This prevents tiny geocoding differences from creating duplicate route history entries.

The existing `Trip` model should not be used as the sole source for this feature because it only records a trip after the user selects a route and starts it.

## Database Initialization

Update `backend/init_db.py` only as needed so the new model is imported before `Base.metadata.create_all()` runs.

The current project uses `create_all()` for local setup. This is sufficient for development, but production should eventually use Alembic migrations for adding and changing tables safely.

## Request Schema Changes

Extend `RoutePlanRequest` in `backend/app/schemas/core.py` with optional display names:

```text
origin_name: Optional[str]
destination_name: Optional[str]
```

Coordinates remain authoritative. Names are labels only and may be absent for map-selected points.

The request should continue to support:

- `origin: [longitude, latitude]`
- `destination: [longitude, latitude]`
- `mode`
- `depart_at`

## Route Planning API Changes

Update `backend/app/api/routes_plan.py`.

### `POST /routes/plan`

The endpoint should:

1. Authenticate using the existing `get_current_user` dependency.
2. Validate coordinate ranges and the travel mode.
3. Generate routes from OSRM or the existing route cache.
4. Score and rank the routes as it currently does.
5. Upsert the route history record after successful route generation.
6. Return the ranked routes without changing the existing response shape.

History persistence should not prevent route planning from returning a response if a non-critical history write fails. The failure should be logged and monitored, but the behavior should be decided explicitly in tests and documentation.

### New endpoints

Add these endpoints in `backend/app/api/routes_plan.py` or a dedicated `backend/app/api/route_history.py` module:

```text
GET /routes/history?limit=10
GET /routes/history/frequent?limit=10
```

Both endpoints must:

- Require authentication.
- Filter by the authenticated `user_id`.
- Enforce a maximum limit server-side.
- Return an empty list when the user has no history.

Suggested response shape:

```json
{
  "id": "route-history-id",
  "origin": {
    "name": "Home",
    "coordinates": [88.36, 22.57]
  },
  "destination": {
    "name": "Office",
    "coordinates": [88.40, 22.60]
  },
  "mode": "walk",
  "use_count": 8,
  "last_used_at": "2026-09-25T09:30:00"
}
```

## Authentication

Use `get_current_user` consistently for all route-history operations.

The current implementation in `backend/app/deps.py` returns the demo user ID `test_user_id`. This is acceptable for the current MVP, but the route-history API must already be user-scoped so it will work correctly when real authentication replaces the mock implementation.

Do not use browser local storage as the source of truth. Local storage is device-specific and cannot enforce server-side privacy or synchronize between devices.

## Main Web Frontend

The first implementation target should be the `frontend` application.

### API client

Update `frontend/src/services/api.ts` with:

- A `RouteHistoryItem` TypeScript interface
- `getRecentRoutes()`
- `getFrequentRoutes()`

Update `frontend/src/types/index.ts` so `RoutePlanRequest` supports:

```text
origin_name?: string
destination_name?: string
```

### Plan screen

Update `frontend/src/screens/PlanScreen.tsx` to:

1. Fetch recent and frequent routes when the screen loads.
2. Show loading state while history is being fetched.
3. Show recent and frequent sections when records exist.
4. Show a compact empty state when no records exist.
5. Restore coordinates, names, and mode when a saved route is selected.
6. Keep manual map selection and place autocomplete working.
7. Include `origin_name` and `destination_name` in `planRoute()` requests.
8. Keep history loading failures non-blocking so users can still plan manually.

The existing `PlaceAutocomplete` component already provides place names and coordinates. When the user selects a map point without a name, use a formatted coordinate string as the display fallback.

To keep `PlanScreen.tsx` maintainable, add reusable components such as:

```text
frontend/src/components/RouteHistoryList.tsx
frontend/src/components/RouteHistoryItem.tsx
```

The UI should remain consistent with the existing Leaflet/map and card styling.

## PWA Alignment

After the main frontend implementation works, expose the same backend functionality in the PWA:

- `pwa/src/services/api.ts`
- `pwa/src/screens/PlanScreen.tsx`
- `pwa/src/types/` if route-history types are centralized there

The PWA currently has less complete place-name support than the main frontend. It may initially display coordinate-based labels when names are unavailable.

The PWA should use the same backend endpoints and response format rather than implementing a separate storage system.

## Mobile Alignment

The mobile app currently accepts raw coordinate strings in `mobile/src/screens/Plan.tsx`.

Add the same route-history API methods to `mobile/src/services/api.ts` and display saved coordinate pairs in `mobile/src/screens/Plan.tsx`.

The first mobile version can restore:

- Origin coordinates
- Destination coordinates
- Travel mode

Named place autocomplete can be added later when the mobile client gains a structured place-search component.

## Privacy and Retention

Route history contains sensitive location data. The implementation should:

- Store every record under a user ID.
- Require authentication for reads and writes.
- Never return another user's route history.
- Avoid logging full coordinates or place names.
- Add a future `DELETE /routes/history` or per-item delete operation.
- Consider retention cleanup for records unused for 90 to 180 days.

A future settings action should allow the user to clear route history.

## Testing Plan

### Backend tests

Add tests covering:

1. A first successful route plan creates one history record.
2. Repeating the same route increments `use_count`.
3. Recent history is ordered by `last_used_at DESC`.
4. Frequent history is ordered by `use_count DESC`, then `last_used_at DESC`.
5. Different travel modes create separate records.
6. Coordinate normalization prevents near-duplicate records.
7. Missing place names are accepted.
8. One user cannot read another user's history.
9. The endpoint respects the maximum limit.
10. Existing route-plan response behavior remains unchanged.

Relevant existing test files include:

- `test_routes.py`
- `test_risk_engine.py`

### Frontend tests

Add tests covering:

1. Recent and frequent history loads on the Plan screen.
2. Selecting a saved route restores the source and destination.
3. Selecting a saved route restores travel mode.
4. History API failure does not block manual planning.
5. Route requests include optional source and destination names.
6. Empty history renders without errors.

### Validation commands

Use the repository's existing commands and add focused checks as appropriate:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest

cd ..\frontend
npm run typecheck
npm run build

cd ..\pwa
npm run typecheck
npm run build
```

## Recommended Implementation Order

1. Add the `RouteHistory` SQLAlchemy model.
2. Add database initialization/migration support.
3. Extend `RoutePlanRequest` with optional names.
4. Add route-history upsert logic to `POST /routes/plan`.
5. Add recent and frequent history endpoints.
6. Add backend tests.
7. Add frontend API types and methods.
8. Add route-history controls to the main web Plan screen.
9. Add frontend tests and build validation.
10. Port the shared API behavior to the PWA.
11. Add coordinate-based history controls to mobile.
12. Add deletion and retention controls as a follow-up.

## Acceptance Criteria

The feature is complete when:

- A successful route plan appears in recent history.
- Reusing the same route increases its usage count.
- The most frequently used routes are ranked correctly.
- Selecting a history item restores the complete route form.
- History is scoped to the authenticated user.
- Manual map and autocomplete planning still work.
- The backend and frontend builds pass.
- Backend and frontend tests cover the new behavior.
- PWA and mobile clients use the same backend contract where implemented.
