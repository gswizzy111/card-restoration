"use client";

import { useState } from "react";

export function ReturnLabelButton({ orderId, existingLabelUrl }: { orderId: string; existingLabelUrl?: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [labelUrl, setLabelUrl] = useState<string | null>(existingLabelUrl ?? null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/return-label`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setLabelUrl(data.labelUrl);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  if (labelUrl) {
    return (
      <a
        href={labelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        Print Return Label (PDF)
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCreate}
        disabled={state === "loading"}
        className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {state === "loading" ? "Generating label..." : "Create Return Label"}
      </button>
      {state === "error" && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
