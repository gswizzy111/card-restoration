import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin.from("orders").select("*").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  // Return cached label if already purchased
  if (order.return_label_url) {
    return Response.json({ labelUrl: order.return_label_url });
  }

  const addr = order.ship_from_address as Record<string, string> | null;
  if (!addr?.street1) {
    return Response.json({ error: "No customer address on file" }, { status: 400 });
  }

  const shipment = await shippo.shipments.create({
    addressFrom: businessAddress,
    addressTo: {
      name: order.customer_name ?? "",
      street1: addr.street1,
      street2: addr.street2 ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip: addr.zip ?? "",
      country: addr.country ?? "US",
      phone: order.customer_phone ?? "",
      email: order.customer_email ?? "",
    },
    parcels: [{
      massUnit: "lb",
      weight: "0.5",
      distanceUnit: "in",
      length: "6",
      width: "4",
      height: "1",
    }],
    async: false,
  });

  const rates = [...(shipment.rates ?? [])].sort(
    (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
  );

  if (rates.length === 0) {
    return Response.json({ error: "No shipping rates available from Shippo" }, { status: 500 });
  }

  const rate = rates[0];
  const transaction = await shippo.transactions.create({
    rate: rate.objectId,
    labelFileType: "PDF",
    async: false,
  });

  if (transaction.status !== "SUCCESS" || !transaction.labelUrl) {
    return Response.json({ error: "Label purchase failed" }, { status: 500 });
  }

  await admin
    .from("orders")
    .update({ return_label_url: transaction.labelUrl })
    .eq("id", id);

  return Response.json({ labelUrl: transaction.labelUrl, carrier: rate.provider, amount: rate.amount });
}
