import { H, P } from "./Typography";

/** Renders "## Heading" bodies (Terms/Privacy). Plain text only — never HTML. */
export function Doc({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((b, i) => {
        if (b.startsWith("## ")) {
          const [head = "", ...rest] = b.split("\n");
          return (
            <div key={i}>
              <H l={3} as="h2" style={{ fontSize: 17, margin: "18px 0 6px" }}>{head.slice(3)}</H>
              {rest.length > 0 && <P style={{ fontSize: 15 }}>{rest.join(" ")}</P>}
            </div>
          );
        }
        return <P key={i} style={{ fontSize: 15 }}>{b}</P>;
      })}
    </>
  );
}
