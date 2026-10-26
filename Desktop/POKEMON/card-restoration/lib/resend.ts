import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const businessName =
  process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "The Card Doc";

const sender = process.env.FROM_EMAIL ?? "orders@restoracards.com";

/** The bare sending address (orders@…), for mailto links and for telling
 * customers what to look for in their inbox. */
export const fromAddress = sender.match(/<([^>]+)>/)?.[1]?.trim() ?? sender.trim();

/** The From header. A bare FROM_EMAIL gets the business name, so inboxes
 * show "The Card Doc" instead of an address. */
export const fromEmail = sender.includes("<") ? sender : `${businessName} <${fromAddress}>`;
