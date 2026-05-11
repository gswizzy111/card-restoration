"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { US_STATES } from "@/lib/constants";

export default function ProductCheckoutPage() {
  const { items, totalCents, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    street1: "", street2: "", city: "", state: "", zip: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function isValid() {
    return !!(form.name && form.email && form.phone && form.street1 && form.city && form.state && form.zip);
  }

  async function handleCheckout() {
    if (!isValid()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: i.quantity, slug: i.slug })),
          customer: { name: form.name, email: form.email, phone: form.phone },
          address: { street1: form.street1, street2: form.street2 || undefined, city: form.city, state: form.state, zip: form.zip },
        }),
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
      <h1 className="font-heading font-black text-3xl text-foreground mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Form */}
        <div className="lg:col-span-3 flex flex-col gap-6">
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

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">Shipping Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Street Address *</Label>
                <Input value={form.street1} onChange={(e) => set("street1", e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Apt / Suite</Label>
                <Input value={form.street2} onChange={(e) => set("street2", e.target.value)} placeholder="Apt 4B" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="New York" />
              </div>
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
              <div className="flex flex-col gap-1.5">
                <Label>ZIP *</Label>
                <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} placeholder="10001" />
              </div>
            </div>
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
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totalCents)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Shipping calculated by Stripe at checkout.</p>
            <Button
              onClick={handleCheckout}
              disabled={submitting || !isValid()}
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
