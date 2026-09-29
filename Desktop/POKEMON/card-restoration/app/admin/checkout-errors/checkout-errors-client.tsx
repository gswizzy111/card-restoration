"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CheckoutErrorEntry } from "@/lib/checkout-error-log";

const CODE_COLORS: Record<string, string> = {
  ORDER_SAVE_FAILED:    "bg-red-100 text-red-800",
  PAYMENT_SETUP_FAILED: "bg-orange-100 text-orange-800",
  VALIDATION_ERROR:     "bg-yellow-100 text-yellow-800",
  TIER_SOLD_OUT:        "bg-blue-100 text-blue-800",
  TIER_CLOSED:          "bg-gray-100 text-gray-700",
  SHOP_CLOSED:          "bg-gray-100 text-gray-700",
  NETWORK_ERROR:        "bg-purple-100 text-purple-800",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CheckoutErrorsClient({ initialErrors }: { initialErrors: CheckoutErrorEntry[] }) {
  const [errors, setErrors] = useState(initialErrors);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    if (!confirm("Clear all checkout errors? This cannot be undone.")) return;
    setClearing(true);
    const res = await fetch("/api/admin/checkout-errors", { method: "DELETE" });
    if ((await res.json()).ok) {
      setErrors([]);
      toast.success("Cleared");
    } else {
      toast.error("Failed to clear");
    }
    setClearing(false);
  }

  if (errors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-16 text-center">
        <p className="text-4xl mb-3">✓</p>
        <p className="font-heading font-black text-xl text-foreground mb-1">No checkout errors</p>
        <p className="text-sm text-muted-foreground">Errors will appear here as they happen. You&apos;ll also get an email for each one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={handleClear}
          disabled={clearing}
          className="text-xs text-muted-foreground hover:text-destructive font-medium transition-colors"
        >
          {clearing ? "Clearing…" : "Clear all"}
        </button>
      </div>

      {errors.map((err) => {
        const isOpen = expanded === err.ref;
        const codeCls = CODE_COLORS[err.code] ?? "bg-gray-100 text-gray-700";
        return (
          <div
            key={err.ref}
            className="bg-white rounded-xl border border-border overflow-hidden"
          >
            <button
              className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(isOpen ? null : err.ref)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${codeCls}`}>{err.code}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(err.timestamp)}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{new Date(err.timestamp).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {err.customer_name && (
                    <p className="font-semibold text-sm text-foreground">{err.customer_name}</p>
                  )}
                  {err.customer_email && (
                    <a
                      href={`mailto:${err.customer_email}?subject=Your Card Doc Order — We Can Help`}
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {err.customer_email}
                    </a>
                  )}
                  {err.customer_phone && (
                    <span className="text-xs text-muted-foreground">{err.customer_phone}</span>
                  )}
                </div>
                {err.tier && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {err.tier} · {err.card_count ?? "?"} card{(err.card_count ?? 1) !== 1 ? "s" : ""} · {err.shipping_method ?? "?"}
                  </p>
                )}
              </div>
              <span className="text-muted-foreground text-sm shrink-0">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t border-border pt-4">
                <div className="mb-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Ref Code</p>
                  <p className="font-mono text-xs text-foreground select-all">{err.ref}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Actual Error</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-mono text-xs text-red-800 break-all whitespace-pre-wrap">{err.actual_error}</p>
                  </div>
                </div>
                {err.user_agent && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Device</p>
                    <p className="text-xs text-muted-foreground break-all">{err.user_agent}</p>
                  </div>
                )}
                {err.customer_email && (
                  <a
                    href={`mailto:${err.customer_email}?subject=Your Card Doc Order — We Can Help&body=Hi ${err.customer_name?.split(" ")[0] ?? "there"},%0A%0AWe noticed you had trouble checking out and wanted to help you complete your order.%0A%0A— The Card Doc`}
                    className="inline-flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Email Customer →
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
