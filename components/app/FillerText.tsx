import { splitFillers } from "@/lib/score";

/** Transcript with filler words highlighted (#9A6106 on warning-50). Built from React nodes, never innerHTML. */
export function FillerText({ text }: { text: string }) {
  return (
    <>
      {splitFillers(text).map((p, i) =>
        p.filler ? <mark key={i} style={{ background: "var(--warning-50)", color: "#9A6106", borderRadius: 4, padding: "0 3px", fontWeight: 700 }}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}
