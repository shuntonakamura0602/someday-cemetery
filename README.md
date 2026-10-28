# Someday Cemetery

Someday Cemetery is a quiet public garden for unfinished projects, drafts, and plans. Visitors can wander a 2D cemetery, read short epitaphs, and leave one flower from their browser. Creating, editing, sharing, and a 1200×630 memorial image are free. One **Custom Headstone** purchase—**US$7, once, for one grave**—unlocks three additional designs and a 2400×1260 keepsake.

The public UI is English. The source and operations documentation are written for maintainers.

## Connection status

These are separate deliverables and must not be reported as interchangeable:

| Path | Status in this checkout | What it means |
| --- | --- | --- |
| Local demo | Implemented; run the commands below to verify on this machine | Graves, ownership, flowers, recovery, and standard PNGs stay in browser storage. Examples are marked. Paid styles are preview-only. |
| Shared Supabase service | Connected to the dedicated `someday-cemetery` Preview project | The initial migration and idempotent seed are applied. Anonymous Auth and Supabase Auth CAPTCHA with Cloudflare Turnstile are enabled. The deployed app uses the shared database without a demo fallback. |
| Vercel Preview | Deployed at [someday-cemetery-preview.vercel.app](https://someday-cemetery-preview.vercel.app) with Vercel Authentication enabled | Preview-only environment variables are configured, `PAYMENTS_MODE=off`, and the deployment uses the shared Supabase project. Sign in to the owning Vercel account to open the protected URL. |
| Polar Sandbox | Integration and tests of pure payment state transitions are present; no Sandbox token, product, or webhook is connected | Checkout is intentionally disabled in Preview. Connect and verify Sandbox checkout, webhook, reconciliation, refund, and duplicate-delivery behavior before changing `PAYMENTS_MODE`. |
| Production / live payments | Not deployed; live payments are not configured | Keep `PAYMENTS_MODE=off` until production identity, support, monitoring, secrets, and live-payment verification are complete. |

The Preview, local demo, and Production are intentionally separate. The protected Preview is the current shared-service verification environment; it is not a Production release.

## Stack and fixed versions

- Next.js `16.4.3` App Router, React `19.3.1`, TypeScript `6.0.3`
- Tailwind CSS `4.3.3` plus application CSS and DOM/SVG garden components
- Supabase JS `2.118.0` and SSR `0.12.7`
- Polar TypeScript SDK `1.0.2`, pinned to API import `@polar-sh/sdk/2026-10`
- Zod `4.6.7`, Sharp `0.35.5`, Vitest `5.0.5`, Playwright `1.64.1`

All package versions are exact and `package-lock.json` is included in this checkout. Node.js 22 or newer is required; development used Node.js 24.

## Run the local demo

```sh
npm install
cp .env.example .env.local
npm run dev
```

The example defaults already select:

```dotenv
APP_STAGE=local
APP_BASE_URL=http://127.0.0.1:3000
DATA_BACKEND=demo
PAYMENTS_MODE=off
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). A permanent **“Demo — changes stay in this browser”** ribbon identifies the mode. Demo state is versioned in `localStorage`; an unfinished create form is kept in the tab’s `sessionStorage`. Clearing browser storage removes demo graves. The recovery link is never included in the draft.

Demo behavior includes:

- 100 stable plots, Map/List views, keyboard plot navigation, zoom/drag, and 12 marked Examples;
- local creation with idempotency, editing with optimistic versions, deletion, ownership recovery, flowers, random/recent visits, public-link copying, and 1200×630 PNG download;
- all four headstones as previews, while paid application and high-resolution download remain unavailable;
- responsive layouts including the 360px E2E project and reduced-motion styling.

## Modes and environment safety

Copy [`.env.example`](.env.example) and fill only the stage being run.

- `DATA_BACKEND=demo` is allowed only in `local` or `preview`, and requires `PAYMENTS_MODE=off`.
- `DATA_BACKEND=supabase` never falls back to browser demo when configuration or the database fails.
- `PAYMENTS_MODE=off` stops new Checkout creation. It does **not** change the entitlement environment or disable existing decorations, downloads, webhooks, or refund reconciliation.
- local/preview entitlement records use `sandbox`; production records use `live`.
- `PAYMENTS_MODE=sandbox` is rejected in production. `PAYMENTS_MODE=live` is rejected outside production.
- server secrets, recovery keys, billing data, and service keys must never use a `NEXT_PUBLIC_` name.

`APP_BASE_URL` must exactly match the origin visitors use. It is used for mutation origin checks and Polar callback URLs. Production must use HTTPS.

## Connect Supabase

Read [the database runbook](docs/runbooks/database.md) before applying anything.

1. Create an isolated Supabase project for the intended stage.
2. Use the installed Supabase CLI’s current `--help` output, link the correct project, and apply [`supabase/migrations/20261028160000_initial_schema.sql`](supabase/migrations/20261028160000_initial_schema.sql).
3. Apply [`supabase/seed.sql`](supabase/seed.sql). It uses fixed IDs and can be run repeatedly without multiplying Garden 1 or the 12 Examples.
4. Enable Anonymous Sign-Ins and Supabase Auth CAPTCHA/Turnstile. Browsing alone creates no Auth user; creation or explicit recovery does.
5. Set the Supabase URL, publishable key, and server secret. Generate independent cookie-signing and visitor-hash secrets.
6. Create persistent administrator users and place their verified UUIDs in `ADMIN_USER_IDS`. User-editable metadata is never an administrator source.
7. Set real `SUPPORT_EMAIL`, `OPERATOR_NAME`, and the canonical `APP_BASE_URL` before publication.
8. Run the integration checks against a disposable database, then inspect Supabase security/performance advisors.

All application tables have RLS enabled. `anon` and `authenticated` have no direct table CRUD or internal RPC execution. The Next.js server verifies the current Auth user, enforces ownership/allowlists, and uses the server key for explicit DTO queries and transaction RPCs. Anonymous users receive the Postgres `authenticated` role, so role membership alone is not authorization.

## Connect Polar Sandbox

Read [the payment runbook](docs/runbooks/payments.md). In summary:

1. Complete the shared Supabase setup first.
2. In Polar **Sandbox**, create the one-time `custom_headstone_v1` product at USD 700 cents, without coupons, adjustable quantity, or subscription behavior.
3. Configure a version `2026-10` raw webhook at `/api/webhooks/polar`, and set Sandbox token, product ID, and webhook secret.
4. Use an HTTPS tunnel as `APP_BASE_URL` for local hosted Checkout callbacks.
5. Set `PAYMENTS_MODE=sandbox`, schedule the protected reconciliation endpoint every five minutes, and execute every Sandbox acceptance check in the runbook.

The client never supplies product, price, or currency. A success URL is not proof of payment. The server persists a signature-verified raw webhook event, retrieves the current provider order, verifies metadata/product/USD 700 tax-exclusive terms/refunds/environment, and only then changes the grave entitlement.

## Important routes

Public experience:

- `/`, `/create`, `/g/[graveId]`
- `/about`, `/guidelines`, `/privacy`, `/terms`

Private or no-index experience:

- `/my-graves`, `/g/[graveId]/edit`, `/g/[graveId]/customize`
- `/recover`, `/checkout/result`
- `/admin/sign-in`, `/admin`

The API surface follows the specification under `src/app/api`. Public responses are explicit DTOs and `no-store`. Owner/admin responses are private and `no-store`. Recovery/admin pages use `noindex` and `Referrer-Policy: no-referrer`.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Optional checks:

```sh
# Uses a disposable Postgres database; explicitly skips when DATABASE_URL is absent
DATABASE_URL='postgresql://...' npm run test:integration

# Installs/uses Playwright browsers and starts a demo server
npx playwright install chromium
npm run test:e2e

# Optional Safari-family mobile project
npx playwright install webkit
npm run test:e2e:webkit
```

The repository’s automated coverage targets grapheme-aware input, NFC/LF normalization, contact-detail rejection, demo idempotency/version/recovery/flowers, payment configuration and order decisions, and real-Postgres constraints/concurrency/RLS. The current Preview has exercised the shared Supabase schema/seed, Anonymous Auth configuration, and Turnstile readiness. A public test post was not submitted. Safari and Polar provider behavior remain external checks until those environments are exercised.

Do not claim an LCP result without measuring and recording the device, browser, network, build, and URL. The target is 2.5 seconds, not a verified value in this checkout.

## Operations and publication

- [Database setup and recovery](docs/runbooks/database.md)
- [Payment, reconciliation, refund, and duplicate-charge handling](docs/runbooks/payments.md)
- [Moderation and ownership recovery](docs/runbooks/moderation-and-recovery.md)
- [Routine operations and release checklist](docs/runbooks/operations.md)
- [Assets and licenses](docs/assets-and-licenses.md)

Before a Production release, replace every placeholder with a real operator/contact/URL, define retention periods in the actual Privacy text, configure monitoring, verify backup restoration, and complete the external acceptance matrix. Configure the five-minute payment job only when Polar Sandbox/live payments are enabled. The current deployment is a Vercel-Authentication-protected Preview; Production resources and live charges remain disabled.
