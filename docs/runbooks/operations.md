# Operations and release runbook

This runbook covers routine operation and publication. It does not authorize production deployment or live charges. Record each check with stage, date, operator, build/commit, and evidence.

## Stage matrix

| Stage | Data | New payments | Entitlements |
| --- | --- | --- | --- |
| Local demo | Browser only | `off` | No real entitlements; paid preview only |
| Local/preview shared | Isolated Supabase | `off` or `sandbox` | Sandbox |
| Production, free launch | Production Supabase | `off` | Live records remain readable/reconcilable |
| Production sales | Production Supabase | `live` | Live |

Never place Sandbox keys, products, events, or orders in production. Never place live keys or events in local/preview.

## Pre-release checklist

1. Run lint, typecheck, unit tests, production build, demo E2E, and disposable-Postgres integration tests.
2. Apply migrations from a clean database and run seed twice. Confirm one Garden 1 and 12 Examples.
3. Confirm `anon` and `authenticated` cannot read/write any application base table or execute internal RPCs.
4. Enable anonymous Auth and CAPTCHA. Test browsing without a user, create-time anonymous sign-in, another-browser recovery, old-key rejection, and old-owner rejection.
5. Configure Turnstile and test expired/invalid/used tokens and report limits.
6. Configure real `APP_BASE_URL`, `OPERATOR_NAME`, `SUPPORT_EMAIL`, cookie/visitor/cron secrets, and administrator UUIDs.
7. Review About, Guidelines, Privacy, and Terms against actual operator identity, providers, retention periods, refund process, and jurisdiction. Do not state unverified legal compliance.
8. Test 360px Chromium, current desktop Chromium, and Safari-family mobile for create, full reading, flower, copy, image download, and checkout reachability.
9. Verify public/owner/admin/recovery responses are not shared-cached. Hide a grave and confirm its text disappears from map, detail, recent, random, and public image.
10. Test backup restoration in a separate project and record recovery time.
11. Configure error monitoring without titles, epitaphs, recovery fragments, IPs, billing data, or secrets.
12. Measure LCP on a production build and record conditions. Do not mark the 2.5s goal complete without evidence.

For sales, additionally complete every Sandbox acceptance check in `payments.md`, repeat the environment-sensitive subset with separate live configuration, and obtain explicit authorization before setting `PAYMENTS_MODE=live`.

## Scheduled work

- Every five minutes: authenticated `POST /api/internal/reconcile-payments`, using `Authorization: Bearer <CRON_SECRET>`. Keep the bounded batch and DB leases.
- Within 24 hours: every active entitlement’s source order must be refreshed so refunds are found during webhook outages.
- Daily or bounded maintenance: remove expired rate-limit buckets and idempotency rows; retain unprocessed webhook events.
- According to the published retention policy: archive/prune processed operational records. Never remove order evidence required for refunds, disputes, or entitlement provenance.
- Regularly: Supabase database/security advisors, failed webhook/reconciliation queues, moderation backlog, backups, expiring credentials, error rate, and latency.

The application’s metrics table records aggregate operational events only. Do not add titles, epitaphs, recovery URLs, emails, or billing data. Examples, local demo, preview, and Sandbox do not count as production activity or revenue.

## Incident triage

### Shared database unavailable

1. Do not silently switch visitors to demo.
2. Return the explicit service-unavailable UI and preserve tab drafts.
3. Check provider status, credentials, quota, database health, migration state, and server logs without printing secrets.
4. Restore in a separate project if necessary, run security/integration checks, then change traffic deliberately.

### Secret or recovery data exposure

1. Stop the affected path and preserve a minimal audit trail.
2. Rotate the affected service/cookie/visitor/cron secrets and any exposed recovery link.
3. Invalidate sessions where supported; remember deleting a Supabase user does not itself invalidate already-issued access tokens.
4. Review logs, analytics, error reports, referrers, and caches for the exposure. Never copy the secret into the incident ticket.
5. Notify affected parties according to the real incident policy and applicable obligations.

### New payments must stop

Set `PAYMENTS_MODE=off`. Keep the Polar product/order identifiers, webhook secret, and reconciliation schedule so existing decorations and high-resolution images keep working and refunds continue to synchronize. Do not delete order or entitlement rows.

## Rollback and forward repair

Application releases may be rolled back to a previously verified build if its schema contract remains compatible. Database changes are repaired forward with a reviewed migration. Do not edit applied migration history or manually patch production without a matching repository migration.

After any incident or rollback, re-run a representative public read, owner mutation, recovery, flower uniqueness, admin action/audit log, image, and payment reconciliation check before closing the incident.
