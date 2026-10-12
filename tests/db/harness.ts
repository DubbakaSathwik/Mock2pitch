// Real-Postgres harness: each suite gets a fresh database with a Supabase stand-in + all migrations applied.
import { Client, Pool } from "pg";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/postgres";
const root = path.resolve(__dirname, "../..");

export type Db = {
  name: string;
  admin: Pool; // superuser connection pool (bypasses RLS) - for setup/inspection only
  asUser: <T>(uid: string | null, fn: (c: Client) => Promise<T>, role?: "authenticated" | "anon" | "service_role") => Promise<T>;
  q: (uid: string | null, sql: string, params?: unknown[], role?: "authenticated" | "anon" | "service_role") => Promise<any[]>;
  close: () => Promise<void>;
  makeUser: (email: string, opts?: { confirmed?: boolean; name?: string }) => Promise<string>;
};

export async function createDb(opts: { seed?: boolean; ownerEmail?: string | null } = {}): Promise<Db> {
  const name = `m2p_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const root_ = new Client({ connectionString: BASE });
  await root_.connect();
  await root_.query(`create database ${name}`);
  await root_.end();
  const url = BASE.replace(/\/[^/]*$/, `/${name}`);
  const admin = new Pool({ connectionString: url, max: 10 });

  await admin.query(fs.readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try { await admin.query(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { throw new Error(`migration ${f} failed: ${(e as Error).message}`); }
  }
  if (opts.ownerEmail !== null) {
    await admin.query("insert into private.owner_allowlist(email) values ($1)", [opts.ownerEmail ?? "owner@mock2pitch.test"]);
  }

  const asUser: Db["asUser"] = async (uid, fn, role) => {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query("begin");
      const r = role ?? (uid ? "authenticated" : "anon");
      await c.query(`set local role ${r}`);
      if (uid) await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: r })]);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      await c.end();
    }
  };

  return {
    name, admin, asUser,
    q: (uid, sql, params, role) => asUser(uid, async (c) => (await c.query(sql, params as any[])).rows, role),
    close: async () => {
      await admin.end();
      const c = new Client({ connectionString: BASE });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
    makeUser: async (email, o = {}) => {
      const r = await admin.query(
        "insert into auth.users(email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id",
        [email, o.confirmed === false ? null : new Date(), JSON.stringify({ full_name: o.name ?? email.split("@")[0], picture: "https://example.test/p.png" })],
      );
      return r.rows[0].id as string;
    },
  };
}

/** Expect a SQL error whose message is exactly the given code. */
export async function expectCode(p: Promise<unknown>, code: string) {
  try { await p; } catch (e) {
    const msg = (e as Error).message;
    if (msg === code) return;
    throw new Error(`expected error '${code}' but got '${msg}'`);
  }
  throw new Error(`expected error '${code}' but call succeeded`);
}
/** Expect any SQL error whose message contains the fragment (e.g. 'permission denied'). */
export async function expectDenied(p: Promise<unknown>, fragment = "permission denied") {
  try { await p; } catch (e) {
    if ((e as Error).message.includes(fragment)) return;
    throw new Error(`expected '${fragment}' but got '${(e as Error).message}'`);
  }
  throw new Error(`expected '${fragment}' but call succeeded`);
}

/** Convenience fixtures built through the superuser connection. */
export async function completeProfile(db: Db, uid: string, over: Partial<{ college: string; year: string; branch: string }> = {}) {
  await db.admin.query("update public.profiles set college=$2, year=$3, branch=$4 where id=$1",
    [uid, over.college ?? "NIT Test", over.year ?? "3rd year", over.branch ?? "CSE"]);
}
export async function acceptLatest(db: Db, uid: string) {
  await db.admin.query("insert into public.policy_acceptances(user_id, policy_version_id) select $1, id from public.policy_versions order by published_at desc limit 1 on conflict do nothing", [uid]);
}
export async function readyStudent(db: Db, email: string) {
  const id = await db.makeUser(email);
  await completeProfile(db, id);
  await acceptLatest(db, id);
  return id;
}
export async function makeReadyDeck(db: Db, owner: string, weights = [10, 20, 20, 10], title = "Test deck") {
  const d = await db.admin.query(
    "insert into public.decks(owner_id,title,original_filename,page_count,status) values ($1,$2,$3,$4,'ready') returning id",
    [owner, title, `${title}.pdf`, weights.length]);
  const id = d.rows[0].id as string;
  for (let i = 0; i < weights.length; i++) {
    await db.admin.query("insert into public.slides(deck_id,slide_index,title,key_points,time_weight) values ($1,$2,$3,$4,$5)",
      [id, i, `Slide ${i + 1}`, ["a", "b", "c"], weights[i]]);
  }
  return id;
}
