# nabz — Implementation Plan

District healthcare operations platform for PHCs and CHCs: stock, footfall, beds, staffing, diagnostics, cross-facility redistribution, explainable AI and a bilingual copilot.

**Single Cloud Run service** hosts Next.js (UI + route handlers). Firestore is the system of record and is accessed only server-side via the Admin SDK. Deterministic domain logic lives in `src/domain` and never depends on an LLM.

```
Browser ──(Firebase anon ID token)──▶ Route handler ─▶ authenticate() ─▶ session-scoped repository ─▶ Firestore
                                                   └▶ src/domain (risk, forecasting, redistribution) — pure, tested
```

---

## V1 — Foundation + premium UX ✅

**Scope:** skeleton, design system, 3D district network, Firebase-backed isolated demo sessions, security/observability foundations, Docker + CI.

- [x] Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4
- [x] Light clinical design system (`src/app/globals.css`), centralised branding (`src/config/brand.ts`)
- [x] Single-page Command Centre: plain-language summary, 4 key numbers, map, needs-attention list, facility panel, centre list
- [x] React Three Fiber district network: 12 facilities, status-coded nodes, footfall-height pillars, critical pulse, hover/select, camera focus, related-link highlighting
- [x] 2D accessible fallback (auto when WebGL missing, manual toggle), reduced-motion support, lazy-loaded 3D
- [x] Zod schemas for district/facility/medicine/diagnostics with invariants (occupied ≤ total, present ≤ scheduled)
- [x] Deterministic 30-day synthetic seed (`src/domain/seed.ts`) covering healthy / stock-out / bed / staffing / diagnostic / surplus profiles
- [x] Risk assessment (`src/domain/risk.ts`): 7-day moving average, days-of-cover vs lead time, bed/attendance/diagnostic thresholds
- [x] Firebase anonymous auth (client) + server-side ID-token verification; roles/capabilities resolved server-side
- [x] Session isolation: `demoSessions/{uid}/…`, transactional idempotent bootstrap from immutable seed template
- [x] Local no-Firebase mode (`npm run dev:local`), hard-disabled in production
- [x] API envelope, `AppError`, request IDs, structured JSON logs (Cloud Logging compatible), secret redaction
- [x] `/healthz` and `/api/health`
- [x] Default-deny `firestore.rules`
- [x] Multistage non-root Dockerfile (standalone output, `PORT=8080`)
- [x] GitHub Actions CI: lint, typecheck, tests, build, audit
- [x] Vitest: risk, seed, auth, API handler, route integration (38 tests)

**Endpoints:** `POST /api/session`, `GET /api/facilities`, `GET /healthz`, `GET /api/health`

**Known limitations / deferred:**
- [ ] Firebase Emulator-backed tests (rules + Firestore repository) — needs Java + firebase-tools in CI
- [ ] Playwright E2E (planned V4)
- [ ] Real Cloud Run deployment not yet performed
- Only anonymous demo identities are provisioned; admin/operator/viewer roles are defined but not issued
- Alerts are computed on read, not persisted

## V2 — Complete healthcare operations ✅

- [x] Visual identity: forest + mint palette, Bricolage Grotesque display type, "pulse" hero drawn from real 30-day district footfall, plain-language copy
- [x] Single mutation endpoint `POST /api/facilities/[id]/updates` (discriminated union: beds, attendance, footfall, stock receive/issue/count, diagnostic) — Zod-validated, 8 KB body cap, `facility:write` capability, transactional
- [x] Pure state transitions in `src/domain/operations.ts`; invariants enforced (no negative stock, occupied ≤ total, present ≤ scheduled); 422 `RULE_VIOLATION` on breach
- [x] Idempotency keys (`Idempotency-Key` header) stored per session; replays return the original result; key reuse for a different request → 409
- [x] Audit trail per facility (`facilities/{id}/audit`), inventory movements (`facilities/{id}/movements`)
- [x] Forecasting (`src/domain/forecast.ts`): 7-day moving average level, damped 14-day OLS trend, ±1.28σ typical range, safety stock = 1.65σ√lead, reorder point, suggested order (lead + 14 days), stock-out day projection (expected + pessimistic), footfall surge detection
- [x] Alerts derived deterministically from thresholds on every read (incl. new footfall surge signal)
- [x] Underperforming centres ranking (`rankStruggling`: 3 per critical + 1 per warning, tie-break attendance)
- [x] Facility drilldown `/facilities/[id]` + `GET /api/facilities/[id]`: Recharts patient history + 7-day outlook band, beds/doctors, medicines with days-left and reorder suggestion, tests, recent changes — all editable
- [x] Bounded reads: facilities `limit(50)`, audit `orderBy(at desc).limit(20)` (single-field indexes only; no composite indexes required)
- [x] Tests: forecast, operations, repository (idempotency, isolation, concurrent issues), facility route integration — 75 total
- [ ] Firestore emulator tests for transactions and rules (deferred: needs Java + firebase-tools)
- [ ] Persisted alert documents (alerts are recomputed on read instead; deterministic and always current)
- [ ] Long history beyond 90 days (history arrays are capped in the facility document; split into daily subcollections if needed)

**Endpoints added:** `GET /api/facilities/[id]`, `POST /api/facilities/[id]/updates`

## V3 — Cross-facility intelligence + explainability ✅

- [x] Donor matching (`src/domain/redistribution.ts`): donor reserve = forecast demand × (lead time + 14 days) + safety stock; receiver topped up to lead time + 7 days; nearest donor that covers the full shortfall wins; deterministic
- [x] Transfer workflow `proposed → approved (reserves stock) → dispatched (leaves donor) → received (arrives)`, cancel from proposed/approved releases reservation; transactional; idempotency keys; audit events on both centres
- [x] Explainable recommendation cards: receiver days-left before/after, donor days-left before/after, lead time, alternatives, partial-cover note
- [x] AI gateway (`src/lib/ai`): provider-agnostic `generateStructuredResponse`, Gemini (`@google/genai`, JSON schema) primary, Cerebras (OpenAI-compatible REST) fallback, per-call timeout, Zod validation, at most one attempt per provider, structured logs without content or keys
- [x] 3D map: approved transfers drawn dashed (planned), dispatched drawn solid (in transit); receipt is never implied
- [x] Tests: redistribution, lifecycle, repository idempotency/isolation/over-approval, gateway fallback matrix
- [ ] Resettable demo scenario fixtures (deferred)
- [ ] Firestore emulator concurrency tests (deferred)

**Endpoints added:** `POST /api/transfers`, `POST /api/transfers/[id]` (`approve` / `dispatch` / `receive` / `cancel`)

## V4 — Multilingual copilot + hardening (in progress)

- [x] Three tabs: Overview, Centres, Transfers; centre workspace at `/facilities/[id]`
- [x] Dark dotted map hero with responsive attention/facility panel; explicit light-card foreground prevents inherited white text
- [x] Operational KPI strip, stock-out countdown/runway watch with restock lead-time markers and transfer options
- [x] Historical patient analysis, rolling averages, week-over-week comparisons and medicine-consumption trends; pure insights regression tests
- [x] Searchable/filterable/sortable Centres table and Transfers KPI/workflow board with before/after coverage
- [x] Seven languages: English, Hindi, Bengali, Tamil, Telugu, Marathi, Kannada (`src/i18n`); every key and placeholder verified by tests; risk signals carry codes + params so they render in any language
- [x] "Ask nabz" copilot (`POST /api/assistant`): read-only, grounded in a bounded snapshot of the caller's own session, answers in the selected language, labels facts as recorded vs forecast
- [x] Anti-fabrication: AI answers rejected if they cite unknown centres or numbers absent from the grounding context; falls back to a deterministic localised answer when AI is off, slow or invalid
- [x] Abuse protection: 12 questions/minute per user, 2 KB request cap, prompt-injection fencing of the question
- [ ] Playwright critical paths (skipped for time)
- [ ] Cloud Run deployment + smoke verification

## Risks

| Risk | Mitigation |
| --- | --- |
| WebGL unsupported / low-end devices | 2D fallback, capped DPR, demand frameloop with reduced motion |
| Admin SDK bypasses rules | Every handler calls `authenticate()` and uses `principal.sessionId`; rules default-deny |
| AI outage | Deterministic results always returned; AI optional |
| Cloud Run reserves `/healthz` on `run.app` | `/api/health` alias |
