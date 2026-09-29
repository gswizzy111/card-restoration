import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "./admin-nav";
import { getAdminRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getAdminRole();
  const isAdmin = role === "admin";

  let openCaseCount = 0;
  if (isAdmin) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]);
    openCaseCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav openCaseCount={openCaseCount} role={role} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
