"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function ComposeForm({ totalEmails }: { totalEmails: number }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required.");
      return;
    }
    if (!confirmed) {
      setError(`Please confirm you want to send to all ${totalEmails} contacts.`);
      return;
    }
    setStatus("sending");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setResult({ sent: data.sent, failed: data.failed ?? 0 });
      setStatus("done");
      setConfirmed(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  const canSend = status !== "sending" && subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-5">
      <div>
        <h2 className="font-heading font-bold text-xl text-foreground">Compose Email</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Will be sent to all <span className="font-semibold text-foreground">{totalEmails}</span> contacts
        </p>
      </div>

      {status === "done" && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-green-800">
            Sent to {result.sent} contact{result.sent !== 1 ? "s" : ""}
            {result.failed > 0 && (
              <span className="text-red-600"> · {result.failed} failed</span>
            )}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Subject line
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. We're back — restoration slots now open!"
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          disabled={status === "sending"}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Message body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Hi [first name],\n\nWrite your message here...\n\nThanks,\nThe Card Doc`}
          rows={10}
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono leading-relaxed resize-y"
          disabled={status === "sending"}
        />
        <p className="text-xs text-muted-foreground">
          Write in plain text. Each line becomes a paragraph. Each contact&apos;s first name is automatically inserted.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <input
          type="checkbox"
          id="confirm-send"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 mt-0.5 accent-amber-600 flex-shrink-0"
          disabled={status === "sending"}
        />
        <label htmlFor="confirm-send" className="text-sm cursor-pointer text-amber-900">
          I confirm I want to send this email to all <strong>{totalEmails}</strong> contacts. This cannot be undone.
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <button
        onClick={handleSend}
        disabled={!canSend || !confirmed}
        className="w-full py-3 px-6 rounded-full font-bold text-sm transition-all duration-150 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "sending"
          ? "Sending…"
          : `Send to ${totalEmails} contacts`}
      </button>
    </div>
  );
}
