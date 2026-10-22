import { resend, fromEmail, businessName } from "@/lib/resend";
import { orderLabel, escapeHtml } from "@/lib/card-inquiries";

/**
 * Unclaimed and undeliverable property (Terms Section 21): we notify, keep a
 * dated log of every notice, and escalate after 90 days. Nothing here sells,
 * disposes of or takes ownership of a card; Section 21.3 needs a separate
 * legal basis for that.
 */
export const UNCLAIMED_DAYS = 90;
export type NoticeKind = "ready_for_return" | "undeliverable" | "follow_up";

export const NOTICE_LABEL: Record<NoticeKind, string> = {
  ready_for_return: "Ready for return",
  undeliverable: "Undeliverable",
  follow_up: "Follow-up",
};

/** The emailed notice for an order. */
export async function sendNoticeEmail(order: { order_number: string | number; customer_name: string | null; customer_email: string }, kind: NoticeKind, note?: string) {
  const name = (order.customer_name ?? "").split(" ")[0] || "there";
  const label = orderLabel(order.order_number);
  const what = kind === "undeliverable"
    ? `the return package for order ${label} came back to us as undeliverable`
    : `your cards from order ${label} are ready to come back to you`;
  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Action needed: order ${label} — ${businessName}`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;font-size:15px;line-height:1.6;color:#222">
      <p>Hi ${escapeHtml(name)},</p>
      <p>This is a notice that ${what}. Please reply to this email or write to thecarddoc1@gmail.com to confirm your return address and arrange shipping${kind === "ready_for_return" ? " and any payment still due" : ""}.</p>
      ${note ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>` : ""}
      <p>We keep your property safe in the meantime; we don't take ownership of it.</p>
      <p style="color:#666;font-size:13px">${businessName} · thecarddoc1@gmail.com</p>
    </div>`,
  });
}
