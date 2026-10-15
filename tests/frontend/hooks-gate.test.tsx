// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { setData } from "@/lib/data";
import { createMockData, type PersonaId } from "@/lib/data/mock";
import { AppError } from "@/lib/data/errors";
import type { DataPort } from "@/lib/data/types";
import { makeQueryClient, qk } from "@/lib/query";
import { usePinDeck, useDecks } from "@/features/decks/queries";
import { useAdminStudents, useSetBlocked } from "@/features/admin/queries";
import { useRateReport, useReport } from "@/features/reports/queries";
import { StudentGate, AdminGate } from "@/components/app/Gate";

const replace = vi.fn();
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => pathname, useSearchParams: () => new URLSearchParams() }));

afterEach(() => { setData(null); replace.mockReset(); });

const wrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
const fast = { latencyMs: 0, stageMs: 0 };
function use(persona: PersonaId, wrap?: (p: DataPort) => DataPort) {
  const m = createMockData({ persona, config: fast });
  setData(wrap ? wrap(m.data) : m.data);
  return m;
}

describe("query hooks over the port", () => {
  it("pin is optimistic and rolls back when the call fails", async () => {
    use("returning_student", (p) => ({ ...p, decks: { ...p.decks, setPinned: async () => { await new Promise((r) => setTimeout(r, 400)); throw new AppError("blocked"); } } }));
    const qc = makeQueryClient();
    const { result } = renderHook(() => ({ decks: useDecks(), pin: usePinDeck() }), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.decks.data).toHaveLength(1));
    const id = result.current.decks.data![0]!.deck_id;
    act(() => { result.current.pin.mutate({ deckId: id, pinned: true }); });
    await waitFor(() => expect(qc.getQueryData<{ pinned: boolean }[]>(qk.decks)![0]!.pinned).toBe(true)); // optimistic
    await waitFor(() => expect(result.current.pin.isError).toBe(true));
    await waitFor(() => expect(result.current.decks.data![0]!.pinned).toBe(false)); // rolled back / refetched
  });

  it("block/unblock updates the row optimistically and rolls back on error", async () => {
    let fail = false;
    use("admin", (p) => ({ ...p, admin: { ...p.admin, setBlocked: async (u, b) => { await new Promise((r) => setTimeout(r, 400)); if (fail) throw new AppError("unknown"); return p.admin.setBlocked(u, b); } } }));
    const qc = makeQueryClient();
    const { result } = renderHook(() => ({ list: useAdminStudents(""), block: useSetBlocked() }), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.list.data).toHaveLength(10));
    const arjun = result.current.list.data!.find((s) => s.full_name === "Arjun Reddy")!;
    act(() => { result.current.block.mutate({ userId: arjun.user_id, blocked: true }); });
    await waitFor(() => expect(result.current.list.data!.find((s) => s.user_id === arjun.user_id)!.is_blocked).toBe(true));
    await waitFor(() => expect(result.current.block.isSuccess).toBe(true));
    fail = true;
    act(() => { result.current.block.mutate({ userId: arjun.user_id, blocked: false }); });
    await waitFor(() => expect(result.current.block.isError).toBe(true));
    await waitFor(() => expect(result.current.list.data!.find((s) => s.user_id === arjun.user_id)!.is_blocked).toBe(true));
  });

  it("rating invalidates the report so the read-only rating appears", async () => {
    use("returning_student");
    const qc = makeQueryClient();
    const id = (await (await import("@/lib/data")).getData().dashboard.listRecentReports(1))[0]!.report_id;
    const { result } = renderHook(() => ({ r: useReport(id), rate: useRateReport(id) }), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.r.data?.rating).toBeNull());
    act(() => { result.current.rate.mutate({ stars: 5, comment: "Great" }); });
    await waitFor(() => expect(result.current.r.data?.rating).toEqual({ stars: 5, comment: "Great" }));
  });
});

describe("route gates render nothing protected until allowed", () => {
  let qc = makeQueryClient();
  beforeEach(() => { qc = makeQueryClient(); });
  const ui = (kids: ReactNode, g: "student" | "admin" = "student") => (
    <QueryClientProvider client={qc}>{g === "student" ? <StudentGate>{kids}</StudentGate> : <AdminGate>{kids}</AdminGate>}</QueryClientProvider>
  );
  const protectedText = () => <div>PROTECTED CONTENT</div>;
  const expectRedirect = async (to: RegExp) => { await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringMatching(to))); expect(screen.queryByText("PROTECTED CONTENT")).toBeNull(); };

  it.each([
    ["signed_out", "/history", /^\/sign-in\?next=%2Fhistory/],
    ["admin", "/dashboard", /^\/admin$/],
    ["blocked", "/dashboard", /^\/paused$/],
    ["new_student", "/dashboard", /^\/onboarding\/terms\?next=/],
  ] as const)("%s on %s is redirected without a content flash", async (persona, path, to) => {
    pathname = path; use(persona);
    render(ui(protectedText()));
    expect(screen.queryByText("PROTECTED CONTENT")).toBeNull(); // first paint: neutral loading shell
    expect(screen.getByTestId("loading-shell")).toBeInTheDocument();
    await expectRedirect(to);
  });

  it("an onboarded student sees the page; a blocked student can read History", async () => {
    pathname = "/dashboard"; use("returning_student");
    const { unmount } = render(ui(protectedText()));
    expect(await screen.findByText("PROTECTED CONTENT")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    unmount();
    pathname = "/history"; use("blocked");
    render(ui(protectedText()));
    expect(await screen.findByText("PROTECTED CONTENT")).toBeInTheDocument();
  });

  it("admin routes: signed out → owner sign-in, student → dashboard, owner allowed", async () => {
    pathname = "/admin"; use("signed_out");
    const a = render(ui(protectedText(), "admin"));
    await expectRedirect(/^\/admin\/sign-in$/); a.unmount(); replace.mockReset(); qc = makeQueryClient();
    use("student");
    const b = render(ui(protectedText(), "admin"));
    await expectRedirect(/^\/dashboard$/); b.unmount(); qc = makeQueryClient();
    use("admin");
    render(ui(protectedText(), "admin"));
    expect(await screen.findByText("PROTECTED CONTENT")).toBeInTheDocument();
  });

  it("a policy published while the student is already inside is enforced on the next navigation, but not inside /session/*", async () => {
    pathname = "/dashboard"; const m = use("returning_student");
    const view = render(ui(protectedText()));
    expect(await screen.findByText("PROTECTED CONTENT")).toBeInTheDocument();
    m.control.republishPolicy();
    pathname = "/history"; view.rerender(ui(protectedText()));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/onboarding\/terms\?next=%2Fhistory/)));
    replace.mockReset(); view.unmount();
    pathname = "/session/abc/room"; use("returning_student").control.republishPolicy();
    render(ui(protectedText()));
    expect(await screen.findByText("PROTECTED CONTENT")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
