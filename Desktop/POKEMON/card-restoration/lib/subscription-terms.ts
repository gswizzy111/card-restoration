/**
 * What a customer sees and agrees to before paying for the Monthly Kit Club
 * (Terms Section 26). Browser-safe; the consent stored with an enrollment is
 * built from the same text.
 */
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function subscriptionDisclosures(priceCents: number): string[] {
  return [
    `Price: ${usd(priceCents)} per month. US shipping is included, and there are no other fees.`,
    "Billing: charged today, then automatically every month on the same date until you cancel.",
    "Delivery: one restoration kit ships after each monthly payment, to the address below.",
    "Cancel anytime: online at /subscribe/manage or from your account, or by emailing thecarddoc1@gmail.com. Cancelling stops all future charges right away; a kit already paid for still ships. You'll get an email confirming the cancellation.",
  ];
}

export const subscriptionEnrollLabel = (priceCents: number) =>
  `Yes, enroll me in the Monthly Kit Club: ${usd(priceCents)} charged today and every month until I cancel.`;
