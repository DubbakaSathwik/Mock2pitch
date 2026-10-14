// Local stand-in for Supabase security advisors: structural checks over the catalogs.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

const STUDENT_FNS = ["accept_policy", "check_can_practise", "has_accepted_latest_policy", "is_admin", "my_deck_detail", "my_decks", "my_dashboard_stats", "rate_report", "set_deck_pinned", "start_practice_session"];
const ADMIN_FNS = ["admin_ai_usage", "admin_list_students", "admin_overview", "admin_policy_versions", "admin_publish_policy", "admin_ratings", "admin_sessions_per_day", "admin_set_blocked", "admin_set_credit_limit", "admin_student_detail"];
const SERVICE_FNS = ["svc_ai_slot_states", "svc_begin_account_deletion", "svc_complete_deck_upload", "svc_finalize_report", "svc_finish_account_deletion", "svc_pending_deletions", "svc_touch_active"];

describe("function privileges", () => {
  it("anon can execute only the pure date helper", async () => {
    const r = await db.admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1");
    expect(r.rows.map((x) => x.proname)).toEqual(["ist_date"]);
  });
  it("authenticated can execute exactly the student + admin RPCs (and the date helper)", async () => {
    const r = await db.admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1");
    expect(r.rows.map((x) => x.proname).sort()).toEqual([...STUDENT_FNS, ...ADMIN_FNS, "ist_date"].sort());
  });
  it("service functions are executable by service_role only", async () => {
    for (const fn of SERVICE_FNS) {
      const r2 = await db.admin.query("select has_function_privilege('service_role', p.oid,'EXECUTE') s, has_function_privilege('authenticated', p.oid,'EXECUTE') a, has_function_privilege('anon', p.oid,'EXECUTE') n from pg_proc p where p.proname=$1", [fn]);
      expect(r2.rows[0], fn).toEqual({ s: true, a: false, n: false });
    }
  });
  it("the private schema is not usable by API roles", async () => {
    const r = await db.admin.query("select has_schema_privilege('anon','private','USAGE') a, has_schema_privilege('authenticated','private','USAGE') b, has_schema_privilege('service_role','private','USAGE') c");
    expect(r.rows[0]).toEqual({ a: false, b: false, c: true });
  });
});

describe("definer functions", () => {
  it("every SECURITY DEFINER function pins search_path (no search-path hijack)", async () => {
    const r = await db.admin.query(`select n.nspname||'.'||p.proname fn, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig::text ilike '%search_path=%', false)`);
    expect(r.rows).toEqual([]);
  });
  it("the read helpers that must respect RLS are SECURITY INVOKER", async () => {
    const r = await db.admin.query("select proname, prosecdef from pg_proc where proname in ('my_decks','my_deck_detail','my_dashboard_stats') order by 1");
    expect(r.rows.every((x) => x.prosecdef === false)).toBe(true);
  });
  it("no function builds dynamic SQL from inputs", async () => {
    const r = await db.admin.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc ~* '\\m(execute\\s+format|execute\\s+[a-z_]+\\s*\\|\\|)'");
    expect(r.rows).toEqual([]);
  });
});

describe("tables", () => {
  it("anon and authenticated hold no write privileges on any public table (except profiles column updates)", async () => {
    const r = await db.admin.query(`select table_name, privilege_type, grantee from information_schema.role_table_grants
      where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')`);
    expect(r.rows).toEqual([]);
    const cols = await db.admin.query(`select column_name from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE' order by 1`);
    expect(cols.rows.map((x) => x.column_name)).toEqual(["branch", "college", "full_name", "year"]);
  });
  it("anon can read nothing but policy_versions", async () => {
    const r = await db.admin.query("select table_name from information_schema.role_table_grants where table_schema='public' and grantee='anon' and privilege_type='SELECT' order by 1");
    expect(r.rows.map((x) => x.table_name)).toEqual(["policy_versions"]);
  });
  it("sensitive tables expose no grants to API roles at all", async () => {
    const r = await db.admin.query("select table_name from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('ai_key_slots','ai_usage_log','admin_actions') ");
    expect(r.rows).toEqual([]);
  });
  it("realtime publishes only decks and practice_sessions", async () => {
    const r = await db.admin.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1");
    expect(r.rows.map((x) => x.tablename)).toEqual(["decks", "practice_sessions"]);
  });
  it("every foreign-key column is indexed", async () => {
    const r = await db.admin.query(`
      select c.conrelid::regclass::text tbl, a.attname col from pg_constraint c
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum = c.conkey[1]
      where c.contype='f' and c.connamespace='public'::regnamespace and cardinality(c.conkey)=1
        and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])`);
    // policy_acceptances.policy_version_id, usage etc. are indexed; report anything that is not
    expect(r.rows).toEqual([]);
  });
});
