# PROJECT_NAME — Implementation Plan

District healthcare operations platform for PHCs and CHCs: stock, footfall, beds, staffing, diagnostics, cross-facility redistribution, explainable AI and a bilingual copilot.

**Single Cloud Run service** hosts Next.js (UI + route handlers). Firestore is the system of record and is accessed only server-side via the Admin SDK. Deterministic domain logic lives in `src/domain` and never depends on an LLM.

```
Browser ──(Firebase anon ID token)──▶ Route handler ─▶ authenticate() ─▶ session-scoped repository ─▶ Firestore
                                                   └▶ src/domain (risk, forecasting, redistribution) — pure, tested
```

---

## V1 — Foundation + premium UX ✅ (awaiting approval)

**Scope:** skeleton, design system, 3D district network, Firebase-backed isolated demo sessions, security/observability foundations, Docker + CI.

- [x] Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4
- [x] Design tokens (`src/app/globals.css`), centralised branding (`src/config/brand.ts`)
- [x] Responsive shell + Command Centre (KPI strip, alerts, facility panel, searchable/filterable directory)
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

## V2 — Complete healthcare operations

- [ ] Split history into subcollections (`inventoryMovements`, `dailyMetrics`, `attendance`, `diagnosticAudits`) with bounded, indexed queries
- [ ] Mutation endpoints per domain (stock movement, footfall entry, bed update, attendance, diagnostic audit) — Zod-validated, capability-checked, transactional, audited
- [ ] Forecasting module: moving average + optional trend, variability band (±σ), reorder point = avg × lead + safety stock, footfall forecast
- [ ] Persisted alerts with thresholds; underperforming-facility ranking
- [ ] Recharts operational charts; facility drilldown route `/facilities/[id]`
- [ ] Emulator integration tests for transactions and rules
- **Done when:** all five domains editable, persisted, reflected in dashboard; forecasts reproducible; invalid inputs rejected

## V3 — Cross-facility intelligence + explainability

- [ ] Donor matching: surplus = stock − (avg × (lead + reserve days)); proximity score from network distance
- [ ] Transfer workflow `proposed → approved (reserves stock) → dispatched → received`, cancel where valid; idempotency keys; Firestore transactions; audit events
- [ ] Explainable recommendation cards with evidence references
- [ ] AI gateway (`generateStructuredResponse`) — Gemini primary, Cerebras fallback, timeout, Zod-validated output, deterministic fallback text
- [ ] 3D: active transfer relationships (pending ≠ delivered)
- [ ] Resettable demo scenario fixtures applied via normal mutation paths
- [ ] Concurrency + duplicate-transfer tests
- **Done when:** hero transfer flow works end to end with reserves enforced and audit trail

## V4 — Multilingual copilot + hardening

- [ ] Read-only copilot (EN/HI) over bounded, session-scoped grounding context; facts vs forecasts labelled
- [ ] Rate limiting for AI endpoints, input size limits
- [ ] Playwright critical paths; accessibility audit; mobile polish; performance pass
- [ ] Cloud Run deployment + smoke verification; final README and evaluation evidence

## Risks

| Risk | Mitigation |
| --- | --- |
| WebGL unsupported / low-end devices | 2D fallback, capped DPR, demand frameloop with reduced motion |
| Admin SDK bypasses rules | Every handler calls `authenticate()` and uses `principal.sessionId`; rules default-deny |
| AI outage | Deterministic results always returned; AI optional |
| Cloud Run reserves `/healthz` on `run.app` | `/api/health` alias |
