# Database runbook

Someday Cemetery uses Supabase Postgres behind the Next.js server. Browser clients do not query base tables or call internal RPCs. The migration enables RLS on every application table, creates no browser policies, revokes `anon` and `authenticated` privileges, and grants the server-only RPCs to `service_role`.

## Before applying anything

1. Install the current official Supabase CLI using Supabase's documented method.
2. Run `supabase --version`, `supabase --help`, `supabase db --help`, and `supabase migration --help`. CLI commands and flags change; use the help text from the installed version as the authority.
3. Confirm that the intended project and stage are selected. Never point local or preview work at production.
4. Back up an existing database before applying migrations.

The repository contains:

- `supabase/migrations/20261028160000_initial_schema.sql` — schema, constraints, indexes, RLS, privileges, and transaction RPCs.
- `supabase/seed.sql` — Garden 1 and 12 fixed Example graves. It is safe to run more than once.

## Local rebuild

After checking the installed CLI's help, start the local Supabase stack and use its database reset command. A reset must apply all migrations followed by `supabase/seed.sql`. Verify that there is one garden with ordinal 1 and exactly 12 Example graves. Reset is destructive and must only target the local stack.

Enable anonymous sign-ins in local Auth configuration before exercising owner flows. Configure the same CAPTCHA provider that will be used by the hosted project; CAPTCHA tokens passed to anonymous sign-in must not be consumed a second time by application code.

## Hosted project

1. Create separate Supabase projects for preview and production, or otherwise guarantee strict key and data separation.
2. Link the CLI to the intended project only after confirming its project reference.
3. Inspect the linked migration list before pushing. Resolve drift instead of forcing history.
4. Apply migrations using the command shown by the current `supabase db --help` / migration help.
5. Apply `supabase/seed.sql` only when the Example records are wanted. Re-running it updates the fixed examples without multiplying them.
6. Run database advisors. Fix security and performance findings before public traffic.

Required dashboard settings:

- Enable Anonymous Sign-Ins.
- Enable Supabase Auth CAPTCHA / Turnstile for anonymous sign-in.
- Keep the publishable key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Keep the secret/server key in `SUPABASE_SECRET_KEY`; never expose it in a public bundle or `NEXT_PUBLIC_` variable.
- Add persistent administrator user UUIDs to `ADMIN_USER_IDS`. Do not authorize with user-editable metadata.
- Do not run generic anonymous-user cleanup against users that still own a live grave.

## Verification

Use a local or disposable test database, never production:

```sh
DATABASE_URL='postgresql://...' npm run test:integration
```

The integration suite skips when `DATABASE_URL` is absent. With a configured database it checks:

- idempotent create replay and mismatched-payload rejection;
- concurrent plot acquisition;
- optimistic version conflicts;
- recovery rotation and old-owner invalidation;
- concurrent duplicate flowers;
- active entitlement preservation for hidden graves and partial refunds;
- payment-order reconciliation lease fencing against stale workers;
- replacement entitlement preservation when an older refunded order is reconciled again;
- seed idempotency;
- RLS plus denied privileges on every application base table and internal RPC for `anon` and `authenticated`.

Also inspect privileges directly:

```sql
select has_table_privilege('anon', 'public.graves', 'select');
select has_table_privilege('authenticated', 'public.graves', 'select');
select has_function_privilege(
  'authenticated',
  'public.create_grave(uuid,uuid,integer,text,text,integer,text,text,text,text,text)',
  'execute'
);
```

All three results must be `false`. Use the secret server client for application access and re-check a representative public DTO endpoint rather than opening table access.

## Recovery and maintenance

- Restore from a verified backup into a separate project first, then run migrations and smoke tests there.
- Prune expired `rate_limit_buckets` and `api_idempotency` rows on a bounded schedule.
- Retain unprocessed webhook events. Archive or prune processed operational records only under the documented retention policy.
- Reconciliation workers use leases. A crashed worker is recoverable after the lease expires; do not manually mark jobs processed without checking the provider.
- A full refund revokes only the entitlement backed by that order. An old order event cannot revoke a later order's entitlement.
- `deleted` graves are terminal: text and recovery data are scrubbed, while minimal payment records remain for reconciliation and refund support.

If a migration fails, stop after the first failure. Record the exact migration and SQL error, confirm the target project, and repair forward with a reviewed migration. Do not edit migration history or manually patch production tables without a matching repository migration.
