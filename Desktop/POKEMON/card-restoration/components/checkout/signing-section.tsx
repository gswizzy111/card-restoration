"use client";

import { useId } from "react";
import { Download, ExternalLink, Hourglass, PenLine } from "lucide-react";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  AGREE_LABEL, CERTIFICATION_CLAUSE, CERTIFICATION_TEXT, ESIGN_BLOCKS, ESIGN_LABEL, HIGH_VALUE_NOTICE,
  KEY_TERMS_BLOCKS, MEDIA_LABEL, TAG_LABEL, TERMS_BLOCKS, TERMS_VERSION,
} from "@/lib/legal/current-terms";
import { cardTitle, holderLine, slabAuthorization, SLAB_FEE_CENTS, type CardDetails } from "@/lib/legal/agreements-v1";
import type { SubmittedSigning } from "@/lib/checkout-signing";

/**
 * Everything a customer signs or chooses before an order is placed (Terms
 * Section 35), in order: a separate authorization for each slab to open,
 * the high-value hold notice, the optional photo permissions (unchecked),
 * the E-SIGN consent, and the master signature on the full Terms. Shared by
 * the restoration, prep and add-cards checkouts.
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

export type SlabCard = { index: number; details: CardDetails };

// A signature belongs to the exact card details it was given for: editing the
// card afterwards asks for it again.
const slabKey = (c: SlabCard) => [c.index, c.details.card_name, c.details.grading_company, c.details.grade, c.details.cert_number].join("\u0001");
const named = (n: string | undefined) => (n ?? "").trim().length >= 2;

export function slabSigned(state: SigningState, c: SlabCard) {
  const s = state.slab[slabKey(c)];
  return !!s && s.agreed && named(s.signer_name);
}

/** Every required piece is in place (master signature, e-sign, each slab signed). */
export function signingReady(state: SigningState, slabCards: SlabCard[], { masterRequired = true } = {}) {
  if (!state.esign) return false;
  if (masterRequired && !(state.agreed && named(state.signerName))) return false;
  return slabCards.every((c) => slabSigned(state, c));
}

/** What the checkout routes expect. */
export function submittedSigning(state: SigningState, slabCards: SlabCard[], { masterRequired = true } = {}): SubmittedSigning {
  return {
    ...(masterRequired && state.agreed && named(state.signerName)
      ? { terms: { version: TERMS_VERSION, signer_name: state.signerName.trim(), agreed: true as const } }
      : {}),
    esign_consent: state.esign,
    marketing: { media: state.media, tag_name: state.media && state.tagName },
    slab_authorizations: slabCards
      .filter((c) => slabSigned(state, c))
      .map((c) => ({ card_index: c.index, signer_name: state.slab[slabKey(c)].signer_name.trim(), agreed: true as const })),
  };
}

const BOX = "rounded-lg border border-border bg-card";
const NAME_INPUT = "w-full h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function SlabAuthorization({ card, state, onChange, onSkip }: {
  card: SlabCard;
  state: SigningState;
  onChange: (s: SigningState) => void;
  onSkip: () => void;
}) {
  const id = useId();
  const key = slabKey(card);
  const sig = state.slab[key] ?? { signer_name: "", agreed: false };
  const set = (patch: Partial<typeof sig>) => onChange({ ...state, slab: { ...state.slab, [key]: { ...sig, ...patch } } });
  const doc = slabAuthorization(card.details);
  const signed = slabSigned(state, card);
  return (
    <div className={`${BOX} p-4 md:p-5 flex flex-col gap-3 ${signed ? "border-primary" : ""}`}>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-primary">{doc.title}</p>
        <p className="mt-1 font-semibold text-foreground">{cardTitle(card.details)}</p>
        <p className="text-sm text-muted-foreground">{holderLine(card.details)}</p>
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-white p-3" tabIndex={0} aria-label={`${doc.title} for ${card.details.card_name}`}>
        <LegalDocument blocks={doc.blocks} variant="compact" />
      </div>
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={sig.agreed} onChange={(e) => set({ agreed: e.target.checked })} />
        <span className="text-foreground">I authorize The Card Doc to open this card&apos;s holder, as described above.</span>
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-xs font-semibold text-muted-foreground">Full legal name</label>
        <input id={`${id}-name`} className={NAME_INPUT} autoComplete="name" value={sig.signer_name} onChange={(e) => set({ signer_name: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">{signed ? "Signed. Dated by our server when you place the order." : "Sign to keep slab removal for this card."}</p>
        <button type="button" onClick={onSkip} className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Don&apos;t open this slab (remove the ${(SLAB_FEE_CENTS / 100).toFixed(0)} add-on)
        </button>
      </div>
    </div>
  );
}

export function SigningSection({
  slabCards,
  highValueCards,
  state,
  onChange,
  onSkipSlab,
  skippedSlabs = [],
  mediaRequiredNote,
  masterRequired = true,
}: {
  slabCards: SlabCard[];
  highValueCards: { name: string; valueCents: number }[];
  state: SigningState;
  onChange: (s: SigningState) => void;
  /** The customer chose not to sign for this card's slab: drop the add-on. */
  onSkipSlab: (index: number) => void;
  /** Cards whose slab removal was dropped, to tell the customer. */
  skippedSlabs?: string[];
  /** Set when a paid add-on depends on the photo permission. */
  mediaRequiredNote?: string;
  /** False on add-cards, where the order's Terms are already signed. */
  masterRequired?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      {(slabCards.length > 0 || skippedSlabs.length > 0) && (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="font-medium text-foreground">Slab removal authorizations</h3>
            <p className="text-sm text-muted-foreground mt-1">Each slab we open needs its own signature, naming the card and its certification number (Terms Section 7).</p>
          </div>
          {slabCards.map((c) => (
            <SlabAuthorization key={slabKey(c)} card={c} state={state} onChange={onChange} onSkip={() => onSkipSlab(c.index)} />
          ))}
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
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={state.media}
            onChange={(e) => onChange({ ...state, media: e.target.checked, tagName: e.target.checked ? state.tagName : false })}
          />
          <span className="text-foreground">{MEDIA_LABEL}</span>
        </label>
        <label className={`flex items-start gap-2.5 text-sm ${state.media ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={state.media && state.tagName}
            disabled={!state.media}
            onChange={(e) => onChange({ ...state, tagName: e.target.checked })}
          />
          <span className="text-foreground">{TAG_LABEL}</span>
        </label>
        <p className="text-xs text-muted-foreground">{mediaRequiredNote ?? "Both are optional and don't affect your order."}</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-white p-3" tabIndex={0} aria-label="Consent to electronic records and signatures">
          <LegalDocument blocks={ESIGN_BLOCKS} variant="compact" />
        </div>
        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={state.esign} onChange={(e) => onChange({ ...state, esign: e.target.checked })} />
          <span className="text-foreground">{ESIGN_LABEL} <span className="text-red-700">*</span></span>
        </label>
      </section>

      {masterRequired && (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
              <PenLine className="h-5 w-5 text-primary" strokeWidth={1.75} />
              Sign the Terms of Service v{TERMS_VERSION}
            </h3>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <a href={`/terms/v${TERMS_VERSION}/pdf`} className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
                <Download className="h-3.5 w-3.5" strokeWidth={2} />Download PDF
              </a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2">
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />Open in a new tab
              </a>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-white p-4" tabIndex={0} aria-label={`Terms of Service v${TERMS_VERSION}`}>
            <LegalDocument blocks={TERMS_BLOCKS} variant="compact" />
          </div>
          <div className={`${BOX} p-4`}>
            <LegalDocument blocks={KEY_TERMS_BLOCKS} variant="compact" />
          </div>
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-primary mb-1">Your certification (Section {CERTIFICATION_CLAUSE})</p>
            <p className="text-sm text-foreground leading-relaxed">{CERTIFICATION_TEXT}</p>
          </div>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={state.agreed} onChange={(e) => onChange({ ...state, agreed: e.target.checked })} />
            <span className="font-semibold text-foreground">{AGREE_LABEL} <span className="text-red-700">*</span></span>
          </label>
          <div className="flex flex-col gap-1.5 max-w-md">
            <label htmlFor={`${id}-legal-name`} className="text-xs font-semibold text-muted-foreground">Full legal name *</label>
            <input
              id={`${id}-legal-name`}
              className={NAME_INPUT}
              autoComplete="name"
              value={state.signerName}
              onChange={(e) => onChange({ ...state, signerName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Typing your name is your electronic signature. The date and time come from our server when you place the order.</p>
          </div>
        </section>
      )}
    </div>
  );
}
