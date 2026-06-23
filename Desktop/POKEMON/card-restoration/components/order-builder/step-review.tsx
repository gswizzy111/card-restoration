"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { getPriceCents, getRatePerCard } from "@/lib/pricing";
import { getTierById, formatCents } from "@/lib/restoration-tiers";
import type { Service, CardEntry, CustomerInfo, ShippingRate, InsuranceSelection } from "@/lib/types";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import { INSURANCE_ENABLED } from "@/lib/site-config";

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
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  onEditStep: (step: number) => void;
  selectedTier?: RestorationTierId;
  insurance: InsuranceSelection;
  onInsuranceChange: (ins: InsuranceSelection) => void;
}

export function StepReview({
  services,
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
  termsAccepted,
  onTermsChange,
  onEditStep,
  selectedTier,
  insurance,
  onInsuranceChange,
}: StepReviewProps) {
  const [codeStatus, setCodeStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [codeName, setCodeName] = useState("");
  const [insuranceQuote, setInsuranceQuote] = useState<{ customerChargeCents: number; roundTripChargeCents: number } | null>(null);
  const [quotingInsurance, setQuotingInsurance] = useState(false);
  const [insuranceDollars, setInsuranceDollars] = useState(
    insurance.declaredValueCents > 0 ? String(insurance.declaredValueCents / 100) : ""
  );

  async function fetchInsuranceQuote(declaredValueCents: number) {
    if (declaredValueCents < 100) { setInsuranceQuote(null); return; }
    setQuotingInsurance(true);
    try {
      const res = await fetch(`/api/insurance/quote?declared_value_cents=${declaredValueCents}`);
      const data = await res.json();
      if (res.ok) {
        setInsuranceQuote({ customerChargeCents: data.customerChargeCents, roundTripChargeCents: data.roundTripChargeCents });
        if (insurance.type !== "none") {
          const charge = insurance.type === "round_trip" ? data.roundTripChargeCents : data.customerChargeCents;
          onInsuranceChange({ ...insurance, declaredValueCents, chargeCents: charge });
        } else {
          onInsuranceChange({ ...insurance, declaredValueCents });
        }
      }
    } finally {
      setQuotingInsurance(false);
    }
  }

  function handleDeclaredValueBlur() {
    const dollars = parseFloat(insuranceDollars.replace(/[^0-9.]/g, ""));
    if (isNaN(dollars) || dollars < 1) {
      setInsuranceDollars("");
      onInsuranceChange({ declaredValueCents: 0, type: "none", chargeCents: 0 });
      setInsuranceQuote(null);
      return;
    }
    const clamped = Math.min(Math.floor(dollars), 10000);
    setInsuranceDollars(String(clamped));
    fetchInsuranceQuote(clamped * 100);
  }

  function handleInsuranceTypeChange(type: "none" | "inbound" | "round_trip") {
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

  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

  // Sum per-card tier prices (supports mixed tiers)
  let subtotal = 0;
  for (const card of cards) {
    const tierId = card.tier ?? selectedTier;
    if (tierId) {
      subtotal += getTierById(tierId).price_cents;
    } else {
      subtotal = getPriceCents(cards.length);
      break;
    }
  }

  const TAX_RATE = 0.065;
  const discountCents = discountPercent > 0 ? Math.round(subtotal * discountPercent / 100) : 0;
  const taxCents = Math.round((subtotal - discountCents) * TAX_RATE);
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const total = subtotal - discountCents + taxCents + shipping + (INSURANCE_ENABLED ? insurance.chargeCents : 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">Review your order.</h2>
      </div>

      {/* Cards & Services/Tier */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Cards & Services</h3>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        {selectedTier && (
          <div className="border border-[#1a8fe0] bg-blue-50 rounded-lg p-4">
            <p className="font-medium text-[#1a8fe0] text-sm mb-1">
              {getTierById(selectedTier).name} Tier
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Turnaround: {getTierById(selectedTier).turnaround_min_days}–{getTierById(selectedTier).turnaround_max_days} business days</p>
              <p>Max value: {getTierById(selectedTier).max_card_value_cents === null ? "Unlimited" : formatCurrency(getTierById(selectedTier).max_card_value_cents!)}</p>
            </div>
          </div>
        )}
        {cards.map((card, i) => (
          <div key={card.id} className="border border-border rounded-lg p-4 flex flex-col gap-2">
            <p className="font-medium text-foreground text-sm">
              Card {i + 1}: {card.card_name}
            </p>
            <div className="flex flex-wrap gap-1">
              {(card.tier ?? selectedTier) ? (
                <span className="text-xs bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                  {getTierById(card.tier ?? selectedTier!).name} Restoration — {formatCents(getTierById(card.tier ?? selectedTier!).price_cents)}
                </span>
              ) : (
                card.service_ids.map((sid) => {
                  const svc = serviceMap[sid];
                  return svc ? (
                    <span
                      key={sid}
                      className="text-xs bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground"
                    >
                      {svc.name} — {formatCurrency(getRatePerCard(cards.length))}
                    </span>
                  ) : null;
                })
              )}
            </div>
          </div>
        ))}
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
            : "Self-ship — you'll receive our address after checkout"}
        </p>
      </div>

      {/* Insurance */}
      {INSURANCE_ENABLED && <div className="flex flex-col gap-3">
        <h3 className="font-medium text-foreground">Package Insurance <span className="text-xs font-normal text-muted-foreground">(optional)</span></h3>
        <p className="text-xs text-muted-foreground">Insure your cards against loss or damage in transit via Shippo / ShipSurance. Up to $10,000.</p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Declared Value</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
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
          <p className="text-xs text-muted-foreground">Enter the value of cards you&apos;re sending ($1–$10,000)</p>
        </div>

        {insuranceQuote && insurance.declaredValueCents > 0 && (
          <div className="flex flex-col gap-2">
            {(["none", "inbound", "round_trip"] as const).map((type) => {
              const label = type === "none" ? "No insurance" : type === "inbound" ? "Inbound only" : "Round trip";
              const sublabel = type === "none" ? "" : type === "inbound" ? "You → The Card Doc" : "Both ways (you → us → back to you)";
              const price = type === "none" ? null : type === "inbound" ? insuranceQuote.customerChargeCents : insuranceQuote.roundTripChargeCents;
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
                    {price !== null && <span className="text-sm font-semibold text-primary ml-2">{formatCurrency(price)}</span>}
                    {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {!insuranceQuote && insurance.declaredValueCents === 0 && (
          <p className="text-xs text-muted-foreground italic">Enter a declared value above to see insurance pricing.</p>
        )}
      </div>}

      {/* Customer info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Your Information</h3>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
          <p>{customer.name}</p>
          <p>{customer.email}</p>
          <p>{customer.phone}</p>
          <p>
            {customer.street1}
            {customer.street2 ? `, ${customer.street2}` : ""}
          </p>
          <p>
            {customer.city}, {customer.state} {customer.zip}
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="border border-border rounded-lg p-5 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Discount ({discountPercent}% off)</span>
            <span>−{formatCurrency(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Sales Tax (6.5%)</span>
          <span>{formatCurrency(taxCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Shipping</span>
          <span>{shippingMethod === "self_ship" ? "Self-ship" : formatCurrency(shipping)}</span>
        </div>
        {INSURANCE_ENABLED && insurance.chargeCents > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Insurance ({insurance.type === "round_trip" ? "round trip" : "inbound"})</span>
            <span>{formatCurrency(insurance.chargeCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium text-foreground pt-2 border-t border-border">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
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

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
        />
        <span className="text-sm text-muted-foreground">
          I have read and agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            Terms &amp; Conditions
          </a>
          , including The Card Doc&apos;s limitations of liability regarding grading outcomes and card condition.
        </span>
      </label>
    </div>
  );
}
