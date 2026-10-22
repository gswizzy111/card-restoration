import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin and accountant sign-in sessions. Each admin has their own username
 * and password (admin_users); accountants sign in with their email
 * (accountant_access). The cookie holds a random session ID, never a
 * password, and the database keeps only its SHA-256. A session ends when the
 * browser closes (the cookie has no max-age), on sign-out, or after
 * SESSION_HOURS, whichever comes first, so every new visit asks for the
 * password again. Both sites share the database, so the same logins work on
 * both; each site's cookie only works on that site.
 */
export const ADMIN_SESSION_COOKIE = "admin_session";
// The cookie from before per-admin logins held the password itself; cleared on sign-in and sign-out.
export const LEGACY_ADMIN_COOKIE = "admin_auth";
export const SESSION_HOURS = 12;

export type AdminRole = "admin" | "accountant";
export type AdminSession = {
  role: AdminRole;
  /** The admin's username; for accountants, their email. */
  username: string;
  /** admin_users.id (admins only) */
  adminUserId?: string;
};

function toHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A random 64-hex token (session IDs and password reset links). */
export function newToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** What the database stores instead of a token. */
export async function sha256(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Starts a session and returns the token to put in the cookie. */
export async function createAdminSession(
  who: { role: "admin"; adminUserId: string } | { role: "accountant"; accountantId: string },
  userAgent?: string | null
): Promise<string> {
  const token = newToken();
  const admin = createAdminClient();
  // Old sessions are no use to anyone: clear them out while we're here
  await admin.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("admin_sessions").insert({
    token_hash: await sha256(token),
    role: who.role,
    admin_user_id: who.role === "admin" ? who.adminUserId : null,
    accountant_id: who.role === "accountant" ? who.accountantId : null,
    expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
  if (error) throw new Error(`Could not start admin session: ${error.message}`);
  return token;
}

/** The session a cookie token belongs to, if it is live and its account still has access. */
export async function lookupAdminSession(token: string | null | undefined): Promise<AdminSession | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_sessions")
    .select("role, admin_user_id, admin_users(username, active), accountant_access(email, password_hash)")
    .eq("token_hash", await sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  type Joined<T> = T | T[] | null;
  const one = <T,>(v: Joined<T>) => (Array.isArray(v) ? v[0] ?? null : v);
  if (data.role === "admin") {
    const user = one(data.admin_users as Joined<{ username: string; active: boolean }>);
    return user?.active ? { role: "admin", username: user.username, adminUserId: data.admin_user_id as string } : null;
  }
  if (data.role === "accountant") {
    const acct = one(data.accountant_access as Joined<{ email: string; password_hash: string | null }>);
    // Revoking an accountant (clearing their password) ends their sessions too
    return acct?.password_hash ? { role: "accountant", username: acct.email } : null;
  }
  return null;
}

/** Ends the session behind a cookie token (sign-out). */
export async function endAdminSession(token: string | null | undefined) {
  if (!token || !TOKEN_PATTERN.test(token)) return;
  const admin = createAdminClient();
  await admin.from("admin_sessions").delete().eq("token_hash", await sha256(token));
}

/**
 * Signs a person out everywhere after their password changes, except the
 * session behind `keepToken` (the browser that just changed it).
 */
export async function endSessionsFor(
  who: { adminUserId: string } | { accountantId: string },
  keepToken?: string | null
) {
  const admin = createAdminClient();
  let query = admin.from("admin_sessions").delete();
  query = "adminUserId" in who ? query.eq("admin_user_id", who.adminUserId) : query.eq("accountant_id", who.accountantId);
  if (keepToken && TOKEN_PATTERN.test(keepToken)) query = query.neq("token_hash", await sha256(keepToken));
  await query;
}
