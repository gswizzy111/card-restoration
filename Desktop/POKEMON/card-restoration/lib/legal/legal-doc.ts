/**
 * The small Markdown subset the legal texts in legal/*.md use: "# " title
 * lines, "## " section headings, "- " list items and plain paragraphs, with
 * [label](/path) links. Parsing never changes the wording; it only finds the
 * structure, so pages, checkout and PDFs all show the same text.
 */
export type DocBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string; id: string; num: string | null }
  | { kind: "para"; text: string; clause: string | null }
  | { kind: "list"; items: string[] };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function parseLegalMarkdown(md: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const raw of md.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (chunk.startsWith("## ")) {
      const text = chunk.slice(3).trim();
      const num = text.match(/^(\d+)\.\s/)?.[1] ?? null;
      blocks.push({ kind: "heading", text, num, id: num ? `section-${num}` : slug(text) });
    } else if (chunk.startsWith("# ")) {
      blocks.push({ kind: "title", text: chunk.slice(2).trim() });
    } else if (chunk.split("\n").every((l) => l.startsWith("- "))) {
      blocks.push({ kind: "list", items: chunk.split("\n").map((l) => l.slice(2).trim()) });
    } else {
      const text = chunk.replace(/\n/g, " ");
      blocks.push({ kind: "para", text, clause: text.match(/^(\d+\.\d+)\.\s/)?.[1] ?? null });
    }
  }
  return blocks;
}

type Heading = Extract<DocBlock, { kind: "heading" }>;

/** A section with its heading, up to the next heading: by number ("7") or by a test on the heading. */
export function sectionBlocks(blocks: DocBlock[], num: string | ((h: Heading) => boolean)): DocBlock[] {
  const match = typeof num === "string" ? (h: Heading) => h.num === num : num;
  const start = blocks.findIndex((b) => b.kind === "heading" && match(b));
  if (start < 0) return [];
  const end = blocks.findIndex((b, i) => i > start && b.kind === "heading");
  return blocks.slice(start, end < 0 ? undefined : end);
}

/** The number of the first clause whose text matches ("11.3"). */
export function findClause(blocks: DocBlock[], test: RegExp): string | null {
  for (const b of blocks) if (b.kind === "para" && b.clause && test.test(b.text)) return b.clause;
  return null;
}

/** The clauses whose text matches, word for word. */
export function clauseBlocks(blocks: DocBlock[], test: RegExp): DocBlock[] {
  return blocks.filter((b) => b.kind === "para" && b.clause !== null && test.test(b.text));
}

/** The value after "Label:" on a front-matter line, e.g. "Effective date". */
export function frontMatter(blocks: DocBlock[], label: string): string | null {
  for (const b of blocks) {
    if (b.kind === "para" && b.text.startsWith(`${label}:`)) return b.text.slice(label.length + 1).trim();
  }
  return null;
}

/** The quoted statement in the clause that contains `marker`, without the quotes. */
export function quotedStatement(blocks: DocBlock[], marker: string): string | null {
  for (const b of blocks) {
    if (b.kind !== "para" || !b.text.includes(marker)) continue;
    const open = b.text.indexOf('"', b.text.indexOf(marker));
    const close = b.text.lastIndexOf('"');
    if (open >= 0 && close > open) return b.text.slice(open + 1, close);
  }
  return null;
}

/** Plain text, one block per paragraph, as stored with a signature and printed in PDFs. */
export function blocksToText(blocks: DocBlock[]): string {
  return blocks
    .map((b) => (b.kind === "list" ? b.items.map((i) => `- ${i}`).join("\n") : b.text))
    .join("\n\n");
}
