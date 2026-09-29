"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"admin" | "accountant">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const body = mode === "accountant"
      ? { email: email.trim(), password }
      : { password };
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      window.location.href = "/admin";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Incorrect credentials.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-border p-8 w-full max-w-sm shadow-sm">
        <h1 className="font-heading font-black text-2xl text-foreground mb-1">The Card Doc</h1>
        <p className="text-sm text-muted-foreground mb-6">Admin access</p>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode("admin"); setError(""); }}
            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${mode === "admin" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => { setMode("accountant"); setError(""); }}
            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${mode === "accountant" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Accountant
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "accountant" && (
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
              required
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus={mode === "admin"}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
