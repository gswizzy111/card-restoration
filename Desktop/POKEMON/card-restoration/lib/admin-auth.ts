import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, VIEW_AS_COOKIE, lookupAdminSession, withViewAs, type AdminRole, type AdminSession } from "@/lib/admin-session";

export type { AdminRole } from "@/lib/admin-session";

/** The admin, accountant or support member signed in on this request, if any (looked up once per request). */
// An admin in "View as Support" gets the support role here, like everywhere else.
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const jar = await cookies();
  return withViewAs(await lookupAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value), jar.get(VIEW_AS_COOKIE)?.value);
});

/** The signed-in person as they really are, ignoring "View as Support". */
export async function getRealAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return lookupAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function getAdminRole(): Promise<AdminRole | null> {
  return (await getAdminSession())?.role ?? null;
}

/** A signed-in full admin (accountants and support staff are not). */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminRole()) === "admin";
}

// Accountants see the tax reports and nothing else (see middleware.ts).
export const ACCOUNTANT_HOME = "/admin/tax";

// Customer support staff see order lookup, cases and email problems (see
// middleware.ts and SUPPORT_PAGES in lib/admin-session.ts).
export const SUPPORT_HOME = "/admin/support";

/** Where each role lands after signing in, and when it opens a page it can't use. */
export function homeFor(role: AdminRole): string {
  return role === "accountant" ? ACCOUNTANT_HOME : role === "support" ? SUPPORT_HOME : "/admin";
}

export async function requireAdmin(): Promise<"admin"> {
  const role = await getAdminRole();
  if (role && role !== "admin") redirect(homeFor(role));
  if (role !== "admin") redirect("/admin/login");
  return "admin";
}

/** A full admin or a support member: the people who answer customers. */
export async function isAdminOrSupport(): Promise<boolean> {
  const role = await getAdminRole();
  return role === "admin" || role === "support";
}

/** For pages admins and support staff share; accountants go to their own page. */
export async function requireAdminOrSupport(): Promise<"admin" | "support"> {
  const role = await getAdminRole();
  if (role === "accountant") redirect(ACCOUNTANT_HOME);
  if (role !== "admin" && role !== "support") redirect("/admin/login");
  return role;
}

/** Who to name on a case note: the admin's username or the support member's name. */
export async function staffName(): Promise<string | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (session.preview) return `${session.username} (admin, viewing as support)`;
  return session.role === "support" ? `${session.name ?? session.username} (support)` : session.username;
}

export async function requireAdminOrAccountant(): Promise<"admin" | "accountant"> {
  const role = await getAdminRole();
  if (role === "support") redirect(SUPPORT_HOME);
  if (role !== "admin" && role !== "accountant") redirect("/admin/login");
  return role;
}
