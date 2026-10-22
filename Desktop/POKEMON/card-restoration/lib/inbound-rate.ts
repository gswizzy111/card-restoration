import { shippo, businessAddress } from "@/lib/shippo";

const zip5 = (z: string | null | undefined) => (z ?? "").replace(/\D/g, "").slice(0, 5);

/**
 * The prepaid inbound label's rate, looked up at Shippo (the price is never
 * taken from the browser) and only if it was quoted from the customer's ZIP
 * to the shop. Null when it can't be found or doesn't match.
 */
export async function inboundRate(rateId: string, customerZip: string): Promise<{ amountCents: number; carrier: string; serviceLevel: string } | null> {
  try {
    const rate = await shippo.rates.get(rateId);
    const shipment = await shippo.shipments.get(rate.shipment);
    if (zip5(shipment.addressTo?.zip) !== zip5(businessAddress.zip)) return null;
    if (zip5(shipment.addressFrom?.zip) !== zip5(customerZip)) return null;
    const amountCents = Math.round(parseFloat(rate.amount) * 100);
    if (!(amountCents > 0)) return null;
    return { amountCents, carrier: rate.provider, serviceLevel: rate.servicelevel?.name ?? rate.servicelevel?.token ?? "" };
  } catch (err) {
    console.error("Inbound rate lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
