import { serve } from "../_shared/deno-deps.ts";
import { opsSelftest } from "../_shared/handlers/ops-selftest.ts";

serve(opsSelftest);
