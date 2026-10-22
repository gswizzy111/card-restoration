"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  affiliate: { id: string; name: string };
  setUp: boolean;
  lastLogin: string | null;
  linkPending: boolean;
};

// The creator portal (/affiliates): make a one-time setup link for the
// creator to choose their password, or turn their access off.
export function PortalAccess({ affiliate, setUp, lastLogin, linkPending }: Props) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function makeLink() {
    setBusy(true);
    setError("");
    setCopied(false);
    const res = await fetch(`/api/admin/affiliates/${affiliate.id}/portal-link`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not make a link.");
    setLink(data.url);
    router.refresh();
  }

  async function turnOff() {
    if (!confirm(`Turn off creator portal access for ${affiliate.name}? They'll be signed out and need a new setup link to get back in.`)) return;
    setBusy(true);
    await fetch(`/api/admin/affiliates/${affiliate.id}/portal-link`, { method: "DELETE" });
    setBusy(false);
    setLink("");
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the link is selectable in the box
    }
  }

  const status = setUp
    ? `Set up${lastLogin ? ` · last signed in ${new Date(lastLogin).toLocaleDateString()}` : ""}`
    : linkPending ? "Setup link sent, not used yet" : "Not set up";

  return (
    <div className="border-t border-border px-6 py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">Creator portal</span>
          {status}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={makeLink} disabled={busy} className="text-xs font-semibold text-primary hover:underline underline-offset-2 disabled:opacity-50">
            {setUp || linkPending ? "New setup link" : "Create setup link"}
          </button>
          {(setUp || linkPending) && (
            <button type="button" onClick={turnOff} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline underline-offset-2 disabled:opacity-50">
              Turn off
            </button>
          )}
        </div>
      </div>
      {link && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={`Setup link for ${affiliate.name}`} className="flex-1 min-w-0 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs font-mono" />
            <button type="button" onClick={copy} className="shrink-0 h-9 px-4 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this to {affiliate.name}. It works once, for 7 days: they choose a password, then sign in at /affiliates with their code and that password.
          </p>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
