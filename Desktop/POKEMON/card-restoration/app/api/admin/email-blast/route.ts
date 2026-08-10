import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { z } from "zod";

const Schema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Subject and body are required." }, { status: 400 });

  const { subject, body: messageBody } = parsed.data;

  const admin = createAdminClient();

  const [{ data: restorationOrders }, { data: shopOrders }, { data: waitlistRows }, { data: rlWaitlist }] =
    await Promise.all([
      admin.from("orders").select("customer_name, customer_email").neq("status", "awaiting_payment"),
      admin.from("shop_orders").select("customer_name, customer_email"),
      admin.from("waitlist").select("email"),
      admin.from("restoration_waitlist").select("name, email"),
    ]);

  const emailMap = new Map<string, string>(); // email → name

  for (const o of restorationOrders ?? []) {
    const e = (o.customer_email ?? "").toLowerCase().trim();
    if (e) emailMap.set(e, emailMap.get(e) ?? (o.customer_name ?? ""));
  }
  for (const o of shopOrders ?? []) {
    const e = (o.customer_email ?? "").toLowerCase().trim();
    if (e) emailMap.set(e, emailMap.get(e) ?? (o.customer_name ?? ""));
  }
  for (const w of waitlistRows ?? []) {
    const e = (w.email ?? "").toLowerCase().trim();
    if (e && !emailMap.has(e)) emailMap.set(e, "");
  }
  for (const w of rlWaitlist ?? []) {
    const e = (w.email ?? "").toLowerCase().trim();
    if (e && !emailMap.has(e)) emailMap.set(e, w.name ?? "");
  }

  const recipients = Array.from(emailMap.entries());
  if (recipients.length === 0) return Response.json({ ok: true, sent: 0 });

  // Wrap plain text in a clean HTML email template
  const htmlBody = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.6">
      ${messageBody
        .split("\n")
        .map((line) => (line.trim() === "" ? "<br>" : `<p style="margin:0 0 12px">${line}</p>`))
        .join("")}
      <hr style="margin:28px 0;border:none;border-top:1px solid #eee" />
      <p style="font-size:12px;color:#999;margin:0">${businessName} · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com"}" style="color:#999">thecarddoc1.com</a></p>
    </div>
  `;

  // Send in batches of 100 (Resend batch limit)
  const BATCH_SIZE = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const messages = chunk.map(([email, name]) => ({
      from: fromEmail,
      to: email,
      subject,
      html: htmlBody.replace(/Hi there/g, name ? `Hi ${name.split(" ")[0]}` : "Hi there"),
    }));

    try {
      await resend.batch.send(messages);
      sent += chunk.length;
    } catch (e) {
      console.error("Batch send failed", e);
      failed += chunk.length;
    }
  }

  return Response.json({ ok: true, sent, failed });
}
