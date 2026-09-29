import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail } from "@/lib/resend";

const BUCKET = "app-config";
const FILE = "checkout-errors.json";
const MAX_ENTRIES = 200;

export interface CheckoutErrorEntry {
  ref: string;
  timestamp: string;
  code: string;
  actual_error: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  tier?: string;
  card_count?: number;
  shipping_method?: string;
  user_agent?: string;
}

async function readLog(admin: ReturnType<typeof createAdminClient>): Promise<CheckoutErrorEntry[]> {
  const { data, error } = await admin.storage.from(BUCKET).download(FILE);
  if (error || !data) return [];
  try {
    return JSON.parse(await data.text()) as CheckoutErrorEntry[];
  } catch {
    return [];
  }
}

async function writeLog(admin: ReturnType<typeof createAdminClient>, entries: CheckoutErrorEntry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  await admin.storage.from(BUCKET).upload(FILE, blob, { upsert: true, contentType: "application/json" });
}

export async function logCheckoutError(entry: CheckoutErrorEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    const existing = await readLog(admin);
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    await writeLog(admin, updated);
  } catch (e) {
    console.error("Failed to write checkout error log:", e);
  }

  // Email admin — fire and forget
  try {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "gavinfraiman33@gmail.com";
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `⚠️ Checkout Failed — ${entry.code} — ${entry.customer_name ?? "Unknown customer"}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;color:#111">
          <div style="background:#dc2626;border-radius:8px 8px 0 0;padding:16px 20px">
            <h2 style="margin:0;color:#fff;font-size:20px">Checkout Failure Alert</h2>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:20px;background:#fff">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px">Error Code</td><td style="font-weight:700;color:#dc2626">${entry.code}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Ref</td><td style="font-family:monospace;font-size:12px">${entry.ref}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Time</td><td>${new Date(entry.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
              ${entry.customer_name ? `<tr><td style="padding:6px 0;color:#6b7280">Customer</td><td><strong>${entry.customer_name}</strong></td></tr>` : ""}
              ${entry.customer_email ? `<tr><td style="padding:6px 0;color:#6b7280">Email</td><td><a href="mailto:${entry.customer_email}">${entry.customer_email}</a></td></tr>` : ""}
              ${entry.customer_phone ? `<tr><td style="padding:6px 0;color:#6b7280">Phone</td><td>${entry.customer_phone}</td></tr>` : ""}
              ${entry.tier ? `<tr><td style="padding:6px 0;color:#6b7280">Tier</td><td>${entry.tier}</td></tr>` : ""}
              ${entry.card_count ? `<tr><td style="padding:6px 0;color:#6b7280">Cards</td><td>${entry.card_count}</td></tr>` : ""}
              ${entry.shipping_method ? `<tr><td style="padding:6px 0;color:#6b7280">Shipping</td><td>${entry.shipping_method}</td></tr>` : ""}
            </table>
            <div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em">Actual Error</p>
              <p style="margin:0;font-family:monospace;font-size:12px;color:#7f1d1d;word-break:break-all">${entry.actual_error}</p>
            </div>
            ${entry.customer_email ? `
            <div style="margin-top:16px;text-align:center">
              <a href="mailto:${entry.customer_email}?subject=Your Card Doc Order — We Can Help&body=Hi ${entry.customer_name?.split(" ")[0] ?? "there"},%0A%0AWe noticed you had trouble checking out and wanted to reach out to help complete your order.%0A%0A— The Card Doc"
                style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
                Email Customer →
              </a>
            </div>` : ""}
            <p style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center">
              View all errors at <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com"}/admin/checkout-errors" style="color:#1d4ed8">Admin → Checkout Errors</a>
            </p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send checkout error email:", e);
  }
}

export async function getCheckoutErrors(): Promise<CheckoutErrorEntry[]> {
  const admin = createAdminClient();
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
  return readLog(admin);
}

export async function clearCheckoutErrors(): Promise<void> {
  const admin = createAdminClient();
  await writeLog(admin, []);
}
