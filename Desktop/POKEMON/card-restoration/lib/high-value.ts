import { createHash, randomBytes } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { agreementText, cardTitle, highValueAgreementDoc, type CardDetails } from "@/lib/legal/agreements-v1";
import { documentHash, recordSignatures, signingContext, type SignatureRow } from "@/lib/signatures";
import { ensureTermsVersion } from "@/lib/terms-versions";
import { signaturePdf, signedPdfFilename, storePdfOnce } from "@/lib/signed-pdfs";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * High-Value Card Restoration & Custody Agreements (Terms Section 4.2): every
 * card valued above $5,000 stays on hold (cards.status on_hold_high_value)
 * until the customer signs its agreement from an emailed link and The Card Doc
 * countersigns it on the admin order page. Shared by both sites.
 */
export type HighValueAgreement = {
  id: string;
  order_id: string;
  order_item_id: string;
  negotiated_terms: string;
  token_hash: string | null;
  sent_at: string | null;
  customer_signature_id: string | null;
  company_signed_by: string | null;
  company_signed_at: string | null;
  status: "pending" | "executed" | "declined";
  declined_reason: string | null;
};

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
const ownerEmail = () => process.env.ADMIN_NOTIFY_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL ?? "";
const displayOrder = (n: string | number) => (/^\d+$/.test(String(n)) ? `R${n}` : String(n));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function emailShell(title: string, body: string) {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;color:#111">
      <div style="background:#a23200;border-radius:12px 12px 0 0;padding:22px;text-align:center">
        <p style="margin:0;color:#fed8c4;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${businessName}</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;margin:6px 0 0;color:#fff;font-size:24px;font-weight:900">${title}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e6e4e2;border-top:0;border-radius:0 0 12px 12px;padding:26px;font-size:15px;line-height:1.6;color:#333">${body}</div>
    </div>`;
}

export async function loadAgreementContext(admin: Admin, agreement: HighValueAgreement) {
  const [{ data: order }, { data: card }] = await Promise.all([
    admin.from("orders").select("id, order_number, customer_name, customer_email").eq("id", agreement.order_id).single(),
    admin.from("cards").select("*").eq("id", agreement.order_item_id).single(),
  ]);
  if (!order || !card) return null;
  const details: CardDetails = { ...card, declared_value_cents: card.estimated_value_cents };
  const doc = highValueAgreementDoc(details, { orderNumber: displayOrder(order.order_number), customerName: order.customer_name ?? order.customer_email }, agreement.negotiated_terms);
  return { order, card, details, doc };
}

/** A new signing link for the agreement (the previous one stops working) and its email. */
export async function sendHighValueRequest(admin: Admin, agreement: HighValueAgreement): Promise<string | null> {
  if (agreement.status !== "pending" || agreement.customer_signature_id) return "This agreement is no longer waiting for the customer.";
  const ctx = await loadAgreementContext(admin, agreement);
  if (!ctx) return "Order or card not found.";
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("high_value_agreements")
    .update({ token_hash: tokenHash(token), sent_at: new Date().toISOString() })
    .eq("id", agreement.id);
  if (error) return error.message;
  const link = `${appUrl()}/agreements/high-value/sign/${token}`;
  const name = (ctx.order.customer_name ?? "").split(" ")[0] || "there";
  try {
    await resend.emails.send({
      from: fromEmail,
      to: ctx.order.customer_email,
      subject: `Please sign: High-Value Agreement for ${cardTitle(ctx.details)} (order ${displayOrder(ctx.order.order_number)})`,
      html: emailShell("High-Value Agreement", `
        <p>Hi ${esc(name)},</p>
        <p>Your card <strong>${esc(cardTitle(ctx.details))}</strong> is declared above $5,000, so it needs its own High-Value Card Restoration &amp; Custody Agreement before we begin work. The card stays on hold until both of us sign.</p>
        <p style="text-align:center;margin:26px 0"><a href="${link}" style="display:inline-block;background:#a23200;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700">Review and sign the agreement</a></p>
        <p style="font-size:13px;color:#666">This link is just for you; please don't forward it. Questions? Reply to this email or write to thecarddoc1@gmail.com.</p>`),
    });
  } catch (err) {
    console.error("High-value agreement email failed:", err);
    return "The email could not be sent.";
  }
  await admin.from("order_events").insert({
    order_id: agreement.order_id,
    event_type: "high_value_sent",
    description: `High-Value Agreement for ${ctx.card.card_name} emailed to the customer for signature`,
    is_customer_visible: true,
  });
  return null;
}

/** After payment: email every unsent agreement on the order and tell the owner. */
export async function startHighValueAgreements(admin: Admin, orderId: string) {
  const { data } = await admin.from("high_value_agreements").select("*").eq("order_id", orderId).eq("status", "pending").is("sent_at", null);
  const pending = (data ?? []) as HighValueAgreement[];
  if (!pending.length) return;
  const names: string[] = [];
  for (const a of pending) {
    const err = await sendHighValueRequest(admin, a);
    if (err) console.error(`High-value agreement ${a.id}:`, err);
    const ctx = await loadAgreementContext(admin, a);
    if (ctx) names.push(cardTitle(ctx.details));
  }
  const { data: order } = await admin.from("orders").select("order_number").eq("id", orderId).single();
  if (ownerEmail() && order) {
    await resend.emails.send({
      from: fromEmail,
      to: ownerEmail(),
      subject: `On hold: High-Value Agreement needed (order ${displayOrder(order.order_number)})`,
      html: emailShell("High-Value Agreement needed", `
        <p>Order ${displayOrder(order.order_number)} has ${pending.length} card${pending.length === 1 ? "" : "s"} declared above $5,000:</p>
        <ul>${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
        <p>The customer was emailed the agreement to sign. You can add negotiated terms and resend it from the order page; once they sign, countersign there. No work can start until both of you have signed.</p>
        <p><a href="${appUrl()}/admin/orders/${orderId}" style="color:#a23200;font-weight:700">Open the order →</a></p>`),
    }).catch((err) => console.error("Owner high-value email failed:", err));
  }
}

export async function agreementByToken(admin: Admin, token: string): Promise<HighValueAgreement | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await admin.from("high_value_agreements").select("*").eq("token_hash", tokenHash(token)).maybeSingle();
  return (data as HighValueAgreement | null) ?? null;
}

/** The customer signs from the emailed link (which shows they control the order's email). */
export async function customerSignHighValue(admin: Admin, request: Request, agreement: HighValueAgreement, signerName: string): Promise<string | null> {
  if (agreement.status !== "pending") return "This agreement is no longer open for signature.";
  if (agreement.customer_signature_id) return "You've already signed this agreement.";
  const ctx = await loadAgreementContext(admin, agreement);
  if (!ctx) return "We couldn't find this order.";
  const terms = await ensureTermsVersion(admin);
  const text = agreementText(ctx.doc);
  const signed = await recordSignatures(admin, [{
    order_id: agreement.order_id,
    order_item_id: agreement.order_item_id,
    type: "high_value",
    terms_version_id: terms.id,
    document_title: ctx.doc.title,
    document_text: text,
    document_sha256: documentHash(text),
    card_snapshot: { ...ctx.details, negotiated_terms: agreement.negotiated_terms },
    typed_full_name: signerName,
  }], await signingContext(request, ctx.order.customer_email, true));
  if ("error" in signed) return "We couldn't save your signature. Please try again.";
  const sig = signed.rows[0];
  // The link has done its job
  await admin.from("high_value_agreements").update({ customer_signature_id: sig.id, token_hash: null }).eq("id", agreement.id);
  await admin.from("order_events").insert({
    order_id: agreement.order_id,
    event_type: "high_value_customer_signed",
    description: `Customer signed the High-Value Agreement for ${ctx.card.card_name}; waiting for The Card Doc's countersignature`,
    is_customer_visible: true,
  });
  const bytes = await signaturePdf(admin, sig, ctx.order);
  if (sig.signed_pdf_url) await storePdfOnce(admin, sig.signed_pdf_url, bytes);
  await resend.emails.send({
    from: fromEmail,
    to: ctx.order.customer_email,
    subject: `Signed: High-Value Agreement for ${cardTitle(ctx.details)}`,
    html: emailShell("Thanks for signing", `<p>Your signed copy is attached. We'll countersign and email you the fully signed agreement; the card stays on hold until then.</p>`),
    attachments: [{ filename: signedPdfFilename(sig, ctx.order.order_number), content: Buffer.from(bytes) }],
  }).catch((err) => console.error("Customer high-value copy failed:", err));
  if (ownerEmail()) {
    await resend.emails.send({
      from: fromEmail,
      to: ownerEmail(),
      subject: `Countersign: High-Value Agreement for ${cardTitle(ctx.details)} (order ${displayOrder(ctx.order.order_number)})`,
      html: emailShell("Ready to countersign", `<p>${esc(ctx.order.customer_name ?? "The customer")} signed the High-Value Agreement for <strong>${esc(cardTitle(ctx.details))}</strong>. Countersign it on the order page to release the card for work.</p>
        <p><a href="${appUrl()}/admin/orders/${agreement.order_id}" style="color:#a23200;font-weight:700">Open the order →</a></p>`),
    }).catch((err) => console.error("Owner countersign email failed:", err));
  }
  return null;
}

/** The Card Doc countersigns: the agreement is executed and the card comes off hold. */
export async function countersignHighValue(admin: Admin, agreement: HighValueAgreement, signedBy: string): Promise<string | null> {
  if (agreement.status !== "pending") return "This agreement is not waiting for a countersignature.";
  if (!agreement.customer_signature_id) return "The customer hasn't signed yet.";
  const signedAt = new Date().toISOString();
  const { error } = await admin.from("high_value_agreements")
    .update({ status: "executed", company_signed_by: signedBy, company_signed_at: signedAt })
    .eq("id", agreement.id)
    .eq("status", "pending");
  if (error) return error.message;
  await admin.from("cards").update({ status: "active" }).eq("id", agreement.order_item_id).eq("status", "on_hold_high_value");
  const ctx = await loadAgreementContext(admin, agreement);
  const { data: sig } = await admin.from("signatures").select("*").eq("id", agreement.customer_signature_id).single();
  await admin.from("order_events").insert({
    order_id: agreement.order_id,
    event_type: "high_value_executed",
    description: `High-Value Agreement${ctx ? ` for ${ctx.card.card_name}` : ""} countersigned by ${signedBy}; the card is released for work`,
    is_customer_visible: true,
  });
  if (ctx && sig) {
    const bytes = await signaturePdf(admin, sig as SignatureRow, ctx.order, { signed_by: signedBy, signed_at: signedAt });
    await storePdfOnce(admin, executedPdfPath(agreement), bytes);
    await resend.emails.send({
      from: fromEmail,
      to: ctx.order.customer_email,
      subject: `Fully signed: High-Value Agreement for ${cardTitle(ctx.details)}`,
      html: emailShell("Agreement complete", `<p>We've countersigned the High-Value Agreement for <strong>${esc(cardTitle(ctx.details))}</strong>. The fully signed copy is attached, and your card is released for work.</p>`),
      attachments: [{ filename: signedPdfFilename(sig as SignatureRow, ctx.order.order_number, true), content: Buffer.from(bytes) }],
    }).catch((err) => console.error("Executed agreement email failed:", err));
  }
  return null;
}

export const executedPdfPath = (a: { order_id: string; id: string }) => `${a.order_id}/hva-${a.id}-executed.pdf`;
