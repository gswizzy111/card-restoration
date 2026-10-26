import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/fetch-all";
import { bareAddress, type EmailProblem } from "@/lib/email-problem-labels";

/**
 * Emails that didn't reach the customer, recorded from Resend's webhook
 * (app/api/webhooks/resend on New-Website-Concept; table email_problems,
 * supabase/migrations/20261026_email_problems.sql). The admin sees them on
 * the Email Problems page and on the customer's order, instead of the email
 * failing silently. Shared by both sites.
 */
export type { EmailProblem, EmailProblemType } from "@/lib/email-problem-labels";

const COLUMNS = "id, email, type, subject, detail, sent_at, received_at, resolved_at";

// Fixed problems older than this drop off the page (they stay in the table)
const FIXED_SHOWN_DAYS = 90;

/** Every open problem (newest first), then those fixed in the last 90 days. */
export async function listEmailProblems(): Promise<EmailProblem[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - FIXED_SHOWN_DAYS * 86_400_000).toISOString();
  const [open, fixed] = await Promise.all([
    fetchAll<EmailProblem>((from, to) =>
      admin.from("email_problems").select(COLUMNS).is("resolved_at", null)
        .order("received_at", { ascending: false }).order("id").range(from, to)
    ),
    fetchAll<EmailProblem>((from, to) =>
      admin.from("email_problems").select(COLUMNS).not("resolved_at", "is", null).gte("resolved_at", since)
        .order("resolved_at", { ascending: false }).order("id").range(from, to)
    ),
  ]);
  return [...open, ...fixed];
}

/** Open problems for one address (case-insensitive), newest first. Never
 * throws: the order page shows nothing rather than failing. */
export async function openProblemsFor(email: string | null | undefined): Promise<EmailProblem[]> {
  const address = email ? bareAddress(email) : "";
  if (!address) return [];
  const { data, error } = await createAdminClient()
    .from("email_problems")
    .select(COLUMNS)
    .eq("email", address)
    .is("resolved_at", null)
    .order("received_at", { ascending: false });
  if (error) console.error("Reading email problems failed:", error.message);
  return (data ?? []) as EmailProblem[];
}

/** How many addresses have an open problem (the admin nav badge). Never
 * throws: the admin layout runs it on every page. */
export async function openProblemCount(): Promise<number> {
  const admin = createAdminClient();
  try {
    const rows = await fetchAll<{ email: string }>((from, to) =>
      admin.from("email_problems").select("email").is("resolved_at", null).order("id").range(from, to)
    );
    return new Set(rows.map((r) => r.email)).size;
  } catch (err) {
    console.error("Counting email problems failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}
