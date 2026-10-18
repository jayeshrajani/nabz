# nabz

District healthcare operations intelligence for Primary and Community Health Centres (PHCs/CHCs). It tracks medicine stock, patient footfall, beds, doctor attendance and diagnostic availability, then flags which facilities need attention and why.

> **Status: V2 (operations).** All data is synthetic and fictional. See [plan.md](plan.md) for what is implemented and what is planned.

## What works today

- **District pulse:** a plain-language summary of who needs a hand, the district's 30-day patient "pulse", an interactive 3D map (with 2D fallback), and a ranking of the centres carrying the most weight
- **Facility workspace** (`/facilities/[id]`): patients with a 7-day outlook, beds, doctors, medicines with days-left and reorder suggestions, tests, and a log of recent changes
- **All five domains are editable:** stock received/used/counted, beds, attendance, today's patients, and test availability. Every change is validated, transactional, idempotent and audited
- **Deterministic forecasting and alerts** ([method](docs/architecture.md#forecasting-method-srcdomainforecastts)): no ML and no randomness, so the same history always gives the same forecast
- Isolated demo sessions: each anonymous visitor gets their own seeded dataset in Firestore
- Server-side auth, Zod validation, structured logs, health endpoint, Docker image, CI

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · React Three Fiber + Drei · Motion · Recharts · Zod · Firebase Auth + Firestore (Admin SDK) · Vitest · Cloud Run

## Run locally

```bash
npm install
npm run dev:local        # no Firebase needed: in-memory data + local session IDs (dev only)
```

With Firebase, copy `.env.example` to `.env.local`, fill in the values, enable **Anonymous** sign-in in Firebase Auth, then run `npm run dev`. Locally the Admin SDK uses `gcloud auth application-default login` or the emulators (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`).

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | public, build-time | Firebase web config (not secrets) |
| `FIREBASE_PROJECT_ID` | server | Admin SDK project (defaults to `GOOGLE_CLOUD_PROJECT`) |
| `AUTH_MODE=local`, `DATA_BACKEND=memory`, `NEXT_PUBLIC_AUTH_MODE=local` | dev only | No-Firebase mode; ignored when `NODE_ENV=production` |

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
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT
```

No service-account key file is needed; Cloud Run's identity provides Application Default Credentials. Smoke test with `curl $URL/api/health` (Cloud Run reserves `/healthz` on `run.app` domains). AI keys (V3+) go in Secret Manager via `--set-secrets`.

## Security

- All operational data goes through route handlers. Firestore rules deny all direct client access.
- ID tokens are verified server-side, and roles come from the server, never the client.
- Every read and write is scoped to the caller's session.
- Inputs and stored documents are validated with Zod. Error responses are generic and logs redact credentials.

## Known limitations

See [plan.md](plan.md#v1--foundation--premium-ux--awaiting-approval). Emulator and E2E tests, forecasting, transfers, AI and the copilot are not implemented yet.
