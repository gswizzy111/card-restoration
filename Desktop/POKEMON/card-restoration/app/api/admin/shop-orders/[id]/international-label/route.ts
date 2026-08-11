import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";
import {
  WeightUnitEnum,
  DistanceUnitEnum,
  CustomsDeclarationContentsTypeEnum,
  CustomsDeclarationNonDeliveryOptionEnum,
  CustomsDeclarationEelPfcEnum,
} from "shippo/models/components";

export const maxDuration = 60;

const BOX_KEYWORDS = ["official", "essential", "clamp"];

function getParcel(items: { product_name: string }[] | null) {
  const names = (items ?? []).map((i) => i.product_name ?? "");
  const needsBox = names.some((n) => BOX_KEYWORDS.some((kw) => n.toLowerCase().includes(kw)));
  return needsBox
    ? { massUnit: WeightUnitEnum.Lb, weight: "4", distanceUnit: DistanceUnitEnum.In, length: "10", width: "7", height: "7" }
    : { massUnit: WeightUnitEnum.Oz, weight: "6", distanceUnit: DistanceUnitEnum.In, length: "8", width: "5", height: "1" };
}

type ShippingAddress = {
  street1: string; street2?: string; city: string; state?: string; zip: string; country: string;
};

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

// GET — create Shippo shipment with customs declaration, return rates
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const declaredValueCents = parseInt(url.searchParams.get("declared_value_cents") ?? "0", 10);

  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("*").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const addr = order.shipping_address as ShippingAddress | null;
  if (!addr?.country || addr.country === "US") {
    return Response.json({ error: "Not an international order" }, { status: 400 });
  }

  const parcel = getParcel(order.items as { product_name: string }[] | null);
  const valueAmount = ((declaredValueCents || order.total_cents || 0) / 100).toFixed(2);

  const shipment = await shippo.shipments.create({
    addressFrom: businessAddress,
    addressTo: {
      name: order.customer_name ?? "Customer",
      street1: addr.street1,
      street2: addr.street2 ?? "",
      city: addr.city,
      state: addr.state ?? "",
      zip: addr.zip,
      country: addr.country,
      phone: order.customer_phone ?? "",
      email: order.customer_email ?? "",
    },
    parcels: [parcel],
    customsDeclaration: {
      certify: true,
      certifySigner: businessAddress.name || "The Card Doc",
      contentsType: CustomsDeclarationContentsTypeEnum.Merchandise,
      nonDeliveryOption: CustomsDeclarationNonDeliveryOptionEnum.Return,
      eelPfc: CustomsDeclarationEelPfcEnum.NOEEI3037A,
      items: [
        {
          description: "Card restoration kit supplies",
          quantity: 1,
          netWeight: parcel.weight,
          massUnit: parcel.massUnit,
          valueAmount,
          valueCurrency: "USD",
          originCountry: "US",
        },
      ],
    },
    async: false,
  });

  const rates = [...(shipment.rates ?? [])]
    .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
    .map((r) => ({
      objectId: r.objectId,
      provider: r.provider,
      service: r.servicelevel?.name ?? "",
      amount: r.amount,
      currency: r.currency,
      days: r.estimatedDays ?? null,
    }));

  if (rates.length === 0) return Response.json({ error: "No international rates available for this address." }, { status: 400 });

  const existingLabels = (order as Record<string, unknown>).international_labels as unknown[] ?? [];
  return Response.json({ rates, existingLabels });
}

// POST — purchase the selected rate, save label + customs invoice
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rateObjectId } = await req.json().catch(() => ({}));
  if (!rateObjectId) return Response.json({ error: "Missing rateObjectId" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("*").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const transaction = await shippo.transactions.create({
    rate: rateObjectId,
    labelFileType: "PDF",
    async: false,
  });

  if (transaction.status !== "SUCCESS" || !transaction.labelUrl) {
    const msgs = (transaction as any).messages ?? [];
    const detail = msgs.map((m: any) => m.text ?? m.message ?? JSON.stringify(m)).join(" | ");
    return Response.json({ error: `Label purchase failed: ${detail || transaction.status}`, raw: msgs }, { status: 500 });
  }

  const newEntry = {
    label_url: transaction.labelUrl,
    customs_url: transaction.commercialInvoiceUrl ?? null,
    tracking_number: transaction.trackingNumber ?? null,
    tracking_url: transaction.trackingUrlProvider ?? null,
    created_at: new Date().toISOString(),
  };

  const existingLabels = (order as Record<string, unknown>).international_labels as unknown[] ?? [];
  const allLabels = [...existingLabels, newEntry];

  const { error: dbErr } = await (admin as any)
    .from("shop_orders")
    .update({ international_labels: allLabels, status: "shipped", tracking_number: newEntry.tracking_number })
    .eq("id", id);

  if (dbErr) {
    await admin
      .from("shop_orders")
      .update({ status: "shipped", tracking_number: newEntry.tracking_number })
      .eq("id", id);
  }

  return Response.json({ result: newEntry, allLabels });
}
