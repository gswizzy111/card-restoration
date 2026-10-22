import { createAdminClient } from "@/lib/supabase/admin";
import { signedPdfResponse } from "@/lib/signed-pdf-download";

/**
 * The customer downloads a signed PDF from their order page, which they open
 * with the order number and email (the same check as the page itself).
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string; signatureId: string }> }) {
  const { orderNumber, signatureId } = await params;
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[0-9a-f-]{36}$/i.test(signatureId)) return new Response("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: sig } = await admin.from("signatures").select("order_id").eq("id", signatureId).maybeSingle();
  if (!sig) return new Response("Not found", { status: 404 });
  const { data: order } = await admin.from("orders").select("order_number, customer_email").eq("id", sig.order_id).single();
  const number = String(orderNumber).replace(/^(CD-?|R)/i, "");
  if (!order || String(order.order_number).replace(/^(CD-?|R)/i, "") !== number || order.customer_email?.trim().toLowerCase() !== email) {
    return new Response("Not found", { status: 404 });
  }
  return signedPdfResponse(admin, signatureId, url.searchParams.get("executed") === "1");
}
