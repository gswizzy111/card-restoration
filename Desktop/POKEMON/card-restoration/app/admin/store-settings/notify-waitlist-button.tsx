"use client";

import { useState } from "react";

export function NotifyWaitlistButton({ count }: { count: number }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; texts: number } | null>(null);
  const [error, setError] = useState("");

  async function handleNotify() {
    if (count === 0) return;
    if (!confirm(`Send a notification to all ${count} people on the waitlist?`)) return;
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/notify-restoration-waitlist", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send."); return; }
      setResult({ sent: data.sent, texts: data.texts ?? 0 });
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleNotify}
        disabled={sending || count === 0}
        className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
      >
        {sending ? "Sending…" : `Notify All ${count} Customer${count !== 1 ? "s" : ""}`}
      </button>
      {result && (
        <p className="text-xs text-green-600 font-medium">
          ✓ Sent {result.sent} email{result.sent !== 1 ? "s" : ""}
          {result.texts > 0 ? ` + ${result.texts} text${result.texts !== 1 ? "s" : ""}` : ""}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
