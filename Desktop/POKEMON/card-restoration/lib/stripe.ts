import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe moved an invoice's subscription under `parent` in API version
// 2025-03-31; older event payloads still carry it at the top level.
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub =
    invoice.parent?.subscription_details?.subscription ??
    (invoice as { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
