"use client";

import { useState, Suspense } from "react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { US_STATES } from "@/lib/constants";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

const INPUT_CN = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

const COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "AT", name: "Austria" },
  { code: "IE", name: "Ireland" },
  { code: "FI", name: "Finland" },
  { code: "HK", name: "Hong Kong" },
  { code: "TW", name: "Taiwan" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
];

type ShippingRate = {
  provider: string;
  service: string;
  amountCents: number;
  days: number | null;
};

function CheckoutInner() {
  const { items, totalCents, clearCart } = useCart();
  const searchParams = useSearchParams();
  const isInternational = searchParams.get("international") === "true";

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    street1: "", street2: "", city: "", state: "", zip: "", country: "",
  });

  // Creator / coupon code
  const [codeInput, setCodeInput] = useState("");
  const [creatorCode, setCreatorCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [discountPercent, setDiscountPercent] = useState(0);

  // International shipping
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);
  const [rateError, setRateError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Reset rate if address changes
    if (isInternational && ["street1", "city", "zip", "country"].includes(field)) {
      setChosenRate(null);
      setRateStatus("idle");
    }
  }

  async function applyCreatorCode() {
    const trimmed = codeInput.trim();
    if (!trimmed) return;
    setCodeStatus("checking");
    try {
      const res = await fetch(`/api/affiliates/validate?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setCreatorCode(trimmed);
        setCodeStatus("valid");
        setDiscountPercent(data.discount_percent ?? 0);
      } else {
        setCreatorCode("");
        setCodeStatus("invalid");
        setDiscountPercent(0);
      }
    } catch {
      setCreatorCode("");
      setCodeStatus("invalid");
      setDiscountPercent(0);
    }
  }

  async function calculateShipping() {
    setRateStatus("loading");
    setRateError("");
    setChosenRate(null);
    try {
      const res = await fetch("/api/shop/international-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          street1: form.street1,
          street2: form.street2 || undefined,
          city: form.city,
          state: form.state || undefined,
          zip: form.zip,
          country: form.country,
          item_names: items.map((i) => i.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRateError(data.error ?? "Failed to calculate shipping"); setRateStatus("error"); return; }
      // Pick cheapest rate
      const cheapest: ShippingRate = data.rates[0];
      setChosenRate(cheapest);
      setRateStatus("done");
    } catch {
      setRateError("Network error. Please try again.");
      setRateStatus("error");
    }
  }

  function isAddressValid() {
    if (!form.name || !form.email || !form.phone || !form.street1 || !form.city || !form.zip) return false;
    if (isInternational) return !!form.country;
    return !!form.state;
  }

  function canPay() {
    if (!isAddressValid()) return false;
    if (isInternational) return rateStatus === "done" && !!chosenRate;
    return true;
  }

  async function handleCheckout() {
    if (!canPay()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        items: items.map((i) => ({ id: i.id, quantity: i.quantity, slug: i.slug })),
        customer: { name: form.name, email: form.email, phone: form.phone },
        address: {
          street1: form.street1,
          street2: form.street2 || undefined,
          city: form.city,
          state: form.state || "",
          zip: form.zip,
          country: isInternational ? form.country : "US",
        },
      };
      if (codeStatus === "valid" && creatorCode) body.affiliate_code = creatorCode;
      if (isInternational && chosenRate) {
        body.international_shipping_cents = chosenRate.amountCents + 1000;
        body.international_shipping_label = `${chosenRate.provider} ${chosenRate.service}`;
      }

      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        clearCart();
        window.location.href = data.url;
      } else {
        toast.error(typeof data.error === "string" ? data.error : "Something went wrong.");
        setSubmitting(false);
      }
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const intlShippingTotal = chosenRate ? chosenRate.amountCents + 1000 : 0;
  const discountCents = discountPercent > 0 ? Math.round(totalCents * discountPercent / 100) : 0;
  const discountedTotal = totalCents - discountCents;
  const taxCents = Math.round(discountedTotal * 0.06625);

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty.</p>
        <Button render={<Link href="/shop" />}>Browse Shop</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="font-heading font-black text-3xl text-foreground">Checkout</h1>
        {isInternational && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">International</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Form */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Contact */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="John Smith" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="john@email.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000" />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">Shipping Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isInternational && (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label>Country *</Label>
                  <select
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Street Address *</Label>
                <AddressAutocomplete
                  value={form.street1}
                  onChange={(v) => set("street1", v)}
                  onPlaceSelect={(f) => setForm((prev) => ({ ...prev, street1: f.street1, city: f.city, state: f.state, zip: f.zip }))}
                  className={INPUT_CN}
                  placeholder="123 Main St"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Apt / Suite</Label>
                <Input value={form.street2} onChange={(e) => set("street2", e.target.value)} placeholder="Apt 4B" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="London" />
              </div>
              {isInternational ? (
                <div className="flex flex-col gap-1.5">
                  <Label>State / Province</Label>
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Optional" />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>State *</Label>
                  <select
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Postal Code *</Label>
                <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} placeholder="SW1A 1AA" />
              </div>
            </div>

            {/* International shipping calculator */}
            {isInternational && (
              <div className="mt-5 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={calculateShipping}
                  disabled={!isAddressValid() || rateStatus === "loading"}
                  className="w-full h-10 bg-secondary text-foreground text-sm font-bold rounded-lg hover:bg-secondary/70 disabled:opacity-40 transition-colors"
                >
                  {rateStatus === "loading" ? "Calculating..." : "Calculate Exact Shipping"}
                </button>

                {rateStatus === "error" && (
                  <p className="text-xs text-red-600 mt-2">{rateError}</p>
                )}

                {rateStatus === "done" && chosenRate && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-bold text-blue-900 mb-2">Shipping Quote</p>
                    <div className="flex flex-col gap-1 text-sm text-blue-800">
                      <div className="flex justify-between">
                        <span>{chosenRate.provider} — {chosenRate.service}{chosenRate.days ? ` (${chosenRate.days} days)` : ""}</span>
                        <span>${(chosenRate.amountCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-blue-600">
                        <span>Handling fee</span>
                        <span>$10.00</span>
                      </div>
                      <div className="flex justify-between font-black text-blue-900 border-t border-blue-200 pt-1 mt-1">
                        <span>Shipping total</span>
                        <span>${(intlShippingTotal / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Creator Code */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-1">Creator Code</h2>
            <p className="text-xs text-muted-foreground mb-3">Have a creator code? Enter it here.</p>
            <div className="flex gap-2">
              <Input
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeStatus("idle"); setCreatorCode(""); setDiscountPercent(0); }}
                onBlur={applyCreatorCode}
                placeholder="CREATORCODE"
                className="flex-1 font-mono uppercase"
              />
              <button type="button" onClick={applyCreatorCode}
                className="px-4 h-9 bg-secondary text-foreground text-sm font-bold rounded-lg hover:bg-secondary/70 transition-colors whitespace-nowrap">
                Apply
              </button>
            </div>
            {codeStatus === "checking" && <p className="text-xs text-muted-foreground mt-2">Checking...</p>}
            {codeStatus === "valid" && discountPercent > 0 && <p className="text-xs text-green-600 font-semibold mt-2">✓ {discountPercent}% discount applied</p>}
            {codeStatus === "valid" && discountPercent === 0 && <p className="text-xs text-green-600 font-semibold mt-2">✓ Code applied</p>}
            {codeStatus === "invalid" && <p className="text-xs text-red-600 mt-2">Invalid code. Please try again.</p>}
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-border rounded-xl p-6 sticky top-24">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">Order Summary</h2>
            <div className="flex flex-col gap-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                  <span className="font-medium">{formatCurrency(item.price_cents * item.quantity)}</span>
                </div>
              ))}
              {discountCents > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span>Discount ({discountPercent}% off)</span>
                  <span>−{formatCurrency(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sales Tax (6.625%)</span>
                <span className="font-medium">{formatCurrency(taxCents)}</span>
              </div>
              {isInternational && chosenRate ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">International Shipping</span>
                  <span className="font-medium">{formatCurrency(intlShippingTotal)}</span>
                </div>
              ) : !isInternational ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground text-xs">Calculated at Stripe</span>
                </div>
              ) : null}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(discountedTotal + taxCents + (isInternational && chosenRate ? intlShippingTotal : 0))}
                </span>
              </div>
            </div>
            {isInternational && !chosenRate && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Enter your address above and click Calculate Exact Shipping before paying.
              </p>
            )}
            <Button
              onClick={handleCheckout}
              disabled={submitting || !canPay()}
              className="w-full font-bold"
            >
              {submitting ? "Redirecting..." : "Pay Securely with Stripe"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductCheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
