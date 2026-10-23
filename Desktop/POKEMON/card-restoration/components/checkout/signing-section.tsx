"use client";

import { useId } from "react";
import { Check, Download, ExternalLink, Hourglass, PenLine } from "lucide-react";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  AGREE_LABEL, CERTIFICATION_CLAUSE, CERTIFICATION_TEXT, ESIGN_BLOCKS, ESIGN_LABEL, HIGH_VALUE_NOTICE,
  MEDIA_LABEL, TAG_LABEL, TERMS_VERSION,
} from "@/lib/legal/current-terms";
import { cardTitle, holderLine, SLAB_FEE_CENTS, type CardDetails } from "@/lib/legal/agreements-v1";
import type { SubmittedSigning } from "@/lib/checkout-signing";
import { Need, Req } from "./required";

/**
 * Everything a customer signs or chooses before an order is placed (Terms
 * Section 35), kept short. Each slab to open is authorized in its own pop-up
 * when slab cracking is picked (SlabAuthorizationDialog); here the review
 * step lists those, then the high-value hold notice, the optional photo
 * permissions (unchecked), and "Sign to confirm your order": two required
 * boxes (the Terms and electronic records) and the Full legal name. The full
 * texts are a link or a tap away, and all of it is stored with the signature
 * and printed on its PDF. Shared by the restoration, prep and add-cards
 * checkouts.
 */
export type SigningState = {
  slab: Record<string, { signer_name: string; agreed: boolean }>;
  media: boolean;
  tagName: boolean;
  esign: boolean;
  agreed: boolean;
  signerName: string;
};

export const emptySigning = (): SigningState => ({ slab: {}, media: false, tagName: false, esign: false, agreed: false, signerName: "" });

/** A card whose slab is to be opened: its position in the order, a stable id and its details. */
export type SlabCard = { index: number; id?: string; details: CardDetails };

// A slab authorization belongs to the exact card details it was signed for:
// editing the card afterwards asks for it again.
const slabKey = (c: SlabCard) =>
  [c.id ?? c.index, c.details.card_name, c.details.card_year, c.details.card_set, c.details.card_number, c.details.variation, c.details.grading_company, c.details.grade, c.details.cert_number].join("\u0001");
const named = (n: string | undefined) => (n ?? "").trim().length >= 2;

export function slabSignature(state: SigningState, c: SlabCard) {
  return state.slab[slabKey(c)] ?? null;
}

export function slabSigned(state: SigningState, c: SlabCard) {
  const s = slabSignature(state, c);
  return !!s && s.agreed && named(s.signer_name);
}

export function signSlab(state: SigningState, c: SlabCard, signerName: string): SigningState {
  return { ...state, slab: { ...state.slab, [slabKey(c)]: { signer_name: signerName, agreed: true } } };
}

/** Every required piece is in place (both boxes, a name, each slab signed). */
export function signingReady(state: SigningState, slabCards: SlabCard[]) {
  return state.esign && state.agreed && named(state.signerName) && slabCards.every((c) => slabSigned(state, c));
}

/** What the checkout routes expect. */
export function submittedSigning(state: SigningState, slabCards: SlabCard[]): SubmittedSigning {
  return {
    ...(state.agreed && named(state.signerName)
      ? { terms: { version: TERMS_VERSION, signer_name: state.signerName.trim(), agreed: true as const } }
      : {}),
    esign_consent: state.esign,
    marketing: { media: state.media, tag_name: state.media && state.tagName },
    slab_authorizations: slabCards
      .filter((c) => slabSigned(state, c))
      .map((c) => ({ card_index: c.index, signer_name: slabSignature(state, c)!.signer_name.trim(), agreed: true as const })),
  };
}

const CHECK = "mt-0.5 h-4 w-4 shrink-0 accent-primary";
const NAME_INPUT = "w-full h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const MORE = "cursor-pointer text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground";
const LINK_BUTTON = "text-xs font-semibold underline underline-offset-2";

export function SigningSection({
  slabCards,
  highValueCards,
  state,
  onChange,
  onSkipSlab,
  onOpenSlab,
  skippedSlabs = [],
  mediaRequiredNote,
  showMissing = false,
}: {
  slabCards: SlabCard[];
  highValueCards: { name: string; valueCents: number }[];
  state: SigningState;
  onChange: (s: SigningState) => void;
  /** The customer chose not to authorize this card's slab: drop the add-on. */
  onSkipSlab: (index: number) => void;
  /** Open the card's slab authorization pop-up. */
  onOpenSlab?: (index: number) => void;
  /** Cards whose slab removal was dropped, to tell the customer. */
  skippedSlabs?: string[];
  /** Set when a paid add-on depends on the photo permission. */
  mediaRequiredNote?: string;
  /** The customer pressed sign with something missing: outline it in red */
  showMissing?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      {(slabCards.length > 0 || skippedSlabs.length > 0) && (
        <section className="flex flex-col gap-2.5">
          <h3 className="font-medium text-foreground">Slab removal</h3>
          {slabCards.map((c) => {
            const signed = slabSigned(state, c);
            return (
              <Need key={slabKey(c)} missing={showMissing && !signed} note="Sign this slab's authorization, or choose not to open it.">
              <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm ${signed ? "border-border bg-card" : "border-amber-300 bg-amber-50"}`}>
                <p className="text-foreground min-w-0">
                  {signed ? <Check className="inline h-4 w-4 mr-1.5 -mt-0.5 text-primary" strokeWidth={2.25} /> : null}
                  <strong className="font-semibold">{cardTitle(c.details) || `Card ${c.index + 1}`}</strong>{c.details.grading_company || c.details.cert_number ? ` (${holderLine(c.details)})` : ""}:{" "}
                  {signed ? `authorization signed by ${slabSignature(state, c)!.signer_name.trim()}.` : "the slab authorization isn't signed yet."}
                </p>
                <span className="flex gap-4">
                  {onOpenSlab && (
                    <button type="button" onClick={() => onOpenSlab(c.index)} className={`${LINK_BUTTON} text-primary`}>
                      {signed ? "Review" : "Sign authorization"}
                    </button>
                  )}
                  {!signed && (
                    <button type="button" onClick={() => onSkipSlab(c.index)} className={`${LINK_BUTTON} text-muted-foreground hover:text-foreground`}>
                      Don&apos;t open this slab (remove the ${(SLAB_FEE_CENTS / 100).toFixed(0)} add-on)
                    </button>
                  )}
                </span>
              </div>
              </Need>
            );
          })}
          {skippedSlabs.length > 0 && (
            <p className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground">
              Slab removal removed for {skippedSlabs.join(", ")}. We won&apos;t open {skippedSlabs.length === 1 ? "that holder" : "those holders"}, and the ${(SLAB_FEE_CENTS / 100).toFixed(0)} add-on is off your order.
            </p>
          )}
        </section>
      )}

      {highValueCards.length > 0 && (
        <section className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5">
          <Hourglass className="h-5 w-5 mt-0.5 shrink-0 text-amber-800" strokeWidth={1.75} />
          <div className="text-sm text-amber-950">
            <p className="font-semibold">{HIGH_VALUE_NOTICE}</p>
            <ul className="mt-1.5 list-disc pl-5">
              {highValueCards.map((c, i) => <li key={i}>{c.name}: ${(c.valueCents / 100).toLocaleString("en-US")}</li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h3 className="font-medium text-foreground">Optional permissions</h3>
        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={CHECK}
            checked={state.media}
            onChange={(e) => onChange({ ...state, media: e.target.checked, tagName: e.target.checked ? state.tagName : false })}
          />
          <span className="text-foreground">{MEDIA_LABEL}</span>
        </label>
        <label className={`flex items-start gap-2.5 text-sm ${state.media ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
          <input
            type="checkbox"
            className={CHECK}
            checked={state.media && state.tagName}
            disabled={!state.media}
            onChange={(e) => onChange({ ...state, tagName: e.target.checked })}
          />
          <span className="text-foreground">{TAG_LABEL}</span>
        </label>
        <p className="text-xs text-muted-foreground">{mediaRequiredNote ?? "Both are optional and don't affect your order."}</p>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" strokeWidth={1.75} />
            Sign to confirm your order
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />Read the Terms of Service v{TERMS_VERSION}
            </a>
            <a href={`/terms/v${TERMS_VERSION}/pdf`} className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
              <Download className="h-3.5 w-3.5" strokeWidth={2} />Download PDF
            </a>
          </div>
        </div>
        <Need missing={showMissing && !state.agreed} note="Check this box to agree to the Terms.">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" className={CHECK} checked={state.agreed} onChange={(e) => onChange({ ...state, agreed: e.target.checked })} />
            <span className="font-semibold text-foreground">{AGREE_LABEL}<Req /></span>
          </label>
        </Need>
        <Need missing={showMissing && !state.esign} note="Check this box to sign electronically.">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" className={CHECK} checked={state.esign} onChange={(e) => onChange({ ...state, esign: e.target.checked })} />
            <span className="text-foreground">{ESIGN_LABEL}<Req /></span>
          </label>
        </Need>
        <details>
          <summary className={MORE}>Your certification (Section {CERTIFICATION_CLAUSE}) and electronic records</summary>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-white p-3 flex flex-col gap-3" tabIndex={0} aria-label="Certification and consent to electronic records">
            <p className="text-sm text-foreground leading-relaxed">{CERTIFICATION_TEXT}</p>
            <LegalDocument blocks={ESIGN_BLOCKS} variant="compact" />
          </div>
        </details>
        <Need missing={showMissing && !named(state.signerName)} note="Type your full legal name to sign." className="flex flex-col gap-1.5 max-w-md">
          <label htmlFor={`${id}-legal-name`} className="text-xs font-semibold text-muted-foreground">Full legal name<Req /></label>
          <input
            id={`${id}-legal-name`}
            className={NAME_INPUT}
            autoComplete="name"
            value={state.signerName}
            onChange={(e) => onChange({ ...state, signerName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Typing your name is your electronic signature on the Terms, including the certification above. The date and time come from our server when you place the order.
          </p>
        </Need>
      </section>
    </div>
  );
}
