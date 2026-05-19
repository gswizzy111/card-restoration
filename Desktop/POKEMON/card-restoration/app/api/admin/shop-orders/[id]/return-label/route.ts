import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";

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
    return Response.json({ labelUrl: order.return_label_url });
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
    parcels: [{
      massUnit: "lb",
      weight: "3",
      distanceUnit: "in",
      length: "12",
      width: "10",
      height: "8",
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
    return Response.json({ labelUrl: order.return_label_url });
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

  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from("shop_orders")
    .update({ return_label_url: transaction.labelUrl })
    .eq("id", id);

  if (dbError) {
    console.error("Failed to save return_label_url:", dbError);
    return Response.json(
      { error: `Label was purchased but could not be saved: ${dbError.message}. Run: ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS return_label_url TEXT;` },
      { status: 500 }
    );
  }

  return Response.json({ labelUrl: transaction.labelUrl });
}
