import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The Supabase deploy bundler only reads the import map from each function's own folder, so every function needs its own
// deno.json, identical to the shared one.
const dir = path.resolve(__dirname, "../../supabase/functions");
describe("per-function deno.json", () => {
  const shared = fs.readFileSync(path.join(dir, "deno.json"), "utf8");
  const fns = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "_shared").map((d) => d.name);
  it("exists for every function and matches supabase/functions/deno.json", () => {
    expect(fns.length).toBe(9);
    for (const f of fns) expect(fs.readFileSync(path.join(dir, f, "deno.json"), "utf8"), f).toBe(shared);
  });
  it("maps every bare package specifier the shared code imports", () => {
    const imports = Object.keys(JSON.parse(shared).imports);
    const used = new Set<string>();
    const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".ts")) for (const m of fs.readFileSync(p, "utf8").matchAll(/from "([^./n][^"]*)"/g)) used.add(m[1]!); } };
    walk(path.join(dir, "_shared"));
    for (const u of used) expect(imports, u).toContain(u);
  });
});
