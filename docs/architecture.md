# Architecture

## Layers

| Layer         | Location                                    | Responsibility                                                                |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| UI            | `src/app`, `src/components`, `src/features` | Rendering, interaction, client state only                                     |
| API           | `src/app/api/**/route.ts`, `src/lib/api`    | Authenticate, authorise, validate, call domain/repository, envelope responses |
| Auth          | `src/lib/auth`                              | ID-token verification, role → capability mapping, session scoping             |
| Domain        | `src/domain`                                | Pure, deterministic calculations (risk, summary, seed). No I/O                |
| Persistence   | `src/lib/data`                              | `DistrictRepository` interface; Firestore and in-memory implementations       |
| Observability | `src/lib/observability`, `src/lib/errors`   | JSON logs, request IDs, safe error mapping                                    |

## Request flow

1. Client signs in anonymously with Firebase Auth and sends `Authorization: Bearer <idToken>`.
2. `apiHandler` assigns a request ID, times the call and converts errors into `{ ok:false, error, requestId }`.
3. `authenticate()` verifies the token with the Admin SDK. Anonymous users become `demo_user` with `sessionId = uid`. Client-sent roles are never trusted.
4. The repository reads/writes only under `demoSessions/{sessionId}`.
5. Domain functions compute assessments; the response is returned with `cache-control: no-store`.

## Firestore layout

```
demoSessions/{sessionId}                                   District { id, name, synthetic: true, historyEndDate, createdAt }
demoSessions/{sessionId}/facilities/{id}                   Facility (see src/domain/schemas.ts)
demoSessions/{sessionId}/facilities/{id}/audit/{eventId}   AuditEvent { kind, summary, actorUid, at }
demoSessions/{sessionId}/facilities/{id}/movements/{id}    InventoryMovement { medicineId, movement, delta, balanceAfter }
demoSessions/{sessionId}/idempotency/{key}                 { facilityId, kind, audit }
```

Reads are bounded (`limit(50)` facilities, `limit(20)` audit events) and each document is validated with Zod before use. All queries use single-field ordering, so no composite indexes are required. Session bootstrap runs inside a transaction so concurrent first requests cannot double-seed.

## Write path

`POST /api/facilities/[id]/updates` → authenticate → `facility:write` capability → 8 KB body cap → Zod discriminated union → Firestore transaction:

1. Read the facility and (if supplied) the idempotency record.
2. If the key exists: same facility and kind → return the original result; otherwise 409.
3. Apply the pure `applyFacilityUpdate()` (throws `DomainRuleError` → 422) and re-validate the result with `FacilitySchema`.
4. Write facility, audit event, movement (stock only) and idempotency record atomically.

Firestore retries contended transactions, so concurrent updates to a facility serialise and cannot drive stock negative.

## Forecasting method (`src/domain/forecast.ts`)

All forecasts are computed server-side from stored history; identical history gives identical output.

| Quantity             | Method                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Level                | Mean of the last 7 days (needs ≥ 3 days, otherwise "not enough history")                                                                                             |
| Trend                | OLS slope over the last 14 days, halved (damped)                                                                                                                     |
| Typical range        | expected ± 1.28 × sample standard deviation of the last 14 days (~80% band under a normal approximation; shown as "anywhere from X to Y", not as a confidence score) |
| Days until stock-out | Step through forecast demand day by day until stock is exhausted (capped at one year); pessimistic variant uses the high end of the range                            |
| Safety stock         | 1.65 × σ × √(lead time)                                                                                                                                              |
| Reorder point        | level × lead time + safety stock                                                                                                                                     |
| Suggested order      | level × (lead time + 14 days) + safety stock − current stock                                                                                                         |
| Footfall surge       | today ≥ 1.3 × mean of the previous 7 days                                                                                                                            |

Underperforming centres are ranked by 3 points per critical signal and 1 per warning, with ties broken by lower doctor attendance.

## Risk thresholds

- Average daily consumption = mean of the last 7 recorded days (requires ≥ 3 days; otherwise "insufficient history").
- Days of cover = stock ÷ average. Zero consumption → unlimited.
- Medicine **critical** if stock is 0 or cover < lead time; **warning** if stock ≤ reorder level or cover < 2 × lead time.
- Beds: warning ≥ 85 %, critical ≥ 95 % occupancy.
- Doctors: warning < 75 %, critical < 50 % attendance.
- Diagnostics: critical when unavailable or 0 kits; warning when < 3 days of kits.
- Footfall: warning when today is ≥ 1.3 × the previous 7-day mean.

Thresholds live in `THRESHOLDS` in `src/domain/risk.ts`.

## 3D network

`NetworkStage` detects WebGL via `useSyncExternalStore`, lazy-loads the R3F scene with `next/dynamic({ ssr:false })`, and falls back to an accessible 2D button map. Reduced motion switches the canvas to `frameloop="demand"` and disables easing/pulses. Node colour, shape and label all encode status (shape = type; label text = status) so severity is not colour-only.

The dark map uses an instanced dotted ground. On desktop, the attention/facility panel overlays the map; below 1024px it is mounted below it instead, avoiding duplicate panel IDs. White cards explicitly set their foreground colour so they remain readable inside the dark map.

## Operational insights

`src/domain/insights.ts` derives the stock-out watch, district medicine-consumption trends, trailing averages, week-over-week changes and centre-table rows from the shared district view. These are pure calculations, not AI output. The Overview presents countdowns and restock lead-time markers alongside history; Centres provides a sortable operational table; Transfers shows workflow stages and before/after coverage. Restock markers represent lead times, not confirmed purchase orders.
