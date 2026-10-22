import type { createAdminClient } from "@/lib/supabase/admin";
import type { SignatureRow } from "@/lib/signatures";
import { SIGNED_BUCKET, signaturePdf, signedPdfFilename, storePdfOnce } from "@/lib/signed-pdfs";
import { executedPdfPath } from "@/lib/high-value";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * A signed PDF as a download: the stored copy, or (if it was never stored)
 * one built from the signature row and stored now. `executed` gives a
 * High-Value Agreement with The Card Doc's countersignature.
 */
export async function signedPdfResponse(admin: Admin, signatureId: string, executed = false): Promise<Response> {
  const { data } = await admin.from("signatures").select("*").eq("id", signatureId).maybeSingle();
  const sig = data as SignatureRow | null;
  if (!sig) return new Response("Not found", { status: 404 });
  const { data: order } = await admin.from("orders").select("order_number").eq("id", sig.order_id).single();
  if (!order) return new Response("Not found", { status: 404 });

  let path = sig.signed_pdf_url;
  let company: { signed_by: string; signed_at: string } | null = null;
  if (executed) {
    const { data: hva } = await admin.from("high_value_agreements")
      .select("id, order_id, status, company_signed_by, company_signed_at")
      .eq("customer_signature_id", sig.id).maybeSingle();
    if (!hva || hva.status !== "executed" || !hva.company_signed_by || !hva.company_signed_at) return new Response("Not countersigned yet", { status: 404 });
    path = executedPdfPath(hva);
    company = { signed_by: hva.company_signed_by, signed_at: hva.company_signed_at };
  }

  let bytes: Uint8Array | null = null;
  if (path) {
    const { data: file } = await admin.storage.from(SIGNED_BUCKET).download(path);
    if (file) bytes = new Uint8Array(await file.arrayBuffer());
  }
  if (!bytes) {
    bytes = await signaturePdf(admin, sig, order, company);
    if (path) await storePdfOnce(admin, path, bytes);
  }
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${signedPdfFilename(sig, order.order_number, executed)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
