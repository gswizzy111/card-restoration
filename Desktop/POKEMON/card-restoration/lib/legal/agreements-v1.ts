import { blocksToText, type DocBlock } from "./legal-doc";
import { SLAB_SECTION_BLOCKS, TERMS_VERSION } from "./current-terms";

/**
 * The two card-specific documents the Terms of Service v1.0 require besides
 * the master signature:
 *   - Slab Removal & High-Risk Holder Opening Authorization (Section 7): one
 *     per slabbed card, signed at checkout, naming the card and its cert.
 *   - High-Value Card Restoration & Custody Agreement (Section 4.2): one per
 *     card valued above $5,000, signed after the order by the customer and
 *     then by The Card Doc. The card stays on hold until both have signed.
 * Each is stored word for word with its signature (lib/signatures.ts).
 * Browser-safe; shared by both sites.
 */

/** Cards valued above this need their own High-Value Agreement. */
export const HIGH_VALUE_CENTS = 500_000;
export const isHighValue = (declaredValueCents: number | null | undefined) => (declaredValueCents ?? 0) > HIGH_VALUE_CENTS;

export const SLAB_FEE_CENTS = 700;

export type CardDetails = {
  card_name: string;
  card_set?: string | null;
  card_year?: string | null;
  card_number?: string | null;
  variation?: string | null;
  grading_company?: string | null;
  grade?: string | null;
  cert_number?: string | null;
  known_defects?: string | null;
  declared_value_cents?: number | null;
};

export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"] as const;

/** Placeholders for the public template pages (/agreements/*). */
export const TEMPLATE_CARD: CardDetails = {
  card_name: "[card name]",
  card_year: "[year]",
  card_set: "[set]",
  card_number: "[number]",
  grading_company: "[grading company]",
  grade: "[grade]",
  cert_number: "[cert number]",
};

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "1999 Base Set Charizard #4 (Shadowless)" */
export function cardTitle(c: CardDetails): string {
  const head = [c.card_year, c.card_set, c.card_name].map((s) => s?.trim()).filter(Boolean).join(" ");
  const num = c.card_number?.trim() ? ` #${c.card_number.trim().replace(/^#/, "")}` : "";
  const variation = c.variation?.trim() ? ` (${c.variation.trim()})` : "";
  return `${head}${num}${variation}`;
}

/** "PSA 9, cert #12345678" */
export function holderLine(c: CardDetails): string {
  const company = c.grading_company?.trim() || "Graded holder";
  const grade = c.grade?.trim() ? ` ${c.grade.trim()}` : "";
  const cert = c.cert_number?.trim() ? `, cert #${c.cert_number.trim()}` : "";
  return `${company}${grade}${cert}`;
}

export type AgreementDoc = { title: string; blocks: DocBlock[] };

const para = (text: string): DocBlock => ({ kind: "para", text, clause: null });

export const SLAB_TITLE = "Slab Removal & High-Risk Holder Opening Authorization";

/** The authorization for one slabbed card (Section 7). */
export function slabAuthorization(c: CardDetails): AgreementDoc {
  return {
    title: SLAB_TITLE,
    blocks: [
      para(`Card: ${cardTitle(c)}. Holder: ${holderLine(c)}.`),
      para(`I authorize The Card Doc LLC to open the graded holder of this card, and only this card, for the ${usd(SLAB_FEE_CENTS)} slab-removal service, under Section 7 of the Terms of Service v${TERMS_VERSION}. In short:`),
      {
        kind: "list",
        items: [
          "The holder has to be broken open. It can crack or shatter, and tools, pressure or fragments can scratch, dent, bend, crease, chip or otherwise damage the card, even by accident.",
          "Opening ends the holder's protection. The old grade and certificate are not a present-day grade for the raw card.",
          "The holder, label, hologram and inserts may not be saved or returned.",
          "The card can be partly or completely destroyed or lose value. The fee is not insurance.",
        ],
      },
      para("Section 7 of the Terms, in full:"),
      ...SLAB_SECTION_BLOCKS,
    ],
  };
}

export const HIGH_VALUE_TITLE = "High-Value Card Restoration & Custody Agreement";

/** The agreement for one card valued above $5,000 (Section 4.2), with the terms negotiated for it. */
export function highValueAgreementDoc(
  c: CardDetails,
  order: { orderNumber: string; customerName: string },
  negotiatedTerms: string,
): AgreementDoc {
  const value = c.declared_value_cents == null ? "[declared value]" : usd(c.declared_value_cents);
  const negotiated = negotiatedTerms.trim();
  return {
    title: HIGH_VALUE_TITLE,
    blocks: [
      para(`Between The Card Doc LLC ("The Card Doc") and ${order.customerName} ("I"), for one card on order ${order.orderNumber}: ${cardTitle(c)}${c.cert_number?.trim() ? ` (${holderLine(c)})` : ""}, with a declared value of ${value}.`),
      para(`This agreement is required by Section 4.2 of the Terms of Service v${TERMS_VERSION}. By signing it, I confirm and agree that:`),
      {
        kind: "list",
        items: [
          `${value} is my honest, good-faith estimate of this card's current market value in its present condition, based on recent completed sales of comparable cards, not asking prices. I own this card, or I have the owner's written permission to send it.`,
          "No cleaning, treatment or slab opening will start until both The Card Doc and I have signed this agreement. Until then the card stays on hold. I may decline instead and have the card returned, paying only charges properly owed under the Terms.",
          "The Card Doc does not carry business insurance covering this card while it is in The Card Doc's custody. Shipping insurance is optional and paid by me. I decide how the card is shipped and whether it is insured.",
          "Results and grades are never guaranteed. Restoration can permanently worsen or destroy a card, change its grade or market value, or produce no visible improvement.",
          "Except as the negotiated terms below say otherwise, The Card Doc's liability for this card is limited as set out in the Terms of Service (Section 19), not by its declared value.",
          "This agreement covers this card only and is in addition to the Terms of Service. Where the negotiated terms below truly conflict with the Terms, they control for this card (Section 4.5).",
        ],
      },
      para("Negotiated terms for this card:"),
      para(negotiated || `None. The Terms of Service v${TERMS_VERSION} apply unchanged.`),
    ],
  };
}

/** The text stored with a signature and printed on its PDF. */
export function agreementText(doc: AgreementDoc): string {
  return [doc.title, blocksToText(doc.blocks)].join("\n\n");
}
