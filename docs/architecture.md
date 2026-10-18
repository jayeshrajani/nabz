# Architecture

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| UI | `src/app`, `src/components`, `src/features` | Rendering, interaction, client state only |
| API | `src/app/api/**/route.ts`, `src/lib/api` | Authenticate, authorise, validate, call domain/repository, envelope responses |
| Auth | `src/lib/auth` | ID-token verification, role → capability mapping, session scoping |
| Domain | `src/domain` | Pure, deterministic calculations (risk, summary, seed). No I/O |
| Persistence | `src/lib/data` | `DistrictRepository` interface; Firestore and in-memory implementations |
| Observability | `src/lib/observability`, `src/lib/errors` | JSON logs, request IDs, safe error mapping |

## Request flow

1. Client signs in anonymously with Firebase Auth and sends `Authorization: Bearer <idToken>`.
2. `apiHandler` assigns a request ID, times the call and converts errors into `{ ok:false, error, requestId }`.
3. `authenticate()` verifies the token with the Admin SDK. Anonymous users become `demo_user` with `sessionId = uid`. Client-sent roles are never trusted.
4. The repository reads/writes only under `demoSessions/{sessionId}`.
5. Domain functions compute assessments; the response is returned with `cache-control: no-store`.

## Firestore layout (V1)

```
demoSessions/{sessionId}                 District { id, name, synthetic: true, historyEndDate, createdAt }
demoSessions/{sessionId}/facilities/{id} Facility (see src/domain/schemas.ts)
```

Reads are bounded (`limit(50)`) and each document is validated with Zod before use. Session bootstrap runs inside a transaction so concurrent first requests cannot double-seed.

## Risk method (V1)

- Average daily consumption = mean of the last 7 recorded days (requires ≥ 3 days; otherwise "insufficient history").
- Days of cover = stock ÷ average. Zero consumption → unlimited.
- Medicine **critical** if stock is 0 or cover < lead time; **warning** if stock ≤ reorder level or cover < 2 × lead time.
- Beds: warning ≥ 85 %, critical ≥ 95 % occupancy.
- Doctors: warning < 75 %, critical < 50 % attendance.
- Diagnostics: critical when unavailable or 0 kits; warning when < 3 days of kits.

Thresholds live in `THRESHOLDS` in `src/domain/risk.ts`.

## 3D network

`NetworkStage` detects WebGL via `useSyncExternalStore`, lazy-loads the R3F scene with `next/dynamic({ ssr:false })`, and falls back to an accessible 2D button map. Reduced motion switches the canvas to `frameloop="demand"` and disables easing/pulses. Node colour, shape and label all encode status (shape = type; label text = status) so severity is not colour-only.
