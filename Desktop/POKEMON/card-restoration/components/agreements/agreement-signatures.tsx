"use client";

import { useId } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  highValueAgreement,
  needsHighValueAgreement,
  signatureDate,
  slabRemovalAgreement,
  type AgreementText,
  type SubmittedAgreements,
} from "@/lib/agreements";

/**
 * The checkout's separate, dated signatures: the Slab-Removal Authorization
 * (when any card is being cracked) and a High-Value Card Agreement for each
 * card declared above $5,000. Each signature is keyed to the exact card
 * details it was given for, so changing a card's name or value afterwards
 * asks for that signature again.
 */
type Sig = { signer_name: string; agreed: boolean };
export type AgreementState = Record<string, Sig>;

export type AgreementCard = { name: string; declaredValueCents: number };

const slabKey = (slabCards: string[] | number) => `slab|${typeof slabCards === "number" ? slabCards : slabCards.join("\u0001")}`;
const highKey = (index: number, c: AgreementCard) => `high|${index}|${c.name}|${c.declaredValueCents}`;
const signed = (s: Sig | undefined) => !!s && s.agreed && s.signer_name.trim().length >= 2;

function slabCount(slabCards: string[] | number) {
  return typeof slabCards === "number" ? slabCards : slabCards.length;
}

/** Every agreement this order needs is signed. */
export function agreementsComplete(state: AgreementState, slabCards: string[] | number, cards: AgreementCard[]) {
  if (slabCount(slabCards) > 0 && !signed(state[slabKey(slabCards)])) return false;
  return cards.every((c, i) => !needsHighValueAgreement(c.declaredValueCents) || signed(state[highKey(i, c)]));
}

/** What the checkout route expects (only the signatures for the current cards). */
export function submittedAgreements(state: AgreementState, slabCards: string[] | number, cards: AgreementCard[]): SubmittedAgreements {
  const slab = slabCount(slabCards) > 0 ? state[slabKey(slabCards)] : undefined;
  const high = cards.flatMap((c, i) => {
    const s = needsHighValueAgreement(c.declaredValueCents) ? state[highKey(i, c)] : undefined;
    return signed(s) ? [{ card_index: i, signer_name: s!.signer_name.trim(), agreed: true as const }] : [];
  });
  return {
    ...(signed(slab) ? { slab_removal: { signer_name: slab!.signer_name.trim(), agreed: true as const } } : {}),
    ...(high.length ? { high_value: high } : {}),
  };
}

function AgreementBox({
  agreement,
  subtitle,
  href,
  sig,
  onChange,
}: {
  agreement: AgreementText;
  subtitle?: string;
  href: string;
  sig: Sig | undefined;
  onChange: (s: Sig) => void;
}) {
  const id = useId();
  const value = sig ?? { signer_name: "", agreed: false };
  const done = signed(sig);
  return (
    <div className={`rounded-lg border p-4 md:p-5 transition-colors ${done ? "border-green-600/50 bg-green-50/50" : "border-border bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{agreement.title}</p>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {done && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Signed
          </span>
        )}
      </div>
      <div
        className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground leading-relaxed"
        tabIndex={0}
        aria-label={`${agreement.title} text`}
      >
        <p className="text-foreground">{agreement.intro}</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          {agreement.points.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <Link href={href} target="_blank" className="underline underline-offset-2 hover:text-foreground">Open in a new tab</Link>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor={`${id}-name`} className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Type your full name to sign
          </label>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="name"
            value={value.signer_name}
            onChange={(e) => onChange({ ...value, signer_name: e.target.value })}
            className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <p className="text-sm text-muted-foreground sm:pb-2.5">Date: <span className="font-medium text-foreground">{signatureDate()}</span></p>
      </div>
      <label className="mt-3 flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={value.agreed}
          onChange={(e) => onChange({ ...value, agreed: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
        />
        <span>I have read and agree to this {agreement.title}{subtitle ? ` for ${subtitle.split(" · ")[0]}` : ""}.</span>
      </label>
    </div>
  );
}

export function AgreementSignatures({
  slabCards,
  cards,
  state,
  onChange,
}: {
  /** The slabbed cards' names, or how many (prep). */
  slabCards: string[] | number;
  cards: AgreementCard[];
  state: AgreementState;
  onChange: (s: AgreementState) => void;
}) {
  const high = cards.map((c, i) => ({ c, i })).filter(({ c }) => needsHighValueAgreement(c.declaredValueCents));
  if (slabCount(slabCards) === 0 && high.length === 0) return null;
  const set = (key: string) => (s: Sig) => onChange({ ...state, [key]: s });
  const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-foreground">Agreements to sign</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {slabCount(slabCards) > 0 && high.length > 0
            ? "Your order includes slab cracking and cards declared above $5,000. Each needs its own signature."
            : slabCount(slabCards) > 0
            ? "Your order includes slab cracking, which needs a separate signed authorization."
            : `Cards declared above $5,000 each need their own signed agreement${high.length > 1 ? ` (${high.length} cards)` : ""}.`}
        </p>
      </div>
      {slabCount(slabCards) > 0 && (
        <AgreementBox
          agreement={slabRemovalAgreement(slabCards)}
          href="/agreements/slab-removal"
          sig={state[slabKey(slabCards)]}
          onChange={set(slabKey(slabCards))}
        />
      )}
      {high.map(({ c, i }) => (
        <AgreementBox
          key={highKey(i, c)}
          agreement={highValueAgreement(c)}
          subtitle={`${c.name} · declared ${usd(c.declaredValueCents)}`}
          href="/agreements/high-value"
          sig={state[highKey(i, c)]}
          onChange={set(highKey(i, c))}
        />
      ))}
    </div>
  );
}
