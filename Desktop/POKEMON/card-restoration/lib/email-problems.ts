import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/fetch-all";
import type { EmailProblem } from "@/lib/email-problem-labels";

/**
 * Emails that didn't reach the customer, recorded from Resend's webhook
 * (app/api/webhooks/resend on New-Website-Concept; table email_problems,
 * supabase/migrations/20261026_email_problems.sql). The admin sees them on
 * the Email Problems page and on the customer's order, instead of the email
 * failing silently. Shared by both sites.
 */
export type { EmailProblem, EmailProblemType } from "@/lib/email-problem-labels";

const COLUMNS = "id, email, type, subject, detail, sent_at, received_at, resolved_at";

/** Every problem, open ones first, newest first within each group. */
export async function listEmailProblems(): Promise<EmailProblem[]> {
  const admin = createAdminClient();
  const rows = await fetchAll<EmailProblem>((from, to) =>
    admin.from("email_problems").select(COLUMNS).order("received_at", { ascending: false }).order("id").range(from, to)
  );
  return [...rows.filter((r) => !r.resolved_at), ...rows.filter((r) => r.resolved_at)];
}

/** Open problems for one address (case-insensitive), newest first. */
export async function openProblemsFor(email: string | null | undefined): Promise<EmailProblem[]> {
  const address = email?.trim().toLowerCase();
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

/** How many addresses have an open problem (the admin nav badge). */
export async function openProblemCount(): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("email_problems")
    .select("email")
    .is("resolved_at", null)
    .limit(1000);
  if (error) console.error("Counting email problems failed:", error.message);
  return new Set((data ?? []).map((r) => r.email)).size;
}
