import Link from "next/link";

/** Text with [label](/path) links, as used in the Terms content. */
export function LinkedText({ text, linkClassName }: { text: string; linkClassName: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        return m ? <Link key={i} href={m[2]} className={linkClassName}>{m[1]}</Link> : part;
      })}
    </>
  );
}
