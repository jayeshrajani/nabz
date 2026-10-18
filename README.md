# nabz

District healthcare operations intelligence for Primary and Community Health Centres (PHCs/CHCs). It tracks medicine stock, patient footfall, beds, doctor attendance and diagnostic availability, then flags which facilities need attention and why.

> **Status: V3 complete, V4 in progress.** The district is Bhopal and centres are named after real Bhopal localities, but every figure is synthetic sample data. See [plan.md](plan.md) for what is implemented and what is planned.

## What works today

- **Three tabs:** Overview (inline AI greeting, patient gauge, centre health matrix, dark dotted district map with a facility/attention panel, operational KPIs, stock-out watch, historical analysis and most-burdened centres), Centres (searchable, filterable, sortable operations table), Transfers (KPIs, workflow board and suggestions with before/after coverage)
- **Stock-out watch:** urgent countdowns, stock runway bars, restock lead-time markers and available transfer options; historical analysis shows patient trends, rolling averages, week-over-week changes and medicine consumption
- **Seven languages:** English, हिन्दी, বাংলা, தமிழ், తెలుగు, मराठी, ಕನ್ನಡ, switchable from the header; risk alerts are rendered from codes so they translate too
- **Ask nabz:** a chat assistant that answers questions about the district in the selected language, using only your session's data; Gemini first, Cerebras fallback, and a computed answer if AI is unavailable
- **Cross-centre transfers:** nabz pairs centres about to run out with centres that can safely spare stock, explains why, and runs a human-approved workflow (approve holds stock, dispatch removes it, receipt adds it)
- **Facility workspace** (`/facilities/[id]`): patients with a 7-day outlook, beds, doctors, medicines with days-left and reorder suggestions, tests, and a log of recent changes; all five domains editable
- **Deterministic forecasting and alerts** ([method](docs/architecture.md#forecasting-method-srcdomainforecastts)): no ML and no randomness, so the same history always gives the same forecast
- Isolated demo sessions: each anonymous visitor gets their own seeded dataset in Firestore
- Server-side auth, Zod validation, idempotency keys, audit trail, rate limiting, structured logs, health endpoint, Docker image, CI

## Problem statement → feature map

| Requirement                                                         | Where it lives                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock monitoring + early stock-out warnings                         | [src/domain/risk.ts](src/domain/risk.ts), Stock-out watch on Overview                                                                                                                                                                                                 |
| Patient footfall, beds, doctor attendance, test availability audits | Facility workspace `/facilities/[id]`, every update audited ([src/domain/operations.ts](src/domain/operations.ts))                                                                                                                                                    |
| AI-driven demand forecasts                                          | [src/domain/forecast.ts](src/domain/forecast.ts) (deterministic) + Ask nabz (Gemini, grounded)                                                                                                                                                                        |
| Smart redistribution across PHCs/CHCs                               | [src/domain/redistribution.ts](src/domain/redistribution.ts), Transfers tab with human approval                                                                                                                                                                       |
| Auto-flag underperforming / under-resourced centres                 | [src/domain/interventions.ts](src/domain/interventions.ts): each flagged centre is classed as underperforming or under-resourced (including patients per doctor), given a priority and a recommended action; shown on Overview as "Flagged for district intervention" |
| Multilingual                                                        | 7 languages in [src/i18n](src/i18n), completeness enforced by tests                                                                                                                                                                                                   |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · React Three Fiber + Drei · Motion · Recharts · Zod · Firebase Auth + Firestore (Admin SDK) · Gemini (`@google/genai`) · Cerebras · Vitest · Cloud Run

## Run locally

```bash
npm install
npm run dev:local        # no Firebase needed: in-memory data + local session IDs (dev only)
```

With Firebase, copy `.env.example` to `.env.local`, fill in the values, enable **Anonymous** sign-in in Firebase Auth, then run `npm run dev`. Locally the Admin SDK uses `gcloud auth application-default login` or the emulators (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`).

## Checks

```bash
npm run check && npm run build   # format check, zero-warning lint, strict typecheck, tests, build
```

## Environment

| Variable                                                                 | Scope              | Purpose                                                |
| ------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | public, build-time | Firebase web config (not secrets)                      |
| `FIREBASE_PROJECT_ID`                                                    | server             | Admin SDK project (defaults to `GOOGLE_CLOUD_PROJECT`) |
| `AUTH_MODE=local`, `DATA_BACKEND=memory`, `NEXT_PUBLIC_AUTH_MODE=local`  | dev only           | No-Firebase mode; ignored when `NODE_ENV=production`   |
| `GEMINI_API_KEY`, `GEMINI_MODEL`                                         | server secret      | Primary AI provider (both required to enable)          |
| `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`                                     | server secret      | Fallback AI provider                                   |
| `AI_PRIMARY_PROVIDER`                                                    | server             | `gemini` (default) or `cerebras`                       |
| `AI_REQUEST_TIMEOUT_MS`                                                  | server             | Per-provider timeout, 1000-60000 (default 12000)       |

Without AI keys the assistant still works, returning computed answers built directly from the data.

## Deploy to Cloud Run

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com
gcloud firestore databases create --location=asia-south1
firebase deploy --only firestore:rules,firestore:indexes

# Service account needs roles/datastore.user and roles/firebaseauth.viewer
gcloud iam service-accounts create nabz-run
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:nabz-run@$PROJECT.iam.gserviceaccount.com --role=roles/datastore.user
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:nabz-run@$PROJECT.iam.gserviceaccount.com --role=roles/firebaseauth.viewer

docker build -t $REGION-docker.pkg.dev/$PROJECT/app/nabz \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... .
docker push $REGION-docker.pkg.dev/$PROJECT/app/nabz
gcloud run deploy nabz --image $REGION-docker.pkg.dev/$PROJECT/app/nabz --region $REGION \
  --service-account nabz-run@$PROJECT.iam.gserviceaccount.com --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT,GEMINI_MODEL=$GEMINI_MODEL,CEREBRAS_MODEL=$CEREBRAS_MODEL \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,CEREBRAS_API_KEY=cerebras-api-key:latest
```

No service-account key file is needed; Cloud Run's identity provides Application Default Credentials. Smoke test with `curl $URL/api/health` (Cloud Run reserves `/healthz` on `run.app` domains). Create the two secrets first with `gcloud secrets create ... --data-file=-` and grant the service account `roles/secretmanager.secretAccessor`.

## Security

- All operational data goes through route handlers. Firestore rules deny all direct client access.
- ID tokens are verified server-side, and roles come from the server, never the client.
- Every read and write is scoped to the caller's session.
- Inputs and stored documents are validated with Zod; JSON bodies require `application/json` and are size-capped (413). Error responses are generic and logs redact credentials recursively, including bearer tokens and API keys inside messages.
- Content-Security-Policy, HSTS, COOP, `X-Frame-Options: DENY`, `nosniff` and a locked-down Permissions-Policy are sent on every response ([next.config.ts](next.config.ts)).
- Local no-Firebase mode fails closed: it only activates when `NODE_ENV` is explicitly `development` or `test`.
- AI is read-only: it sees a bounded snapshot of the caller's own session, cannot mutate data, and its answers are rejected if they cite numbers or centres that are not in that snapshot. Questions are rate limited and fenced as data, not instructions.
- Consequential actions (transfers) need explicit human approval at each step and are idempotent and audited.

## Known limitations

- Firestore emulator tests and Playwright end-to-end tests are not yet written; the in-memory repository is tested instead.
- The rate limiter is per instance (adequate for one small Cloud Run service).
- Only anonymous demo identities are provisioned; other roles are defined but not issued.
- Cloud Run deployment has not been verified yet.
