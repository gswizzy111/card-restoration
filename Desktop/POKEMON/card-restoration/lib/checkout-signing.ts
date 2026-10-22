import { z } from "zod";
import {
  esignConsentText, masterSignatureText, MEDIA_LABEL, TAG_LABEL, TERMS_VERSION,
} from "@/lib/legal/current-terms";
import { agreementText, slabAuthorization, type CardDetails } from "@/lib/legal/agreements-v1";
import { documentHash, masterDocumentHash, type ConsentType, type SignatureInput } from "@/lib/signatures";
import type { TermsVersionRow } from "@/lib/terms-versions";

/**
 * What every checkout (restoration, prep, add-cards) sends to sign, and the
 * server-side checks: nothing is trusted from the browser except the choices
 * themselves. Shared by both sites.
 */
const text = (max: number) => z.string().trim().max(max).optional();

/** The identifying fields of one card (Terms Section 3.2). */
export const CardFieldsSchema = z.object({
  card_set: text(120),
  card_year: text(20),
  card_number: text(40),
  variation: text(120),
  grading_company: text(40),
  grade: text(20),
  cert_number: text(40),
  known_defects: text(2000),
});

const Name = z.string().trim().min(2).max(120);

export const SigningSchema = z.object({
  terms: z.object({ version: z.string(), signer_name: Name, agreed: z.literal(true) }).optional(),
  esign_consent: z.boolean().optional(),
  marketing: z.object({ media: z.boolean(), tag_name: z.boolean() }).optional(),
  // One per slabbed card that the customer authorized, by the card's position in the order
  slab_authorizations: z.array(z.object({ card_index: z.number().int().min(0), signer_name: Name, agreed: z.literal(true) })).optional(),
});
export type SubmittedSigning = z.infer<typeof SigningSchema>;

/** The master signature and e-sign consent are required; returns the error to show, or null. */
export function signingError(s: SubmittedSigning): { error: string; code: string } | null {
  if (!s.terms) return { error: `Please read the Terms of Service v${TERMS_VERSION}, check the box and type your full legal name to sign.`, code: "TERMS_REQUIRED" };
  if (s.terms.version !== TERMS_VERSION) return { error: "The Terms of Service were updated. Please reload the page and sign the current version.", code: "TERMS_OUTDATED" };
  if (s.esign_consent !== true) return { error: "Please consent to electronic records and signatures to place your order online.", code: "ESIGN_REQUIRED" };
  return null;
}

/** The slab authorization signed for a card, if any (it must name a cert number). */
export function slabSignatureFor(s: SubmittedSigning, index: number, card: CardDetails) {
  if (!card.cert_number?.trim()) return null;
  return s.slab_authorizations?.find((a) => a.card_index === index) ?? null;
}

export function masterSignatureInput(orderId: string, terms: TermsVersionRow, signerName: string): SignatureInput {
  const documentText = masterSignatureText();
  return {
    order_id: orderId,
    type: "master_terms",
    terms_version_id: terms.id,
    document_title: `Terms of Service v${terms.version}`,
    document_text: documentText,
    document_sha256: masterDocumentHash(terms.content_markdown, documentText),
    typed_full_name: signerName,
  };
}

export function slabSignatureInput(orderId: string, terms: TermsVersionRow, cardId: string, card: CardDetails, signerName: string): SignatureInput {
  const doc = slabAuthorization(card);
  const documentText = agreementText(doc);
  return {
    order_id: orderId,
    order_item_id: cardId,
    type: "slab_removal",
    terms_version_id: terms.id,
    document_title: doc.title,
    document_text: documentText,
    document_sha256: documentHash(documentText),
    card_snapshot: card,
    typed_full_name: signerName,
  };
}

/** The consents recorded with an order: e-sign (required) and the two optional permissions. */
export function checkoutConsents(orderId: string, s: SubmittedSigning): { type: ConsentType; granted: boolean; consent_text: string; order_id: string }[] {
  const media = !!s.marketing?.media;
  return [
    { type: "esign_records", granted: true, consent_text: esignConsentText(), order_id: orderId },
    { type: "marketing_media", granted: media, consent_text: MEDIA_LABEL, order_id: orderId },
    // Tagging is only possible with photo permission
    { type: "marketing_tag_name", granted: media && !!s.marketing?.tag_name, consent_text: TAG_LABEL, order_id: orderId },
  ];
}
