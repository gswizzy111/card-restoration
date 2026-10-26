import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "./admin-nav";
import { InquiryAlert } from "./inquiry-alert";
import { getAdminSession } from "@/lib/admin-auth";
import { INQUIRY_TYPE, OPEN_CASE_STATUSES } from "@/lib/card-inquiries";
import { openProblemCount } from "@/lib/email-problems";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const role = session?.role ?? null;
  const isAdmin = role === "admin";

  let openCaseCount = 0;
  let openInquiryCount = 0;
  let emailProblemCount = 0;
  if (isAdmin) {
    const admin = createAdminClient();
    const [{ count }, { count: inquiryCount }, problemCount] = await Promise.all([
      admin
        .from("cases")
        .select("id", { count: "exact", head: true })
        .in("status", OPEN_CASE_STATUSES),
      admin
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("type", INQUIRY_TYPE)
        .in("status", OPEN_CASE_STATUSES),
      openProblemCount(),
    ]);
    openCaseCount = count ?? 0;
    openInquiryCount = inquiryCount ?? 0;
    emailProblemCount = problemCount;
  }

  // Signed out (sign-in, forgot and reset password pages): no admin menu
  if (!role) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <AdminNav openCaseCount={openCaseCount} openUpdateRequestCount={openInquiryCount} emailProblemCount={emailProblemCount} role={role} username={session?.username ?? null} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <InquiryAlert count={openInquiryCount} />
        {children}
      </main>
    </div>
  );
}
