"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

type Product = { id: string; name: string; price_cents: number };
type LineItem = { product_id: string; product_name: string; quantity: number; price_cents: number };

export function ManualKitOrderForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? "");

  function addProduct() {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, price_cents: product.price_cents }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty < 1) {
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    } else {
      setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i));
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
  const hasAddress = street1 && city && state && zip;
  const shipping = hasAddress ? 599 : 0;
  const total = subtotal + shipping;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (items.length === 0) { setError("Add at least one product."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/shop-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, customer_email: email, customer_phone: phone, street1, street2: street2 || undefined, city, state, zip, items, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSubmitting(false); return; }
      router.push("/admin/shop-orders");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputClass = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const labelClass = "block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">

      {/* Products */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-lg text-foreground">Products</h2>
        <div className="flex gap-2">
          <select
            className="flex-1 h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price_cents)}</option>
            ))}
          </select>
          <button type="button" onClick={addProduct} className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            Add
          </button>
        </div>

        {items.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground flex-1">{item.product_name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-7 h-7 rounded border border-border text-sm font-bold hover:bg-secondary transition-colors">−</button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-7 h-7 rounded border border-border text-sm font-bold hover:bg-secondary transition-colors">+</button>
                </div>
                <span className="text-sm font-bold text-foreground w-20 text-right">{formatCurrency(item.price_cents * item.quantity)}</span>
                <button type="button" onClick={() => updateQty(item.product_id, 0)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No products added yet.</p>
        )}
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-lg text-foreground">Customer Info</h2>
          <span className="text-xs text-muted-foreground">All optional</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-lg text-foreground">Shipping Address <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
          {hasAddress && <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Will appear in Ship Queue</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Street Address</label>
            <input className={inputClass} value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Apt / Suite</label>
            <input className={inputClass} value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apt 4B" />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>ZIP</label>
            <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="10001" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-2">
        <label className="font-heading font-black text-lg text-foreground">Notes <span className="text-sm font-normal text-muted-foreground">(optional)</span></label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors bg-white resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any special instructions..."
        />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span><span>{hasAddress ? formatCurrency(599) : "—"}</span>
          </div>
          <div className="flex justify-between font-heading font-black text-xl text-foreground border-t border-border pt-2 mt-1">
            <span>Total</span><span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex justify-between">
        <a href="/admin/shop-orders" className="h-10 px-5 border border-border rounded-lg text-sm font-semibold text-foreground flex items-center hover:bg-secondary transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="h-10 px-8 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>
    </form>
  );
}
