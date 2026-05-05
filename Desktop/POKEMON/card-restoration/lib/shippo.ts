import { Shippo } from "shippo";

export const shippo = new Shippo({ apiKeyHeader: process.env.SHIPPO_API_TOKEN! });

export const businessAddress = {
  name: process.env.BUSINESS_SHIPPING_NAME ?? "",
  street1: process.env.BUSINESS_SHIPPING_STREET1 ?? "",
  street2: process.env.BUSINESS_SHIPPING_STREET2 ?? "",
  city: process.env.BUSINESS_SHIPPING_CITY ?? "",
  state: process.env.BUSINESS_SHIPPING_STATE ?? "",
  zip: process.env.BUSINESS_SHIPPING_ZIP ?? "",
  country: "US",
  phone: process.env.BUSINESS_SHIPPING_PHONE ?? "",
  email: process.env.BUSINESS_SHIPPING_EMAIL ?? "",
};
