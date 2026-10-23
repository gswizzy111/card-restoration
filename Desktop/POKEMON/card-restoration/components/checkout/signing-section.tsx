"use client";

import { useId } from "react";
import { Download, ExternalLink, PenLine } from "lucide-react";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  AGREE_LABEL, CERTIFICATION_CLAUSE, CERTIFICATION_TEXT, ESIGN_BLOCKS, ESIGN_LABEL,
  MEDIA_LABEL, TAG_LABEL, TERMS_VERSION,
} from "@/lib/legal/current-terms";
import type { CardDetails } from "@/lib/legal/agreements-v1";
import type { SubmittedSigning } from "@/lib/checkout-signing";
import { Need, Req } from "./required";

/**
 * Everything a customer signs or chooses before an order is placed (Terms
 * Section 35), kept short. Each slab to open is authorized only in its own
 * pop-up when slab cracking is picked (SlabAuthorizationDialog), stored with
 * the order and not shown again. Here: the optional photo permissions
 * (unchecked), and "Sign to confirm your order": two required boxes (the Terms
 * and electronic records) and the Full legal name. The full
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

export function SigningSection({
  state,
  onChange,
  mediaRequiredNote,
  showMissing = false,
}: {
  state: SigningState;
  onChange: (s: SigningState) => void;
  /** Set when a paid add-on depends on the photo permission. */
  mediaRequiredNote?: string;
  /** The customer pressed sign with something missing: outline it in red */
  showMissing?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
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
