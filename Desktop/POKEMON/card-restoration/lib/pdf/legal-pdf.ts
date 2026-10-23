import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocBlock } from "@/lib/legal/legal-doc";

/**
 * Plain, printable PDFs of the legal texts and signed records: US Letter,
 * Helvetica, page numbers and a footer line on every page. Signed records
 * read like a contract: the document, then signature lines, then the signing
 * record as a table. Server-only.
 */
export type SignatureParty = {
  /** "Customer", "The Card Doc LLC" */
  role: string;
  /** The typed name, drawn on the signature line; null while still to be signed */
  name: string | null;
  /** Shown under the line, e.g. the server's signing time */
  date: string | null;
  /** Shown instead when unsigned */
  pendingNote?: string;
};

export type PdfElement =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "para"; text: string }
  | { type: "lead"; text: string }
  | { type: "list"; items: string[] }
  | { type: "check"; text: string; checked: boolean }
  | { type: "amounts"; rows: { label: string; amount: string | null }[]; total?: { label: string; amount: string } }
  | { type: "fields"; rows: [string, string][] }
  | { type: "table"; rows: [string, string][] }
  | { type: "signatures"; parties: SignatureParty[] }
  | { type: "keep"; height: number }
  | { type: "rule" }
  | { type: "small"; text: string };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const WIDTH = PAGE_W - MARGIN * 2;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);
const LINE = rgb(0.8, 0.8, 0.8);
const FILL = rgb(0.955, 0.955, 0.955);
const SIGNATURE_INK = rgb(0.09, 0.18, 0.42);

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
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);

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
      case "lead":
        ensure(30);
        y -= 2;
        lines(el.text, bold, 9.5, INK, 0, 4);
        break;
      case "keep":
        // Starts a new page unless this much room is left (keeps a block together)
        ensure(el.height);
        break;
      case "check": {
        ensure(14);
        const box = 8;
        page.drawRectangle({ x: MARGIN + 1, y: y - 9.5, width: box, height: box, borderColor: INK, borderWidth: 0.8 });
        if (el.checked) {
          page.drawLine({ start: { x: MARGIN + 2.6, y: y - 5.6 }, end: { x: MARGIN + 4.6, y: y - 7.9 }, thickness: 1.1, color: INK });
          page.drawLine({ start: { x: MARGIN + 4.6, y: y - 7.9 }, end: { x: MARGIN + 7.6, y: y - 2.9 }, thickness: 1.1, color: INK });
        }
        lines(el.text, regular, 9.5, INK, 16, 5);
        break;
      }
      case "amounts": {
        // Item and price rows, prices right-aligned, with an optional bold total
        const size = 9.5, pad = 5, amountW = 90;
        const row = (label: string, amount: string | null, font: PDFFont, topRule: boolean) => {
          const labelLines = wrap(label, font, size, WIDTH - amountW - pad * 2);
          const h = labelLines.length * 12.5 + pad * 2 - 2;
          ensure(h);
          if (topRule) page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.9, color: INK });
          labelLines.forEach((l, i) => page.drawText(l, { x: MARGIN + pad, y: y - pad - size - i * 12.5 + 1, size, font, color: INK }));
          if (amount) {
            const a = printable(amount);
            page.drawText(a, { x: PAGE_W - MARGIN - pad - font.widthOfTextAtSize(a, size), y: y - pad - size + 1, size, font, color: INK });
          }
          y -= h;
          page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LINE });
        };
        // Keep a table that fits on one page together (so the total isn't left alone)
        const tableH = [...el.rows.map((r) => r.label), ...(el.total ? [el.total.label] : [])]
          .reduce((h, label) => h + wrap(label, regular, size, WIDTH - amountW - pad * 2).length * 12.5 + pad * 2 - 2, 0);
        if (tableH < PAGE_H - MARGIN * 2 - 60) ensure(tableH + 4);
        if (el.rows.length) {
          ensure(16);
          page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LINE });
        }
        for (const r of el.rows) row(r.label, r.amount, regular, false);
        if (el.total) row(el.total.label, el.total.amount, bold, true);
        y -= 10;
        break;
      }
      case "table": {
        // Bordered label/value rows, labels on a light fill
        const size = 9, pad = 6, labelW = 128, lh = 12;
        for (const [label, value] of el.rows) {
          const valueLines = wrap(value, regular, size, WIDTH - labelW - pad * 2);
          const h = Math.max(1, valueLines.length) * lh + pad * 2 - 3;
          ensure(h);
          page.drawRectangle({ x: MARGIN, y: y - h, width: labelW, height: h, color: FILL });
          page.drawRectangle({ x: MARGIN, y: y - h, width: WIDTH, height: h, borderColor: LINE, borderWidth: 0.6 });
          page.drawLine({ start: { x: MARGIN + labelW, y }, end: { x: MARGIN + labelW, y: y - h }, thickness: 0.6, color: LINE });
          page.drawText(printable(label), { x: MARGIN + pad, y: y - pad - size + 1, size, font: bold, color: INK });
          valueLines.forEach((l, i) => page.drawText(l, { x: MARGIN + labelW + pad, y: y - pad - size + 1 - i * lh, size, font: regular, color: INK }));
          y -= h;
        }
        y -= 10;
        break;
      }
      case "signatures": {
        // Side by side: role, the typed name in signature style, the line, name and date
        const gap = 36;
        const colW = el.parties.length > 1 ? (WIDTH - gap) / 2 : WIDTH * 0.55;
        const height = 104;
        ensure(height);
        y -= 8;
        el.parties.forEach((party, i) => {
          const x = MARGIN + i * (colW + gap);
          page.drawText(printable(party.role.toUpperCase()), { x, y: y - 8, size: 7.5, font: bold, color: MUTED });
          const lineY = y - 52;
          if (party.name) {
            let size = 22;
            const name = printable(party.name);
            while (size > 12 && script.widthOfTextAtSize(name, size) > colW - 8) size -= 1;
            page.drawText(name, { x: x + 4, y: lineY + 7, size, font: script, color: SIGNATURE_INK });
          }
          page.drawLine({ start: { x, y: lineY }, end: { x: x + colW, y: lineY }, thickness: 0.8, color: INK });
          const under = party.name
            ? [`Name: ${party.name}`, party.date ? `Date: ${party.date}` : ""]
            : [party.pendingNote ?? "Not signed yet", ""];
          under.filter(Boolean).forEach((text, j) => {
            const l = wrap(text, regular, 8, colW)[0] ?? "";
            page.drawText(l, { x, y: lineY - 11 - j * 11, size: 8, font: regular, color: party.name ? INK : MUTED });
          });
        });
        y -= height - 8;
        break;
      }
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
