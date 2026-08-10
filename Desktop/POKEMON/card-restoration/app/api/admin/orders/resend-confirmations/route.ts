import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

export const maxDuration = 60;

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  // Optional: pass specific order IDs, or default to today's paid orders
  const orderIds: string[] | undefined = Array.isArray(body.orderIds) ? body.orderIds : undefined;

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  let query = admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, inbound_method, shipping_label_url, ship_from_address")
    .eq("payment_status", "paid");

  if (orderIds && orderIds.length > 0) {
    query = query.in("id", orderIds);
  } else {
    // Default: all paid orders from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query = query.gte("updated_at", todayStart.toISOString());
  }

  const { data: orders, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!orders || orders.length === 0) return Response.json({ ok: true, sent: 0 });

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    const firstName = (order.customer_name ?? "").split(" ")[0] || "there";
    const trackingUrl = `${appUrl}/orders/${order.order_number}`;
    const labelUrl = order.shipping_label_url as string | null;

    const shippingSection = labelUrl
      ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:700;color:#1e3a8a">Your Prepaid Shipping Label</p>
          <p style="margin:0 0 16px;color:#1e40af;font-size:14px">Print this label, attach it to your package, and drop it off at the carrier.</p>
          <a href="${labelUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Download Label (PDF)</a>
        </div>`
      : `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:700;color:#78350f">Ship Your Cards To Us</p>
          <p style="margin:0 0 4px;color:#92400e;font-size:14px">Please send your cards to the address below using a tracked, insured method:</p>
          <p style="margin:8px 0 0;color:#78350f;font-weight:600;font-size:14px">
            ${process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc"}<br>
            ${process.env.BUSINESS_SHIPPING_STREET1 ?? ""}${process.env.BUSINESS_SHIPPING_STREET2 ? `<br>${process.env.BUSINESS_SHIPPING_STREET2}` : ""}<br>
            ${process.env.BUSINESS_SHIPPING_CITY ?? ""}, ${process.env.BUSINESS_SHIPPING_STATE ?? ""} ${process.env.BUSINESS_SHIPPING_ZIP ?? ""}<br>
            United States
          </p>
        </div>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email,
        subject: `Order Confirmed — ${businessName} #${order.order_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:24px;font-weight:900;margin-bottom:4px">Order Confirmed</h1>
            <p style="color:#666;margin-top:0">Order <strong>#${order.order_number}</strong></p>
            <p>Hi ${firstName}, thanks for your order! Here are your shipping instructions.</p>
            ${shippingSection}
            <a href="${trackingUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0 24px">Track Your Order</a>
            <p style="font-size:13px;color:#666">Questions? DM us on Instagram <strong>@thecarddoc</strong></p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
      sent++;
    } catch (e) {
      console.error("Failed to resend confirmation to", order.customer_email, e);
      failed++;
    }
  }

  return Response.json({ ok: true, sent, failed });
}
