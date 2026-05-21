import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const KIT_STATUSES = {
  paid:        { label: "Payment Received" },
  processing:  { label: "Processing" },
  shipped:     { label: "Shipped" },
  delivered:   { label: "Delivered" },
} as const;

export type KitStatus = keyof typeof KIT_STATUSES;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!status || !(status in KIT_STATUSES)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("shop_orders").update({ status }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
