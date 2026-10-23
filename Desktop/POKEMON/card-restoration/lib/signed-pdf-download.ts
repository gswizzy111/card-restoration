import type { createAdminClient } from "@/lib/supabase/admin";
import type { SignatureRow } from "@/lib/signatures";
import { SIGNED_BUCKET, signaturePdf, signedPdfFilename, storePdfOnce } from "@/lib/signed-pdfs";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * A signed PDF as a download: the stored copy, or (if it was never stored)
 * one built from the signature row and stored now.
 */
export async function signedPdfResponse(admin: Admin, signatureId: string): Promise<Response> {
  const { data } = await admin.from("signatures").select("*").eq("id", signatureId).maybeSingle();
  const sig = data as SignatureRow | null;
  if (!sig) return new Response("Not found", { status: 404 });
  const { data: order } = await admin.from("orders").select("order_number").eq("id", sig.order_id).single();
  if (!order) return new Response("Not found", { status: 404 });

  const path = sig.signed_pdf_url;
  let bytes: Uint8Array | null = null;
  if (path) {
    const { data: file } = await admin.storage.from(SIGNED_BUCKET).download(path);
    if (file) bytes = new Uint8Array(await file.arrayBuffer());
  }
  if (!bytes) {
    bytes = await signaturePdf(admin, sig, order);
    if (path) await storePdfOnce(admin, path, bytes);
  }
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${signedPdfFilename(sig, order.order_number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
