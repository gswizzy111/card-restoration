import { blocksToText, type DocBlock } from "./legal-doc";
import { HIGH_VALUE_CLAUSE, HIGH_VALUE_SECTION_BLOCKS, HIGH_VALUE_SHIPPING_BLOCKS, SLAB_SECTION_BLOCKS, TERMS_VERSION } from "./current-terms";

/**
 * The two card-specific documents the Terms of Service v1.0 require besides
 * the master signature:
 *   - Slab Removal & High-Risk Holder Opening Authorization (Section 7): one
 *     per slabbed card, signed at checkout, naming the card.
 *   - High-Value Card Restoration & Custody Agreement (Section 4.2): one per
 *     card valued above $5,000, signed after the order by the customer and
 *     then by The Card Doc. The card stays on hold until both have signed.
 * Each names its card and quotes the Terms that govern it, word for word, and
 * is stored word for word with its signature (lib/signatures.ts).
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
      para(`Card: ${cardTitle(c)}.${c.grading_company?.trim() || c.cert_number?.trim() ? ` Holder: ${holderLine(c)}.` : ""}`),
      para(`I authorize The Card Doc LLC to open the graded holder of this card, and only this card, for the ${usd(SLAB_FEE_CENTS)} slab-removal service, under Section 7 of the Terms of Service v${TERMS_VERSION}.`),
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
      para(`Between The Card Doc LLC ("The Card Doc") and ${order.customerName}, for one card on order ${order.orderNumber}: ${cardTitle(c)}${c.cert_number?.trim() ? ` (${holderLine(c)})` : ""}, with a declared value of ${value}.`),
      para(`This is the High-Value Card Restoration & Custody Agreement that Section ${HIGH_VALUE_CLAUSE} of the Terms of Service v${TERMS_VERSION} requires for this card, and it covers this card only.`),
      para("Negotiated terms for this card:"),
      para(negotiated || `None. The Terms of Service v${TERMS_VERSION} apply unchanged.`),
      para("Section 4 of the Terms, in full:"),
      ...HIGH_VALUE_SECTION_BLOCKS,
      ...HIGH_VALUE_SHIPPING_BLOCKS.flatMap((b) => [para(`Section ${b.kind === "para" ? b.clause : ""} of the Terms:`), b]),
    ],
  };
}

/** The text stored with a signature and printed on its PDF. */
export function agreementText(doc: AgreementDoc): string {
  return [doc.title, blocksToText(doc.blocks)].join("\n\n");
}
