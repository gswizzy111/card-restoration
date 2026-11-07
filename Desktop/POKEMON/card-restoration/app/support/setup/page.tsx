"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MIN = 10; // ADMIN_PASSWORD_MIN in lib/admin-password.ts

function SetupForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) { setError(`Use at least ${MIN} characters.`); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const res = await fetch("/api/support/setup", {
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
        <p className="text-sm text-muted-foreground">Taking you to sign in. Choose <strong>Support</strong> and use your email.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-heading font-black text-2xl text-foreground mb-1">Set your password</h1>
      <p className="text-sm text-muted-foreground mb-6">You&apos;re setting up customer support access to The Card Doc admin.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="pw" className="block text-xs font-semibold text-muted-foreground mb-1.5">New Password</label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN} characters`}
            className="w-full h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="pw2" className="block text-xs font-semibold text-muted-foreground mb-1.5">Confirm Password</label>
          <input
            id="pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className="w-full h-11 px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>
        {(error || !token) && (
          <p className="text-sm text-red-500">{error || "Missing invite token. Use the link from your invitation email."}</p>
        )}
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

export default function SupportSetupPage() {
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
