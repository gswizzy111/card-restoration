import { z } from "zod";
import {
  esignConsentText, masterSignatureText, MEDIA_LABEL, TAG_LABEL, TERMS_VERSION,
} from "@/lib/legal/current-terms";
import { agreementText, cardTitle, holderLine, slabAuthorization, type CardDetails } from "@/lib/legal/agreements-v1";
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

/** The slab authorization signed for a card, if any. */
export function slabSignatureFor(s: SubmittedSigning, index: number) {
  return s.slab_authorizations?.find((a) => a.card_index === index) ?? null;
}

/** A charge the customer authorized: a service on one card, or an order-level line (no amount for a choice like self-ship). */
export type AuthorizedLine = { name: string; cents?: number | null };

/**
 * Exactly what the customer authorized when signing (Terms 35.3): each card
 * with its identifying details, declared value and services, then the
 * order's other charges and total. Stored with the master signature and
 * printed on its PDF, so the record shows what was bought, not just that the
 * Terms were accepted.
 */
export type AuthorizedOrder = {
  order_number: string | number;
  cards: (CardDetails & { services: AuthorizedLine[] })[];
  order_lines: AuthorizedLine[];
  total_cents: number;
  /** The optional permissions, as chosen */
  choices: string[];
};

export const usd = (cents: number) =>
  `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const line = (l: AuthorizedLine) => `- ${l.name}${l.cents == null ? "" : `: ${usd(l.cents)}`}`;
const displayOrder = (n: string | number) => (/^\d+$/.test(String(n)) ? `R${n}` : String(n));

/** One card's identifying details and declared value, as recorded with a signature. */
export function cardDetails(c: Omit<Partial<CardDetails>, "card_name"> & { card_name: string }, declaredValueCents: number | null | undefined): CardDetails {
  return {
    card_name: c.card_name.trim(),
    card_set: c.card_set ?? null,
    card_year: c.card_year ?? null,
    card_number: c.card_number ?? null,
    variation: c.variation ?? null,
    grading_company: c.grading_company ?? null,
    grade: c.grade ?? null,
    cert_number: c.cert_number ?? null,
    known_defects: c.known_defects ?? null,
    declared_value_cents: declaredValueCents ?? null,
  };
}

export function authorizedOrderText(a: AuthorizedOrder): string {
  const blocks = [`## Services authorized on order ${displayOrder(a.order_number)}`];
  a.cards.forEach((c, i) => {
    const holder = c.grading_company?.trim() || c.cert_number?.trim() ? ` Holder: ${holderLine(c)}.` : "";
    const value = c.declared_value_cents == null ? "not given" : usd(c.declared_value_cents);
    const defects = c.known_defects?.trim() ? ` Known defects: ${c.known_defects.trim()}` : "";
    blocks.push(`Card ${i + 1}: ${cardTitle(c)}.${holder} Declared value: ${value}.${defects}`);
    if (c.services.length) blocks.push(c.services.map(line).join("\n"));
  });
  if (a.order_lines.length) blocks.push("Order:", a.order_lines.map(line).join("\n"));
  blocks.push(`Order total: ${usd(a.total_cents)}`);
  if (a.choices.length) blocks.push("Your choices:", a.choices.map((c) => `- ${c}`).join("\n"));
  return blocks.join("\n\n");
}

export function masterSignatureInput(orderId: string, terms: TermsVersionRow, signerName: string, authorized: AuthorizedOrder): SignatureInput {
  const documentText = [masterSignatureText(), authorizedOrderText(authorized)].join("\n\n");
  return {
    order_id: orderId,
    type: "master_terms",
    terms_version_id: terms.id,
    document_title: `Terms of Service v${terms.version}`,
    document_text: documentText,
    document_sha256: masterDocumentHash(terms.content_markdown, documentText),
    card_snapshot: authorized,
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

/** The optional permissions as the customer left them, for the signed record. */
export function signingChoices(s: SubmittedSigning): string[] {
  const media = !!s.marketing?.media;
  return [
    `${MEDIA_LABEL} ${media ? "Yes" : "No"}`,
    `${TAG_LABEL} ${media && s.marketing?.tag_name ? "Yes" : "No"}`,
  ];
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
