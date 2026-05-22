"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPartnerForm() {
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [kitsAllocated, setKitsAllocated] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, store_name: storeName, passcode, kits_allocated: kitsAllocated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setName(""); setStoreName(""); setPasscode(""); setKitsAllocated(0);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Contact Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Smith"
          required
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Store Name</label>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Cards & More"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Passcode *</label>
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="e.g. cards2024"
          required
          className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Kits to Allocate</label>
        <input
          type="number"
          min={0}
          value={kitsAllocated}
          onChange={(e) => setKitsAllocated(parseInt(e.target.value) || 0)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-6 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
        >
          {saving ? "Creating..." : "Create Partner"}
        </button>
      </div>
    </form>
  );
}
