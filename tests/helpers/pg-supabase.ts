// A small supabase-js look-alike over `pg`, so Edge Function handlers can run unmodified against a real Postgres in tests.
// Each call runs in its own transaction with the right role + JWT claims (RLS and grants apply exactly as in PostgREST).
// It implements only the subset of the query-builder API the handlers use.
import type { Pool } from "pg";

type Role = "authenticated" | "service_role" | "anon";
export type Principal = { role: Role; uid?: string };
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const norm = (v: unknown) => {
  if (Array.isArray(v) && v.some((x) => x !== null && typeof x === "object")) return JSON.stringify(v);
  return v;
};

export function makePgSupabase(pool: Pool, principal: Principal, opts: { users?: Map<string, string>; onDeleteUser?: (id: string) => Promise<void> } = {}) {
  async function run(sql: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${principal.role}`);
      if (principal.uid) await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: principal.uid, role: principal.role })]);
      const r = await c.query(sql, params.map(norm) as any[]);
      await c.query("commit");
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  const wrap = async (fn: () => Promise<any>): Promise<Result> => {
    try { return await fn(); } catch (e: any) { return { data: null, error: { message: e.message, code: e.code } }; }
  };

  class Builder implements PromiseLike<Result> {
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private cols = "*"; private wheres: string[] = []; private params: unknown[] = [];
    private orders: string[] = []; private lim?: number; private payload: any; private onConflict?: string;
    private returning = false; private mode: "many" | "single" | "maybe" = "many"; private wantCount = false; private headOnly = false;
    private ignoreDup = false;
    constructor(private table: string) {}
    private p(v: unknown) { this.params.push(v); return `$${this.params.length}`; }
    select(cols = "*", o?: { count?: "exact"; head?: boolean }) {
      this.cols = cols; this.returning = true;
      if (o?.count) this.wantCount = true;
      if (o?.head) this.headOnly = true;
      return this;
    }
    insert(v: any) { this.op = "insert"; this.payload = v; return this; }
    upsert(v: any, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.op = "upsert"; this.payload = v; this.onConflict = o.onConflict; this.ignoreDup = !!o.ignoreDuplicates; return this; }
    update(v: any) { this.op = "update"; this.payload = v; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c: string, v: unknown) { this.wheres.push(`${q(c)} = ${this.p(norm(v))}`); return this; }
    neq(c: string, v: unknown) { this.wheres.push(`${q(c)} <> ${this.p(v)}`); return this; }
    gt(c: string, v: unknown) { this.wheres.push(`${q(c)} > ${this.p(v)}`); return this; }
    gte(c: string, v: unknown) { this.wheres.push(`${q(c)} >= ${this.p(v)}`); return this; }
    lt(c: string, v: unknown) { this.wheres.push(`${q(c)} < ${this.p(v)}`); return this; }
    lte(c: string, v: unknown) { this.wheres.push(`${q(c)} <= ${this.p(v)}`); return this; }
    in(c: string, vs: unknown[]) { this.wheres.push(`${q(c)} = any(${this.p(vs)})`); return this; }
    is(c: string, v: null | boolean) { this.wheres.push(`${q(c)} is ${v === null ? "null" : v ? "true" : "false"}`); return this; }
    not(c: string, op: string, v: unknown) { if (op === "is" && v === null) this.wheres.push(`${q(c)} is not null`); else throw new Error("shim: unsupported not()"); return this; }
    order(c: string, o: { ascending?: boolean } = {}) { this.orders.push(`${q(c)} ${o.ascending === false ? "desc" : "asc"}`); return this; }
    limit(n: number) { this.lim = n; return this; }
    single() { this.mode = "single"; return this; }
    maybeSingle() { this.mode = "maybe"; return this; }

    private async exec(): Promise<Result> {
      const t = `public.${q(this.table)}`;
      const where = this.wheres.length ? ` where ${this.wheres.join(" and ")}` : "";
      const ret = this.returning ? ` returning ${this.cols === "*" ? "*" : this.cols}` : "";
      let sql: string;
      if (this.op === "select") {
        const cols = this.headOnly ? "1" : this.cols;
        sql = `select ${cols} from ${t}${where}${this.orders.length ? ` order by ${this.orders.join(", ")}` : ""}${this.lim !== undefined ? ` limit ${this.lim}` : ""}`;
      } else if (this.op === "insert" || this.op === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const keys = [...new Set(rows.flatMap((r: any) => Object.keys(r)))];
        const values = rows.map((r: any) => `(${keys.map((k) => (r[k] === undefined ? "default" : this.p(norm(r[k])))).join(", ")})`).join(", ");
        sql = `insert into ${t} (${keys.map(q).join(", ")}) values ${values}`;
        if (this.op === "upsert") {
          const conflict = (this.onConflict ?? "id").split(",").map((s) => q(s.trim())).join(", ");
          const updates = keys.filter((k) => !(this.onConflict ?? "id").split(",").map((s) => s.trim()).includes(k));
          sql += this.ignoreDup || updates.length === 0 ? ` on conflict (${conflict}) do nothing` : ` on conflict (${conflict}) do update set ${updates.map((k) => `${q(k)} = excluded.${q(k)}`).join(", ")}`;
        }
        sql += ret;
      } else if (this.op === "update") {
        const sets = Object.entries(this.payload).filter(([, v]) => v !== undefined).map(([k, v]) => `${q(k)} = ${this.p(norm(v))}`);
        sql = `update ${t} set ${sets.join(", ")}${where}${ret}`;
      } else {
        sql = `delete from ${t}${where}${ret}`;
      }
      const r = await run(sql, this.params);
      if (this.headOnly) return { data: null, error: null, count: r.rowCount };
      let data: any = this.returning || this.op === "select" ? r.rows : null;
      if (data && this.mode !== "many") {
        if (this.mode === "single" && data.length !== 1) return { data: null, error: { message: data.length === 0 ? "JSON object requested, multiple (or no) rows returned" : "multiple rows", code: "PGRST116" } };
        data = data[0] ?? null;
      }
      return { data, error: null, count: this.wantCount ? r.rowCount : null };
    }
    then<A, B>(ok?: ((v: Result) => A | PromiseLike<A>) | null, err?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return wrap(() => this.exec()).then(ok, err);
    }
  }

  const rpcMeta = new Map<string, { retset: boolean; composite: boolean; scalarVoid: boolean }>();
  return {
    from: (table: string) => new Builder(table),
    rpc: (fn: string, args: Record<string, unknown> = {}): PromiseLike<Result> => ({
      then: (ok: any, err: any) => wrap(async () => {
        if (!rpcMeta.has(fn)) {
          const m = await pool.query(
            "select p.proretset, t.typtype, p.prorettype::regtype::text rt from pg_proc p join pg_type t on t.oid=p.prorettype join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1 limit 1", [fn]);
          if (!m.rowCount) throw Object.assign(new Error(`Could not find the function public.${fn}`), { code: "PGRST202" });
          rpcMeta.set(fn, { retset: m.rows[0].proretset, composite: m.rows[0].typtype === "c", scalarVoid: m.rows[0].rt === "void" });
        }
        const meta = rpcMeta.get(fn)!;
        const names = Object.keys(args);
        const sql = `select * from public.${q(fn)}(${names.map((n, i) => `${q(n)} => $${i + 1}`).join(", ")})`;
        const r = await run(sql, names.map((n) => args[n]));
        let data: any;
        if (meta.retset) data = r.rows;
        else if (meta.scalarVoid) data = null;
        else if (meta.composite) data = r.rows[0] ?? null;
        else data = r.rows[0] ? Object.values(r.rows[0])[0] : null;
        return { data, error: null };
      }).then(ok, err),
    }) as PromiseLike<Result>,
    auth: {
      getUser: async (jwt?: string) => {
        const uid = jwt ? opts.users?.get(jwt) : undefined;
        return uid ? { data: { user: { id: uid } }, error: null } : { data: { user: null }, error: { message: "invalid jwt" } };
      },
      admin: {
        deleteUser: async (id: string) => {
          try { await opts.onDeleteUser?.(id); return { data: null, error: null }; } catch (e: any) { return { data: null, error: { message: e.message } }; }
        },
      },
    },
  };
}
export type PgSupabase = ReturnType<typeof makePgSupabase>;
