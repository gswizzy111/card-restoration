import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Schema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const { customer_name, customer_email, customer_phone, street1, street2, city, state, zip } = parsed.data;
  const admin = createAdminClient();

  // Build address update if any address fields provided
  const hasAddress = street1 || city || state || zip;
  const addressUpdate = hasAddress
    ? { ship_from_address: { name: customer_name, street1: street1 ?? "", street2: street2 ?? null, city: city ?? "", state: state ?? "", zip: zip ?? "", country: "US" } }
    : {};

  const { error } = await admin
    .from("orders")
    .update({ customer_name, customer_email, customer_phone, ...addressUpdate })
    .eq("id", orderId);

  if (error) {
    console.error("Failed to update customer:", error);
    return Response.json({ error: "Failed to update customer" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
