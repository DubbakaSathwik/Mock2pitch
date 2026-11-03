// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ds";
import { Logo } from "@/components/app/Logo";
import { BackLink } from "@/components/app/BackLink";
import { NavProgress } from "@/components/app/NavProgress";
import { navProgress } from "@/lib/nav-progress";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));

afterEach(() => { navProgress.done(); pathname = "/"; });

describe("Button loading state", () => {
  it("shows a spinner, is busy and disabled, keeps its label, and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    const { rerender, container } = render(<Button onClick={onClick}>Save</Button>);
    expect(container.querySelector("[aria-busy]")).toBeNull();
    rerender(<Button loading onClick={onClick}>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b.querySelector("span[aria-hidden='true']")).not.toBeNull();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Logo / BackLink", () => {
  it("the logo is a link home only when given an href", () => {
    const { rerender } = render(<Logo />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<Logo href="/dashboard" />);
    expect(screen.getByRole("link", { name: "Mock2Pitch home" })).toHaveAttribute("href", "/dashboard");
  });
  it("BackLink points at the previous step and names it", () => {
    render(<BackLink href="/practice/new" label="Back to upload" />);
    expect(screen.getByRole("link", { name: "Back to upload" })).toHaveAttribute("href", "/practice/new");
  });
});

describe("NavProgress", () => {
  const bar = () => screen.getByRole("progressbar", { hidden: true });
  it("runs from an internal link click until the URL changes, and ignores external, new-tab and same-page links", async () => {
    const { rerender } = render(<><NavProgress /><a href="/history">h</a><a href="https://example.com/x">ext</a><a href="/history" target="_blank">tab</a><a href="/#top">same</a></>);
    expect(bar()).toHaveAttribute("aria-hidden", "true");
    for (const name of ["ext", "tab", "same"]) { await userEvent.click(screen.getByText(name)); expect(navProgress.isActive()).toBe(false); }
    await userEvent.click(screen.getByText("h"));
    expect(navProgress.isActive()).toBe(true);
    expect(bar()).toHaveAttribute("aria-hidden", "false");
    pathname = "/history";
    await act(async () => { rerender(<><NavProgress /><a href="/history">h</a></>); });
    expect(navProgress.isActive()).toBe(false);
  });
  it("never runs forever: a navigation that never lands is ended by the safety timeout", () => {
    vi.useFakeTimers();
    navProgress.start();
    expect(navProgress.isActive()).toBe(true);
    vi.advanceTimersByTime(12_001);
    expect(navProgress.isActive()).toBe(false);
    vi.useRealTimers();
  });
});
