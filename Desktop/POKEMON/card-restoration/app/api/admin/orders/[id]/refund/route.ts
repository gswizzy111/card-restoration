import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { z } from "zod";

const Body = z.object({
  amountCents: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
  sendEmail: z.boolean().optional(),
  customerMessage: z.string().max(1000).optional(),
});

export async function POST(
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

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, total_cents, stripe_session_id, payment_status, refunded_cents, customer_name, customer_email")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    console.error("[refund] order lookup failed:", orderErr?.message, "id:", id);
    return Response.json({ error: `Order not found (${orderErr?.message ?? "no data"})` }, { status: 404 });
  }
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return Response.json({ error: "Order has not been paid" }, { status: 400 });
  }
  if (!order.stripe_session_id) return Response.json({ error: "No Stripe session on this order" }, { status: 400 });

  const alreadyRefunded: number = (order.refunded_cents as number) ?? 0;
  const maxRefundable = (order.total_cents as number) - alreadyRefunded;
  if (maxRefundable <= 0) return Response.json({ error: "Order is already fully refunded" }, { status: 400 });

  const refundAmount = parsed.data.amountCents ?? maxRefundable;
  if (refundAmount > maxRefundable) {
    return Response.json({ error: `Cannot refund more than ${maxRefundable / 100} (remaining balance)` }, { status: 400 });
  }

  let paymentIntentId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id as string);
    paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("Stripe session retrieve failed:", e);
    return Response.json({ error: "Could not retrieve Stripe payment. Check the session ID." }, { status: 502 });
  }

  if (!paymentIntentId) {
    return Response.json({ error: "No payment intent found on this Stripe session (subscription orders use a different flow)" }, { status: 400 });
  }

  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        order_id: id,
        order_number: String(order.order_number),
        admin_reason: parsed.data.reason ?? "",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  const newRefundedCents = alreadyRefunded + refundAmount;
  const isFullRefund = newRefundedCents >= (order.total_cents as number);

  await admin
    .from("orders")
    .update({
      refunded_cents: newRefundedCents,
      ...(isFullRefund ? { status: "cancelled", payment_status: "refunded" } : { payment_status: "partially_refunded" }),
    })
    .eq("id", id);

  await admin.from("order_events").insert({
    order_id: id,
    event_type: "refund_issued",
    description: `Refund of $${(refundAmount / 100).toFixed(2)} issued${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}. Stripe refund ID: ${stripeRefund.id}`,
    is_customer_visible: false,
  });

  // Send customer email if requested
  if (parsed.data.sendEmail && order.customer_email) {
    const amountFormatted = `$${(refundAmount / 100).toFixed(2)}`;
    const orderNum = order.order_number;
    const name = (order.customer_name as string | null)?.split(" ")[0] ?? "there";
    const customNote = parsed.data.customerMessage?.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <!-- Header -->
        <tr><td style="background:#111827;padding:28px 32px;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${businessName}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Refund Processed</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Order #${orderNum}</p>

          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${name},</p>

          ${customNote ? `<div style="background:#f9fafb;border-left:4px solid #111827;border-radius:4px;padding:14px 16px;margin:0 0 20px;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${customNote.replace(/\n/g, "<br>")}</p>
          </div>` : ""}

          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            A ${isFullRefund ? "full" : "partial"} refund of <strong>${amountFormatted}</strong> has been processed to your original payment method.
            It typically takes <strong>5–10 business days</strong> to appear on your statement, depending on your bank.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
            <tr>
              <td style="font-size:13px;color:#6b7280;">Refund amount</td>
              <td align="right" style="font-size:15px;font-weight:800;color:#111827;">${amountFormatted}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding-top:6px;">Order number</td>
              <td align="right" style="font-size:13px;color:#374151;padding-top:6px;">#${orderNum}</td>
            </tr>
          </table>

          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            If you have any questions, just reply to this email and we'll get back to you.
          </p>

          <p style="margin:0;font-size:14px;color:#374151;">Thanks,<br /><strong>${businessName}</strong></p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">${businessName} · thecarddoc1.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
      from: fromEmail,
      to: order.customer_email as string,
      subject: `Your refund from ${businessName} — Order #${orderNum}`,
      html,
    }).catch((e) => console.error("[refund email]", e));
  }

  return Response.json({
    ok: true,
    refundId: stripeRefund.id,
    amountCents: refundAmount,
    newRefundedCents,
    isFullRefund,
  });
}
