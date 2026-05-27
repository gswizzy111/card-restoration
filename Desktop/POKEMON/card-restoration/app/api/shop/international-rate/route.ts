import { shippo, businessAddress } from "@/lib/shippo";

export async function POST(req: Request) {
  const { name, street1, street2, city, state, zip, country } = await req.json();

  if (!country || country === "US") {
    return Response.json({ error: "Use standard checkout for US orders" }, { status: 400 });
  }
  if (!street1 || !city || !zip || !country) {
    return Response.json({ error: "Missing address fields" }, { status: 400 });
  }

  try {
    const shipment = await shippo.shipments.create({
      addressFrom: businessAddress,
      addressTo: {
        name: name || "Customer",
        street1,
        street2: street2 || "",
        city,
        state: state || "",
        zip,
        country,
      },
      parcels: [{
        massUnit: "lb",
        weight: "4",
        distanceUnit: "in",
        length: "10",
        width: "7",
        height: "7",
      }],
      async: false,
    });

    const rates = [...(shipment.rates ?? [])]
      .filter((r) => parseFloat(r.amount) > 0)
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
      .slice(0, 5)
      .map((r) => ({
        provider: r.provider,
        service: r.servicelevel?.name ?? "",
        amountCents: Math.round(parseFloat(r.amount) * 100),
        days: r.estimatedDays ?? null,
      }));

    if (rates.length === 0) {
      return Response.json({ error: "No international shipping available for this destination. Please contact us." }, { status: 400 });
    }

    return Response.json({ rates });
  } catch (err) {
    console.error("Shippo international rate error:", err);
    return Response.json({ error: "Failed to calculate shipping. Please contact us." }, { status: 500 });
  }
}
