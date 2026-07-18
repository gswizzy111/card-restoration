"use client";

import { useState } from "react";

export function RestorationsToggle({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  async function toggle() {
    setSaving(true);
    setFlash("");
    const next = !open;
    const res = await fetch("/api/admin/toggle-restorations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open: next }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(next);
      setFlash(next ? "Restorations are now OPEN" : "Restorations are now CLOSED");
      setTimeout(() => setFlash(""), 3000);
    } else {
      setFlash("Error saving — try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center justify-between p-4 rounded-xl border ${open ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40"}`}>
        <div>
          <p className="font-bold text-foreground">
            Restorations are currently{" "}
            <span className={open ? "text-green-700" : "text-red-700"}>{open ? "OPEN" : "CLOSED"}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {open
              ? "Customers can book restoration orders. Individual tier settings below apply."
              : "The restoration page shows a 'not accepting orders' message with a waitlist signup form."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`ml-4 shrink-0 px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
            open
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {saving ? "Saving…" : open ? "Close All Restorations" : "Open Restorations"}
        </button>
      </div>
      {flash && (
        <p className={`text-xs font-semibold ${flash.includes("Error") ? "text-red-500" : "text-green-600"}`}>
          {flash}
        </p>
      )}
    </div>
  );
}
