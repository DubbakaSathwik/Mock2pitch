import { Icon, type IconName } from "@/components/ds/Icon";

export function Tile({ icon, tone = "marine", size = 40 }: { icon: IconName; tone?: "marine" | "violet"; size?: number }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 12, background: tone === "violet" ? "var(--pitch-violet-soft)" : "var(--marine-50)", color: tone === "violet" ? "#5B30D9" : "var(--bright-marine)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon name={icon} size={size * 0.5} />
    </div>
  );
}
