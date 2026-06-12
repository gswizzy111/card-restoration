import { shippo, businessAddress } from "@/lib/shippo";

export async function POST(request: Request) {
  const body = await request.json();
  const { to_address, parcel, from_business } = body;

  if (!to_address || !parcel)
    return Response.json({ error: "Missing address or parcel" }, { status: 400 });

  // from_business=true: rates for shipping FROM us back TO the customer (international return)
  const addressFrom = from_business
    ? {
        name: businessAddress.name,
        street1: businessAddress.street1,
        street2: businessAddress.street2,
        city: businessAddress.city,
        state: businessAddress.state,
        zip: businessAddress.zip,
        country: businessAddress.country,
        phone: businessAddress.phone,
        email: businessAddress.email,
      }
    : {
        name: to_address.name,
        street1: to_address.street1,
        street2: to_address.street2 ?? "",
        city: to_address.city,
        state: to_address.state,
        zip: to_address.zip,
        country: to_address.country ?? "US",
        phone: to_address.phone,
        email: to_address.email,
      };

  const addressTo = from_business
    ? {
        name: to_address.name,
        street1: to_address.street1,
        street2: to_address.street2 ?? "",
        city: to_address.city,
        state: to_address.state,
        zip: to_address.zip,
        country: to_address.country ?? "US",
        phone: to_address.phone,
        email: to_address.email,
      }
    : {
        name: businessAddress.name,
        street1: businessAddress.street1,
        street2: businessAddress.street2,
        city: businessAddress.city,
        state: businessAddress.state,
        zip: businessAddress.zip,
        country: businessAddress.country,
        phone: businessAddress.phone,
        email: businessAddress.email,
      };

  try {
    const shipmentPayload: Parameters<typeof shippo.shipments.create>[0] = {
      addressFrom,
      addressTo,
      parcels: [
        {
          length: String(parcel.length ?? 6),
          width: String(parcel.width ?? 4),
          height: String(parcel.height ?? 1),
          distanceUnit: "in",
          weight: String(parcel.weight ?? 4),
          massUnit: "oz",
        },
      ],
      async: false,
    };

    // International shipments need a customs declaration
    if (from_business && to_address.country && to_address.country !== "US") {
      shipmentPayload.customsDeclaration = {
        contentsType: "RETURN_MERCHANDISE" as const,
        nonDeliveryOption: "RETURN" as const,
        certify: true,
        certifySigner: "The Card Doc",
        items: [{
          description: "Sports trading cards — restored",
          massUnit: "oz" as const,
          netWeight: "4",
          originCountry: "US",
          quantity: 1,
          valueAmount: "50",
          valueCurrency: "USD",
        }],
      };
    }

    const shipment = await shippo.shipments.create(shipmentPayload);

    const rates = (shipment.rates ?? [])
      .filter((r) => r.objectId && r.amount)
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
      .slice(0, 5)
      .map((r) => ({
        object_id: r.objectId,
        carrier: r.provider,
        service_level: r.servicelevel.name ?? r.servicelevel.token,
        amount_cents: Math.round(parseFloat(r.amount) * 100),
        days: r.estimatedDays ?? null,
        duration_terms: r.durationTerms ?? "",
      }));

    return Response.json({ rates });
  } catch (err) {
    console.error("Shippo rates error:", err);
    return Response.json({ error: "Failed to fetch shipping rates" }, { status: 500 });
  }
}
