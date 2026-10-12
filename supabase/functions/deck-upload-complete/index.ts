import { serve } from "../_shared/deno-deps.ts";
import { deckUploadComplete } from "../_shared/handlers/deck-upload-complete.ts";

serve(deckUploadComplete);
