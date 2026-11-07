"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// An internal note on the order's activity log (the customer never sees it),
// signed with the writer's name: what a customer asked, what support told
// them, or what an admin needs to pick up.
export function SupportNoteForm({ orderId }: { orderId: string }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/support/orders/${orderId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(data?.error ?? "Could not save the note. Please try again.");
    else {
      setBody("");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="support-note" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Internal note</label>
      <textarea
        id="support-note"
        rows={2}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Customer called asking when it ships; told them it's in the heat press."
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Only staff see this. It&apos;s saved with your name.</span>
        <button type="submit" disabled={saving || !body.trim()} className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving…" : "Add Note"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
