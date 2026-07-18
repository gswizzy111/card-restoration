"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "in_progress" | "resolved" | "closed";

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function StatusUpdater({ caseId, currentStatus }: { caseId: string; currentStatus: Status }) {
  const [status, setStatus] = useState<Status>(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function update(s: Status) {
    setSaving(true);
    setStatus(s);
    await fetch(`/api/admin/cases/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setSaving(false);
    router.refresh();
  }

  const STATUS_STYLES: Record<Status, string> = {
    open: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-yellow-100 text-yellow-700 border-yellow-200",
    resolved: "bg-green-100 text-green-700 border-green-200",
    closed: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status:</span>
      {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
        <button
          key={s}
          onClick={() => update(s)}
          disabled={saving}
          className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${status === s ? STATUS_STYLES[s] : "bg-white text-muted-foreground border-border hover:border-primary/50"}`}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

export function AddNoteForm({ caseId, isSupport, hasEmail }: { caseId: string; isSupport: boolean; hasEmail: boolean }) {
  const [body, setBody] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), is_customer_visible: visible }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add note."); setSubmitting(false); return; }
      setBody("");
      setVisible(false);
      router.refresh();
    } catch {
      setError("Network error.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white resize-none transition-colors"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note or update..."
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSupport && hasEmail && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-primary" />
              <span className="text-muted-foreground">Email customer</span>
            </label>
          )}
          {isSupport && !hasEmail && (
            <span className="text-xs text-muted-foreground italic">No customer email on file — updates are internal only</span>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Add Note"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
