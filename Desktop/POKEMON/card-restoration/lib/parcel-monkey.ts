// Parcel Monkey API v3.1
// Get credentials from: https://www.parcelmonkey.co.uk/apiSettings.php
// Required env vars: PARCEL_MONKEY_USER_ID, PARCEL_MONKEY_API_KEY
// Optional: PARCEL_MONKEY_API_URL (defaults to https://api.parcelmonkey.co.uk)

const BASE = (process.env.PARCEL_MONKEY_API_URL ?? "https://api.parcelmonkey.co.uk").replace(/\/$/, "");

function headers() {
  return {
    "Content-Type": "application/json",
    "PM-Version": "3.1",
    "PM-UserId": process.env.PARCEL_MONKEY_USER_ID ?? "",
    "PM-ApiKey": process.env.PARCEL_MONKEY_API_KEY ?? "",
  };
}

export interface PmBox {
  length: number; // cm
  width: number;  // cm
  height: number; // cm
  weight: number; // kg
}

export interface PmAddress {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  county?: string;  // state/county
  postcode: string;
  country: string;  // ISO2 code
  phone: string;
  email: string;
}

export interface PmQuote {
  service_id: string;
  carrier: string;
  name: string;
  price: number;
  currency: string;
  transit_days: number | null;
  customs_invoice_required: boolean;
}

export interface PmShipmentResult {
  shipment_id: string;
  label_url: string | null;
  customs_invoice_url: string | null;
  tracking_number: string | null;
}

export async function pmGetQuotes({
  senderCountry,
  recipient,
  boxes,
}: {
  senderCountry: string;
  recipient: { country: string };
  boxes: PmBox[];
}): Promise<{ quotes: PmQuote[]; error?: string }> {
  const res = await fetch(`${BASE}/GetQuote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      boxes,
      sender: { country: senderCountry },
      recipient: { country: recipient.country },
      type: "parcel",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { quotes: [], error: data.message ?? data.error ?? `PM API error ${res.status}` };

  // Normalise — API returns either data.quotes or data itself as array
  const raw: PmQuote[] = Array.isArray(data) ? data : (data.quotes ?? []);
  const quotes = raw
    .filter((q) => q.service_id && q.price > 0)
    .sort((a, b) => a.price - b.price);

  return { quotes };
}

export async function pmCreateShipment({
  serviceId,
  collectionDate,
  sender,
  recipient,
  boxes,
  description,
  valueCents,
  currency,
  customsRequired,
}: {
  serviceId: string;
  collectionDate: string; // YYYY-MM-DD
  sender: PmAddress;
  recipient: PmAddress;
  boxes: PmBox[];
  description: string;
  valueCents: number;
  currency: string;
  customsRequired: boolean;
}): Promise<{ result: PmShipmentResult | null; error?: string }> {
  const value = (valueCents / 100).toFixed(2);

  const payload: Record<string, unknown> = {
    service_id: serviceId,
    collection_date: collectionDate,
    sender,
    recipient,
    boxes,
    description,
    value,
    currency,
  };

  if (customsRequired) {
    payload.customs_invoice = {
      terms_of_trade: "DDU",
      description,
      value,
      currency,
    };
  }

  const res = await fetch(`${BASE}/CreateShipment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { result: null, error: data.message ?? data.error ?? `PM API error ${res.status}` };

  return {
    result: {
      shipment_id: data.shipment_id ?? data.id ?? "",
      label_url: data.label_url ?? data.label ?? null,
      customs_invoice_url: data.customs_invoice_url ?? data.customs_url ?? null,
      tracking_number: data.tracking_number ?? data.tracking ?? null,
    },
  };
}
