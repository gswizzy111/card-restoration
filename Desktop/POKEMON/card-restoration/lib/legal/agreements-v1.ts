import { blocksToText, type DocBlock } from "./legal-doc";
import { SLAB_SECTION_BLOCKS, TERMS_VERSION } from "./current-terms";

/**
 * The card-specific document the Terms of Service require besides the master
 * signature: the Slab Removal & High-Risk Holder Opening Authorization
 * (Section 7), one per slabbed card, signed at checkout, naming the card. It
 * quotes Section 7 word for word and is stored word for word with its
 * signature (lib/signatures.ts). Browser-safe; shared by both sites.
 */

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

/** The text stored with a signature and printed on its PDF. */
export function agreementText(doc: AgreementDoc): string {
  return [doc.title, blocksToText(doc.blocks)].join("\n\n");
}
