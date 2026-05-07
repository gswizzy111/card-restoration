import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES } from "@/lib/constants";
import { resend, fromEmail, businessName } from "@/lib/resend";

const CUSTOMER_MESSAGES: Partial<Record<string, string>> = {
  received: "Great news — we've received your cards and they're checked in!",
  in_progress: "Your cards are now being worked on by our team.",
  completed: "Your cards are finished and looking great!",
  shipped_back: "Your cards have been shipped back to you — keep an eye on your mailbox!",
  delivered: "Your cards have been delivered. We hope you love the results!",
  cancelled: "Your order has been cancelled. Please reach out if you have any questions.",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();
  if (!status || !(status in ORDER_STATUSES)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("customer_email, customer_name, order_number")
    .eq("id", id)
    .single();

  const { error } = await admin.from("orders").update({ status }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("order_events").insert({
    order_id: id,
    event_type: "status_updated",
    description: `Status updated to: ${ORDER_STATUSES[status as keyof typeof ORDER_STATUSES].label}`,
    is_customer_visible: true,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const statusLabel = ORDER_STATUSES[status as keyof typeof ORDER_STATUSES].label;
  const customerMessage = CUSTOMER_MESSAGES[status];

  // Email customer on meaningful status changes
  if (order && customerMessage) {
    const firstName = order.customer_name?.split(" ")[0] ?? "there";
    const trackingUrl = `${appUrl}/orders/${order.order_number}`;
    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email,
        subject: `Update on your order — ${statusLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">Order Update</h1>
            <p style="color:#666;margin-top:0">Order <strong>#${order.order_number}</strong></p>
            <p>Hi ${firstName},</p>
            <p>${customerMessage}</p>
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:12px;padding:16px;margin:20px 0">
              <p style="margin:0;font-size:13px;color:#666">Current status</p>
              <p style="margin:4px 0 0;font-weight:700;font-size:16px">${statusLabel}</p>
            </div>
            <a href="${trackingUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Track Your Order</a>
            <p style="font-size:13px;color:#666;margin-top:24px">Questions? Email us at <a href="mailto:gavinfraiman33@gmail.com" style="color:#c0392b">gavinfraiman33@gmail.com</a></p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send status email:", err);
    }
  }

  // Notify admin when cards arrive
  if (status === "received" && order) {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? "gavinfraiman33@gmail.com";
    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `📦 Cards Arrived — Order #${order.order_number} from ${order.customer_name}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:20px;font-weight:900">Cards have arrived!</h1>
            <p>Order <strong>#${order.order_number}</strong> from <strong>${order.customer_name}</strong> has been marked as received.</p>
            <a href="${appUrl}/admin/orders/${id}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Order</a>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send admin received email:", err);
    }
  }

  return Response.json({ ok: true });
}
