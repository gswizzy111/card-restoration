import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const fromEmail =
  process.env.FROM_EMAIL ?? "orders@restoracards.com";

export const businessName =
  process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "The Card Doc";
