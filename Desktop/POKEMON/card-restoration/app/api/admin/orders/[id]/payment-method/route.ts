import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_METHODS = ["card", "gift_card", "cash", "venmo", "zelle", "check", "other"] as const;
type PaymentMethod = typeof VALID_METHODS[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const method: PaymentMethod | null = body.paymentMethod ?? null;

  if (method !== null && !VALID_METHODS.includes(method)) {
    return Response.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payment_method: method } as any)
    .eq("id", id);

  if (error) {
    console.error("[payment-method PATCH]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
