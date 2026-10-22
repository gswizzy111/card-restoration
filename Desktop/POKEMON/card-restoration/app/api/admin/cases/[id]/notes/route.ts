import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { INQUIRY_TYPE, escapeHtml, orderLabel } from "@/lib/card-inquiries";
import { z } from "zod";

const NoteSchema = z.object({
  body: z.string().min(1),
  is_customer_visible: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();

  const { data: caseRow } = await admin
    .from("cases")
    .select("type, title, customer_name, customer_email, order_ref")
    .eq("id", id)
    .single();
  if (!caseRow) return Response.json({ error: "Case not found" }, { status: 404 });

  const isInquiry = caseRow.type === INQUIRY_TYPE;
  const emailed = parsed.data.is_customer_visible && !!caseRow.customer_email;

  // Email first: a note is only marked "Emailed to customer" if it really went out.
  if (emailed) {
    const firstName = caseRow.customer_name?.trim().split(/\s+/)[0];
    const greeting = `Hi${firstName ? ` ${escapeHtml(firstName)}` : ""},`;
    const label = escapeHtml(orderLabel(caseRow.order_ref));
    const subject = isInquiry
      ? `An update on your order ${orderLabel(caseRow.order_ref)}`
      : `Update on your case: ${caseRow.title}`;
    const intro = isInquiry
      ? `Here's an update on your card${caseRow.order_ref ? ` (order <strong>${label}</strong>)` : ""}:`
      : `We have an update on your case: <strong>${escapeHtml(caseRow.title)}</strong>`;

    const { error: sendError } = await resend.emails
      .send({
        from: fromEmail,
        to: caseRow.customer_email!,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">${greeting}</h2>
            <p style="color:#555">${intro}</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;font-size:15px;color:#333">${escapeHtml(parsed.data.body)}</div>
            <p style="color:#888;font-size:13px">If you have questions, reply to this email or contact us directly.</p>
            <p style="color:#888;font-size:13px;margin-top:24px">— ${businessName}</p>
          </div>
        `,
      })
      .catch((err: unknown) => ({ error: err }));

    if (sendError) {
      console.error("Failed to email case update:", sendError);
      return Response.json(
        { error: "The email didn't send, so nothing was saved. Please try again." },
        { status: 502 }
      );
    }
  }

  const { data: note, error } = await admin
    .from("case_notes")
    .insert({ case_id: id, body: parsed.data.body, is_customer_visible: emailed })
    .select("id, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Answering a "Where's my card?" question resolves it; the customer can ask again.
  await admin
    .from("cases")
    .update({
      updated_at: new Date().toISOString(),
      ...(isInquiry && emailed ? { status: "resolved" } : {}),
    })
    .eq("id", id);

  return Response.json({ id: note.id, created_at: note.created_at });
}
