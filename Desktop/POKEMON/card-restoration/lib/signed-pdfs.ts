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

export type CompanySignature = { signed_by: string; signed_at: string };

function signatureFields(sig: SignatureRow, orderNumber: string | number): [string, string][] {
  // A master signature's snapshot is the whole order (printed in its text), not one card
  const card = sig.type === "master_terms" ? null : (sig.card_snapshot as CardDetails | null);
  return [
    ["Order", displayOrder(orderNumber)],
    ...(card ? [["Card", cardTitle(card)] as [string, string]] : []),
    ...(card?.cert_number ? [["Holder", holderLine(card)] as [string, string]] : []),
    ["Signed by", sig.typed_full_name],
    ["Signed at", utc(sig.signed_at)],
    ["Email", `${sig.email ?? "-"}${sig.email_verified ? " (verified)" : " (not verified)"}`],
    ["IP address", sig.ip_address ?? "-"],
    ["Device", sig.user_agent ?? "-"],
    ["Document SHA-256", sig.document_sha256],
    ["Signature ID", sig.id],
  ];
}

/** The PDF of one signed document. `company` adds The Card Doc's countersignature (high-value agreements). */
export async function signaturePdf(
  admin: Admin,
  sig: SignatureRow,
  order: { order_number: string | number },
  company?: CompanySignature | null,
): Promise<Uint8Array> {
  const { data: terms } = await admin.from("terms_versions").select("version, content_markdown").eq("id", sig.terms_version_id).single();
  const version = terms?.version ?? "";
  const elements: PdfElement[] = [
    { type: "title", text: sig.document_title },
    { type: "subtitle", text: `The Card Doc LLC - signed electronically under the Terms of Service v${version}` },
    { type: "rule" },
    { type: "heading", text: sig.type === "master_terms" ? "Customer signature" : "Signature" },
    { type: "fields", rows: signatureFields(sig, order.order_number) },
  ];
  if (company) {
    elements.push(
      { type: "heading", text: "Countersigned by The Card Doc LLC" },
      { type: "fields", rows: [["Signed by", company.signed_by], ["Signed at", utc(company.signed_at)]] },
    );
  }
  elements.push({ type: "rule" });
  if (sig.type === "master_terms" && terms) {
    elements.push(
      { type: "small", text: "The document signed: the Terms of Service below, then the certification, the consent to electronic records, the boxes checked, the services authorized and the optional choices." },
      ...blocksToPdf(parseLegalMarkdown(terms.content_markdown)),
      { type: "rule" },
    );
  }
  for (const chunk of sig.document_text.split(/\n{2,}/)) {
    if (chunk.startsWith("## ")) elements.push({ type: "heading", text: chunk.slice(3) });
    else if (chunk.split("\n").every((l) => l.startsWith("- "))) elements.push({ type: "list", items: chunk.split("\n").map((l) => l.slice(2)) });
    else elements.push({ type: "para", text: chunk });
  }
  return buildLegalPdf({
    title: `${sig.document_title} - order ${displayOrder(order.order_number)}`,
    footer: `${sig.document_title} - order ${displayOrder(order.order_number)} - signed ${utc(sig.signed_at)} - SHA-256 ${sig.document_sha256.slice(0, 16)}`,
    elements,
  });
}

export function signedPdfFilename(sig: SignatureRow, orderNumber: string | number, executed = false) {
  const card = (sig.card_snapshot as CardDetails | null)?.card_name;
  const what = sig.type === "master_terms" ? sig.document_title : `${sig.document_title}${card ? ` ${card}` : ""}`;
  return `${displayOrder(orderNumber)}-${fileSafe(what)}${executed ? "-executed" : ""}-signed.pdf`;
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
  const sigs = ((rows ?? []) as SignatureRow[]).filter((s) => s.type !== "high_value" && (!ids || ids.includes(s.id)));
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
