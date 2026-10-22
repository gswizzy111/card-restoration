import type { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail } from "@/lib/resend";
import { INQUIRY_TYPE, OPEN_CASE_STATUSES, escapeHtml } from "@/lib/card-inquiries";

type Admin = ReturnType<typeof createAdminClient>;

// A customer can request an update on an order once a week (one open at a time).
export const UPDATE_REQUEST_COOLDOWN_DAYS = 7;
const COOLDOWN_MS = UPDATE_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export type UpdateRequestState = {
  /** When the customer's unanswered request was sent, if there is one. */
  askedAt: string | null;
  /** While the weekly limit applies: when they can ask again. */
  nextAllowedAt: string | null;
  /** Our most recent emailed answer for this order. */
  lastReply: { body: string; at: string } | null;
};

/**
 * Where a customer's update requests on one order stand. `ref` is the
 * order_ref the requests are filed under: the order number for restorations,
 * "K" + the order number for kit orders.
 */
export async function getUpdateRequestState(admin: Admin, ref: string): Promise<UpdateRequestState> {
  const { data } = await admin
    .from("cases")
    .select("id, status, created_at")
    .eq("type", INQUIRY_TYPE)
    .eq("order_ref", ref)
    .order("created_at", { ascending: false });
  const requests = data ?? [];
  const open = requests.find((q) => OPEN_CASE_STATUSES.includes(q.status));
  const latest = requests[0];
  const nextAllowed = latest ? Date.parse(latest.created_at) + COOLDOWN_MS : 0;

  const { data: reply } = requests.length
    ? await admin
        .from("case_notes")
        .select("body, created_at")
        .in("case_id", requests.map((q) => q.id))
        .eq("is_customer_visible", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return {
    askedAt: open?.created_at ?? null,
    nextAllowedAt: nextAllowed > Date.now() ? new Date(nextAllowed).toISOString() : null,
    lastReply: reply ? { body: reply.body, at: reply.created_at } : null,
  };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" });
}

/**
 * Files an update request as an inquiry case (shown under Update Requests in
 * the admin) and emails the shop. Refuses a second request within a week.
 */
export async function createUpdateRequest(
  admin: Admin,
  req: {
    ref: string;
    label: string;
    statusLabel: string;
    customer: { name: string | null; email: string; phone: string | null };
  }
): Promise<{ askedAt: string; nextAllowedAt: string | null } | { error: string; status: number; nextAllowedAt?: string | null }> {
  const state = await getUpdateRequestState(admin, req.ref);
  if (state.askedAt) return { askedAt: state.askedAt, nextAllowedAt: state.nextAllowedAt };
  if (state.nextAllowedAt) {
    return {
      error: `You can request another update on ${shortDate(state.nextAllowedAt)}. Updates can be requested once a week.`,
      status: 429,
      nextAllowedAt: state.nextAllowedAt,
    };
  }

  const name = req.customer.name || "The customer";
  const { data: created, error } = await admin
    .from("cases")
    .insert({
      type: INQUIRY_TYPE,
      title: `Update request (Order ${req.label})`,
      description: `${name} requested an update from their account. Order status when they asked: ${req.statusLabel}.`,
      priority: "normal",
      status: "open",
      customer_name: req.customer.name || null,
      customer_email: req.customer.email,
      customer_phone: req.customer.phone || null,
      order_ref: req.ref,
    })
    .select("id, created_at")
    .single();

  if (error || !created) {
    console.error("Failed to create update request:", error);
    return { error: "Something went wrong. Please try again.", status: 500 };
  }

  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  if (adminEmail) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `Update request — Order ${req.label}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:20px;font-weight:900">A customer requested an update</h1>
            <p><strong>${escapeHtml(name)}</strong> requested an update on order <strong>${escapeHtml(req.label)}</strong>.</p>
            <p style="color:#666;font-size:14px">${escapeHtml(req.customer.email)}${req.customer.phone ? ` · ${escapeHtml(req.customer.phone)}` : ""}</p>
            <p style="font-size:14px"><strong>Order status:</strong> ${escapeHtml(req.statusLabel)}</p>
            <a href="${appUrl}/admin/cases/${created.id}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">Reply to customer</a>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send update request admin email:", err);
    }
  }

  return { askedAt: created.created_at, nextAllowedAt: new Date(Date.parse(created.created_at) + COOLDOWN_MS).toISOString() };
}
