import type { createAdminClient } from "@/lib/supabase/admin";
import { parseLegalMarkdown } from "@/lib/legal/legal-doc";
import { cardTitle, holderLine, type CardDetails } from "@/lib/legal/agreements-v1";
import { buildLegalPdf, blocksToPdf, type PdfElement } from "@/lib/pdf/legal-pdf";
import type { SignatureRow } from "@/lib/signatures";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Signed PDFs: one per signature, printed from the stored row (the exact text,
 * typed name, server time, hash and where it was signed from), so a copy can
 * always be rebuilt. Stored once in the private signed-documents bucket at the
 * path recorded on the signature; never overwritten.
 */
export const SIGNED_BUCKET = "signed-documents";

const utc = (iso: string) => new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
const displayOrder = (n: string | number) => (/^\d+$/.test(String(n)) ? `R${n}` : String(n));
const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function signatureFields(sig: SignatureRow, orderNumber: string | number): [string, string][] {
  // A master signature's snapshot is the whole order (printed in its text), not one card
  const card = sig.type === "master_terms" ? null : (sig.card_snapshot as CardDetails | null);
  return [
    ["Order", displayOrder(orderNumber)],
    ...(card ? [["Card", cardTitle(card)] as [string, string]] : []),
    ...(card?.grading_company?.trim() || card?.cert_number?.trim() ? [["Holder", holderLine(card)] as [string, string]] : []),
    ["Signed by", sig.typed_full_name],
    ["Signed at", utc(sig.signed_at)],
    ["Email", `${sig.email ?? "-"}${sig.email_verified ? " (verified)" : " (not verified)"}`],
    ["IP address", sig.ip_address ?? "-"],
    ["Device", sig.user_agent ?? "-"],
    ["Document SHA-256", sig.document_sha256],
    ["Signature ID", sig.id],
  ];
}

const AMOUNT = /^(.*): (-?\$[\d,]+\.\d{2})$/;

/**
 * The stored text as PDF elements: headings, ticked boxes as checkboxes, and
 * item lists with prices (services, order lines, the total) as a price table.
 * Only the layout changes; every word is the stored text.
 */
function documentElements(text: string, title: string): PdfElement[] {
  const out: PdfElement[] = [];
  text.split(/\n{2,}/).forEach((chunk, i) => {
    if (i === 0 && chunk === title) return; // the title is already at the top
    if (chunk.startsWith("## ")) { out.push({ type: "heading", text: chunk.slice(3) }); return; }
    const box = chunk.match(/^\[(x| )\] ([\s\S]+)$/);
    if (box) { out.push({ type: "check", text: box[2], checked: box[1] === "x" }); return; }
    const lines = chunk.split("\n");
    if (lines.every((l) => l.startsWith("- "))) {
      const items = lines.map((l) => l.slice(2));
      if (items.some((l) => AMOUNT.test(l))) {
        out.push({ type: "amounts", rows: items.map((l) => { const m = l.match(AMOUNT); return m ? { label: m[1], amount: m[2] } : { label: l, amount: null }; }) });
      } else {
        out.push({ type: "list", items });
      }
      return;
    }
    const total = chunk.match(/^(Order total): (-?\$[\d,]+\.\d{2})$/);
    if (total) {
      const prev = out[out.length - 1];
      if (prev?.type === "amounts" && !prev.total) prev.total = { label: total[1], amount: total[2] };
      else out.push({ type: "amounts", rows: [], total: { label: total[1], amount: total[2] } });
      return;
    }
    // A quoted section's heading ("4. Per-card market values; ...") and short labels ("Order:")
    if (!chunk.includes("\n") && chunk.length <= 100 && /^\d+\. \S/.test(chunk)) { out.push({ type: "heading", text: chunk }); return; }
    if (/^Card \d+: /.test(chunk) || (!chunk.includes("\n") && chunk.length <= 80 && chunk.endsWith(":"))) { out.push({ type: "lead", text: chunk }); return; }
    out.push({ type: "para", text: chunk });
  });
  return out;
}

/** The PDF of one signed document. */
export async function signaturePdf(
  admin: Admin,
  sig: SignatureRow,
  order: { order_number: string | number },
): Promise<Uint8Array> {
  const { data: terms } = await admin.from("terms_versions").select("version, content_markdown").eq("id", sig.terms_version_id).single();
  const version = terms?.version ?? "";
  const master = sig.type === "master_terms";
  const elements: PdfElement[] = [
    { type: "title", text: sig.document_title },
    { type: "subtitle", text: `The Card Doc LLC - order ${displayOrder(order.order_number)} - signed electronically under the Terms of Service v${version}` },
    { type: "small", text: master
      ? "The document signed: the Terms of Service below, then the certification, the consent to electronic records, the boxes checked, the services authorized and the optional choices. The signature and the signing record are at the end."
      : "The signatures and the signing record are at the end." },
    { type: "rule" },
  ];
  if (master && terms) elements.push(...blocksToPdf(parseLegalMarkdown(terms.content_markdown)), { type: "rule" });
  elements.push(...documentElements(sig.document_text, sig.document_title));

  // Signatures, like the end of a contract, then the record of how it was signed
  elements.push(
    { type: "keep", height: 250 },
    { type: "rule" },
    { type: "heading", text: "Signatures" },
    { type: "small", text: "Signed electronically: each name below was typed by the person signing. Dates and times are our server's (UTC)." },
    { type: "signatures", parties: [{ role: "Customer", name: sig.typed_full_name, date: utc(sig.signed_at) }] },
    { type: "heading", text: "Signing record" },
    { type: "table", rows: signatureFields(sig, order.order_number) },
  );
  return buildLegalPdf({
    title: `${sig.document_title} - order ${displayOrder(order.order_number)}`,
    footer: `${sig.document_title} - order ${displayOrder(order.order_number)} - signed ${utc(sig.signed_at)} - SHA-256 ${sig.document_sha256.slice(0, 16)}`,
    elements,
  });
}

export function signedPdfFilename(sig: SignatureRow, orderNumber: string | number) {
  const card = (sig.card_snapshot as CardDetails | null)?.card_name;
  const what = sig.type === "master_terms" ? sig.document_title : `${sig.document_title}${card ? ` ${card}` : ""}`;
  return `${displayOrder(orderNumber)}-${fileSafe(what)}-signed.pdf`;
}

/** Stores a PDF once; an existing file is left as it is. */
export async function storePdfOnce(admin: Admin, path: string, bytes: Uint8Array) {
  const { error } = await admin.storage.from(SIGNED_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error && !/exist|duplicate/i.test(error.message)) console.error(`Storing ${path} failed:`, error.message);
}

/**
 * Builds and stores the PDFs for an order's signatures (all, or only `ids`)
 * and returns them as email attachments.
 */
export async function signedPdfAttachments(admin: Admin, orderId: string, ids?: string[]) {
  const [{ data: order }, { data: rows }] = await Promise.all([
    admin.from("orders").select("order_number").eq("id", orderId).single(),
    admin.from("signatures").select("*").eq("order_id", orderId).order("signed_at"),
  ]);
  if (!order) return [];
  const sigs = ((rows ?? []) as SignatureRow[]).filter((s) => !ids || ids.includes(s.id));
  const out: { filename: string; content: Buffer }[] = [];
  for (const sig of sigs) {
    try {
      const bytes = await signaturePdf(admin, sig, order);
      if (sig.signed_pdf_url) await storePdfOnce(admin, sig.signed_pdf_url, bytes);
      out.push({ filename: signedPdfFilename(sig, order.order_number), content: Buffer.from(bytes) });
    } catch (err) {
      console.error(`Signed PDF for ${sig.id} failed:`, err);
    }
  }
  return out;
}
