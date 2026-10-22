import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocBlock } from "@/lib/legal/legal-doc";

/**
 * Plain, printable PDFs of the legal texts and signed records: US Letter,
 * Helvetica, page numbers and a footer line on every page. Server-only.
 */
export type PdfElement =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "para"; text: string }
  | { type: "list"; items: string[] }
  | { type: "fields"; rows: [string, string][] }
  | { type: "rule" }
  | { type: "small"; text: string };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const WIDTH = PAGE_W - MARGIN * 2;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);

// Characters the standard fonts can draw (WinAnsi); anything else becomes "?".
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function printable(text: string): string {
  return Array.from(text.replace(/\t/g, " ").replace(/[‐‑−]/g, "-").replace(/ /g, " "))
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      if (ch === "\n") return ch;
      return "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of printable(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      // A single word wider than the line (a long hash or URL): break it
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let n = rest.length;
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function buildLegalPdf(opts: { title: string; footer: string; elements: PdfElement[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(printable(opts.title));
  pdf.setAuthor("The Card Doc LLC");
  pdf.setCreator("The Card Doc");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensure = (h: number) => { if (y - h < MARGIN + 24) newPage(); };

  const lines = (text: string, font: PDFFont, size: number, color = INK, indent = 0, gapAfter = 0) => {
    const lh = size * 1.38;
    for (const l of wrap(text, font, size, WIDTH - indent)) {
      ensure(lh);
      page.drawText(l, { x: MARGIN + indent, y: y - size, size, font, color });
      y -= lh;
    }
    y -= gapAfter;
  };

  for (const el of opts.elements) {
    switch (el.type) {
      case "title":
        lines(el.text, bold, 16, INK, 0, 4);
        break;
      case "subtitle":
        lines(el.text, regular, 9.5, MUTED, 0, 2);
        break;
      case "heading":
        ensure(40);
        y -= 8;
        lines(el.text, bold, 11, INK, 0, 3);
        break;
      case "para":
        lines(el.text, regular, 9.5, INK, 0, 6);
        break;
      case "small":
        lines(el.text, regular, 8, MUTED, 0, 4);
        break;
      case "list":
        for (const item of el.items) {
          ensure(14);
          page.drawText("•", { x: MARGIN + 2, y: y - 9.5, size: 9.5, font: regular, color: INK });
          lines(item, regular, 9.5, INK, 14, 3);
        }
        y -= 4;
        break;
      case "fields":
        for (const [label, value] of el.rows) {
          ensure(14);
          page.drawText(printable(label), { x: MARGIN, y: y - 9.5, size: 9.5, font: bold, color: INK });
          const valueLines = wrap(value, regular, 9.5, WIDTH - 150);
          for (const [i, l] of valueLines.entries()) {
            if (i > 0) ensure(13);
            page.drawText(l, { x: MARGIN + 150, y: y - 9.5, size: 9.5, font: regular, color: INK });
            y -= 13;
          }
          y -= 2;
        }
        y -= 4;
        break;
      case "rule":
        ensure(16);
        y -= 6;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.6, color: MUTED });
        y -= 10;
        break;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const footer = printable(`${opts.footer}   Page ${i + 1} of ${pages.length}`);
    const size = 7.5;
    const w = regular.widthOfTextAtSize(footer, size);
    p.drawText(footer, { x: Math.max(MARGIN, (PAGE_W - w) / 2), y: MARGIN - 26, size, font: regular, color: MUTED });
  });
  return pdf.save();
}

/** The legal-text blocks as PDF elements. */
export function blocksToPdf(blocks: DocBlock[]): PdfElement[] {
  return blocks.map((b): PdfElement => {
    if (b.kind === "title") return { type: "title", text: b.text };
    if (b.kind === "heading") return { type: "heading", text: b.text };
    if (b.kind === "list") return { type: "list", items: b.items.map(stripLinks) };
    return { type: "para", text: stripLinks(b.text) };
  });
}

/** "[label](/path)" reads as "label" on paper. */
const stripLinks = (t: string) => t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
