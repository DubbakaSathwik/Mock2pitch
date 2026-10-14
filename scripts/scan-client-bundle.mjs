// Fails if the built client bundle (.next/static) contains server-only names or any secret value from the environment.
// Usage: npm run build && node scripts/scan-client-bundle.mjs   (re-run in Phase 2/3 once real client code exists)
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(".next/static");
const names = ["SERVICE_ROLE", "R2_ACCESS", "R2_SECRET", "R2_ACCOUNT", "nvapi-", "NVIDIA_", "INTERNAL_TRANSCRIBE", "INTERNAL_FUNCTION", "grpc.nvcf"];
const secretEnv = Object.entries(process.env).filter(([k, v]) => /SERVICE_ROLE|SECRET|_KEY|TOKEN|PASSWORD/.test(k) && !k.startsWith("NEXT_PUBLIC_") && v && v.length >= 8).map(([, v]) => v);
const hits = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|css|html|json|map)$/.test(e.name)) {
      const t = fs.readFileSync(p, "utf8");
      for (const n of names) if (t.includes(n)) hits.push(`${p}: contains "${n}"`);
      for (const v of secretEnv) if (t.includes(v)) hits.push(`${p}: contains a secret environment value`);
    }
  }
})(dir);
if (hits.length) { console.error(hits.join("\n")); process.exit(1); }
console.log(`client bundle clean (${names.length} name patterns, ${secretEnv.length} secret env values checked)`);
