"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { computeOrderTotals, INSTAGRAM_FEATURE_CENTS } from "@/lib/order-totals";
import type { Service, CardEntry, CustomerInfo, ShippingRate, InsuranceSelection } from "@/lib/types";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import { INSURANCE_ENABLED } from "@/lib/site-config";
import { InsuranceElectionBox, type InsuranceElection } from "@/components/checkout/insurance-election";
import { Req } from "@/components/checkout/required";
import type { InsuranceType } from "@/lib/types";

const INSURANCE_OPTION_LABELS: Record<Exclude<InsuranceType, "none">, { label: string; sub: string }> = {
  inbound: { label: "Insure the trip to us", sub: "Covers the prepaid label's package from you to The Card Doc" },
  round_trip: { label: "Insure both ways", sub: "Covers the trip to us and the trip back to you" },
  return: { label: "Insure the trip back to you", sub: "Covers the return package from The Card Doc to you" },
};
export const insuranceTypeLabel = (t: InsuranceType) => (t === "round_trip" ? "round trip" : t === "return" ? "return" : "inbound");

interface StepReviewProps {
  services: Service[];
  selectedServiceIds: string[];
  cards: CardEntry[];
  customer: CustomerInfo;
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  customerNotes: string;
  onNotesChange: (v: string) => void;
  affiliateCode: string;
  onAffiliateCodeChange: (v: string) => void;
  discountPercent: number;
  onDiscountChange: (pct: number) => void;
  giftCardCode: string;
  onGiftCardCodeChange: (v: string) => void;
  giftCardAmountCents: number;
  onGiftCardAmountChange: (cents: number) => void;
  instagramFeature: boolean;
  onInstagramFeatureChange: (v: boolean) => void;
  onEditStep: (step: number) => void;
  selectedTier?: RestorationTierId;
  /** The slab authorizations, permissions, e-sign consent and master signature (components/checkout/signing-section.tsx) */
  signingSlot?: React.ReactNode;
  /** The customer pressed sign with something missing: outline it in red */
  showMissing?: boolean;
  insuranceElection: InsuranceElection;
  onInsuranceElectionChange: (e: Exclude<InsuranceElection, null>) => void;
  insurance: InsuranceSelection;
  onInsuranceChange: (ins: InsuranceSelection) => void;
  addSignatureConfirmation: boolean;
  onSignatureConfirmationChange: (v: boolean) => void;
  loyaltyDiscountPercent: number;
  onLoyaltyDiscountChange: (pct: number) => void;
  tipCents: number;
  onTipCentsChange: (cents: number) => void;
}

export function StepReview({
  cards,
  customer,
  shippingMethod,
  selectedRate,
  customerNotes,
  onNotesChange,
  affiliateCode,
  onAffiliateCodeChange,
  discountPercent,
  onDiscountChange,
  giftCardCode,
  onGiftCardCodeChange,
  giftCardAmountCents,
  onGiftCardAmountChange,
  instagramFeature,
  onInstagramFeatureChange,
  onEditStep,
  selectedTier,
  insurance,
  signingSlot,
  showMissing = false,
  insuranceElection,
  onInsuranceElectionChange,
  onInsuranceChange,
  addSignatureConfirmation,
  onSignatureConfirmationChange,
  loyaltyDiscountPercent,
  onLoyaltyDiscountChange,
  tipCents,
  onTipCentsChange,
}: StepReviewProps) {
  const [codeStatus, setCodeStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [codeName, setCodeName] = useState("");
  const [gcStatus, setGcStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [insuranceQuote, setInsuranceQuote] = useState<{ customerChargeCents: number; roundTripChargeCents: number } | null>(null);
  const [quotingInsurance, setQuotingInsurance] = useState(false);
  const [insuranceDollars, setInsuranceDollars] = useState(
    insurance.declaredValueCents > 0 ? String(insurance.declaredValueCents / 100) : ""
  );

  // Auto-detect loyalty discount when review step loads
  useEffect(() => {
    if (!customer.email) return;
    fetch(`/api/loyalty?email=${encodeURIComponent(customer.email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.discountPercent > 0) onLoyaltyDiscountChange(data.discountPercent);
      })
      .catch(() => {});
  }, [customer.email]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchInsuranceQuote(declaredValueCents: number) {
    if (declaredValueCents < 100) { setInsuranceQuote(null); return; }
    setQuotingInsurance(true);
    try {
      const res = await fetch(`/api/insurance/quote?declared_value_cents=${declaredValueCents}`);
      const data = await res.json();
      if (res.ok) {
        setInsuranceQuote({ customerChargeCents: data.customerChargeCents, roundTripChargeCents: data.roundTripChargeCents });
        if (insurance.type !== "none" && insuranceOptions.includes(insurance.type)) {
          const charge = insurance.type === "round_trip" ? data.roundTripChargeCents : data.customerChargeCents;
          onInsuranceChange({ ...insurance, declaredValueCents, chargeCents: charge });
        } else {
          onInsuranceChange({ declaredValueCents, type: "none", chargeCents: 0 });
        }
      }
    } finally {
      setQuotingInsurance(false);
    }
  }

  function handleDeclaredValueBlur() {
    const raw = insuranceDollars.replace(/[^0-9.]/g, "");
    const dollars = parseFloat(raw);
    if (!raw || isNaN(dollars) || dollars < 1) {
      setInsuranceDollars("");
      onInsuranceChange({ declaredValueCents: 0, type: "none", chargeCents: 0 });
      setInsuranceQuote(null);
      return;
    }
    const clamped = Math.min(Math.floor(dollars), 10000);
    if (clamped < 1) {
      setInsuranceDollars("");
      onInsuranceChange({ declaredValueCents: 0, type: "none", chargeCents: 0 });
      setInsuranceQuote(null);
      return;
    }
    setInsuranceDollars(String(clamped));
    fetchInsuranceQuote(clamped * 100);
  }

  function handleInsuranceTypeChange(type: InsuranceType) {
    if (type === "none") {
      onInsuranceChange({ declaredValueCents: insurance.declaredValueCents, type: "none", chargeCents: 0 });
    } else if (insuranceQuote) {
      const charge = type === "round_trip" ? insuranceQuote.roundTripChargeCents : insuranceQuote.customerChargeCents;
      onInsuranceChange({ ...insurance, type, chargeCents: charge });
    } else {
      onInsuranceChange({ ...insurance, type, chargeCents: 0 });
    }
  }

  async function validateCode() {
    const trimmed = affiliateCode.trim().toUpperCase();
    if (!trimmed) return;
    const res = await fetch(`/api/affiliates/validate?code=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setCodeStatus("valid");
      setCodeName(data.name);
      onDiscountChange(data.discount_percent ?? 0);
    } else {
      setCodeStatus("invalid");
      setCodeName("");
      onDiscountChange(0);
    }
  }

  async function validateGiftCard() {
    const trimmed = giftCardCode.trim().toUpperCase();
    if (!trimmed) return;
    const res = await fetch(`/api/gift-cards/validate?code=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setGcStatus("valid");
      onGiftCardAmountChange(data.remaining_cents);
    } else {
      setGcStatus("invalid");
      onGiftCardAmountChange(0);
    }
  }

  // We can only insure the trip to us when we buy that label
  const insuranceOptions: Exclude<InsuranceType, "none">[] = shippingMethod === "buy_label" ? ["inbound", "round_trip"] : ["return"];

  const effectiveDiscountPct = Math.max(discountPercent, loyaltyDiscountPercent);
  const totals = computeOrderTotals({
    cards,
    selectedTier,
    shippingMethod,
    selectedRate,
    discountPercent: effectiveDiscountPct,
    insuranceCents: INSURANCE_ENABLED ? insurance.chargeCents : 0,
    addSignatureConfirmation,
    instagramFeature,
    giftCardAmountCents,
  });
  // The totals themselves (with any tip) are in the order summary beside this step
  const gcApplied = totals.giftCardCents;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">Review your order.</h2>
      </div>

      {/* Shipping */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Shipping</h3>
          <button
            type="button"
            onClick={() => onEditStep(4)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {shippingMethod === "buy_label"
            ? selectedRate
              ? `Prepaid label — ${selectedRate.carrier} ${selectedRate.service_level} — ${formatCurrency(selectedRate.amount_cents)}`
              : "Prepaid label"
            : `Self-ship — you'll receive our address after checkout${selectedRate ? `. Return shipping: ${selectedRate.carrier} ${selectedRate.service_level}, ${formatCurrency(selectedRate.amount_cents)}` : ""}`}
        </p>
      </div>

      {/* Signature confirmation add-on */}
      {shippingMethod === "buy_label" && (
        <div className={`border-2 rounded-xl p-4 transition-colors ${addSignatureConfirmation ? "border-blue-400 bg-blue-50" : "border-border"}`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addSignatureConfirmation}
              onChange={(e) => onSignatureConfirmationChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
            />
            <div>
              <p className="font-medium text-foreground text-sm">
                Add signature confirmation on delivery{" "}
                <span className="text-primary font-semibold">+$5.00</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requires someone to sign for the package when delivered to you. Adds an extra layer of security for high-value cards.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Shipping insurance: a required choice, buy or decline (Terms 15.2, 15.4) */}
      {INSURANCE_ENABLED && (
        <InsuranceElectionBox
          election={insuranceElection}
          onElection={onInsuranceElectionChange}
          showMissing={showMissing}
          purchaseMissing={!(insurance.declaredValueCents > 0 && insurance.type !== "none")}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide" htmlFor="insurance-amount">Amount to insure<Req /></label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                id="insurance-amount"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={insuranceDollars}
                onChange={(e) => setInsuranceDollars(e.target.value)}
                onBlur={handleDeclaredValueBlur}
                placeholder="e.g. 500"
                className="w-36 h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              {quotingInsurance && <span className="text-xs text-muted-foreground">Getting rate...</span>}
            </div>
            <p className="text-xs text-muted-foreground">The value of the cards in the package ($1 to $10,000)</p>
          </div>

          {insuranceQuote && insurance.declaredValueCents > 0 && (
            <div className="flex flex-col gap-2">
              {insuranceOptions.map((type) => {
                const { label, sub } = INSURANCE_OPTION_LABELS[type];
                const price = type === "round_trip" ? insuranceQuote.roundTripChargeCents : insuranceQuote.customerChargeCents;
                return (
                  <label key={type} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${insurance.type === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <input
                      type="radio"
                      name="insurance-type"
                      checked={insurance.type === type}
                      onChange={() => handleInsuranceTypeChange(type)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className="text-sm font-semibold text-primary ml-2">{formatCurrency(price)}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {!insuranceQuote && insurance.declaredValueCents === 0 && (
            <p className="text-xs text-muted-foreground italic">Enter the amount to insure to see the price.</p>
          )}
        </InsuranceElectionBox>
      )}

      {/* Instagram Feature Add-on */}
      <div className={`border-2 rounded-xl p-5 transition-colors ${instagramFeature ? "border-[#1a8fe0] bg-blue-50" : "border-border"}`}>
        <label className="flex items-start gap-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={instagramFeature}
            onChange={(e) => onInstagramFeatureChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
          />
          <div>
            <p className="font-medium text-foreground">
              Feature my card in an Instagram video{" "}
              <span className="text-[#1a8fe0] font-semibold">+{formatCurrency(INSTAGRAM_FEATURE_CENTS)}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              We&apos;ll film your card being restored and post it to{" "}
              <a href="https://www.instagram.com/the_card_doc" target="_blank" rel="noopener noreferrer" className="text-[#1a8fe0] hover:underline">@the_card_doc</a>.
              Perfect for rare or high-value cards.
            </p>
          </div>
        </label>
      </div>

      {/* Tip */}
      <div className="border-2 rounded-xl p-5 border-border">
        <p className="font-medium text-foreground mb-1">Add a tip <span className="text-xs text-muted-foreground font-normal">(optional)</span></p>
        <p className="text-sm text-muted-foreground mb-3">100% goes to the technician working on your cards. Thank you!</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[0, 500, 1000, 2000, 5000].map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => onTipCentsChange(cents)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                tipCents === cents
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-foreground border-border hover:border-amber-400"
              }`}
            >
              {cents === 0 ? "No tip" : formatCurrency(cents)}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            step={1}
            placeholder="Custom amount"
            value={tipCents > 0 && ![500, 1000, 2000, 5000].includes(tipCents) ? tipCents / 100 : ""}
            onChange={(e) => {
              const v = Math.round((parseFloat(e.target.value) || 0) * 100);
              onTipCentsChange(Math.min(v, 50000));
            }}
            className="w-full border border-border rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-notes">Anything else we should know? (optional)</Label>
        <Textarea
          id="customer-notes"
          value={customerNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Special instructions, packaging preferences, etc."
        />
      </div>

      {/* Affiliate / creator code */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="affiliate-code">Creator or coupon code <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="flex gap-2">
          <input
            id="affiliate-code"
            type="text"
            value={affiliateCode}
            onChange={(e) => {
              onAffiliateCodeChange(e.target.value.toUpperCase());
              setCodeStatus("idle");
              setCodeName("");
              onDiscountChange(0);
            }}
            placeholder="CREATOR123"
            className="flex-1 h-9 border border-border rounded-lg px-3 text-sm font-mono uppercase focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            onClick={validateCode}
            disabled={!affiliateCode.trim()}
            className="h-9 px-4 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:bg-border transition-colors disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        {codeStatus === "valid" && discountPercent > 0 && (
          <p className="text-sm text-green-600 font-medium">✓ {discountPercent}% discount applied — {codeName}</p>
        )}
        {codeStatus === "valid" && discountPercent === 0 && (
          <p className="text-sm text-green-600 font-medium">✓ Code applied — {codeName}</p>
        )}
        {codeStatus === "invalid" && <p className="text-sm text-red-500">Invalid code.</p>}
      </div>

      {/* Gift card */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="gift-card-code">Gift card code <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="flex gap-2">
          <input
            id="gift-card-code"
            type="text"
            value={giftCardCode}
            onChange={(e) => {
              onGiftCardCodeChange(e.target.value.toUpperCase());
              setGcStatus("idle");
              onGiftCardAmountChange(0);
            }}
            placeholder="GIFT-XXXX-XXXX"
            className="flex-1 h-9 border border-border rounded-lg px-3 text-sm font-mono uppercase focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            onClick={validateGiftCard}
            disabled={!giftCardCode.trim()}
            className="h-9 px-4 bg-secondary text-foreground text-sm font-semibold rounded-lg hover:bg-border transition-colors disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        {gcStatus === "valid" && gcApplied > 0 && (
          <p className="text-sm text-green-600 font-medium">✓ Gift card applied — {formatCurrency(gcApplied)} off</p>
        )}
        {gcStatus === "invalid" && <p className="text-sm text-red-500">Invalid or already used gift card.</p>}
      </div>

      {signingSlot}
    </div>
  );
}
