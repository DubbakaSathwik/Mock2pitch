// Deletes every integration user through the REAL account-delete Edge Function (removes the R2 prefix first, then the auth user and,
// by cascade, every row). Run with NODE_USE_ENV_PROXY=1 in sandboxes. The integration admin must be demoted first (the function refuses
// to delete an admin):  update profiles set role = 'student' where email = 'it.admin@mock2pitch.test';
// Then verify with the residue SQL printed by:  node scripts/integration/provision-test-users.mjs --cleanup  (the count query only).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env.integration.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim(); }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
for (const key of ["NEW", "A", "B", "DEL", "ADMIN"]) {
  const email = process.env[`IT_USER_${key}_EMAIL`], password = process.env[`IT_USER_${key}_PASSWORD`];
  if (!email || !password) { console.log(`${key}: no credentials, skipped`); continue; }
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) { console.log(`${key}: sign-in failed (${error.message}) — already deleted?`); continue; }
  const res = await fetch(`${url}/functions/v1/account-delete`, { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({}) });
  console.log(`${key}: account-delete -> ${res.status} ${(await res.text()).slice(0, 120)}`);
}
