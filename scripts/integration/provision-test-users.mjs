// Generates the SQL that provisions the @mock2pitch.test integration users on the hosted project (they bypass the Google-only sign-up hook
// because they are inserted directly) and writes their random passwords to .env.integration.local (git-ignored).
//   node scripts/integration/provision-test-users.mjs            -> prints SQL (run it in the Supabase SQL editor / MCP), writes the creds file
//   node scripts/integration/provision-test-users.mjs --cleanup  -> prints the SQL that removes every @mock2pitch.test user and its data
import crypto from "node:crypto";
import fs from "node:fs";

const USERS = [
  { key: "NEW", email: "it.new@mock2pitch.test", name: "IT New Student", role: "student", complete: false },
  { key: "A", email: "it.a@mock2pitch.test", name: "IT Student A", role: "student", complete: true },
  { key: "B", email: "it.b@mock2pitch.test", name: "IT Student B", role: "student", complete: true },
  { key: "DEL", email: "it.del@mock2pitch.test", name: "IT Delete Me", role: "student", complete: true },
  { key: "ADMIN", email: "it.admin@mock2pitch.test", name: "IT Admin", role: "admin", complete: true },
];

if (process.argv.includes("--cleanup")) {
  console.log(`-- Removes every integration user. Cascades delete profiles, decks, sessions, reports, ratings, usage events, files rows.
-- (R2 objects must be removed first through the account-delete function; see docs/phase-3/integration.md.)
delete from auth.users where email like '%@mock2pitch.test';
select count(*) as residue_users from auth.users where email like '%@mock2pitch.test';`);
  process.exit(0);
}

const pw = () => crypto.randomBytes(18).toString("base64url");
const creds = Object.fromEntries(USERS.map((u) => [u.key, pw()]));
fs.writeFileSync(".env.integration.local", USERS.map((u) => `IT_USER_${u.key}_EMAIL=${u.email}\nIT_USER_${u.key}_PASSWORD=${creds[u.key]}`).join("\n") + "\n", { mode: 0o600 });

const values = USERS.map((u, i) => `('00000000-0000-4000-8000-0000000017${String(i + 1).padStart(2, "0")}', '${u.email}', '${creds[u.key]}', '${u.name}')`).join(",\n  ");
console.log(`with u(id, email, pw, name) as (values
  ${values}
)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, extensions.crypt(pw, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from u on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@mock2pitch.test' on conflict do nothing;

-- Profiles come from the handle_new_user trigger. Complete the ones that should start onboarded (policy accepted + profile filled).
update public.profiles set college = 'IT Test College', year = '3rd year', branch = 'CSE'
 where email in (${USERS.filter((u) => u.complete && u.role === "student").map((u) => `'${u.email}'`).join(", ")});
insert into public.policy_acceptances (user_id, policy_version_id)
select p.id, (select id from public.policy_versions order by published_at desc limit 1) from public.profiles p
 where p.email in (${USERS.filter((u) => u.complete && u.role === "student").map((u) => `'${u.email}'`).join(", ")}) on conflict do nothing;
-- The integration admin (never the real owner): promoted by hand, removed with the others.
update public.profiles set role = 'admin' where email = 'it.admin@mock2pitch.test';
select email, role, profile_completed_at is not null as profile_done from public.profiles where email like '%@mock2pitch.test' order by email;`);
