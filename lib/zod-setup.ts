// Import this FIRST in every browser-reachable module that builds zod schemas (ES imports run in order, before the module body).
// zod 4 decides at schema-construction time whether to JIT-compile its parsers, by probing `Function("")`. Our Content-Security-Policy forbids
// eval, so in the browser that probe is blocked and logged as a CSP violation on every page load. Parsers here are tiny: turn the JIT off.
import { z } from "zod";

z.config({ jitless: true });
