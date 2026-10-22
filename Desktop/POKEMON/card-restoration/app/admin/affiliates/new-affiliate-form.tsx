"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/commission";

export function NewAffiliateForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [commission, setCommission] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase(), commission_percent: rate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create affiliate.");
      setName("");
      setCode("");
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
      <h2 className="font-heading font-black text-lg text-foreground mb-4">Add Creator Code</h2>
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
