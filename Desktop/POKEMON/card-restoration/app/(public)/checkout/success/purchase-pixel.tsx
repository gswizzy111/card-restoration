"use client";

import { useEffect } from "react";
import { fbq } from "@/lib/pixel";

export function PurchasePixel({
  sessionId,
  amountCents,
  orderId,
}: {
  sessionId?: string;
  amountCents: number | null;
  orderId?: string;
}) {
  useEffect(() => {
    if (!sessionId || amountCents === null) return;

    // Fire exactly once per session_id — prevents re-firing on refresh
    const key = `meta_px_${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked (private browsing etc.) — fire anyway, just once per mount
    }

    fbq("track", "Purchase", {
      value: amountCents / 100,
      currency: "USD",
      ...(orderId ? { order_id: orderId } : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
