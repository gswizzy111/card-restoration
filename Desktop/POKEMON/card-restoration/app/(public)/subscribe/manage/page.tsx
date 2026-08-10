"use client";

import { useState } from "react";
import Link from "next/link";

type SubResult = {
  found: boolean;
  id?: string;
  status?: string;
  created_at?: string;
  cancelled_at?: string;
};

export default function ManageSubscriptionPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setLookupError("");
    setResult(null);
    setCancelled(false);
    try {
      const res = await fetch(`/api/subscriptions/lookup?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      setResult(data);
      if (!data.found) setLookupError("No subscription found for that email address.");
    } catch {
      setLookupError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!result?.id) return;
    if (!confirm("Are you sure you want to cancel your subscription? This will stop future billing immediately.")) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), subscriptionId: result.id }),
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error ?? "Failed to cancel."); return; }
      setCancelled(true);
      setResult({ ...result, status: "cancelled" });
    } catch {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-xl border border-border p-8 max-w-md w-full">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary block mb-6">← Back to home</Link>

        <h1 className="font-heading font-black text-2xl text-foreground mb-1">Manage Your Subscription</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter the email you used to subscribe.</p>

        <form onSubmit={handleLookup} className="flex gap-2 mb-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {loading ? "…" : "Look up"}
          </button>
        </form>

        {lookupError && (
          <p className="text-sm text-red-600 mb-4">{lookupError}</p>
        )}

        {result?.found && (
          <div className="border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Monthly Kit Club</p>
                <p className="text-xs text-muted-foreground mt-0.5">$62.99 / month</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                result.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {result.status === "active" ? "Active" : "Cancelled"}
              </span>
            </div>

            {result.created_at && (
              <p className="text-sm text-muted-foreground">
                Subscribed on <span className="font-medium text-foreground">{formatDate(result.created_at)}</span>
              </p>
            )}

            {result.cancelled_at && (
              <p className="text-sm text-muted-foreground">
                Cancelled on <span className="font-medium text-foreground">{formatDate(result.cancelled_at)}</span>
              </p>
            )}

            {cancelled && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
                Your subscription has been cancelled. You won&apos;t be charged again.
              </div>
            )}

            {result.status === "active" && !cancelled && (
              <div className="pt-2 border-t border-border space-y-2">
                {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full py-2.5 px-4 rounded-lg border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  {cancelling ? "Cancelling…" : "Cancel my subscription"}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  Cancellation is immediate. No refunds for the current billing period.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
