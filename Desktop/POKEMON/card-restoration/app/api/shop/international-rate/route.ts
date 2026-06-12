import { shippo, businessAddress } from "@/lib/shippo";

const BOX_KEYWORDS = ["official", "essential", "clamp"];

function getParcel(itemNames: string[]) {
  const needsBox = itemNames.some((n) => BOX_KEYWORDS.some((kw) => n.toLowerCase().includes(kw)));
  return needsBox
    ? { massUnit: "lb", weight: "4", distanceUnit: "in", length: "10", width: "7", height: "7" }
    : { massUnit: "oz", weight: "6", distanceUnit: "in", length: "8", width: "5", height: "1" };
}

export async function POST(req: Request) {
  const { name, street1, street2, city, state, zip, country, item_names } = await req.json();

  if (!country || country === "US") {
    return Response.json({ error: "Use standard checkout for US orders" }, { status: 400 });
  }
  if (!street1 || !city || !zip || !country) {
    return Response.json({ error: "Missing address fields" }, { status: 400 });
  }

  const parcel = getParcel(Array.isArray(item_names) ? item_names : []);

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
      parcels: [parcel],
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
