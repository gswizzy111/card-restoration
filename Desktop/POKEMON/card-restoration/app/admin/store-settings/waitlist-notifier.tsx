"use client";

import { useState } from "react";

type WaitlistPerson = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notified_at: string | null;
};

const DEFAULT_EMAIL_SUBJECT = "We're back — restoration slots now open!";
const DEFAULT_EMAIL_BODY = `Hi [first name],

Great news — The Card Doc is now accepting restoration orders again.

You signed up to be notified, so we wanted to reach out right away. Spots fill up fast!

Book your restoration here: https://thecarddoc1.com/tier-selection

Thanks,
The Card Doc`;

const DEFAULT_SMS = `Hi [first name]! The Card Doc is now accepting restoration orders. Book your spot: https://thecarddoc1.com/tier-selection`;

export function WaitlistNotifier({ people }: { people: WaitlistPerson[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [smsMessage, setSmsMessage] = useState(DEFAULT_SMS);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; texts: number } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"contacts" | "compose">("contacts");

  const unnotified = people.filter((p) => !p.notified_at);
  const allSelected = selected.size === people.length && people.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(people.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectUnnotified() {
    setSelected(new Set(unnotified.map((p) => p.id)));
  }

  async function handleSend() {
    if (selected.size === 0) { setError("Select at least one person."); return; }
    if (!emailSubject.trim() || !emailBody.trim()) { setError("Email subject and body are required."); return; }
    if (!confirm(`Send notifications to ${selected.size} selected contact${selected.size !== 1 ? "s" : ""}?`)) return;

    setSending(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/notify-restoration-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          emailSubject,
          emailBody,
          smsMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send."); return; }
      setResult({ sent: data.sent, texts: data.texts ?? 0 });
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">No one on the waitlist yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {(["contacts", "compose"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
              tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "contacts" ? `Contacts (${people.length})` : "Message"}
          </button>
        ))}
      </div>

      {tab === "contacts" && (
        <div className="space-y-3">
          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button onClick={toggleAll} className="text-primary font-semibold hover:underline">
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <span className="text-muted-foreground">·</span>
            <button onClick={selectUnnotified} className="text-primary font-semibold hover:underline">
              Select unnotified ({unnotified.length})
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{selected.size} selected</span>
              </>
            )}
          </div>

          {/* Contact list */}
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-72 overflow-y-auto">
            {people.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  className="w-4 h-4 accent-primary flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                </div>
                {p.notified_at ? (
                  <span className="text-xs text-muted-foreground shrink-0">Notified</span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 shrink-0">Pending</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === "compose" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Body</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono resize-y"
            />
            <p className="text-xs text-muted-foreground">Use [first name] where you want the customer&apos;s first name inserted.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">SMS Message</label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono resize-y"
            />
            <p className="text-xs text-muted-foreground">Only sent to contacts who provided a phone number. Use [first name] for personalization.</p>
          </div>
        </div>
      )}

      {/* Send button — always visible */}
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      {result && (
        <p className="text-sm text-green-600 font-semibold">
          ✓ Sent {result.sent} email{result.sent !== 1 ? "s" : ""}
          {result.texts > 0 ? ` + ${result.texts} text${result.texts !== 1 ? "s" : ""}` : ""}
        </p>
      )}
      <button
        onClick={handleSend}
        disabled={sending || selected.size === 0}
        className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
      >
        {sending ? "Sending…" : `Send to ${selected.size || "…"} selected`}
      </button>
    </div>
  );
}
