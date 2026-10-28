# Moderation and ownership recovery runbook

## Administrator access

Administrators are normal persistent Supabase users whose verified UUID is also present in server-only `ADMIN_USER_IDS`. Anonymous users and user-editable metadata never grant administrator status. Use `/admin/sign-in`, then `/admin`.

Every content or entitlement action requires a reason and writes the administrator UUID, grave, action, reason, and timestamp to `moderation_log`. Do not put private report details, recovery keys, or billing information in the reason.

## Report handling

Reports use one signed visitor cookie, a purpose-specific hash, a five-per-hour limit, and Turnstile. The same browser/grave can have only one open report. Report count never hides a grave automatically.

1. Read the reported public content and the private reason/details.
2. If it is allowed, dismiss the report with a concise policy reason.
3. If review is incomplete or the content violates rules, hide the grave. Hiding retains its plot and owner access but removes text from every new public response/image.
4. Resolve or dismiss the report separately so its lifecycle is explicit.
5. Republish only after a human review. Owner edits while hidden do not publish it.
6. Delete only when terminal removal is appropriate. Deletion scrubs text, start year, owner, recovery hash, and flowers; the old URL is never reused or redirected to a new grave. Minimal payment records remain.

Check map, public detail, recent, random, and image endpoints after hide/delete. External shares or caches already held by third parties cannot be guaranteed removed.

## Ownership recovery

A recovery URL has the form `/recover#grave=<UUID>&key=<secret>`. The secret stays in the fragment, is read into memory, and is immediately removed from the address bar. A GET or page view does not transfer ownership.

The user must choose **Restore editing access**. The server then locks the grave, hashes and compares the supplied key, changes the owner to the currently verified anonymous session, rotates the recovery token, and increments the grave version in one transaction.

After success:

- the old recovery link is invalid;
- the prior browser owner cannot edit with its old user ID/version;
- the user must save the newly issued private link;
- any grave entitlement follows the grave, but receipts, purchaser email, and billing data do not;
- an unfinished checkout created by an earlier owner is not shown to the new owner and must be reconciled before a new checkout.

If the response is lost after the DB transaction, the new owner session can open the edit page and issue another recovery link. If both the browser session and link are lost, the initial release has no automatic recovery. Knowledge of the title or epitaph is not proof of ownership.

### Support response

Never ask a user to email or paste a recovery link. Ask only for the public grave URL and non-secret context. If they have neither their owner session nor recovery link, explain that automatic restoration is unavailable. Operator database edits must not be used to guess ownership.

## Entitlement suspension

Use suspension for a provider dispute or manual review. Record the reason. Ordinary paid-order synchronization must not clear `suspended`; only a reviewed administrator restore may do so. A hidden grave can retain an entitlement and its authenticated owner may privately download the keepsake. A deleted grave cannot generate any image.

Refunds are initiated in Polar and reconciled into the app. A full refund revokes the entitlement and returns the effective public design to Classic. A partial refund keeps the entitlement under the initial policy and enters review. See `payments.md` for duplicate/deleted/hidden order cases.
