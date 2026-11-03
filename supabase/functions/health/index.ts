import { serve } from "../_shared/deno-deps.ts";
import { health } from "../_shared/handlers/health.ts";

serve(health);
