import { Resend } from "resend";

export const businessName =
  process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "The Card Doc";

/** Where replies go. The sending address (orders@…) has no mailbox, so
 * without this a customer's reply bounces. The Terms and FAQ already tell
 * people to write to this address. */
export const replyToAddress = process.env.CONTACT_EMAIL ?? "thecarddoc1@gmail.com";

const client = new Resend(process.env.RESEND_API_KEY);
// Every email gets that reply-to unless it sets its own (a problem report
// replies to the customer, for example)
const sendOne = client.emails.send.bind(client.emails);
client.emails.send = (payload, options) => sendOne({ ...payload, replyTo: payload.replyTo ?? replyToAddress }, options);
const sendBatch = client.batch.send.bind(client.batch);
client.batch.send = ((payload, options) =>
  sendBatch(payload.map((p) => ({ ...p, replyTo: p.replyTo ?? replyToAddress })), options)) as typeof client.batch.send;

export const resend = client;

const sender = process.env.FROM_EMAIL ?? "orders@restoracards.com";

/** The bare sending address (orders@…), for mailto links and for telling
 * customers what to look for in their inbox. */
export const fromAddress = sender.match(/<([^>]+)>/)?.[1]?.trim() ?? sender.trim();

/** The From header. A bare FROM_EMAIL gets the business name, so inboxes
 * show "The Card Doc" instead of an address. */
export const fromEmail = sender.includes("<") ? sender : `"${businessName.replace(/["\\]/g, "\\$&")}" <${fromAddress}>`;
