import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { WeightUnitEnum, DistanceUnitEnum } from "shippo/models/components";

const BOX_KEYWORDS = ["official", "essential", "clamp"];

function getParcel(items: { product_name: string }[] | null) {
  const names = (items ?? []).map((i) => i.product_name ?? "");
  const needsBox = names.some((n) => BOX_KEYWORDS.some((kw) => n.toLowerCase().includes(kw)));
  return needsBox
    ? { massUnit: WeightUnitEnum.Lb, weight: "4", distanceUnit: DistanceUnitEnum.In, length: "10", width: "7", height: "7" }
    : { massUnit: WeightUnitEnum.Oz, weight: "6", distanceUnit: DistanceUnitEnum.In, length: "8", width: "5", height: "1" };
}

type ShippingAddress = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

async function getOrder(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("shop_orders").select("*").eq("id", id).single();
  return data;
}

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

// GET — return rates without purchasing
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  if (order.return_label_url) {
    return Response.json({ labelUrl: order.return_label_url, trackingNumber: order.tracking_number ?? null });
  }

  const addr = order.shipping_address as ShippingAddress | null;
  if (!addr?.street1) return Response.json({ error: "No shipping address on file" }, { status: 400 });

  const shipment = await shippo.shipments.create({
    addressFrom: businessAddress,
    addressTo: {
      name: order.customer_name ?? "",
      street1: addr.street1,
      street2: addr.street2 ?? "",
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country ?? "US",
      phone: order.customer_phone ?? "",
      email: order.customer_email ?? "",
    },
    parcels: [getParcel(order.items as { product_name: string }[] | null)],
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

  if (rates.length === 0) return Response.json({ error: "No rates available" }, { status: 500 });

  return Response.json({ rates });
}

// POST — purchase the chosen rate
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  if (order.return_label_url) {
    return Response.json({ labelUrl: order.return_label_url, trackingNumber: order.tracking_number ?? null });
  }

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

  const trackingNumber = transaction.trackingNumber ?? null;
  const trackingUrl = transaction.trackingUrlProvider ?? null;

  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from("shop_orders")
    .update({
      return_label_url: transaction.labelUrl,
      tracking_number: trackingNumber,
    })
    .eq("id", id);

  if (dbError) {
    console.error("Failed to save label data:", dbError);
    return Response.json({ error: `Label purchased but could not be saved: ${dbError.message}` }, { status: 500 });
  }

  // Send shipping email to customer
  if (order.customer_email && trackingNumber) {
    const firstName = (order.customer_name as string)?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customer_email as string,
        subject: `Your order is on the way! — ${businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">Your order has shipped!</h1>
            <p>Hi ${firstName}, your kit order is on its way to you.</p>

            <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:20px;margin:20px 0">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0891b2">Tracking Number</p>
              <p style="margin:0 0 10px;font-family:monospace;font-size:22px;font-weight:900;color:#0e7490;letter-spacing:0.05em">${trackingNumber}</p>
              ${trackingUrl
                ? `<a href="${trackingUrl}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Track Your Package →</a>`
                : ""}
            </div>

            <p style="font-size:14px;color:#666;">You can also copy the tracking number above and paste it on your carrier's website to follow your package.</p>
            <p style="font-size:13px;color:#666;margin-top:24px">Questions? Email us at <a href="mailto:gavinfraiman33@gmail.com" style="color:#c0392b">gavinfraiman33@gmail.com</a></p>
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
