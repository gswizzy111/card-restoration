import { resend, fromEmail, businessName } from "@/lib/resend";

export type ConfirmationOrder = {
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  shipping_label_url: string | null;
};

/**
 * The order confirmation with next steps: the prepaid label when the order
 * has one, otherwise where to ship the cards. Sent by "Resend Confirmation"
 * and every time "Regenerate label" makes a new label. Throws if Resend
 * refuses the email.
 */
export async function sendOrderConfirmationEmail(order: ConfirmationOrder): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const firstName = (order.customer_name ?? "").split(" ")[0] || "there";
  const trackingUrl = `${appUrl}/orders/${order.order_number}`;
  const labelUrl = order.shipping_label_url as string | null;

  const shippingSection = labelUrl
    ? `<div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:24px;margin:24px 0">
        <p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#1e3a8a">📦 Your Prepaid Shipping Label Is Ready</p>
        <p style="margin:0 0 16px;color:#1e40af;font-size:14px;line-height:1.6">
          We've generated a prepaid label for you. Just:
        </p>
        <ol style="margin:0 0 16px;padding-left:20px;color:#1e40af;font-size:14px;line-height:2">
          <li>Package your cards securely in a bubble mailer or small box</li>
          <li>Print the label below and tape it to the outside</li>
          <li>Drop the package off at your nearest carrier location</li>
        </ol>
        <a href="${labelUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">⬇ Download Shipping Label (PDF)</a>
      </div>`
    : `<div style="background:#fefce8;border:2px solid #fbbf24;border-radius:12px;padding:24px;margin:24px 0">
        <p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#78350f">📬 Ship Your Cards To Us</p>
        <p style="margin:0 0 12px;color:#92400e;font-size:14px;line-height:1.6">
          Please send your cards using a tracked, insured shipping method (USPS Priority, UPS, or FedEx recommended).
        </p>
        <ol style="margin:0 0 16px;padding-left:20px;color:#92400e;font-size:14px;line-height:2">
          <li>Package your cards securely in a bubble mailer or small box</li>
          <li>Write your order number <strong>#${order.order_number}</strong> on the inside</li>
          <li>Ship to the address below and save your tracking number</li>
        </ol>
        <div style="background:#fff8e1;border:1px solid #fde68a;border-radius:8px;padding:14px">
          <p style="margin:0;color:#78350f;font-weight:700;font-size:15px;line-height:1.8">
            ${process.env.BUSINESS_SHIPPING_NAME ?? "The Card Doc"}<br>
            ${process.env.BUSINESS_SHIPPING_STREET1 ?? ""}${process.env.BUSINESS_SHIPPING_STREET2 ? `<br>${process.env.BUSINESS_SHIPPING_STREET2}` : ""}<br>
            ${process.env.BUSINESS_SHIPPING_CITY ?? ""}, ${process.env.BUSINESS_SHIPPING_STATE ?? ""} ${process.env.BUSINESS_SHIPPING_ZIP ?? ""}<br>
            United States
          </p>
        </div>
      </div>`;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Order Confirmed — ${businessName} #${order.order_number}`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#111">
        <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <p style="margin:0;color:#bfdbfe;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${businessName}</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:28px;font-weight:900">Order Confirmed ✓</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px">
          <p style="color:#666;margin:0 0 4px;font-size:13px">Order number</p>
          <p style="margin:0 0 20px;font-size:22px;font-weight:900;color:#111">#${order.order_number}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6">
            Hi ${firstName}! 👋 Thank you for your order. Here's what to do next to get your cards to us.
          </p>
          ${shippingSection}
          <div style="text-align:center;margin:24px 0">
            <a href="${trackingUrl}" style="display:inline-block;background:#111;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">View Your Order Status →</a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="font-size:13px;color:#666;margin:0 0 6px">Questions? We're always happy to help:</p>
          <p style="font-size:13px;color:#333;margin:0">
            Instagram: <a href="https://instagram.com/the_card_doc" style="color:#1d4ed8;font-weight:600">@the_card_doc</a>
          </p>
        </div>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}
