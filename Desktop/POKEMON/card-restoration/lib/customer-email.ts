import { resend, fromEmail, businessName } from "@/lib/resend";

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
export { escape as escapeHtml };

export type EmailOrder = { customer_email: string | null; customer_name: string | null; order_number: string | number };

/** The customer's tracking page, signed in by their email. */
export function trackingUrl(order: EmailOrder) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const email = order.customer_email ? `?email=${encodeURIComponent(order.customer_email)}` : "";
  return `${appUrl}/orders/${order.order_number}${email}`;
}

/**
 * An order update email in the same style as the status emails
 * (app/api/admin/orders/[id]/status). `bodyHtml` must already be escaped.
 * Returns whether it was sent; a failure is logged, never thrown.
 */
export async function sendOrderUpdateEmail(order: EmailOrder, subject: string, heading: string, bodyHtml: string) {
  if (!order.customer_email) return false;
  const firstName = escape(order.customer_name?.split(" ")[0] || "there");
  const contact = process.env.CONTACT_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL;
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: order.customer_email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
          <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">${escape(heading)}</h1>
          <p style="color:#666;margin-top:0">Order <strong>#${escape(String(order.order_number))}</strong></p>
          <p>Hi ${firstName},</p>
          ${bodyHtml}
          <a href="${trackingUrl(order)}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">Track Your Order</a>
          <p style="font-size:13px;color:#666;margin-top:24px">Questions? Email us at <a href="mailto:${contact}" style="color:#c0392b">${contact}</a></p>
          <p style="font-size:13px;color:#999">${businessName}</p>
        </div>
      `,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`Failed to send "${subject}" email:`, err);
    return false;
  }
}
