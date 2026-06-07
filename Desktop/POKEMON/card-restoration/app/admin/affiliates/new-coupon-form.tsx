"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCouponForm() {
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = parseInt(percent, 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      setError("Discount must be between 1 and 100.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Coupon ${code.trim().toUpperCase()}`,
          code: code.trim().toUpperCase(),
          discount_percent: pct,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create coupon.");
      setCode("");
      setPercent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 mb-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Add Coupon Code</h2>
      <p className="text-xs text-muted-foreground mb-4">Coupon codes give customers a percent off their order at checkout.</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE (e.g. SAVE20)"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        <div className="relative w-36 shrink-0">
          <input
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="10"
            min={1}
            max={100}
            className="w-full border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-9 px-5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Adding..." : "Add Coupon"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
