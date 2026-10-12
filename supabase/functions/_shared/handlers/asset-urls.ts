import { api, Errors, ok, readBody, requireNotAdmin, requireUser } from "./common.ts";
import { assetUrlsIn } from "../schemas.ts";
import { GET_EXPIRES_S } from "../constants.ts";

export const assetUrls = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { deck_id, kinds } = await readBody(ctx.req, assetUrlsIn);
  await requireNotAdmin(ctx, a.userId);
  const { deps } = ctx;

  const { data: deck } = await deps.admin.from("decks").select("id").eq("id", deck_id).eq("owner_id", a.userId).maybeSingle();
  if (!deck) throw Errors.notFound(); // same answer for "not yours" and "doesn't exist"

  const { data: files } = await deps.admin.from("files").select("kind, slide_index, object_key")
    .eq("deck_id", deck_id).eq("owner_id", a.userId).eq("status", "uploaded").in("kind", kinds).order("slide_index", { ascending: true });
  const out = [];
  let expires_at = new Date(deps.now().getTime() + GET_EXPIRES_S * 1000).toISOString();
  for (const f of (files ?? []) as { kind: string; slide_index: number | null; object_key: string }[]) {
    const g = await deps.r2.presignGet(f.object_key, GET_EXPIRES_S); // keys come from the DB, never from the client
    expires_at = g.expires_at;
    out.push({ kind: f.kind, slide_index: f.slide_index, url: g.url });
  }
  return ok({ deck_id, expires_at, files: out });
});
