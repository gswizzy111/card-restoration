import type { createAdminClient } from "@/lib/supabase/admin";
import type { AgreementRow } from "@/lib/agreements";

/**
 * Stores the agreements signed at checkout (order_agreements), each with the
 * exact text, the typed name, the server's timestamp as its date, and where
 * it was signed from. Returns an error message when it couldn't be saved, so
 * checkout stops instead of taking payment without the signature on file.
 */
export async function recordAgreements(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  rows: AgreementRow[],
  request: Request,
): Promise<string | null> {
  if (!rows.length) return null;
  const ip = request.headers.get("x-nf-client-connection-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const { error } = await admin.from("order_agreements").insert(
    rows.map((r) => ({ order_id: orderId, ...r, ip, user_agent: userAgent }))
  );
  if (error) {
    console.error("Saving signed agreements failed:", error.message);
    return error.message;
  }
  const slab = rows.filter((r) => r.kind === "slab_removal").length;
  const high = rows.filter((r) => r.kind === "high_value").length;
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "agreements_signed",
    description: [
      slab ? "Slab-Removal Authorization" : "",
      high ? `High-Value Card Agreement × ${high}` : "",
    ].filter(Boolean).join(" and ") + ` signed by ${rows[0].signer_name}`,
    is_customer_visible: false,
  });
  return null;
}
