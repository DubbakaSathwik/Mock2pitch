import { serve } from "../_shared/deno-deps.ts";
import { sessionAnalyse } from "../_shared/handlers/session-analyse.ts";

serve(sessionAnalyse);
