"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/constants";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { subscriptionDisclosures, subscriptionEnrollLabel } from "@/lib/subscription-terms";
import { MissingNote, Need, Req, revealMissing } from "@/components/checkout/required";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function SubscribeForm({ priceCents }: { priceCents: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Enrolling is its own affirmative choice, never pre-checked (Terms Section 26)
  const [enroll, setEnroll] = useState(false);
  // Pressed subscribe with something missing: outline it in red
  const [showMissing, setShowMissing] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const miss = (v: string) => showMissing && !v.trim();
  const ready = !!(form.name.trim() && form.email.trim() && form.phone.trim() && form.street1.trim() && form.city.trim() && form.state && form.zip.trim() && enroll);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) {
      setShowMissing(true);
      revealMissing();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, enroll }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      if (data.url) router.push(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const priceLabel = formatPrice(priceCents);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="font-heading font-black text-5xl text-foreground mb-4">Monthly Kit Club</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get a fresh restoration kit delivered every month — {priceLabel}/mo
          </p>
          <ul className="inline-flex flex-col gap-3 text-left text-base text-foreground">
            <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span>1 Restoration Kit every month</li>
            <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span>Automatic billing — cancel anytime</li>
            <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span>Free US shipping included</li>
          </ul>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-border p-8">
          <h2 className="font-heading font-black text-2xl text-foreground mb-6">Your shipping details</h2>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <Need missing={miss(form.name)}>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Full Name<Req /></label>
              <input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
                placeholder="Jane Smith" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </Need>
            <Need missing={miss(form.email)}>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email<Req /></label>
              <input id="email" name="email" type="email" required value={form.email} onChange={handleChange}
                placeholder="jane@example.com" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </Need>
            <Need missing={miss(form.phone)}>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">Phone<Req /></label>
              <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange}
                placeholder="(555) 555-5555" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </Need>
            <Need missing={miss(form.street1)}>
              <label htmlFor="street1" className="block text-sm font-medium text-foreground mb-1">Street Address<Req /></label>
              <AddressAutocomplete
                id="street1"
                value={form.street1}
                onChange={(v) => setForm((prev) => ({ ...prev, street1: v }))}
                onPlaceSelect={(f) => setForm((prev) => ({ ...prev, street1: f.street1, city: f.city, state: f.state, zip: f.zip }))}
                placeholder="123 Main St"
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </Need>
            <div>
              <label htmlFor="street2" className="block text-sm font-medium text-foreground mb-1">
                Apt / Suite <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input id="street2" name="street2" type="text" value={form.street2} onChange={handleChange}
                placeholder="Apt 4B" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Need missing={miss(form.city)} className="col-span-2 sm:col-span-1">
                <label htmlFor="city" className="block text-sm font-medium text-foreground mb-1">City<Req /></label>
                <input id="city" name="city" type="text" required value={form.city} onChange={handleChange}
                  placeholder="Chicago" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </Need>
              <Need missing={miss(form.state)}>
                <label htmlFor="state" className="block text-sm font-medium text-foreground mb-1">State<Req /></label>
                <select id="state" name="state" required value={form.state} onChange={handleChange}
                  className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white">
                  <option value="">—</option>
                  {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.value}</option>)}
                </select>
              </Need>
              <Need missing={miss(form.zip)}>
                <label htmlFor="zip" className="block text-sm font-medium text-foreground mb-1">ZIP<Req /></label>
                <input id="zip" name="zip" type="text" required value={form.zip} onChange={handleChange}
                  placeholder="60601" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </Need>
            </div>

            <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Before you subscribe</p>
              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground list-disc pl-5">
                {subscriptionDisclosures(priceCents).map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
            <Need missing={showMissing && !enroll} note="Check this box to subscribe.">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={enroll} onChange={(e) => setEnroll(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
              <span className="font-semibold text-foreground">{subscriptionEnrollLabel(priceCents)}<Req /></span>
            </label>
            </Need>

            <MissingNote show={showMissing && !ready} />
            <button type="submit" disabled={loading}
              className="mt-2 w-full rounded-lg bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
              {loading ? "Redirecting to checkout…" : `Subscribe — ${priceLabel}/mo`}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Secured by Stripe. Cancel anytime online or by email.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
