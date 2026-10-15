import { Badge } from "@/components/ds/Badge";
import { Icon } from "@/components/ds/Icon";

/** Violet "AI-generated" marker — used only on AI content (design rule). */
export function AIBadge({ children = "AI-generated" }: { children?: React.ReactNode }) {
  return <Badge tone="violet"><Icon name="sparkles" size={12} /> {children}</Badge>;
}
