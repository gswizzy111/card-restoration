"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Typed-name signature for a High-Value Agreement (dated by the server). */
export function HighValueSignForm({ token }: { token: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = agreed && name.trim().length >= 2 && !busy;

  async function sign() {
    if (!ready) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/agreements/high-value/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signer_name: name.trim(), agreed: true }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="font-semibold text-foreground">I have read and agree to this High-Value Card Restoration &amp; Custody Agreement.</span>
      </label>
      <div className="flex flex-col gap-1.5 max-w-md">
        <label htmlFor="hv-name" className="text-xs font-semibold text-muted-foreground">Full legal name</label>
        <input
          id="hv-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">Typing your name is your electronic signature. The date and time come from our server.</p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={sign}
        disabled={!ready}
        className="self-start h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {busy ? "Signing…" : "Electronically sign agreement"}
      </button>
    </div>
  );
}
