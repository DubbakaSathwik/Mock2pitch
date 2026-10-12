import { serve } from "../_shared/deno-deps.ts";
import { accountDelete } from "../_shared/handlers/account-delete.ts";

serve(accountDelete);
