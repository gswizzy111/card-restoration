import { createAdminClient } from "@/lib/supabase/admin";

// Shippo's label links are signed and stop working when they expire. Most
// last a year, but some have expired after four days, leaving the customer
// with an "Access denied" page. Everyone gets this permanent link instead:
// it sends them to the stored label while that still works, and otherwise
// asks Shippo for a freshly signed one first.

/** The permanent link to an order's prepaid inbound label. */
export function labelHref(orderId: string, absolute = false) {
  const path = `/api/shipping/label/${orderId}`;
  if (!absolute) return path;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  return `${appUrl}${path}`;
}

/** Whether a signed Shippo link has stopped working. */
export function labelExpired(url: string) {
  const at = labelExpiresAt(url);
  return !!at && at.getTime() <= Date.now();
}

/** When a signed Shippo link stops working, or null when it doesn't say. */
export function labelExpiresAt(url: string): Date | null {
  const m = /[?&]Expires=(\d+)/.exec(url);
  return m ? new Date(Number(m[1]) * 1000) : null;
}

type ShippoTransaction = {
  object_id?: string;
  label_url?: string;
  tracking_number?: string;
  status?: string;
};

async function shippoGet(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.goshippo.com${path}`, {
    headers: { Authorization: `ShippoToken ${process.env.SHIPPO_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/** The label's file name, which stays the same when Shippo re-signs it. */
function labelFile(url: string) {
  return url.split("?")[0].split("/").pop() ?? "";
}

/**
 * Finds the order's label purchase in Shippo: by its id when we saved one,
 * otherwise by matching the tracking number or label file across recent
 * purchases (newest first).
 */
async function findTransaction(order: {
  inbound_shippo_transaction_id: string | null;
  inbound_tracking_number: string | null;
  shipping_label_url: string;
}): Promise<ShippoTransaction | null> {
  if (order.inbound_shippo_transaction_id) {
    const tx = await shippoGet(`/transactions/${order.inbound_shippo_transaction_id}`);
    if (tx?.label_url) return tx as ShippoTransaction;
  }
  const file = labelFile(order.shipping_label_url);
  for (let page = 1; page <= 20; page++) {
    const list = await shippoGet(`/transactions/?results=100&page=${page}`);
    const results = (list?.results as ShippoTransaction[] | undefined) ?? [];
    const hit = results.find((t) =>
      t.status === "SUCCESS" && t.label_url &&
      ((order.inbound_tracking_number && t.tracking_number === order.inbound_tracking_number) ||
        (file && labelFile(t.label_url) === file)));
    if (hit) return hit;
    if (!list?.next) break;
  }
  return null;
}

/**
 * A working link to the order's inbound label, or null when the order has
 * none. Re-signs and saves the link when the stored one has expired (or will
 * within the hour).
 */
export async function workingLabelUrl(orderId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, shipping_label_url, inbound_tracking_number, inbound_shippo_transaction_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.shipping_label_url) return null;

  const expires = labelExpiresAt(order.shipping_label_url);
  if (!expires || expires.getTime() > Date.now() + 60 * 60 * 1000) return order.shipping_label_url;

  const tx = await findTransaction(order);
  // Shippo hands back the same link for some labels instead of re-signing
  // it; the caller then tells the customer the label has expired.
  if (!tx?.label_url) return order.shipping_label_url; // nothing better to offer
  await admin
    .from("orders")
    .update({ shipping_label_url: tx.label_url, ...(tx.object_id ? { inbound_shippo_transaction_id: tx.object_id } : {}) })
    .eq("id", order.id);
  return tx.label_url;
}
