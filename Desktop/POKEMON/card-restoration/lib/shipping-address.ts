import type Stripe from "stripe";
import { US_STATES } from "@/lib/constants";

/** A kit order's ship-to address, as stored in shop_orders.shipping_address. */
export type ShippingAddress = {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

/** Kits ship anywhere USPS delivers in the US: the states, DC, the territories and military mail. */
export const KIT_US_STATES = [
  ...US_STATES,
  { value: "DC", label: "District of Columbia" },
  { value: "PR", label: "Puerto Rico" },
  { value: "VI", label: "U.S. Virgin Islands" },
  { value: "GU", label: "Guam" },
  { value: "AS", label: "American Samoa" },
  { value: "MP", label: "Northern Mariana Islands" },
  { value: "AA", label: "Armed Forces Americas (AA)" },
  { value: "AE", label: "Armed Forces Europe (AE)" },
  { value: "AP", label: "Armed Forces Pacific (AP)" },
];

/** Trimmed, with state and country upper-cased. */
export function normalizeAddress(a: Partial<ShippingAddress>): ShippingAddress {
  return {
    street1: (a.street1 ?? "").trim(),
    street2: (a.street2 ?? "").trim() || null,
    city: (a.city ?? "").trim(),
    state: (a.state ?? "").trim().toUpperCase(),
    zip: (a.zip ?? "").trim().toUpperCase(),
    country: ((a.country ?? "US").trim() || "US").toUpperCase(),
  };
}

/**
 * What is missing or wrong in a ship-to address, or null when it is complete.
 * The cart shows this before checkout and the checkout API refuses an order
 * that fails it, so a kit can't be paid for without a shippable address.
 */
export function addressProblem(input: Partial<ShippingAddress>): string | null {
  const a = normalizeAddress(input);
  if (a.street1.length < 3) return "Enter your street address.";
  if (!/\d/.test(`${a.street1} ${a.street2 ?? ""}`)) {
    return "Add your house or building number to the street address.";
  }
  if (a.city.length < 2) return "Enter your city.";
  if (a.country === "US") {
    if (!KIT_US_STATES.some((s) => s.value === a.state)) return "Choose your state.";
    if (!/^\d{5}(-?\d{4})?$/.test(a.zip)) return "Enter a valid 5-digit ZIP code.";
  } else {
    if (!/^[A-Z]{2}$/.test(a.country)) return "Choose your country.";
    if (a.zip.length < 2) return "Enter your postal code.";
  }
  return null;
}

/**
 * The ship-to address of a paid kit checkout. Since the cart started checking
 * addresses, every order carries the checked address in its metadata; older
 * domestic orders only have the one Stripe's page collected (newer API shape
 * first, then the pre-2025 one).
 */
export function addressFromSession(session: Stripe.Checkout.Session): ShippingAddress | null {
  const json = session.metadata?.shipping_address_json;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Partial<ShippingAddress> | null;
      if (parsed?.street1) return normalizeAddress(parsed);
    } catch { /* fall through to what Stripe collected */ }
  }
  const legacy = (session as unknown as { shipping_details?: { address?: Stripe.Address | null } | null }).shipping_details;
  const addr = session.collected_information?.shipping_details?.address ?? legacy?.address ?? null;
  if (!addr) return null;
  return {
    street1: addr.line1 ?? "",
    street2: addr.line2 ?? null,
    city: addr.city ?? "",
    state: addr.state ?? "",
    zip: addr.postal_code ?? "",
    country: addr.country ?? "US",
  };
}
