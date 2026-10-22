"use client";

import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LegalDocument } from "@/components/legal/legal-document";
import { GRADING_COMPANIES, SLAB_FEE_CENTS, SLAB_TITLE, cardTitle, slabAuthorization } from "@/lib/legal/agreements-v1";
import { signSlab, slabSignature, slabSigned, type SigningState, type SlabCard } from "./signing-section";
import { Need, Req, revealMissing } from "./required";

export type HolderPatch = { grading_company?: string; grade?: string; cert_number?: string };

const FIELD = "w-full h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The Slab Removal Authorization for one card, opened as soon as the customer
 * picks slab cracking (Terms Section 7). It names the card and its holder,
 * shows the authorization in full, and is signed on the spot with a checkbox
 * and the customer's typed name. Closing it without signing takes the slab
 * (and its $7) off the card.
 */
export function SlabAuthorizationDialog(props: {
  /** The card being authorized, or null when closed */
  card: SlabCard | null;
  state: SigningState;
  onChange: (s: SigningState) => void;
  onHolderChange: (patch: HolderPatch) => void;
  /** signed: the customer signed; otherwise the slab comes off the card */
  onClose: (signed: boolean) => void;
}) {
  if (!props.card) return null;
  // A fresh form per card, starting from any signature already given for it
  return <SlabDialog key={props.card.id ?? props.card.index} {...props} card={props.card} />;
}

function SlabDialog({ card, state, onChange, onHolderChange, onClose }: {
  card: SlabCard;
  state: SigningState;
  onChange: (s: SigningState) => void;
  onHolderChange: (patch: HolderPatch) => void;
  onClose: (signed: boolean) => void;
}) {
  const id = useId();
  const [agreed, setAgreed] = useState(() => !!slabSignature(state, card)?.agreed);
  const [name, setName] = useState(() => slabSignature(state, card)?.signer_name ?? "");
  // Pressed "Sign" with something missing: outline it in red
  const [tried, setTried] = useState(false);
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  const d = card.details;
  const holderOk = !!d.grading_company && !!d.cert_number?.trim();
  const ready = holderOk && agreed && name.trim().length >= 2;
  const doc = slabAuthorization(d);

  function sign() {
    if (!ready) {
      setTried(true);
      revealMissing(box);
      return;
    }
    onChange(signSlab(state, card, name.trim()));
    onClose(true);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(slabSigned(state, card)); }}>
      <DialogContent ref={setBox} className="sm:max-w-xl max-h-[92dvh] overflow-y-auto p-5 md:p-6 gap-5">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-foreground pr-6">{SLAB_TITLE}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {cardTitle(d) || "This card"}: slab cracking is ${(SLAB_FEE_CENTS / 100).toFixed(0)}. We only open this holder once you sign below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Need missing={tried && !d.grading_company} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-company`} className="text-xs font-semibold text-muted-foreground">Grading company<Req /></label>
            <select id={`${id}-company`} className={FIELD} value={d.grading_company ?? ""} onChange={(e) => onHolderChange({ grading_company: e.target.value })}>
              <option value="">Choose…</option>
              {GRADING_COMPANIES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Need>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-grade`} className="text-xs font-semibold text-muted-foreground">Grade</label>
            <input id={`${id}-grade`} className={FIELD} placeholder="e.g. 9" value={d.grade ?? ""} onChange={(e) => onHolderChange({ grade: e.target.value })} />
          </div>
          <Need missing={tried && !d.cert_number?.trim()} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-cert`} className="text-xs font-semibold text-muted-foreground">Certification number<Req /></label>
            <input id={`${id}-cert`} className={FIELD} placeholder="From the slab label" value={d.cert_number ?? ""} onChange={(e) => onHolderChange({ cert_number: e.target.value })} />
          </Need>
        </div>

        <div className="max-h-[38dvh] overflow-y-auto rounded-md border border-border bg-white p-3" tabIndex={0} aria-label={`${SLAB_TITLE} for ${d.card_name}`}>
          <LegalDocument blocks={doc.blocks} variant="compact" />
        </div>

        <Need missing={tried && !agreed} note="Check this box to authorize opening the slab.">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span className="text-foreground">I authorize The Card Doc to open this card&apos;s holder, as described above.<Req /></span>
          </label>
        </Need>
        <Need missing={tried && name.trim().length < 2} note="Type your full legal name to sign." className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-name`} className="text-xs font-semibold text-muted-foreground">Full legal name<Req /></label>
          <input id={`${id}-name`} className={FIELD} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-muted-foreground">Typing your name signs this authorization for this card only. The date and time come from our server when you place the order.</p>
        </Need>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <button type="button" onClick={() => onClose(false)} className="text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground self-start sm:self-auto">
            Don&apos;t open this slab
          </button>
          <button
            type="button"
            onClick={sign}
            className="h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Sign slab authorization
          </button>
        </div>
        {tried && !ready && <p className="text-sm font-semibold text-red-700 -mt-2" role="alert">Please fill in the fields outlined in red.</p>}
      </DialogContent>
    </Dialog>
  );
}
