"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/commission";

export function NewAffiliateForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("0");
  const [commission, setCommission] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const off = Number(discount);
    if (discount.trim() === "" || !Number.isInteger(off) || off < 0 || off > 100) {
      setError("Customer discount must be a whole number between 0 and 100.");
      return;
    }
    const rate = Number(commission);
    if (commission.trim() === "" || isNaN(rate) || rate < 0 || rate > 100) {
      setError("Commission must be between 0 and 100.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase(), discount_percent: off, commission_percent: rate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create affiliate.");
      setName("");
      setCode("");
      setDiscount("0");
      setCommission(String(DEFAULT_COMMISSION_PERCENT));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 mb-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Add Creator Code</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Customers who use the code get the discount on kits, preps and restorations. The creator earns the commission on each paid order.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Creator name"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="w-36 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        <span className="relative sm:w-36">
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            min={0}
            max={100}
            step={1}
            aria-label="Customer discount percent"
            title="Customer discount percent"
            className="w-full border border-border rounded-lg px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">% off</span>
        </span>
        <span className="relative sm:w-44">
          <input
            type="number"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            min={0}
            max={100}
            step={0.5}
            aria-label="Commission percent"
            title="Commission percent"
            className="w-full border border-border rounded-lg px-3 py-2 pr-28 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">% commission</span>
        </span>
        <button
          type="submit"
          disabled={loading}
          className="h-9 px-5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Adding..." : "Add Code"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
