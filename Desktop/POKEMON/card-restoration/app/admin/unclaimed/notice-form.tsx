"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Email the standard notice, or log one sent another way (lib/unclaimed.ts). */
export function NoticeForm({ orderId, defaultKind }: { orderId: string; defaultKind: "ready_for_return" | "undeliverable" | "follow_up" }) {
  const router = useRouter();
  const [kind, setKind] = useState(defaultKind);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(channel: "email" | "other") {
    if (channel === "email" && !confirm("Email the customer this notice now?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, channel, note: note.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success(channel === "email" ? "Notice emailed and logged" : "Notice logged");
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-8 rounded-md border border-border bg-white px-2">
        <option value="ready_for_return">Ready for return</option>
        <option value="undeliverable">Undeliverable</option>
        <option value="follow_up">Follow-up</option>
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required when logging a notice sent another way)" className="h-8 min-w-[16rem] flex-1 rounded-md border border-border bg-white px-2" />
      <button type="button" disabled={busy} onClick={() => send("email")} className="h-8 px-3 rounded-md bg-foreground text-background font-bold disabled:opacity-40">Email notice</button>
      <button type="button" disabled={busy || !note.trim()} onClick={() => send("other")} className="h-8 px-3 rounded-md border border-border font-bold disabled:opacity-40">Log other notice</button>
    </div>
  );
}
