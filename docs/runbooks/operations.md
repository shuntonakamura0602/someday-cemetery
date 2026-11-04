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
2. Enable Supabase Cron / `pg_cron`, apply migrations from a clean database, and run seed twice. Confirm one Garden 1 and 12 Examples. The retention migration must stop with `PG_CRON_REQUIRED` if Cron was not enabled.
3. Confirm `anon` and `authenticated` cannot read/write any application base table or execute internal RPCs.
4. Enable anonymous Auth and CAPTCHA. Test browsing without a user, create-time anonymous sign-in, another-browser recovery, old-key rejection, and old-owner rejection.
5. Configure Turnstile and test expired/invalid/used tokens and report limits.
6. Configure real `APP_BASE_URL`, `OPERATOR_NAME`, `SUPPORT_EMAIL`, cookie/visitor/cron secrets, and administrator UUIDs.
7. Review About, Guidelines, Privacy, and Terms in both English and Japanese against actual operator identity, providers, retention periods, refund process, and jurisdiction. Do not state unverified legal compliance.
8. Switch EN → 日本語 → EN on public, owner, recovery, and admin pages. Confirm the URL/query/hash and in-progress form draft are preserved, `<html lang>` and metadata change, user-written content is unchanged, and the preference survives a new tab.
9. Test 360px Chromium, current desktop Chromium, and Safari-family mobile for create, full reading, flower, copy, image download, and checkout reachability.
10. Download one standard memorial image in each language and inspect the Japanese glyphs. When external services are enabled, verify the Turnstile widget and Polar Checkout receive the selected locale.
11. Verify public/owner/admin/recovery responses are not shared-cached. Hide a grave and confirm its text disappears from map, detail, recent, random, and public image.
12. Test backup restoration in a separate project and record recovery time.
13. Configure error monitoring without titles, epitaphs, recovery fragments, IPs, billing data, or secrets.
14. Measure LCP on a production build and record conditions. Do not mark the 2.5s goal complete without evidence.

For sales, additionally complete every Sandbox acceptance check in `payments.md`, repeat the environment-sensitive subset with separate live configuration, and obtain explicit authorization before setting `PAYMENTS_MODE=live`.

## Scheduled work

- Every five minutes: authenticated `POST /api/internal/reconcile-payments`, using `Authorization: Bearer <CRON_SECRET>`. Keep the bounded batch and DB leases.
- Within 24 hours: every active entitlement’s source order must be refreshed so refunds are found during webhook outages.
- Daily at 03:17 UTC: the Supabase Cron job `someday-cemetery-retention` removes rate-limit and idempotency rows after `expires_at`, removes resolved/dismissed reports and their report-specific moderation logs after one year, and removes eligible anonymous accounts after 90 days without a live grave. Live owners and payment/moderation-referenced users are retained.
- Daily at 03:47 UTC: `someday-cemetery-cron-history-retention` removes Cron run history older than seven days.
- Recovery-token and flower hashes remain only while the corresponding grave exists; the grave-deletion transaction removes them and scrubs public text/ownership immediately.
- Retain unprocessed webhook events and all order evidence needed for refunds, disputes, reconciliation, or entitlement provenance.
- After database upgrades or `pg_cron` maintenance, confirm both named jobs are active and inspect their latest successful runs.
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
