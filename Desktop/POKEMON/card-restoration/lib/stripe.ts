import Stripe from "stripe";

// The SDK throws when it is constructed without a key, which stops any build
// that has no STRIPE_SECRET_KEY (Netlify deploy previews). Without a key the
// client still loads; every Stripe call then fails with an invalid-key error.
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) console.warn("STRIPE_SECRET_KEY is not set: Stripe calls will fail.");
export const stripe = new Stripe(secretKey || "sk_missing_secret_key");

// Stripe moved an invoice's subscription under `parent` in API version
// 2025-03-31; older event payloads still carry it at the top level.
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub =
    invoice.parent?.subscription_details?.subscription ??
    (invoice as { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
