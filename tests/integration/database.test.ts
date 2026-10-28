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

  async function insertAnonymousUser(id: string) {
    await pool.query(
      `insert into auth.users (
        instance_id, id, aud, role, encrypted_password,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000', $1, 'authenticated',
        'authenticated', '', '{}'::jsonb, '{}'::jsonb, now(), now(), true
      ) on conflict (id) do nothing`,
      [id],
    );
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
    await insertAnonymousUser(ownerA);
    await insertAnonymousUser(ownerB);
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
    await pool.query("delete from public.gardens where id = $1", [gardenId]);
    await pool.query("delete from auth.users where id = any($1::uuid[])", [[ownerA, ownerB]]);
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
  });
});

