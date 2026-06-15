export interface Service {
  id: string;
  name: string;
  short_description: string;
  full_description: string;
  price_cents: number;
  turnaround_days: number;
  display_order: number;
  active: boolean;
}

export interface CardEntry {
  id: string;
  card_name: string;
  card_set: string;
  card_year: string;
  card_number: string;
  estimated_value: string;
  notes: string;
  photo_urls: string[];
  service_ids: string[];
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ShippingRate {
  object_id: string;
  carrier: string;
  service_level: string;
  amount_cents: number;
  days: number | null;
  duration_terms: string;
}

export type InsuranceType = "none" | "inbound" | "round_trip";

export interface InsuranceSelection {
  declaredValueCents: number;
  type: InsuranceType;
  chargeCents: number;
}
