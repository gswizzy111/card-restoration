import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { description, is_customer_visible } = await request.json();

  if (!description?.trim()) {
    return Response.json({ error: "Description is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("order_events").insert({
    order_id: id,
    event_type: "checkpoint",
    description: description.trim(),
    is_customer_visible: is_customer_visible ?? false,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
