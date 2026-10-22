import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, lookupAdminSession, type AdminRole, type AdminSession } from "@/lib/admin-session";

export type { AdminRole } from "@/lib/admin-session";

/** The admin or accountant signed in on this request, if any (looked up once per request). */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const jar = await cookies();
  return lookupAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
});

export async function getAdminRole(): Promise<AdminRole | null> {
  return (await getAdminSession())?.role ?? null;
}

/** A signed-in full admin (accountants are not). */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminRole()) === "admin";
}

// Accountants see the tax reports and nothing else (see middleware.ts).
export const ACCOUNTANT_HOME = "/admin/tax";

export async function requireAdmin(): Promise<"admin"> {
  const role = await getAdminRole();
  if (role === "accountant") redirect(ACCOUNTANT_HOME);
  if (role !== "admin") redirect("/admin/login");
  return "admin";
}

export async function requireAdminOrAccountant(): Promise<AdminRole> {
  const role = await getAdminRole();
  if (!role) redirect("/admin/login");
  return role;
}
