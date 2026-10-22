import { z } from "zod";

/**
 * The two agreements a customer signs at checkout, separate from the Terms of
 * Service:
 *   - Slab-Removal Authorization: once per order that includes slab cracking,
 *     listing the cards (or how many, for prep orders).
 *   - High-Value Card Agreement: one for every card declared above $5,000.
 * Each is signed with a typed name and a checkbox, dated by the server, and
 * stored with the exact text the customer saw (order_agreements). Shared by
 * the browser (to show and collect them) and the checkout routes (to require
 * and record them); keep both sites' copies identical.
 */
export const AGREEMENTS_VERSION = "2026-10-22";

/** Cards declared above this need their own High-Value Card Agreement. */
export const HIGH_VALUE_AGREEMENT_CENTS = 500_000;

export function needsHighValueAgreement(declaredValueCents: number | null | undefined) {
  return (declaredValueCents ?? 0) > HIGH_VALUE_AGREEMENT_CENTS;
}

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type AgreementText = { title: string; intro: string; points: string[] };

/**
 * cards: the slabbed cards' names, or how many (prep orders only give a
 * count), or null for the wording shown on the public agreement page.
 */
export function slabRemovalAgreement(cards: string[] | number | null): AgreementText {
  const count = cards === null ? 2 : typeof cards === "number" ? cards : cards.length;
  const which = cards === null
    ? "each slabbed card listed on my order"
    : typeof cards === "number"
    ? `the ${count} slabbed card${count === 1 ? "" : "s"} I send with this order`
    : `the card${count === 1 ? "" : "s"} listed here (${cards.join("; ")})`;
  const holder = cards === null ? "its grading-company holder" : `${count === 1 ? "its" : "their"} grading-company holder${count === 1 ? "" : "s"}`;
  return {
    title: "Slab-Removal Authorization",
    intro: `I authorize The Card Doc LLC ("The Card Doc") to remove ("crack") ${which} from ${holder}. By signing, I confirm and agree that:`,
    points: [
      "I own each of these cards, or I have the owner's permission to authorize removing it from its holder.",
      "Removal is permanent. The holder and its label are destroyed and can't be put back together. The card will no longer be tied to its current grade or certification number, and any value that depends on that grade may be lost.",
      "Each card comes back to me raw, in a Card Saver. If I want it graded again, I will submit it myself, at my own cost, and the new grade may be lower, the same, or higher.",
      "Removing a card from its holder carries a small risk of damage to the card (for example to its edges, corners or surface), even when done carefully. If a card is damaged during removal, The Card Doc's responsibility is as set out in the Terms of Service.",
      "The slab-removal fee shown at checkout is charged per card and is not refundable once a holder has been opened.",
      "This authorization covers only these cards. A \"review\" note on any other slabbed card does not authorize removing it, and The Card Doc will not crack any other slab without a separate authorization from me.",
      "The Terms of Service also apply to these cards.",
    ],
  };
}

/** card: the card it's signed for, or null for the wording on the public agreement page. */
export function highValueAgreement(card: { name: string; declaredValueCents: number } | null): AgreementText {
  const value = card ? usd(card.declaredValueCents) : "The declared value I give for this card";
  return {
    title: "High-Value Card Agreement",
    intro: card
      ? `This agreement is for one card: ${card.name}, with a declared value of ${value}. By signing it, I confirm and agree that:`
      : "This agreement is signed separately for each card with a declared value above $5,000, named on my order with its declared value. By signing it, I confirm and agree that:",
    points: [
      `${value} is my honest estimate of what this card is worth today, in its current condition (raw or graded, whichever it is now), not what it might be worth after grading. I own this card, or I have the owner's permission to send it.`,
      "The Card Doc may ask me for more photos or information about this card, and may decline to work on it before work begins. If it declines, it will refund the service fee for this card and send it back to me; I cover shipping both ways.",
      "Shipping insurance is optional and is not included unless I buy it. I decide how this card is shipped to The Card Doc and whether it is insured, and I understand that insured, tracked shipping with signature confirmation is strongly recommended for a card of this value. Insurance bought at checkout covers up to the amount I insure, within the insurer's limits.",
      "Results and grades are never guaranteed. Restoration carries an inherent risk, low but not zero, that a grading company detects it or returns the card as altered.",
      "While this card is in The Card Doc's care, The Card Doc's responsibility for loss or damage is as set out in the Terms of Service, and never more than the declared value above.",
      "This agreement applies to this card only and is in addition to the Terms of Service. If the two conflict for this card, this agreement controls.",
    ],
  };
}

/** The text as stored with a signature: what the customer saw, word for word. */
export function agreementPlainText(a: AgreementText) {
  return [a.title, a.intro, ...a.points.map((p, i) => `${i + 1}. ${p}`)].join("\n\n");
}

/** Today's date as the customer sees it next to their signature (shop time). */
export function signatureDate(d = new Date()) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

// ── What the browser sends, and what the server requires ─────────────────

const Signature = z.object({
  signer_name: z.string().trim().min(2).max(120),
  agreed: z.literal(true),
});

export const AgreementsSchema = z.object({
  slab_removal: Signature.optional(),
  // One per card declared above $5,000, by the card's position in the order
  high_value: z.array(Signature.extend({ card_index: z.number().int().min(0) })).optional(),
}).optional();

export type SubmittedAgreements = z.infer<typeof AgreementsSchema>;

export type AgreementRow = {
  kind: "slab_removal" | "high_value";
  version: string;
  signer_name: string;
  card_index: number | null;
  card_name: string | null;
  declared_value_cents: number | null;
  cards: string[] | number | null;
  agreement_text: string;
};

/**
 * Checks that every agreement this order needs is signed and returns the rows
 * to store, or an error to show. `slabCards` is the slabbed cards' names, or a
 * count for prep orders; `cards` are all cards in their order.
 */
export function requiredAgreements(
  submitted: SubmittedAgreements,
  slabCards: string[] | number,
  cards: { name: string; declaredValueCents: number }[],
): { rows: AgreementRow[] } | { error: string } {
  const rows: AgreementRow[] = [];
  const slabCount = typeof slabCards === "number" ? slabCards : slabCards.length;
  if (slabCount > 0) {
    const sig = submitted?.slab_removal;
    if (!sig) return { error: "Please sign the Slab-Removal Authorization to have your slabs cracked." };
    rows.push({
      kind: "slab_removal",
      version: AGREEMENTS_VERSION,
      signer_name: sig.signer_name,
      card_index: null,
      card_name: null,
      declared_value_cents: null,
      cards: slabCards,
      agreement_text: agreementPlainText(slabRemovalAgreement(slabCards)),
    });
  }
  for (const [i, card] of cards.entries()) {
    if (!needsHighValueAgreement(card.declaredValueCents)) continue;
    const sig = submitted?.high_value?.find((h) => h.card_index === i);
    if (!sig) return { error: `Please sign the High-Value Card Agreement for ${card.name} (declared above $5,000).` };
    rows.push({
      kind: "high_value",
      version: AGREEMENTS_VERSION,
      signer_name: sig.signer_name,
      card_index: i,
      card_name: card.name,
      declared_value_cents: card.declaredValueCents,
      cards: null,
      agreement_text: agreementPlainText(highValueAgreement(card)),
    });
  }
  return { rows };
}
