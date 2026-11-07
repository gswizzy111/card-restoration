"use client";

import { useState } from "react";

/** Switches an admin into, or back out of, "View as Support". */
export function ViewAsButton({ to, className, children }: { to: "support" | "admin"; className?: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await fetch("/api/admin/support/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: to }),
    }).catch(() => null);
    if (!res?.ok) { setBusy(false); alert("Couldn't switch views. Please try again."); return; }
    // A full load, so the menu and every page pick up the new view
    window.location.href = to === "support" ? "/admin/support" : "/admin/support-team";
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={className}>
      {busy ? "Switching…" : children}
    </button>
  );
}
