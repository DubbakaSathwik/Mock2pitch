import { serve } from "../_shared/deno-deps.ts";
import { maintenanceSweep } from "../_shared/handlers/maintenance-sweep.ts";

serve(maintenanceSweep);
