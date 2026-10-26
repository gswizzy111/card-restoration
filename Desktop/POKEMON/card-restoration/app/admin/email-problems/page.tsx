import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { listEmailProblems } from "@/lib/email-problems";
import { EmailProblemsClient } from "./email-problems-client";

export const dynamic = "force-dynamic";

// Emails that didn't reach the customer, recorded from Resend's webhook
// (lib/email-problems.ts)
export default async function EmailProblemsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const problems = await listEmailProblems();
  const open = problems.filter((p) => !p.resolved_at).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading font-black text-3xl text-foreground">Email Problems</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Emails that didn&apos;t reach the customer: bounced, marked as spam, blocked by Resend or failed · {open} open · newest first
        </p>
      </div>
      <EmailProblemsClient initialProblems={problems} />
    </div>
  );
}
