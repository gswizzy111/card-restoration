"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SetupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing invite token. Use the link from your invitation email.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const res = await fetch("/api/accountant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/admin/login"), 2500);
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="font-bold text-xl text-foreground mb-2">Password set!</h2>
        <p className="text-sm text-muted-foreground">Redirecting you to the login page…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading font-black text-2xl text-foreground mb-1">Set your password</h1>
      <p className="text-sm text-muted-foreground mb-6">You're setting up accountant access to The Card Doc admin.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className="w-full h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token}
          className="h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : "Set Password & Continue →"}
        </button>
      </form>
    </>
  );
}

export default function AccountantSetupPage() {
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-border p-8 w-full max-w-sm shadow-sm">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SetupForm />
        </Suspense>
      </div>
    </div>
  );
}
