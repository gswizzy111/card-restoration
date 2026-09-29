import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminRole = "admin" | "accountant";

export async function getAdminRole(): Promise<AdminRole | null> {
  const jar = await cookies();
  const val = jar.get("admin_auth")?.value;
  if (!val) return null;

  // Full admin
  if (val === process.env.ADMIN_PASSWORD) return "admin";

  // Accountant session — cookie is "act_<uuid>"
  if (val.startsWith("act_")) {
    const id = val.slice(4);
    const admin = createAdminClient();
    const { data } = await admin
      .from("accountant_access")
      .select("id")
      .eq("id", id)
      .not("password_hash", "is", null)
      .maybeSingle();
    if (data) {
      // Update last_login_at lazily (fire and forget)
      admin.from("accountant_access").update({ last_login_at: new Date().toISOString() }).eq("id", id).then(() => {});
      return "accountant";
    }
  }

  return null;
}

export async function requireAdmin(): Promise<"admin"> {
  const role = await getAdminRole();
  if (role !== "admin") redirect("/admin/login");
  return "admin";
}

export async function requireAdminOrAccountant(): Promise<AdminRole> {
  const role = await getAdminRole();
  if (!role) redirect("/admin/login");
  return role;
}
