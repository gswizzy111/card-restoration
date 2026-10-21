import { shippo } from "@/lib/shippo";
import type { ShippingAddress } from "@/lib/shipping-address";

// Military mail (APO/FPO/DPO) is skipped: USPS validation is unreliable for it.
const SKIP_STATES = new Set(["AA", "AE", "AP"]);

/**
 * Asks Shippo (USPS) whether a US address exists. Returns USPS's reason when
 * it doesn't, and null when it does. A Shippo outage or a slow answer returns
 * null too: a validation hiccup never blocks a sale.
 */
export async function usAddressRejection(a: ShippingAddress, name: string): Promise<string | null> {
  if (a.country !== "US" || SKIP_STATES.has(a.state)) return null;
  try {
    const result = await Promise.race([
      shippo.addresses.create({
        name: name || "Customer",
        street1: a.street1,
        ...(a.street2 ? { street2: a.street2 } : {}),
        city: a.city,
        state: a.state,
        zip: a.zip,
        country: "US",
        validate: true,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    const validation = result?.validationResults;
    if (validation?.isValid !== false) return null;
    return validation.messages?.map((m) => m.text).filter(Boolean).join(" ") || "The address could not be found.";
  } catch (err) {
    console.error("Shippo address check failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
