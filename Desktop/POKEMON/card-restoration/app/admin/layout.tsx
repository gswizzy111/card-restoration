import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "./admin-nav";
import { InquiryAlert, RefundRequestAlert } from "./inquiry-alert";
import { pendingRefundRequestCount } from "@/lib/refund-requests";
import { getAdminSession } from "@/lib/admin-auth";
import { INQUIRY_TYPE, OPEN_CASE_STATUSES } from "@/lib/card-inquiries";
import { openProblemCount } from "@/lib/email-problems";
import { ViewAsButton } from "./view-as-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const role = session?.role ?? null;
  const isAdmin = role === "admin";
  const isSupport = role === "support";

  let openCaseCount = 0;
  let openInquiryCount = 0;
  let emailProblemCount = 0;
  let refundRequestCount = 0;
  if (isAdmin || isSupport) {
    const admin = createAdminClient();
    // Support staff don't see internal cases, so they aren't in their count
    const openCases = admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_CASE_STATUSES);
    const [{ count }, { count: inquiryCount }, problemCount] = await Promise.all([
      isSupport ? openCases.neq("type", "internal") : openCases,
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
    // Refunds support asked for wait on an admin
    if (isAdmin) refundRequestCount = await pendingRefundRequestCount(admin);
  }

  // Signed out (sign-in, forgot and reset password pages): no admin menu
  if (!role) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <AdminNav openCaseCount={openCaseCount} openUpdateRequestCount={openInquiryCount} emailProblemCount={emailProblemCount} role={role} username={session?.name ?? session?.username ?? null} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        {session?.preview && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900 px-6 py-3 text-sm font-semibold text-white">
            <span>👀 You&apos;re seeing the admin exactly as your support team does. Anything you do here is signed &ldquo;{session.username} (admin, viewing as support)&rdquo;.</span>
            <ViewAsButton to="admin" className="shrink-0 h-8 px-3 rounded-lg bg-white text-gray-900 text-xs font-bold disabled:opacity-60">
              Exit support view
            </ViewAsButton>
          </div>
        )}
        {isAdmin && <RefundRequestAlert count={refundRequestCount} />}
        <InquiryAlert count={openInquiryCount} />
        {children}
      </main>
    </div>
  );
}
