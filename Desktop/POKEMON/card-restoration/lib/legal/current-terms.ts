import { LEGAL_TEXTS } from "./generated-texts";
import { blocksToText, findClause, frontMatter, parseLegalMarkdown, quotedStatement, sectionBlocks } from "./legal-doc";

/**
 * The Terms of Service in effect for new orders, and the checkout wording that
 * goes with them. The Terms text lives in legal/terms-v<version>.md (turned
 * into lib/legal/generated-texts.ts by scripts/legal-texts.mjs) and is never
 * edited here. A wording change is a new file and a new TERMS_VERSION:
 * the version signed at checkout governs that order, and every version stays
 * readable at /terms/v<version> (terms_versions keeps each one, unchanged).
 * Browser-safe; shared by both sites.
 */
export const TERMS_VERSION = "1.0";
const termsMarkdown = LEGAL_TEXTS[`terms-v${TERMS_VERSION}`];
const keyTermsMarkdown = LEGAL_TEXTS[`key-terms-v${TERMS_VERSION}`];
const esignMarkdown = LEGAL_TEXTS[`esign-consent-v${TERMS_VERSION}`];
export const TERMS_MARKDOWN = termsMarkdown;
export const TERMS_BLOCKS = parseLegalMarkdown(termsMarkdown);

/** "October 22, 2026", from the Terms' own "Effective date:" line. */
export const TERMS_EFFECTIVE_LABEL = frontMatter(TERMS_BLOCKS, "Effective date") ?? "";
/** The same date as YYYY-MM-DD, for terms_versions. */
export const TERMS_EFFECTIVE_ISO = (() => {
  const d = new Date(`${TERMS_EFFECTIVE_LABEL} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? "2026-10-22" : d.toISOString().slice(0, 10);
})();

/** Our summary and the E-SIGN disclosure (not part of the Terms text). */
export const KEY_TERMS_BLOCKS = parseLegalMarkdown(keyTermsMarkdown);
export const ESIGN_BLOCKS = parseLegalMarkdown(esignMarkdown);

/** The customer certification quoted in the Terms (Section 35.5 in v1.0). */
export const CERTIFICATION_TEXT = quotedStatement(TERMS_BLOCKS, "Customer certification on signature:") ?? "";
export const CERTIFICATION_CLAUSE = findClause(TERMS_BLOCKS, /Customer certification on signature:/) ?? "";

/** Where the Terms make the service fee non-refundable once cleaning starts (11.3 in v1.0). */
export const NONREFUNDABLE_CLAUSE = findClause(TERMS_BLOCKS, /After cleaning has started/) ?? "11.3";

/** The slab-removal section (Section 7 in v1.0), shown with each card's authorization. */
export const SLAB_SECTION_BLOCKS = sectionBlocks(TERMS_BLOCKS, "7");

// ── Checkout wording ────────────────────────────────────────────────────────
export const AGREE_LABEL = `I have read and agree to the Terms of Service v${TERMS_VERSION}`;
export const SIGN_BUTTON_LABEL = "Electronically sign & place order";
export const ESIGN_LABEL = "I consent to use electronic records and signatures for this order, and I can open and save the PDF of the Terms.";
export const MEDIA_LABEL = "You may feature photos/videos of my card(s) on social media.";
export const TAG_LABEL = "You may tag or name me.";
export const VALUE_HELP = "Use recent completed sales for comparable cards, not asking prices.";
export const HIGH_VALUE_NOTICE = "Cards over $5,000 need a separate High-Value Agreement before we begin work. We'll email it after you order. The card stays on hold until both of us sign.";
export const INSURANCE_DECLINED_TEXT = "You've declined shipping insurance. No coverage will apply to this shipment.";
export const NOT_INSURED_TEXT = "We do not currently insure customer cards while they are in our possession. Optional shipping insurance is available at checkout.";

/**
 * What the master signature covers besides the Terms themselves: the Key
 * Terms summary, the certification and the box the customer checked. Stored
 * with the signature; its hash covers the Terms text too (lib/signatures.ts).
 */
export function masterSignatureText(): string {
  return [
    blocksToText(KEY_TERMS_BLOCKS),
    `Customer certification (Section ${CERTIFICATION_CLAUSE}):`,
    CERTIFICATION_TEXT,
    `[x] ${AGREE_LABEL}`,
  ].join("\n\n");
}

/** The E-SIGN consent as the customer saw it, stored with the consent record. */
export function esignConsentText(): string {
  return [blocksToText(ESIGN_BLOCKS), `[x] ${ESIGN_LABEL}`].join("\n\n");
}

/**
 * What a customer is told before buying shipping insurance (Terms 13.3, 15.2).
 * The deductible and exclusions come from the insurer's policy through Shippo.
 */
export const INSURANCE_DETAILS = [
  "Provider: shipping insurance bought through Shippo, our label provider, and underwritten by its third-party insurer. It covers the package in transit, not your cards while we have them.",
  "Coverage: loss of or damage to the insured shipment, up to the amount you enter (maximum $10,000), subject to the insurer's terms, deductible and exclusions.",
  "Claims: tell us at thecarddoc1@gmail.com within 5 days of delivery (or as soon as tracking shows the package lost), keep all packaging and send photos. We file the claim through Shippo, and the insurer decides it under its policy; payment is never promised just because insurance was bought.",
];
