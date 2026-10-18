# Evaluation Matrix

Factual mapping of criteria to evidence present in this repository. Items marked _planned_ are not yet implemented.

| Criterion | Evidence |
| --- | --- |
| **Code quality** | `strict` TS ([tsconfig.json](../tsconfig.json)); ESLint ([eslint.config.mjs](../eslint.config.mjs)); layered modules ([architecture.md](architecture.md)); pure domain logic in [src/domain](../src/domain); typed envelopes [src/lib/api/envelope.ts](../src/lib/api/envelope.ts) |
| **Security** | Server-side token verification [src/lib/auth/authenticate.ts](../src/lib/auth/authenticate.ts); capability map [src/lib/auth/roles.ts](../src/lib/auth/roles.ts); session scoping in [src/lib/data/firestore-repository.ts](../src/lib/data/firestore-repository.ts); default-deny [firestore.rules](../firestore.rules); Zod validation [src/domain/schemas.ts](../src/domain/schemas.ts); log redaction [src/lib/observability/logger.ts](../src/lib/observability/logger.ts); security headers [next.config.ts](../next.config.ts); local mode disabled in production (tested) |
| **Efficiency** | Bounded Firestore reads (`limit`), lazy-loaded WebGL, capped DPR, demand frameloop under reduced motion, standalone output |
| **Testing** | [tests/unit](../tests/unit) (risk, seed, auth, API handler); [tests/integration/api-routes.test.ts](../tests/integration/api-routes.test.ts) (auth, isolation, idempotent bootstrap); CI [.github/workflows/ci.yml](../.github/workflows/ci.yml). Emulator + Playwright tests: _planned_ |
| **Accessibility** | Skip link, semantic landmarks/headings, labelled controls, `aria-pressed` selection, 2D keyboard-operable network [district-network-2d.tsx](../src/components/district-3d/district-network-2d.tsx), reduced-motion CSS + JS, status icon + text (not colour-only) [status-badge.tsx](../src/components/ui/status-badge.tsx) |
| **Problem alignment** | Medicines, footfall, beds, doctors, diagnostics modelled and assessed [src/domain/risk.ts](../src/domain/risk.ts); district summary [src/domain/district.ts](../src/domain/district.ts). Forecasting, transfers, AI explanations, copilot: _planned (V2–V4)_ |
| **Google services** | Firestore + Firebase Auth (Admin + client SDK), Cloud Run-ready [Dockerfile](../Dockerfile), Cloud Logging-compatible JSON logs. Gemini: _planned (V3)_. Deployment: _not yet performed_ |
