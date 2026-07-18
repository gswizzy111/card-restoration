import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
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

  const { data: note, error } = await admin
    .from("case_notes")
    .insert({ case_id: id, body: parsed.data.body, is_customer_visible: parsed.data.is_customer_visible })
    .select("id, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Update case updated_at
  await admin.from("cases").update({ updated_at: new Date().toISOString() }).eq("id", id);

  // Send email to customer if this note is customer-visible and the case has a customer email
  if (parsed.data.is_customer_visible) {
    const { data: caseRow } = await admin.from("cases").select("title, customer_name, customer_email").eq("id", id).single();
    if (caseRow?.customer_email) {
      await resend.emails.send({
        from: fromEmail,
        to: caseRow.customer_email,
        subject: `Update on your case: ${caseRow.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">Hi${caseRow.customer_name ? ` ${caseRow.customer_name}` : ""},</h2>
            <p style="color:#555">We have an update on your case: <strong>${caseRow.title}</strong></p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;font-size:15px;color:#333">${parsed.data.body}</div>
            <p style="color:#888;font-size:13px">If you have questions, reply to this email or contact us directly.</p>
            <p style="color:#888;font-size:13px;margin-top:24px">— ${businessName}</p>
          </div>
        `,
      }).catch(() => {/* fail silently */});
    }
  }

  return Response.json({ id: note.id, created_at: note.created_at });
}
