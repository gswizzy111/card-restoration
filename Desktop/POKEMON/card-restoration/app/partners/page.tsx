"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerLoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/partners/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid passcode");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-border p-8 w-full max-w-sm shadow-sm">
        <h1 className="font-heading font-black text-2xl text-foreground mb-1">Partner Portal</h1>
        <p className="text-sm text-muted-foreground mb-6">The Card Doc</p>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
