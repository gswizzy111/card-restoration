// ShipSurance via Shippo: 1.5% of declared value, minimum $2.50
const SHIPPO_RATE = 0.015;
const SHIPPO_MIN_CENTS = 250;
const MARKUP = 1.1;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const declared = parseInt(searchParams.get("declared_value_cents") ?? "0");

  if (!declared || declared < 100 || declared > 1_000_000) {
    return Response.json({ error: "declared_value_cents must be between 100 and 1000000" }, { status: 400 });
  }

  const shippoCostCents = Math.max(Math.round(declared * SHIPPO_RATE), SHIPPO_MIN_CENTS);
  const customerChargeCents = Math.round(shippoCostCents * MARKUP);
  const roundTripChargeCents = customerChargeCents * 2;

  return Response.json({ shippoCostCents, customerChargeCents, roundTripChargeCents });
}
