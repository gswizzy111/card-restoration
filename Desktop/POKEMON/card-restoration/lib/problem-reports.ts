import type { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail } from "@/lib/resend";
import { escapeHtml } from "@/lib/card-inquiries";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * "Report a problem" from an order page (Terms Section 20, Section 24.3 for
 * kits): saved as a case so it shows in admin Cases, and emailed to the owner.
 */
export const PROBLEM_TYPE = "problem_report";
export { PROBLEM_NOTICE } from "@/lib/problem-report-notice";

export async function saveProblemReport(admin: Admin, r: {
  orderRef: string;
  orderLabel: string;
  customerName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  description: string;
  photoUrls: string[];
}): Promise<string | null> {
  const { data, error } = await admin.from("cases").insert({
    type: PROBLEM_TYPE,
    title: `Problem report: order ${r.orderLabel}`,
    description: r.description,
    status: "open",
    priority: "high",
    customer_name: r.customerName,
    customer_email: r.customerEmail,
    customer_phone: r.customerPhone,
    order_ref: r.orderRef,
    photo_urls: r.photoUrls,
  }).select("id").single();
  if (error || !data) {
    console.error("Problem report failed:", error?.message);
    return "We couldn't send your report. Please email thecarddoc1@gmail.com instead.";
  }
  const to = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  if (to) {
    await resend.emails.send({
      from: fromEmail,
      to,
      replyTo: r.customerEmail,
      subject: `Problem report — order ${r.orderLabel}`,
      html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
        <p><strong>${escapeHtml(r.customerName ?? r.customerEmail)}</strong> reported a problem with order ${escapeHtml(r.orderLabel)}:</p>
        <p style="white-space:pre-wrap;background:#f6f5f4;padding:12px;border-radius:8px">${escapeHtml(r.description)}</p>
        ${r.photoUrls.length ? `<p>${r.photoUrls.map((u, i) => `<a href="${escapeHtml(u)}">Photo ${i + 1}</a>`).join(" · ")}</p>` : "<p>No photos attached.</p>"}
        <p><a href="${appUrl}/admin/cases/${data.id}" style="color:#a23200;font-weight:700">Open the case →</a></p>
      </div>`,
    }).catch((err) => console.error("Problem report email failed:", err));
  }
  return null;
}
