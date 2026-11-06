import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { escapeHtml, sendOrderUpdateEmail } from "@/lib/customer-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
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

  // A checkpoint the customer can see is also emailed to them
  let emailed = false;
  if (is_customer_visible) {
    const { data: order } = await admin.from("orders").select("customer_email, customer_name, order_number").eq("id", id).single();
    if (order) {
      emailed = await sendOrderUpdateEmail(
        order,
        `Update on your order — Order #${order.order_number}`,
        "Order Update",
        `<div style="background:#f9f9f9;border:1px solid #eee;border-radius:12px;padding:16px;margin:20px 0">
           <p style="margin:0;font-weight:700;font-size:16px">${escapeHtml(description.trim())}</p>
         </div>`,
      );
    }
  }

  return Response.json({ ok: true, emailed });
}
