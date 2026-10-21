/**
 * Kit orders from the new site's cart (theonethatsaveditall.com) carry the
 * shipping rate the customer picked in metadata.kit_rate_object_id; this
 * webhook buys it as the outbound label once the order is paid.
 */

export type KitLabel = {
  labelUrl: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  /** Commercial invoice for customs, when the carrier makes one (international). */
  customsUrl: string | null;
};

/**
 * Buys the rate the customer picked at checkout as the outbound label.
 * Called once per paid order by the Stripe webhook. REST rather than the SDK
 * so the response's messages come back whole for the admin email.
 */
export async function buyKitLabel(rateId: string, international: boolean): Promise<{ label: KitLabel } | { error: string }> {
  try {
    const res = await fetch("https://api.goshippo.com/transactions/", {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      // US: a 4x6 for the thermal printer; abroad: the full page the admin label route uses
      body: JSON.stringify({ rate: rateId, label_file_type: international ? "PDF" : "PDF_4x6", async: false }),
    });
    const tx = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (tx.status !== "SUCCESS" || !tx.label_url) {
      const messages = (tx.messages as { text?: string }[] | undefined) ?? [];
      const detail = messages.map((m) => m.text).filter(Boolean).join("; ") || (tx.detail as string | undefined) || `Shippo status ${tx.status ?? res.status}`;
      return { error: detail };
    }
    return {
      label: {
        labelUrl: tx.label_url as string,
        trackingNumber: (tx.tracking_number as string | undefined) || null,
        trackingUrl: (tx.tracking_url_provider as string | undefined) || null,
        customsUrl: (tx.commercial_invoice_url as string | undefined) || null,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
