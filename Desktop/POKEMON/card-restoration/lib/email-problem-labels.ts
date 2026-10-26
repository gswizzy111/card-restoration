/**
 * Kinds of email problem and what they mean, for the admin pages (no server
 * code here, so client components can import it). Rows come from
 * lib/email-problems.ts.
 */
export type EmailProblemType = "bounced" | "complained" | "suppressed" | "failed";

export type EmailProblem = {
  id: string;
  email: string;
  type: EmailProblemType;
  subject: string | null;
  detail: string | null;
  sent_at: string | null;
  received_at: string;
  resolved_at: string | null;
};

export const PROBLEM_LABELS: Record<EmailProblemType, string> = {
  bounced: "Bounced",
  complained: "Marked as spam",
  suppressed: "Blocked by Resend",
  failed: "Failed to send",
};

/** What the admin should do about it, in one line. */
export function problemAdvice(type: EmailProblemType): string {
  switch (type) {
    case "bounced": return "The address may have a typo or no longer exist. Check it with the customer.";
    case "complained": return "The customer marked our email as spam. Reach them another way.";
    case "suppressed": return "Resend won't send to this address because it bounced or was marked as spam before. Check the address, then remove it from Resend's suppression list.";
    case "failed": return "Resend couldn't send it. Try again, or reach the customer another way.";
  }
}
