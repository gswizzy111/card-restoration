import { shippo, businessAddress } from "@/lib/shippo";

const zip5 = (z: string | null | undefined) => (z ?? "").replace(/\D/g, "").slice(0, 5);

/**
 * A restoration or prep shipping rate, looked up at Shippo (the price is never
 * taken from the browser) and only if it was quoted for this customer's trip:
 * "in" from the customer's ZIP to the shop (the prepaid label), "back" from
 * the shop to the customer (the return a self-ship order pays for). Null when
 * it can't be found or doesn't match.
 */
export async function shippingRate(
  rateId: string,
  customerZip: string,
  direction: "in" | "back" = "in",
  customerCountry = "US",
): Promise<{ amountCents: number; carrier: string; serviceLevel: string } | null> {
  try {
    const rate = await shippo.rates.get(rateId);
    const shipment = await shippo.shipments.get(rate.shipment);
    const [shop, customer] = direction === "in"
      ? [shipment.addressTo, shipment.addressFrom]
      : [shipment.addressFrom, shipment.addressTo];
    if (zip5(shop?.zip) !== zip5(businessAddress.zip)) return null;
    if (zip5(customer?.zip) !== zip5(customerZip)) return null;
    if ((customer?.country ?? "US").toUpperCase() !== customerCountry.toUpperCase()) return null;
    const amountCents = Math.round(parseFloat(rate.amount) * 100);
    if (!(amountCents > 0)) return null;
    return { amountCents, carrier: rate.provider, serviceLevel: rate.servicelevel?.name ?? rate.servicelevel?.token ?? "" };
  } catch (err) {
    console.error("Shipping rate lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
