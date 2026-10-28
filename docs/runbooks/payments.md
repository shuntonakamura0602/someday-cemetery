# Payment operations runbook

Someday Cemetery sells one product: **Custom Headstone** (`custom_headstone_v1`), a one-time purchase for one grave. The application accepts only the server-configured Polar product and verifies a tax-exclusive amount of USD 700 cents before granting an entitlement.

This repository contains the integration, but it is not connected until a real Polar Sandbox organization, product, token, and webhook secret are configured and an end-to-end Sandbox purchase has been verified. Never treat the local demo as a successful purchase.

## Environment separation

`PAYMENTS_MODE` controls only new checkout creation:

- `off`: do not create checkouts. Existing entitlements, high-resolution downloads, webhooks, and refund reconciliation continue to use the entitlement environment.
- `sandbox`: allowed only when `APP_STAGE` is `local` or `preview`.
- `live`: allowed only when `APP_STAGE` is `production`.

The entitlement environment is derived separately: production reads `live`; local and preview read `sandbox`. Sandbox and live rows are separated by the `mode` column. Never reuse tokens, products, orders, or webhook endpoints between them.

Required server settings for Sandbox:

```dotenv
APP_STAGE=local
DATA_BACKEND=supabase
PAYMENTS_MODE=sandbox
APP_BASE_URL=https://your-tunnel.example
POLAR_ACCESS_TOKEN=...
POLAR_PRODUCT_ID=...
POLAR_WEBHOOK_SECRET=...
CRON_SECRET=...
```

`POLAR_PRODUCT_ID` must be a one-time USD 7 product. Disable discount codes, coupons, adjustable quantity, and subscriptions in Polar. The app also forces `allow_discount_codes: false`, does not accept a client product or amount, and verifies the resulting order again.

## Initial Sandbox connection

1. Apply the database migration and seed before receiving webhooks.
2. In Polar Sandbox, create the one-time Custom Headstone product for USD 7 and copy its ID.
3. Create an organization access token with checkout and order read/write scopes required by the integration.
4. Configure a raw webhook endpoint at `https://<APP_BASE_URL>/api/webhooks/polar`, pinned to API version `2026-10`. Subscribe to order creation, payment, update, and refund events. The application verifies `webhook-id`, `webhook-timestamp`, and `webhook-signature` against the untouched request body.
5. Store the token and signing secret only in server environment variables. Do not use `NEXT_PUBLIC_` variables.
6. Schedule `POST /api/internal/reconcile-payments` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The worker processes a bounded batch. The DB claim also makes paid orders eligible for periodic verification so active orders are refreshed within 24 hours.
7. Complete the Sandbox acceptance checks below. Keep production at `PAYMENTS_MODE=off` until live keys and the same checks are complete.

Polar's CLI can forward and trigger Sandbox webhooks during local development (`polar webhook listen` and `polar webhook trigger`). Use the CLI's `--help` output for the installed version rather than copying stale flags.

## Acceptance checks

Record the order, grave, and intent IDs without copying customer email or billing details into application logs.

1. **Normal purchase**: as the grave owner, start Checkout, pay USD 7 in Sandbox, and wait for the verified webhook/order lookup. Confirm the three paid designs and 2400×1260 download unlock only after reconciliation.
2. **Success URL is not authority**: open `/checkout/result?intent=<id>` directly. Confirm no entitlement is created.
3. **Browser never returns**: complete Checkout, close the browser before redirect, and confirm the webhook alone grants the entitlement.
4. **Duplicate delivery**: redeliver the same webhook concurrently. Confirm one `(mode, provider_event_id)`, one order, and one grave entitlement.
5. **Bad signature**: alter the body or signature. Confirm HTTP 403 and no order or entitlement change.
6. **Checkout timeout**: interrupt Checkout creation. Confirm the intent becomes `unknown` and another Checkout is not issued until reconciliation resolves it.
7. **Full refund**: refund the complete net amount in Polar. Confirm reconciliation changes the entitlement to `revoked` and effective style returns to `classic`.
8. **Partial refund**: partially refund. Confirm the entitlement remains active and the order is marked for operator review.
9. **Duplicate charge**: produce a second paid order for one grave. Confirm there is still one entitlement and the extra order is `review_required` for a refund decision.
10. **Deleted/hidden grave**: complete an old Checkout after deletion or hiding. Confirm the grave is not republished; the order enters review.
11. **Ownership restoration**: restore the grave to a new anonymous owner. Confirm active decoration remains on the grave, but no prior purchaser email, receipt, or billing data is returned.
12. **Environment mix-up**: send a Sandbox event to production. Confirm it cannot create a live entitlement.
13. **Suspension**: suspend an entitlement in admin, then reconcile a paid order. Confirm ordinary synchronization does not clear the suspension.
14. **Webhook outage**: stop delivery, refund an order, and run reconciliation. Confirm the refund is found without a webhook.

## Review queues and recovery

`purchase_intents.status = review_required`, `payment_orders.needs_review = true`, and failed/expired webhook leases form the operator queues.

- `unknown`: query the existing Polar Checkout; do not automatically create another one.
- `DUPLICATE_PAID_ORDER`: keep one entitlement and review/refund the additional order in Polar.
- `GRAVE_DELETED_BEFORE_FULFILLMENT`: do not restore the grave; review/refund in Polar.
- `HIDDEN_GRAVE_PAID_BEFORE_FULFILLMENT`: do not publish automatically; decide fulfillment or refund manually.
- `ORDER_PARTIALLY_REFUNDED`: keep the entitlement under the initial policy and review the partial refund.
- `ENTITLEMENT_MANUALLY_SUSPENDED`: only an administrator may clear the suspension.
- webhook `failed`: leave it retryable. A lease expiry permits another worker to claim it; do not mark it processed by hand before the order state is applied.

Refunds are initiated in Polar, not this application. After any manual provider action, run reconciliation and confirm the local order and entitlement. Never infer cancellation from the browser's back button.

## Incident checklist

When a purchaser reports a missing design:

1. Find the grave's intent and order by internal IDs, without exposing billing data to the current grave owner.
2. Check the intent status, webhook record, lease expiration, and last error code.
3. Fetch the latest order through the protected recheck or cron endpoint.
4. Confirm mode, product, currency, USD 700 subtotal/net amount, zero discount, metadata binding, grave status, and refund amount.
5. If uncertain or duplicated, keep the entitlement conservative and place the order in review. Do not issue another Checkout.

When stopping new sales, set `PAYMENTS_MODE=off`; do not delete product IDs, webhook secrets, reconciliation scheduling, or order records needed to preserve purchased features and detect refunds.
