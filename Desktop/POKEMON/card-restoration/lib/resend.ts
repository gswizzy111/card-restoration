import { Resend } from "resend";

export const businessName =
  process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "The Card Doc";

/** Where replies go. The sending address (orders@…) has no mailbox, so
 * without this a customer's reply bounces. The Terms and FAQ already tell
 * people to write to this address. */
export const replyToAddress = process.env.CONTACT_EMAIL?.trim() || "thecarddoc1@gmail.com";

const client = new Resend(process.env.RESEND_API_KEY);
// Every email gets that reply-to unless it sets its own (a problem report
// replies to the customer, for example). The SDK's send() calls create(), so
// patching create covers both, for single emails and batches.
const createOne = client.emails.create.bind(client.emails);
client.emails.create = (payload, options) => createOne({ ...payload, replyTo: payload.replyTo?.length ? payload.replyTo : replyToAddress }, options);
const createBatch = client.batch.create.bind(client.batch);
client.batch.create = ((payload, options) =>
  createBatch(payload.map((p) => ({ ...p, replyTo: p.replyTo?.length ? p.replyTo : replyToAddress })), options)) as typeof client.batch.create;

export const resend = client;

const sender = process.env.FROM_EMAIL ?? "orders@restoracards.com";

/** The bare sending address (orders@…), for mailto links and for telling
 * customers what to look for in their inbox. */
export const fromAddress = sender.match(/<([^>]+)>/)?.[1]?.trim() ?? sender.trim();

/** The From header. A bare FROM_EMAIL gets the business name, so inboxes
 * show "The Card Doc" instead of an address. */
export const fromEmail = sender.includes("<") ? sender : `"${businessName.replace(/["\\]/g, "\\$&")}" <${fromAddress}>`;
