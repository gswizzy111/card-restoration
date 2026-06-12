import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";
import { resend, fromEmail, businessName } from "@/lib/resend";

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

async function getOrder(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", id).single();
  return data;
}

function buildAddressTo(order: Record<string, unknown>, addr: Record<string, string>) {
  return {
    name: (order.customer_name as string) ?? "",
    street1: addr.street1,
    street2: addr.street2 ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    zip: addr.zip ?? "",
    country: addr.country ?? "US",
    phone: (order.customer_phone as string) ?? "",
    email: (order.customer_email as string) ?? "",
  };
}

// GET — return rates without purchasing
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  if (order.return_label_url) return Response.json({ labelUrl: order.return_label_url });

  const addr = order.ship_from_address as Record<string, string> | null;
  if (!addr?.street1) return Response.json({ error: "No customer address on file" }, { status: 400 });

  const shipment = await shippo.shipments.create({
    addressFrom: businessAddress,
    addressTo: buildAddressTo(order, addr),
    parcels: [{
      massUnit: "lb",
      weight: "1",
      distanceUnit: "in",
      length: "7",
      width: "5",
      height: "1",
    }],
    async: false,
  });

  const rates = [...(shipment.rates ?? [])]
    .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
    .slice(0, 5)
    .map((r) => ({
      objectId: r.objectId,
      provider: r.provider,
      service: r.servicelevel?.name ?? "",
      amount: r.amount,
      currency: r.currency,
      days: r.estimatedDays ?? null,
    }));

  if (rates.length === 0) return Response.json({ error: "No rates available from Shippo" }, { status: 500 });

  return Response.json({ rates });
}

// POST — purchase the chosen rate
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  if (order.return_label_url) return Response.json({ labelUrl: order.return_label_url });

  const { rateObjectId } = await req.json();
  if (!rateObjectId) return Response.json({ error: "Missing rateObjectId" }, { status: 400 });

  const transaction = await shippo.transactions.create({
    rate: rateObjectId,
    labelFileType: "PDF",
    async: false,
  });

  if (transaction.status !== "SUCCESS" || !transaction.labelUrl) {
    return Response.json({ error: "Label purchase failed" }, { status: 500 });
  }

  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ return_label_url: transaction.labelUrl, tracking_number: transaction.trackingNumber ?? null })
    .eq("id", id);

  const trackingNumber = transaction.trackingNumber ?? null;
  const trackingUrl = transaction.trackingUrlProvider ?? null;

  if (order.customer_email && trackingNumber) {
    const firstName = (order.customer_name as string)?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
    const orderTrackingUrl = `${appUrl}/orders/${order.order_number}`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email as string,
        subject: `Your restored cards are on the way! — ${businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">Your cards have been shipped!</h1>
            <p>Hi ${firstName}, your restored cards are on their way back to you.</p>

            <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:20px;margin:20px 0">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0891b2">Tracking Number</p>
              <p style="margin:0 0 10px;font-family:monospace;font-size:22px;font-weight:900;color:#0e7490;letter-spacing:0.05em">${trackingNumber}</p>
              ${trackingUrl
                ? `<a href="${trackingUrl}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Track Your Package →</a>`
                : ""}
            </div>

            <a href="${orderTrackingUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:24px">View Your Order →</a>

            <p style="font-size:14px;color:#666;">If you have any questions, reply to this email or reach out at <a href="mailto:${fromEmail}" style="color:#c0392b">${fromEmail}</a>.</p>
            <p style="font-size:13px;color:#999">${businessName}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send shipping email:", err);
    }
  }

  return Response.json({ labelUrl: transaction.labelUrl, trackingNumber });
}
