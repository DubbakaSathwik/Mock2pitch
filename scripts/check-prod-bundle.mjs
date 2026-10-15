// After `npm run build:review`: dev-only code must be absent from the production output.
//  - the mock control panel and the window.__m2pMock hook (never shipped),
//  - the /dev/design-system route (*.dev.tsx pages are not routes in production builds).
import fs from "node:fs";
import path from "node:path";

const root = ".next";
if (!fs.existsSync(root)) { console.error("No .next build found. Run: npm run build:review"); process.exit(2); }

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = walk(root).filter((f) => !f.includes(`${path.sep}cache${path.sep}`) && !f.includes(`${path.sep}diagnostics${path.sep}`));
const clientFiles = walk(path.join(root, "static")).filter((f) => /\.(js|css|map)$/.test(f) && !f.endsWith(".map"));

const MARKERS = ["M2P_MOCK_PANEL_SENTINEL", "Mock backend controls", "__m2pMock", "Republish Terms", "Fail the next AI call"];
// A build made with NEXT_PUBLIC_DATA_MODE=supabase must not ship the mock backend at all (seed data, mock PUT transport, persisted mock state).
const SUPABASE_BUILD = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
const MOCK_BACKEND_MARKERS = ["m2p.mock.state.v1", "mock://put/"];
const problems = [];
for (const f of clientFiles) {
  if (SUPABASE_BUILD) { const t = fs.readFileSync(f, "utf8"); for (const m of MOCK_BACKEND_MARKERS) if (t.includes(m)) problems.push(`${f} contains the mock backend ("${m}") in a supabase-mode build`); }
  const text = fs.readFileSync(f, "utf8");
  for (const m of MARKERS) if (text.includes(m)) problems.push(`${f} contains "${m}"`);
}
for (const f of files) {
  if (/design-system/.test(f) && !/node_modules/.test(f)) problems.push(`${f} (design-system route output)`);
}
const manifestPath = path.join(root, "app-path-routes-manifest.json");
if (fs.existsSync(manifestPath)) {
  const routes = Object.values(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  for (const r of routes) if (String(r).startsWith("/dev")) problems.push(`route ${r} exists in the build`);
  console.log(`routes in build: ${routes.length}`);
}
console.log(`client files scanned: ${clientFiles.length}`);
if (problems.length) { console.error("FAIL: dev-only code found in the production build:\n" + problems.map((p) => " - " + p).join("\n")); process.exit(1); }
console.log(`OK: no mock panel, no __m2pMock hook and no /dev routes in the production build${SUPABASE_BUILD ? "; no mock backend in the supabase-mode bundle" : ""}.`);
