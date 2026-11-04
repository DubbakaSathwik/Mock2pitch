import { serve } from "../_shared/deno-deps.ts";
import { adminDiagnose } from "../_shared/handlers/admin-diagnose.ts";

serve(adminDiagnose);
