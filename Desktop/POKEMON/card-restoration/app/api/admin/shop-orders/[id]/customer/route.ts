import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  street1: z.string().optional().default(""),
  street2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  country: z.string().optional().default("US"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const { name, email, phone, street1, street2, city, state, zip, country } = parsed.data;
  const admin = createAdminClient();

  const shippingAddress = street1
    ? { street1, street2: street2 || null, city, state, zip, country }
    : null;

  const updatePayload: Record<string, unknown> = {
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
  };
  if (shippingAddress) updatePayload.shipping_address = shippingAddress;

  const { error } = await admin.from("shop_orders").update(updatePayload).eq("id", id);
  if (error) return Response.json({ error: "Failed to update" }, { status: 500 });

  return Response.json({ ok: true });
}
