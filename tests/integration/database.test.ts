import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type QueryResult } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Someday Cemetery Postgres invariants", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 12 });
  const gardenId = randomUUID();
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const createdGraves: string[] = [];
  const createdUsers = new Set<string>();

  async function insertUser(id: string, isAnonymous = true) {
    await pool.query(
      `insert into auth.users (
        instance_id, id, aud, role, encrypted_password,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000', $1, 'authenticated',
        'authenticated', '', '{}'::jsonb, '{}'::jsonb, now(), now(), $2
      ) on conflict (id) do nothing`,
      [id, isAnonymous],
    );
    createdUsers.add(id);
  }

  async function createGrave(input: {
    owner?: string;
    plot: number;
    idempotencyKey?: string;
    payloadHash?: string;
    recoveryHash?: string;
    title?: string;
  }): Promise<QueryResult<{ grave_id: string; grave_version: number; replayed: boolean }>> {
    const result = await pool.query(
      `select * from public.create_grave(
        $1::uuid, $2::uuid, $3::integer, $4::text, $5::text, $6::integer,
        $7::text, $8::text, $9::text, $10::text, $11::text
      )`,
      [
        input.owner ?? ownerA,
        gardenId,
        input.plot,
        input.title ?? `Integration ${input.plot}`,
        "A database test, quietly resting.",
        2026,
        "classic",
        "stone",
        input.recoveryHash ?? "a".repeat(64),
        input.idempotencyKey ?? randomUUID(),
        input.payloadHash ?? "b".repeat(64),
      ],
    );
    if (!result.rows[0].replayed) createdGraves.push(result.rows[0].grave_id);
    return result;
  }

  beforeAll(async () => {
    await insertUser(ownerA);
    await insertUser(ownerB);
    const ordinal = Number(BigInt(`0x${gardenId.replaceAll("-", "").slice(0, 7)}`)) + 10_000;
    await pool.query(
      `insert into public.gardens(id, ordinal, capacity, layout_version)
       values ($1, $2, 100, 1)`,
      [gardenId, ordinal],
    );
  });

  afterAll(async () => {
    if (createdGraves.length > 0) {
      await pool.query("delete from public.reports where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.moderation_log where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.flowers where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.grave_recovery where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.api_idempotency where resource_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.grave_entitlements where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query(
        `delete from public.payment_orders
         where purchase_intent_id in (
           select id from public.purchase_intents where grave_id = any($1::uuid[])
         )`,
        [createdGraves],
      );
      await pool.query("delete from public.purchase_intents where grave_id = any($1::uuid[])", [createdGraves]);
      await pool.query("delete from public.graves where id = any($1::uuid[])", [createdGraves]);
    }
    await pool.query("delete from public.api_idempotency where actor_id = any($1::uuid[])", [[...createdUsers]]);
    await pool.query("delete from public.rate_limit_buckets where action like 'integration-retention-%'");
    await pool.query("delete from public.gardens where id = $1", [gardenId]);
    await pool.query("delete from auth.users where id = any($1::uuid[])", [[...createdUsers]]);
    await pool.end();
  });

  it("replays the same idempotent create and rejects a changed payload", async () => {
    const key = randomUUID();
    const first = await createGrave({ plot: 1, idempotencyKey: key, payloadHash: "1".repeat(64) });
    const replay = await createGrave({ plot: 1, idempotencyKey: key, payloadHash: "1".repeat(64) });

    expect(replay.rows[0]).toMatchObject({
      grave_id: first.rows[0].grave_id,
      replayed: true,
    });
    await expect(
      createGrave({ plot: 2, idempotencyKey: key, payloadHash: "2".repeat(64) }),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  });

  it("allows only one concurrent claimant for a plot", async () => {
    const attempts = await Promise.allSettled([
      createGrave({ owner: ownerA, plot: 10, payloadHash: "3".repeat(64) }),
      createGrave({ owner: ownerB, plot: 10, payloadHash: "4".repeat(64) }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejection = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejection && String(rejection.reason)).toMatch(/PLOT_TAKEN/);
  });

  it("enforces optimistic versions and invalidates the old owner and recovery hash", async () => {
    const recoveryA = "5".repeat(64);
    const recoveryB = "6".repeat(64);
    const grave = (await createGrave({ plot: 20, recoveryHash: recoveryA, payloadHash: "7".repeat(64) })).rows[0];

    const updated = await pool.query<{ update_grave: number }>(
      `select public.update_grave($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [grave.grave_id, ownerA, grave.grave_version, "Updated title", "Still unfinished.", 2025, "classic", "stone", "sandbox"],
    );
    expect(updated.rows[0].update_grave).toBe(grave.grave_version + 1);
    await expect(
      pool.query(`select public.update_grave($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
        grave.grave_id, ownerA, grave.grave_version, "Stale", null, null, "classic", "stone", "sandbox",
      ]),
    ).rejects.toThrow(/VERSION_CONFLICT/);

    const restored = await pool.query<{ restore_grave_ownership: number }>(
      `select public.restore_grave_ownership($1,$2,$3,$4)`,
      [grave.grave_id, recoveryA, ownerB, recoveryB],
    );
    await expect(
      pool.query(`select public.update_grave($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
        grave.grave_id, ownerA, restored.rows[0].restore_grave_ownership,
        "Old owner", null, null, "classic", "stone", "sandbox",
      ]),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      pool.query(`select public.restore_grave_ownership($1,$2,$3,$4)`, [
        grave.grave_id, recoveryA, ownerA, "8".repeat(64),
      ]),
    ).rejects.toThrow(/RECOVERY_INVALID/);
  });

  it("counts simultaneous repeat flowers from one visitor only once", async () => {
    const grave = (await createGrave({ plot: 30, payloadHash: "9".repeat(64) })).rows[0];
    const visitorHash = "c".repeat(64);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        pool.query<{ flower_count: number; added: boolean }>(
          `select * from public.leave_flower($1,$2)`,
          [grave.grave_id, visitorHash],
        ),
      ),
    );
    expect(results.filter((result) => result.rows[0].added)).toHaveLength(1);
    expect(new Set(results.map((result) => result.rows[0].flower_count))).toEqual(new Set([1]));
  });

  it("fences periodic order reconciliation with the claimed lease token", async () => {
    const grave = (await createGrave({ plot: 40, payloadHash: "d".repeat(64) })).rows[0];
    const intent = await pool.query<{ intent_id: string }>(
      `select * from public.begin_purchase_intent($1,$2,'sandbox')`,
      [grave.grave_id, ownerA],
    );
    const intentId = intent.rows[0].intent_id;
    const providerOrderId = `order-${randomUUID()}`;
    const intentToken = randomUUID();
    await pool.query(
      `select * from public.claim_purchase_intent_reconciliation($1,'sandbox',$2,60)`,
      [intentId, intentToken],
    );
    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',$2,null,$3,'paid','product-test','organization-test',
        700,0,700,700,0,'USD',$4,'paid','active',false,null
      )`,
      [intentId, intentToken, providerOrderId, "2026-10-28T07:00:00Z"],
    );
    await pool.query("update public.graves set status = 'hidden' where id = $1", [grave.grave_id]);
    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'paid','product-test','organization-test',
        700,0,700,700,0,'USD',$3,'paid','active',false,null
      )`,
      [intentId, providerOrderId, "2026-10-28T07:15:00Z"],
    );
    const hiddenExisting = await pool.query<{ needs_review: boolean; status: string }>(
      `select o.needs_review, e.status
       from public.payment_orders o
       join public.grave_entitlements e on e.source_order_id = o.id
       where o.mode = 'sandbox' and o.provider_order_id = $1`,
      [providerOrderId],
    );
    expect(hiddenExisting.rows[0]).toEqual({ needs_review: false, status: "active" });
    await pool.query("update public.graves set status = 'published' where id = $1", [grave.grave_id]);
    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'partially_refunded','product-test','organization-test',
        700,0,700,700,100,'USD',$3,'review_required','active',true,'ORDER_PARTIALLY_REFUNDED'
      )`,
      [intentId, providerOrderId, "2026-10-28T07:30:00Z"],
    );
    const partialRefund = await pool.query<{ needs_review: boolean; status: string }>(
      `select o.needs_review, e.status
       from public.payment_orders o
       join public.grave_entitlements e on e.source_order_id = o.id
       where o.mode = 'sandbox' and o.provider_order_id = $1`,
      [providerOrderId],
    );
    expect(partialRefund.rows[0]).toEqual({ needs_review: true, status: "active" });
    await pool.query(
      `update public.payment_orders
       set last_synced_at = now() - interval '25 hours'
       where mode = 'sandbox' and provider_order_id = $1`,
      [providerOrderId],
    );

    const validOrderToken = randomUUID();
    const claimed = await pool.query<{ provider_order_id: string }>(
      `select * from public.claim_payment_order_reconciliation_jobs('sandbox',$1,20,60)`,
      [validOrderToken],
    );
    expect(claimed.rows.some((row) => row.provider_order_id === providerOrderId)).toBe(true);

    await expect(
      pool.query(
        `select public.apply_payment_order_state(
          $1,'sandbox',null,$2,$3,'partially_refunded','product-test','organization-test',
          700,0,700,700,100,'USD',$4,'review_required','active',true,'ORDER_PARTIALLY_REFUNDED'
        )`,
        [intentId, randomUUID(), providerOrderId, "2026-10-28T08:00:00Z"],
      ),
    ).rejects.toThrow(/RECONCILIATION_LEASE_LOST/);

    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,$2,$3,'partially_refunded','product-test','organization-test',
        700,0,700,700,100,'USD',$4,'review_required','active',true,'ORDER_PARTIALLY_REFUNDED'
      )`,
      [intentId, validOrderToken, providerOrderId, "2026-10-28T08:00:00Z"],
    );
    const released = await pool.query<{ reconcile_token: string | null }>(
      `select reconcile_token from public.payment_orders
       where mode = 'sandbox' and provider_order_id = $1`,
      [providerOrderId],
    );
    expect(released.rows[0].reconcile_token).toBeNull();
  });

  it("keeps a replacement entitlement active when the refunded old order is reconciled again", async () => {
    const grave = (await createGrave({ plot: 50, payloadHash: "e".repeat(64) })).rows[0];
    const oldIntent = await pool.query<{ intent_id: string }>(
      `select * from public.begin_purchase_intent($1,$2,'sandbox')`,
      [grave.grave_id, ownerA],
    );
    const oldIntentId = oldIntent.rows[0].intent_id;
    const oldProviderOrderId = `order-old-${randomUUID()}`;

    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'paid','product-test','organization-test',
        700,0,700,700,0,'USD',$3,'paid','active',false,null
      )`,
      [oldIntentId, oldProviderOrderId, "2026-10-28T09:00:00Z"],
    );
    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'refunded','product-test','organization-test',
        700,0,700,700,700,'USD',$3,'paid','revoked',false,'ORDER_FULLY_REFUNDED'
      )`,
      [oldIntentId, oldProviderOrderId, "2026-10-28T09:15:00Z"],
    );

    const newIntent = await pool.query<{ intent_id: string }>(
      `select * from public.begin_purchase_intent($1,$2,'sandbox')`,
      [grave.grave_id, ownerA],
    );
    const newIntentId = newIntent.rows[0].intent_id;
    const newProviderOrderId = `order-new-${randomUUID()}`;
    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'paid','product-test','organization-test',
        700,0,700,700,0,'USD',$3,'paid','active',false,null
      )`,
      [newIntentId, newProviderOrderId, "2026-10-28T09:30:00Z"],
    );

    await pool.query(
      `select public.apply_payment_order_state(
        $1,'sandbox',null,null,$2,'refunded','product-test','organization-test',
        700,0,700,700,700,'USD',$3,'paid','revoked',false,'ORDER_FULLY_REFUNDED'
      )`,
      [oldIntentId, oldProviderOrderId, "2026-10-28T09:45:00Z"],
    );

    const entitlement = await pool.query<{ status: string; provider_order_id: string }>(
      `select e.status, o.provider_order_id
       from public.grave_entitlements e
       join public.payment_orders o on o.id = e.source_order_id
       where e.grave_id = $1 and e.mode = 'sandbox'`,
      [grave.grave_id],
    );
    expect(entitlement.rows[0]).toEqual({
      status: "active",
      provider_order_id: newProviderOrderId,
    });
  });

  it("enforces operational, moderation, and anonymous-account retention windows", async () => {
    const orphanOld = randomUUID();
    const orphanRecent = randomUUID();
    const liveOwner = randomUUID();
    const paymentOwner = randomUUID();
    const permanentUser = randomUUID();
    await Promise.all([
      insertUser(orphanOld),
      insertUser(orphanRecent),
      insertUser(liveOwner),
      insertUser(paymentOwner),
      insertUser(permanentUser, false),
    ]);

    const liveGrave = (await createGrave({
      owner: liveOwner,
      plot: 70,
      payloadHash: "7".repeat(64),
    })).rows[0];
    const paymentGrave = (await createGrave({
      owner: paymentOwner,
      plot: 71,
      payloadHash: "8".repeat(64),
    })).rows[0];
    await pool.query(
      "select * from public.begin_purchase_intent($1,$2,'sandbox')",
      [paymentGrave.grave_id, paymentOwner],
    );
    await pool.query(
      "select public.delete_grave_and_scrub($1,$2,$3)",
      [paymentGrave.grave_id, paymentOwner, paymentGrave.grave_version],
    );

    await pool.query(
      `insert into private.anonymous_account_retention(user_id, empty_since)
       values
         ($1, now() - interval '91 days'),
         ($2, now() - interval '89 days'),
         ($3, now() - interval '91 days'),
         ($4, now() - interval '91 days'),
         ($5, now() - interval '91 days')
       on conflict (user_id) do update set empty_since = excluded.empty_since`,
      [orphanOld, orphanRecent, liveOwner, paymentOwner, permanentUser],
    );

    const expiredRateAction = `integration-retention-expired-${randomUUID()}`;
    const currentRateAction = `integration-retention-current-${randomUUID()}`;
    await pool.query(
      `insert into public.rate_limit_buckets(action, subject_hash, window_start, count, expires_at)
       values
         ($1, $3, now() - interval '2 days', 1, now() - interval '1 day'),
         ($2, $4, now(), 1, now() + interval '1 day')`,
      [expiredRateAction, currentRateAction, "1".repeat(64), "2".repeat(64)],
    );

    const expiredIdempotencyKey = `expired-${randomUUID()}`;
    const currentIdempotencyKey = `current-${randomUUID()}`;
    await pool.query(
      `insert into public.api_idempotency(
         actor_id, operation, key, payload_hash, resource_id, expires_at
       ) values
         ($1, 'retention-expired', $3, $5, $7, now() - interval '1 day'),
         ($2, 'retention-current', $4, $6, $8, now() + interval '1 day')`,
      [
        orphanOld,
        orphanRecent,
        expiredIdempotencyKey,
        currentIdempotencyKey,
        "3".repeat(64),
        "4".repeat(64),
        randomUUID(),
        randomUUID(),
      ],
    );

    const oldResolvedReport = randomUUID();
    const recentResolvedReport = randomUUID();
    const oldOpenReport = randomUUID();
    await pool.query(
      `insert into public.reports(
         id, grave_id, reporter_hash, reason, details, status, created_at, resolved_at
       ) values
         ($1, $4, $5, 'other', 'old resolved', 'resolved', now() - interval '2 years', now() - interval '366 days'),
         ($2, $4, $6, 'other', 'recent resolved', 'resolved', now() - interval '1 year', now() - interval '364 days'),
         ($3, $4, $7, 'other', 'old but open', 'open', now() - interval '2 years', null)`,
      [
        oldResolvedReport,
        recentResolvedReport,
        oldOpenReport,
        liveGrave.grave_id,
        "5".repeat(64),
        "6".repeat(64),
        "7".repeat(64),
      ],
    );

    const oldReportLog = randomUUID();
    const recentReportLog = randomUUID();
    await pool.query(
      `insert into public.moderation_log(
         id, admin_user_id, grave_id, action, reason, created_at
       ) values
         ($1, $3, $4, 'resolve_report', 'old report decision', now() - interval '366 days'),
         ($2, $3, $4, 'dismiss_report', 'recent report decision', now() - interval '364 days')`,
      [oldReportLog, recentReportLog, ownerA, liveGrave.grave_id],
    );

    await pool.query("select private.run_retention_cleanup(now())");

    const retainedRateLimits = await pool.query<{ action: string }>(
      "select action from public.rate_limit_buckets where action = any($1::text[])",
      [[expiredRateAction, currentRateAction]],
    );
    expect(retainedRateLimits.rows.map((row) => row.action)).toEqual([currentRateAction]);

    const retainedIdempotency = await pool.query<{ key: string }>(
      "select key from public.api_idempotency where key = any($1::text[])",
      [[expiredIdempotencyKey, currentIdempotencyKey]],
    );
    expect(retainedIdempotency.rows.map((row) => row.key)).toEqual([currentIdempotencyKey]);

    const retainedReports = await pool.query<{ id: string }>(
      "select id from public.reports where id = any($1::uuid[]) order by id",
      [[oldResolvedReport, recentResolvedReport, oldOpenReport]],
    );
    expect(new Set(retainedReports.rows.map((row) => row.id))).toEqual(
      new Set([recentResolvedReport, oldOpenReport]),
    );

    const retainedReportLogs = await pool.query<{ id: string }>(
      "select id from public.moderation_log where id = any($1::uuid[])",
      [[oldReportLog, recentReportLog]],
    );
    expect(retainedReportLogs.rows.map((row) => row.id)).toEqual([recentReportLog]);

    const retainedUsers = await pool.query<{ id: string }>(
      "select id from auth.users where id = any($1::uuid[])",
      [[orphanOld, orphanRecent, liveOwner, paymentOwner, permanentUser]],
    );
    expect(new Set(retainedUsers.rows.map((row) => row.id))).toEqual(
      new Set([orphanRecent, liveOwner, paymentOwner, permanentUser]),
    );

    const permanentMarker = await pool.query<{ count: string }>(
      "select count(*)::text from private.anonymous_account_retention where user_id = $1",
      [permanentUser],
    );
    expect(permanentMarker.rows[0].count).toBe("0");
  });

  it("starts and clears anonymous-account retention through ownership changes", async () => {
    const deletedOwner = randomUUID();
    const newOwner = randomUUID();
    const transferOwner = randomUUID();
    const recoveredOwner = randomUUID();
    await Promise.all([
      insertUser(deletedOwner),
      insertUser(newOwner),
      insertUser(transferOwner),
      insertUser(recoveredOwner),
    ]);

    const deletedGrave = (await createGrave({
      owner: deletedOwner,
      plot: 60,
      payloadHash: "8".repeat(64),
    })).rows[0];
    await pool.query(
      "select public.delete_grave_and_scrub($1,$2,$3)",
      [deletedGrave.grave_id, deletedOwner, deletedGrave.grave_version],
    );
    const deletionMarker = await pool.query<{ count: string }>(
      `select count(*)::text
       from private.anonymous_account_retention
       where user_id = $1 and empty_since > now() - interval '1 minute'`,
      [deletedOwner],
    );
    expect(deletionMarker.rows[0].count).toBe("1");

    await pool.query(
      `insert into private.anonymous_account_retention(user_id, empty_since)
       values ($1, now() - interval '91 days')`,
      [newOwner],
    );
    await createGrave({ owner: newOwner, plot: 61, payloadHash: "9".repeat(64) });
    const newOwnerMarker = await pool.query<{ count: string }>(
      "select count(*)::text from private.anonymous_account_retention where user_id = $1",
      [newOwner],
    );
    expect(newOwnerMarker.rows[0].count).toBe("0");

    const recoveryHash = "c".repeat(64);
    const recoveredHash = "d".repeat(64);
    const transferredGrave = (await createGrave({
      owner: transferOwner,
      plot: 62,
      recoveryHash,
      payloadHash: "a".repeat(64),
    })).rows[0];
    await pool.query(
      `insert into private.anonymous_account_retention(user_id, empty_since)
       values ($1, now() - interval '91 days')`,
      [recoveredOwner],
    );
    await pool.query(
      "select public.restore_grave_ownership($1,$2,$3,$4)",
      [transferredGrave.grave_id, recoveryHash, recoveredOwner, recoveredHash],
    );
    const transferMarkers = await pool.query<{ user_id: string }>(
      `select user_id
       from private.anonymous_account_retention
       where user_id = any($1::uuid[])`,
      [[transferOwner, recoveredOwner]],
    );
    expect(transferMarkers.rows.map((row) => row.user_id)).toEqual([transferOwner]);
  });

  it("keeps the fixed seed idempotent", async () => {
    const seed = await readFile(resolve(process.cwd(), "supabase/seed.sql"), "utf8");
    await pool.query(seed);
    await pool.query(seed);
    const result = await pool.query<{ count: string }>(
      `select count(*)::text from public.graves
       where id::text like '20000000-0000-4000-8000-%' and is_example = true`,
    );
    expect(result.rows[0].count).toBe("12");
  });

  it("denies every base table and internal RPC to browser roles", async () => {
    const tablesWithoutRls = await pool.query<{ object_name: string }>(
      `select c.relname as object_name
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind in ('r', 'p')
         and not c.relrowsecurity`,
    );
    expect(tablesWithoutRls.rows).toEqual([]);

    const tablePrivileges = await pool.query<{
      object_name: string;
      role_name: string;
      privilege_name: string;
    }>(
      `select c.relname as object_name, roles.role_name, privileges.privilege_name
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join (values ('anon'), ('authenticated')) as roles(role_name)
       cross join (
         values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
       ) as privileges(privilege_name)
       where n.nspname = 'public'
         and c.relkind in ('r', 'p')
         and has_table_privilege(roles.role_name, c.oid, privileges.privilege_name)`,
    );
    expect(tablePrivileges.rows).toEqual([]);

    const functionPrivileges = await pool.query<{ object_name: string; role_name: string }>(
      `select p.oid::regprocedure::text as object_name, roles.role_name
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       cross join (values ('anon'), ('authenticated')) as roles(role_name)
       where n.nspname = 'public'
         and has_function_privilege(roles.role_name, p.oid, 'EXECUTE')`,
    );
    expect(functionPrivileges.rows).toEqual([]);

    const privateSchemaPrivileges = await pool.query<{ role_name: string; privilege_name: string }>(
      `select roles.role_name, privileges.privilege_name
       from (values ('anon'), ('authenticated')) as roles(role_name)
       cross join (values ('USAGE'), ('CREATE')) as privileges(privilege_name)
       where has_schema_privilege(roles.role_name, 'private', privileges.privilege_name)`,
    );
    expect(privateSchemaPrivileges.rows).toEqual([]);

    const privateTablePrivileges = await pool.query<{
      object_name: string;
      role_name: string;
      privilege_name: string;
    }>(
      `select c.relname as object_name, roles.role_name, privileges.privilege_name
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join (values ('anon'), ('authenticated')) as roles(role_name)
       cross join (
         values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
       ) as privileges(privilege_name)
       where n.nspname = 'private'
         and c.relkind in ('r', 'p')
         and has_table_privilege(roles.role_name, c.oid, privileges.privilege_name)`,
    );
    expect(privateTablePrivileges.rows).toEqual([]);

    const privateFunctionPrivileges = await pool.query<{ object_name: string; role_name: string }>(
      `select p.oid::regprocedure::text as object_name, roles.role_name
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       cross join (values ('anon'), ('authenticated')) as roles(role_name)
       where n.nspname = 'private'
         and has_function_privilege(roles.role_name, p.oid, 'EXECUTE')`,
    );
    expect(privateFunctionPrivileges.rows).toEqual([]);

    const serviceRoleCleanupPrivilege = await pool.query<{ allowed: boolean }>(
      `select has_function_privilege(
         'service_role',
         'private.run_retention_cleanup(timestamptz)',
         'EXECUTE'
       ) as allowed`,
    );
    expect(serviceRoleCleanupPrivilege.rows[0].allowed).toBe(false);
  });
});

