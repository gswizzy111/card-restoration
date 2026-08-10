import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  tracking_number: z.string().max(100),
  carrier: z.string().max(50).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();

  // Try saving with carrier; fall back without it if column doesn't exist yet
  const { error } = await admin
    .from("shop_orders")
    .update({ tracking_number: parsed.data.tracking_number, carrier: parsed.data.carrier ?? null })
    .eq("id", id);

  if (error) {
    if (error.code === "42703" || error.message.toLowerCase().includes("carrier")) {
      const { error: e2 } = await admin
        .from("shop_orders")
        .update({ tracking_number: parsed.data.tracking_number })
        .eq("id", id);
      if (e2) return Response.json({ error: e2.message }, { status: 500 });
      return Response.json({ ok: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
