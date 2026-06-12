import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { notes } = await request.json();

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("customer_name, customer_email, order_number")
    .eq("id", id)
    .single();
  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });

  const { error } = await admin.from("orders").update({ admin_notes: notes ?? "" }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (order?.customer_email && notes?.trim()) {
    const firstName = (order.customer_name as string)?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const orderTrackingUrl = `${appUrl}/orders/${order.order_number}`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email as string,
        subject: `Restoration complete — notes from The Card Doc`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">Your restoration is complete!</h1>
            <p>Hi ${firstName}, we finished working on your cards and wanted to share our notes.</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">Restoration Notes</p>
              <p style="margin:0;font-size:15px;color:#111;white-space:pre-wrap;">${notes.trim()}</p>
            </div>

            <a href="${orderTrackingUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:24px">View Your Order →</a>

            <p style="font-size:14px;color:#666;">Questions? Reply to this email or reach out at <a href="mailto:${fromEmail}" style="color:#c0392b">${fromEmail}</a>.</p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send notes email:", err);
    }
  }

  return Response.json({ ok: true });
}
