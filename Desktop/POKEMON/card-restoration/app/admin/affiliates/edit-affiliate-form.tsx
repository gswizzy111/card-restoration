"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  affiliate: { id: string; name: string; code: string; discount_percent: number };
}

export function EditAffiliateForm({ affiliate }: Props) {
  const [name, setName] = useState(affiliate.name);
  const [code, setCode] = useState(affiliate.code);
  const [percent, setPercent] = useState(String(affiliate.discount_percent ?? 0));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = parseInt(percent, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError("Discount must be between 0 and 100.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase(), discount_percent: pct }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update code.");
      router.replace("/admin/affiliates", { scroll: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-border px-6 py-5 bg-secondary/30">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex-1 flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </label>
        <label className="sm:w-44 flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </label>
        <label className="sm:w-28 flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Discount</span>
          <span className="relative">
            <input
              type="number"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              min={0}
              max={100}
              className="w-full bg-white border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="h-9 px-5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <Link
            href="/admin/affiliates"
            scroll={false}
            className="h-9 px-4 inline-flex items-center bg-white border border-border text-foreground font-semibold text-sm rounded-lg hover:bg-secondary transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
      <p className="text-xs text-muted-foreground mt-3">
        The new discount applies to orders placed from now on. Renaming the code moves its past sales to the new code, and a creator signs in with the new code.
      </p>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
