import { api, AppError, Errors, logEvent, ok, readBody, requireUser } from "./common.ts";
import { accountDeleteIn } from "../schemas.ts";
import { keys } from "../r2.ts";

export const accountDelete = api(async (ctx) => {
  const a = await requireUser(ctx);
  await readBody(ctx.req, accountDeleteIn);
  const { deps } = ctx;

  const { data: p } = await deps.admin.from("profiles").select("role").eq("id", a.userId).maybeSingle();
  if (!p) throw Errors.unauthenticated();
  if (p.role === "admin") throw new AppError("is_admin", 403, "The owner account can't be deleted here.");

  // 1) Record the R2 prefix to clean BEFORE anything is removed, so a partial failure can always be finished by the sweeper.
  const { error: be } = await deps.admin.rpc("svc_begin_account_deletion", { p_uid: a.userId });
  if (be) throw new AppError("internal", 500, "Something went wrong.");

  // 2) Delete every object under users/{uid}/.
  let storage: "complete" | "pending" = "complete";
  try {
    await deps.r2.deletePrefix(keys.userPrefix(a.userId));
    await deps.admin.rpc("svc_finish_account_deletion", { p_uid: a.userId });
  } catch {
    storage = "pending"; // sweeper retries until the prefix is empty
  }

  // 3) Delete the auth user; foreign keys cascade every row. ai_usage_log keeps anonymised rows.
  const { error: de } = await deps.admin.auth.admin.deleteUser(a.userId);
  if (de) throw new AppError("delete_failed", 500, "We couldn't delete your account. Please try again.");
  logEvent("account_deleted", { storage });
  return ok({ deleted: true, storage_cleanup: storage });
});
