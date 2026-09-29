import { z } from "zod";

const Body = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional().default(""),
  zip: z.string().min(1),
  country: z.string().length(2).default("US"),
  // Used to build customs declaration for international shipments
  card_count: z.number().int().min(1).optional().default(1),
  total_value_usd: z.number().min(0).optional().default(0),
});

type ShippoRate = {
  object_id: string;
  provider: string;
  servicelevel: { name: string; token: string; terms?: string };
  amount: string;
  currency: string;
  estimated_days: number | null;
  duration_terms: string | null;
  arrives_by: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid address" }, { status: 400 });

  const d = parsed.data;
  const isInternational = d.country !== "US";

  try {
    // Build the from-address (customer's location)
    const addressFrom: Record<string, unknown> = {
      name: "Customer",
      street1: d.street1,
      city: d.city,
      zip: d.zip,
      country: d.country,
    };
    if (d.street2) addressFrom.street2 = d.street2;
    if (d.state) addressFrom.state = d.state;

    const shipmentBody: Record<string, unknown> = {
      address_from: addressFrom,
      address_to: {
        name: process.env.BUSINESS_SHIPPING_NAME ?? "TCD",
        street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
        ...(process.env.BUSINESS_SHIPPING_STREET2 ? { street2: process.env.BUSINESS_SHIPPING_STREET2 } : {}),
        city: process.env.BUSINESS_SHIPPING_CITY ?? "",
        state: process.env.BUSINESS_SHIPPING_STATE ?? "",
        zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
        country: "US",
      },
      parcels: [{
        length: "6",
        width: "4",
        height: "2",
        distance_unit: "in",
        weight: "0.5",
        mass_unit: "lb",
      }],
      async: false,
    };

    // International shipments require a customs declaration to get valid rates
    if (isInternational) {
      const declaredValueUsd = d.total_value_usd > 0 ? d.total_value_usd : d.card_count * 25;
      shipmentBody.customs_declaration = {
        certify: true,
        certify_signer: "TCD",
        contents_type: "OTHER",
        contents_explanation: "Trading cards for professional grading preparation service — to be returned to sender",
        non_delivery_option: "RETURN",
        items: [
          {
            description: "Trading cards",
            quantity: d.card_count,
            net_weight: "0.1",
            mass_unit: "lb",
            value_amount: declaredValueUsd.toFixed(2),
            value_currency: "USD",
            origin_country: d.country,
            tariff_number: "9504.90",
          },
        ],
      };
    }

    const shipmentRes = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Authorization": `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipmentBody),
    });

    if (!shipmentRes.ok) {
      const errBody = await shipmentRes.text();
      console.error("Shippo shipment error:", errBody);
      return Response.json({ error: "Shipping service unavailable. Please try again." }, { status: 502 });
    }

    const shipment = await shipmentRes.json() as { rates?: ShippoRate[]; messages?: unknown[] };

    const rates = (shipment.rates ?? [])
      .filter((r) => r.amount && parseFloat(r.amount) > 0)
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
      .map((r) => ({
        id: r.object_id,
        carrier: r.provider,
        service: r.servicelevel.name,
        amount_cents: Math.round(parseFloat(r.amount) * 100),
        estimated_days: r.estimated_days ?? null,
        duration_terms: r.duration_terms ?? null,
      }));

    if (rates.length === 0) {
      const msg = isInternational
        ? "No international shipping options are available for this address. Please verify it or choose to ship yourself."
        : "No shipping options available for this address. Please verify it and try again.";
      return Response.json({ error: msg }, { status: 422 });
    }

    return Response.json({ rates, is_international: isInternational });
  } catch (err) {
    console.error("Shippo rates fetch error:", err);
    return Response.json({ error: "Could not fetch shipping rates. Please try again." }, { status: 500 });
  }
}
