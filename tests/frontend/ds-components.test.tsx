// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Badge, Button, Card, Checkbox, Dialog, IconButton, Input, ProgressBar, ScoreRing, Select, Tabs, ToastProvider, Tooltip, useToast, TOAST_MS } from "@/components/ds";
import { Avatar } from "@/components/app/Avatar";
import { BarChart } from "@/components/app/BarChart";
import { Doc } from "@/components/app/Doc";
import { FillerText } from "@/components/app/FillerText";
import { LineChart } from "@/components/app/LineChart";
import { MicMeter, METER_BARS } from "@/components/app/MicMeter";
import { Notice } from "@/components/app/Notice";
import { SlideView } from "@/components/app/SlideView";
import { StarRating, Stars } from "@/components/app/Stars";

describe("Button / IconButton", () => {
  it("renders every variant and size, honours disabled and fires clicks", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
    for (const v of ["primary", "secondary", "ghost", "accent", "inverse", "record"] as const) {
      rerender(<Button variant={v} size="lg" iconLeft="plus" iconRight="arrow-right" fullWidth>{v}</Button>);
      expect(screen.getByRole("button", { name: v }).className).toContain(v);
    }
  });
  it("icon buttons need an accessible name and use it as the title", () => {
    render(<IconButton icon="x" label="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("title", "Close");
  });
});

describe("Badge, Card, ProgressBar, ScoreRing", () => {
  it("badge tones and dot", () => {
    const { container } = render(<><Badge tone="success" dot>Live</Badge><Badge tone="violet">AI</Badge></>);
    expect(container.querySelectorAll("span")[0]!.className).toContain("success");
    expect(screen.getByText("AI").className).toContain("violet");
  });
  it("card variants", () => {
    const { container } = render(<Card variant="sunken" interactive>x</Card>);
    expect(container.firstElementChild!.className).toContain("sunken");
    expect(container.firstElementChild!.className).toContain("interactive");
  });
  it("progress bar clamps and exposes ARIA values", () => {
    const { rerender } = render(<ProgressBar value={3} max={5} valueLabel="3 of 5" label="Practice sessions" />);
    const bar = screen.getByRole("progressbar", { name: "Practice sessions" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar.firstElementChild).toHaveStyle({ width: "60%" });
    rerender(<ProgressBar value={9} max={5} />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width: "100%" });
    rerender(<ProgressBar value={-2} max={5} />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ width: "0%" });
  });
  it("score ring draws the right arc and a text alternative", () => {
    render(<ScoreRing value={74} size={100} stroke={10} label="out of 100" />);
    expect(screen.getByRole("img", { name: "Score 74 out of 100" })).toBeInTheDocument();
    const c = 2 * Math.PI * 45;
    const arc = document.querySelectorAll("circle")[1]!;
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(c * 0.26, 3);
  });
});

describe("form controls", () => {
  it("input shows the error, links it with aria-describedby and marks it invalid", () => {
    render(<Input label="College" error="Enter your college name" />);
    const input = screen.getByLabelText("College");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your college name");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
  it("select renders options", async () => {
    const onChange = vi.fn();
    render(<Select label="Year" options={["3rd year", "4th year"]} value="3rd year" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Year"), "4th year");
    expect(onChange).toHaveBeenCalled();
  });
  it("checkbox is a real checkbox and toggles by label click and keyboard", async () => {
    function C() { const [v, setV] = useState(false); return <Checkbox checked={v} onChange={setV} label="I agree" />; }
    render(<C />);
    const cb = screen.getByRole("checkbox", { name: "I agree" });
    expect(cb).not.toBeChecked();
    await userEvent.click(screen.getByText("I agree"));
    expect(cb).toBeChecked();
    cb.focus();
    await userEvent.keyboard(" ");
    expect(cb).not.toBeChecked();
  });
});

describe("Dialog", () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (<><button onClick={() => setOpen(true)}>Open</button><Dialog open={open} title="Leave this session?" onClose={() => setOpen(false)} actions={<><button>Keep</button><button>Leave</button></>}>Body</Dialog></>);
  }
  it("is a labelled modal that traps focus, closes on Escape and returns focus to the opener", async () => {
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    const dlg = screen.getByRole("dialog", { name: "Leave this session?" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(dlg.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 6; i++) { await userEvent.tab(); expect(dlg.contains(document.activeElement)).toBe(true); }
    await userEvent.tab({ shift: true });
    expect(dlg.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it("closes when the scrim is clicked", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const scrim = screen.getByRole("dialog").parentElement!;
    fireEvent.mouseDown(scrim);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Toast", () => {
  it("announces politely and disappears after 2.6 s", () => {
    vi.useFakeTimers();
    function Btn() { const { toast } = useToast(); return <button onClick={() => toast("Profile saved")}>Save</button>; }
    render(<ToastProvider><Btn /></ToastProvider>);
    act(() => { screen.getByRole("button", { name: "Save" }).click(); });
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(within(region).getByText("Profile saved")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(TOAST_MS - 50); });
    expect(within(region).queryByText("Profile saved")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(100); });
    expect(within(region).queryByText("Profile saved")).toBeNull();
    vi.useRealTimers();
  });
});

describe("Tabs and Tooltip", () => {
  it("roving focus with arrow keys; selected tab has tabIndex 0", async () => {
    function T() { const [v, setV] = useState("terms"); return <Tabs variant="pill" items={[{ value: "terms", label: "Terms" }, { value: "privacy", label: "Privacy Policy" }]} value={v} onChange={setV} />; }
    render(<T />);
    const terms = screen.getByRole("tab", { name: "Terms" });
    expect(terms).toHaveAttribute("aria-selected", "true");
    terms.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Privacy Policy" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Privacy Policy" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Terms" })).toHaveAttribute("aria-selected", "true");
  });
  it("tooltip is described by its trigger", () => {
    render(<Tooltip content="Pin to top"><button>Pin</button></Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Pin to top");
  });
});

describe("rating", () => {
  it("renders exactly five star buttons as one radio group", async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeInTheDocument();
    expect(document.querySelectorAll("svg")).toHaveLength(5);
    await userEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
  it("arrow keys change the value; read-only stars have a text alternative", async () => {
    function R() { const [v, setV] = useState(2); return <StarRating value={v} onChange={setV} />; }
    render(<R />);
    screen.getByRole("radio", { name: "2 stars" }).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4 stars" })).toHaveAttribute("aria-checked", "true");
    render(<Stars n={3} />);
    expect(screen.getByRole("img", { name: "3 out of 5 stars" })).toBeInTheDocument();
  });
});

describe("SlideView", () => {
  it("shows a skeleton without a source, then the image", () => {
    const { rerender } = render(<SlideView alt="Slide 1" />);
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<SlideView alt="Slide 1" src="/a.jpg" />);
    expect(screen.getByAltText("Slide 1")).toHaveAttribute("src", "/a.jpg");
  });
  it("asks for fresh URLs exactly once when an image fails, then shows the fallback", () => {
    const onRefetch = vi.fn();
    const { rerender } = render(<SlideView alt="Slide 2" src="/old.jpg" onRefetch={onRefetch} />);
    fireEvent.error(screen.getByAltText("Slide 2"));
    expect(onRefetch).toHaveBeenCalledTimes(1);
    rerender(<SlideView alt="Slide 2" src="/new.jpg" onRefetch={onRefetch} />);
    expect(screen.getByAltText("Slide 2")).toHaveAttribute("src", "/new.jpg");
    fireEvent.error(screen.getByAltText("Slide 2"));
    expect(onRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Slide image unavailable")).toBeInTheDocument();
  });
});

describe("content components never inject HTML", () => {
  it("highlights fillers as <mark> nodes and escapes markup", () => {
    const { container } = render(<p><FillerText text={'So um <img src=x onerror=alert(1)> basically fine'} /></p>);
    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["um", "basically"]);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
  it("Doc turns '## Heading' blocks into headings and keeps raw text otherwise", () => {
    render(<Doc text={"## 1. Using it\nLine one.\nLine two.\n\nPlain <b>paragraph</b>."} />);
    expect(screen.getByRole("heading", { level: 2, name: "1. Using it" })).toBeInTheDocument();
    expect(screen.getByText("Line one. Line two.")).toBeInTheDocument();
    expect(screen.getByText("Plain <b>paragraph</b>.")).toBeInTheDocument();
  });
  it("Avatar falls back to initials when the photo fails", () => {
    render(<Avatar name="Ananya Rao" src="/broken.png" />);
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByText("AR")).toBeInTheDocument();
  });
  it("Notice announces errors as alerts and info as status", () => {
    render(<><Notice title="Upload failed">x</Notice><Notice tone="info">y</Notice></>);
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    expect(screen.getByRole("status")).toHaveTextContent("y");
  });
});

describe("charts have text alternatives", () => {
  it("line chart summarises its points", () => {
    render(<LineChart data={[{ label: "Attempt 1", value: 62 }, { label: "Attempt 2", value: 74 }]} />);
    expect(screen.getByRole("img", { name: "Score trend: Attempt 1 62, Attempt 2 74" })).toBeInTheDocument();
  });
  it("line chart extends the axis only when a score is below 40", () => {
    const { container, rerender } = render(<LineChart data={[{ label: "a", value: 62 }]} />);
    expect([...container.querySelectorAll("text")].map((t) => t.textContent).filter((t) => /^\d+$/.test(t ?? "") && ["40", "60", "80", "100", "20", "0"].includes(t!))).toEqual(["40", "60", "80", "100"]);
    rerender(<LineChart data={[{ label: "a", value: 22 }]} />);
    expect(container.textContent).toContain("20");
  });
  it("bar chart: proportional heights, labels every 2nd plus the last, hidden table for screen readers", () => {
    const labels = Array.from({ length: 14 }, (_, i) => `D${i}`);
    const data = Array.from({ length: 14 }, (_, i) => (i + 1) * 5);
    const { container } = render(<BarChart data={data} labels={labels} every={2} h={170} caption="Sessions per day" />);
    const bars = [...container.querySelectorAll<HTMLElement>("[title]")].map((b) => b.querySelector<HTMLElement>("div")!);
    const heights = bars.map((b) => parseInt(b.style.height));
    expect(heights[13]).toBe(148); // max → h - 22
    expect(heights[6]).toBe(Math.round((35 / 70) * 148));
    const visible = [...container.querySelectorAll<HTMLElement>("span")].filter((s) => s.style.visibility === "visible" && /^D\d+$/.test(s.textContent ?? "")).map((s) => s.textContent);
    expect(visible).toEqual(["D1", "D3", "D5", "D7", "D9", "D11", "D13"]);
    expect(screen.getByRole("table", { hidden: true })).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(14);
  });
  it("mic meter lights bars in proportion to the level", () => {
    const { rerender } = render(<MicMeter level={0} />);
    expect(document.querySelectorAll('[data-on="1"]')).toHaveLength(0);
    rerender(<MicMeter level={0.5} />);
    expect(document.querySelectorAll('[data-on="1"]')).toHaveLength(METER_BARS / 2);
    rerender(<MicMeter level={1} />);
    expect(document.querySelectorAll('[data-on="1"]')).toHaveLength(METER_BARS);
  });
});
