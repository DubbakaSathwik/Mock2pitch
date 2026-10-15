// Flow 5.9 (policy): the owner publishes a new Terms version while a student is signed in. On the next navigation the student is sent to the
// "updated" Terms screen, accepts it, and returns; an in-progress session can still be submitted (D15, covered by the Edge Function tests).
// The published test version re-uses the CURRENT policy text, so a real student would only re-accept identical terms. The row is removed by
// the final cleanup (docs/phase-3/integration.md). Student NEW (already onboarded by spec 02).
import { expect, test } from "@playwright/test";
import { userApi } from "./support/api";
import { watchConsole } from "./support/console";
import { signedInContext } from "./support/session";

test("new policy version → next navigation shows the updated-terms screen → accept → dashboard", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const admin = await userApi("ADMIN");
  const { ctx, client, userId } = await signedInContext(browser, "NEW", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page);
  await page.goto("/dashboard");
  await expect(page.getByText(/of 5 sessions/)).toBeVisible({ timeout: 60_000 });

  const { data: cur } = await client.from("policy_versions").select("*").order("published_at", { ascending: false }).limit(1).single();
  const label = `${cur!.version_label}.1`; // labels are v<N>(.<N>)* and must be higher than the current one
  const pub = await admin.client.rpc("admin_publish_policy", { p_version_label: label, p_terms_body: cur!.terms_body, p_privacy_body: cur!.privacy_body, p_note: "integration test (same text)" });
  expect(pub.error, JSON.stringify(pub.error)).toBeNull();

  // the open page keeps working; the next full navigation goes through the guard with the new version
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/onboarding\/terms/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: /We've updated our terms/ })).toBeVisible();
  await expect(page.getByText(new RegExp(label))).toBeVisible();
  const cont = page.getByRole("button", { name: /Continue|Accept/ }).first();
  await expect(cont).toBeDisabled();
  await page.getByRole("checkbox").check();
  await cont.click();
  await expect(page).toHaveURL(/\/(dashboard|settings)/, { timeout: 60_000 });

  const { data: acc } = await client.from("policy_acceptances").select("policy_version_id,policy_versions(version_label)").eq("user_id", userId);
  const labels = (acc ?? []).map((a: any) => a.policy_versions?.version_label);
  expect(labels).toContain(label);
  expect(labels.length).toBe(2); // the original acceptance is kept (audit trail)
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  console.log(`policy version published for the test: ${label}`);
  await ctx.close();
});
