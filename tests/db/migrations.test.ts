import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

describe("migrations", () => {
  it("apply cleanly on an empty database and seed the 9 key slots + policy v1.0", async () => {
    const slots = await db.admin.query("select purpose, slot from public.ai_key_slots order by 1,2");
    expect(slots.rowCount).toBe(9);
    const v = await db.admin.query("select version_label from public.policy_versions");
    expect(v.rows).toEqual([{ version_label: "v1.0" }]);
  });
  it("RLS is enabled on every public table", async () => {
    const r = await db.admin.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
    expect(r.rows).toEqual([]);
  });
});
