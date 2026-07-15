import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: waitlist, error } = await admin
    .from("restoration_waitlist")
    .select("id, name, email, phone")
    .is("notified_at", null);

  if (error) return Response.json({ error: "Failed to load waitlist." }, { status: 500 });
  if (!waitlist || waitlist.length === 0) return Response.json({ ok: true, sent: 0 });

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com"}/restoration`;

  let emailsSent = 0;
  let textsSent = 0;
  const notifiedIds: string[] = [];

  for (const person of waitlist) {
    // Send email
    try {
      await resend.emails.send({
        from: fromEmail,
        to: person.email,
        subject: `We're accepting restorations again — ${businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:22px;font-weight:900">We're Back!</h1>
            <p>Hi ${person.name.split(" ")[0] || "there"}, great news — ${businessName} is now accepting restoration orders again.</p>
            <p>You signed up to be notified, so we wanted to reach out right away.</p>
            <p style="margin:24px 0">
              <a href="${bookingUrl}" style="background:#1a8fe0;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">
                Book Your Restoration
              </a>
            </p>
            <p style="font-size:13px;color:#666">Spots fill up fast — book soon to secure your place in the queue.</p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
      emailsSent++;
    } catch (e) {
      console.error("Failed to email", person.email, e);
    }

    // Send SMS via Twilio if configured
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;

    if (twilioSid && twilioToken && twilioFrom && person.phone) {
      try {
        const body = new URLSearchParams({
          From: twilioFrom,
          To: person.phone,
          Body: `Hi ${person.name.split(" ")[0] || "there"}! ${businessName} is now accepting restoration orders. Book your spot: ${bookingUrl}`,
        });
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          }
        );
        if (res.ok) textsSent++;
      } catch (e) {
        console.error("Failed to text", person.phone, e);
      }
    }

    notifiedIds.push(person.id);
  }

  // Mark all as notified
  if (notifiedIds.length > 0) {
    await admin
      .from("restoration_waitlist")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
  }

  return Response.json({ ok: true, sent: emailsSent, texts: textsSent });
}
