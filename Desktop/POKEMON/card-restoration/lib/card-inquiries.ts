// "Where's my card?" questions from customers. Each one is a row in `cases`
// with this type, so it shows up in the admin Cases list and badge, and the
// admin's reply (a customer-visible case note) is emailed to the customer.
export const INQUIRY_TYPE = "inquiry";

// Statuses that still count as waiting for a reply.
export const OPEN_CASE_STATUSES = ["open", "in_progress"];

// Restoration order numbers are shown with an R prefix (R1234).
export function orderLabel(orderNumber: string | number | null | undefined) {
  const n = String(orderNumber ?? "");
  return /^\d+$/.test(n) ? `R${n}` : n;
}

// For text dropped into email HTML.
export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
