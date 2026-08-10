import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

export const maxDuration = 60;

const DEFAULT_SUBJECT = `We're accepting restorations again — ${businessName}`;
const DEFAULT_EMAIL_BODY = `Hi [first name], great news — ${businessName} is now accepting restoration orders again.

You signed up to be notified, so we wanted to reach out right away.

Spots fill up fast — book soon to secure your place in the queue.`;
const DEFAULT_SMS = `Hi [first name]! ${businessName} is now accepting restoration orders. Book your spot:`;

const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com"}/tier-selection`;

function personalize(template: string, firstName: string): string {
  return template.replace(/\[first name\]/gi, firstName || "there");
}

function bodyToHtml(body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.6">
      ${body
        .split("\n")
        .map((line) =>
          line.trim() === ""
            ? "<br>"
            : `<p style="margin:0 0 12px">${line}</p>`
        )
        .join("")}
      <p style="margin:24px 0">
        <a href="${bookingUrl}" style="background:#1a8fe0;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">
          Book Your Restoration
        </a>
      </p>
      <hr style="margin:28px 0;border:none;border-top:1px solid #eee" />
      <p style="font-size:12px;color:#999;margin:0">${businessName} · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com"}" style="color:#999">thecarddoc1.com</a></p>
    </div>
  `;
}

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional body — supports custom messages and specific recipient IDs
  let ids: string[] | undefined;
  let emailSubject = DEFAULT_SUBJECT;
  let emailBody = DEFAULT_EMAIL_BODY;
  let smsMessage = DEFAULT_SMS;

  try {
    const body = await request.json();
    if (Array.isArray(body.ids)) ids = body.ids;
    if (body.emailSubject) emailSubject = body.emailSubject;
    if (body.emailBody) emailBody = body.emailBody;
    if (body.smsMessage) smsMessage = body.smsMessage;
  } catch {
    // no body — use defaults, send to all unnotified
  }

  const admin = createAdminClient();

  let query = admin.from("restoration_waitlist").select("id, name, email, phone");
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  } else {
    query = query.is("notified_at", null);
  }

  const { data: waitlist, error } = await query;
  if (error) return Response.json({ error: "Failed to load waitlist." }, { status: 500 });
  if (!waitlist || waitlist.length === 0) return Response.json({ ok: true, sent: 0, texts: 0 });

  let emailsSent = 0;
  let textsSent = 0;
  const notifiedIds: string[] = [];
  const textbeltKey = process.env.TEXTBELT_API_KEY;

  // Build all email messages first
  const emailMessages = waitlist.map((person) => {
    const firstName = (person.name ?? "").split(" ")[0] || "there";
    return {
      from: fromEmail,
      to: person.email,
      subject: emailSubject,
      html: bodyToHtml(personalize(emailBody, firstName)),
    };
  });

  // Send emails in batches of 100 (Resend batch limit)
  const BATCH = 100;
  for (let i = 0; i < emailMessages.length; i += BATCH) {
    const chunk = emailMessages.slice(i, i + BATCH);
    try {
      await resend.batch.send(chunk);
      emailsSent += chunk.length;
    } catch (e) {
      console.error(`Email batch ${i / BATCH + 1} failed`, e);
    }
  }

  // Send SMS individually (Textbelt has no batch API)
  for (const person of waitlist) {
    notifiedIds.push(person.id);

    if (!textbeltKey || !person.phone) continue;
    const firstName = (person.name ?? "").split(" ")[0] || "there";
    const digits = person.phone.replace(/\D/g, "");
    const normalized = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    try {
      const res = await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          message: `${personalize(smsMessage, firstName)} ${bookingUrl}`,
          key: textbeltKey,
        }),
      });
      const data = await res.json();
      if (data.success) textsSent++;
      else console.error("Textbelt error for", normalized, data.error);
    } catch (e) {
      console.error("Failed to text", person.phone, e);
    }
  }

  // Only mark as notified when sending to all unnotified (not for targeted/test sends)
  if (!ids && notifiedIds.length > 0) {
    await admin
      .from("restoration_waitlist")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
  }

  return Response.json({ ok: true, sent: emailsSent, texts: textsSent });
}
