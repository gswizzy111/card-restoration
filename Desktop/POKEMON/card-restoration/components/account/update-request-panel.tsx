"use client";

import { useState } from "react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * "Request an update" on an order page in the customer's account: our latest
 * emailed answer, then either the pending request, the date they can ask
 * again (once a week), or the button.
 */
export function UpdateRequestPanel({
  endpoint,
  email,
  askedAt: initialAskedAt,
  nextAllowedAt: initialNextAllowedAt,
  lastReply,
  subject = "order",
}: {
  endpoint: string;
  email: string;
  askedAt: string | null;
  nextAllowedAt: string | null;
  lastReply: { body: string; at: string } | null;
  subject?: string;
}) {
  const [askedAt, setAskedAt] = useState(initialAskedAt);
  const [nextAllowedAt, setNextAllowedAt] = useState(initialNextAllowedAt);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    setError("");
    setSending(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.nextAllowedAt) setNextAllowedAt(data.nextAllowedAt);
      if (!res.ok) setError(data.error ?? "Something went wrong. Please try again.");
      else setAskedAt(data.askedAt ?? new Date().toISOString());
    } catch {
      setError("Network error. Please try again.");
    }
    setSending(false);
  }

  return (
    <div id="update" className="bg-white rounded-xl border border-border p-5 scroll-mt-24">
      <h2 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-3">Request an Update</h2>

      {lastReply && (
        <div className="mb-4 p-4 bg-secondary/40 rounded-lg">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Latest update · {formatDate(lastReply.at)}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{lastReply.body}</p>
        </div>
      )}

      {askedAt ? (
        <div role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-bold text-foreground">Update requested {formatDate(askedAt)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            We&apos;ll email an update to <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{email}</span>. We reply within 1 business day.
          </p>
        </div>
      ) : nextAllowedAt ? (
        <div role="status" className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="text-sm font-bold text-foreground">You can request another update on {formatDate(nextAllowedAt)}</p>
          <p className="text-xs text-muted-foreground mt-1">Updates can be requested once a week per order.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Wondering how your {subject} is doing? Request an update and we&apos;ll email you. You can do this once a week.
          </p>
          <button
            type="button"
            onClick={ask}
            disabled={sending}
            className="w-full h-11 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {sending ? "Sending..." : "Request an update"}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
