import { z } from "zod";
import { cookies } from "next/headers";
import { getRealAdminSession } from "@/lib/admin-auth";
import { VIEW_AS_COOKIE } from "@/lib/admin-session";

const Body = z.object({ as: z.enum(["support", "admin"]) });

/**
 * "View as Support" on and off, for admins only. It lives under
 * /api/admin/support so an admin already viewing as support can still reach
 * it to switch back (middleware lets support sessions call /api/admin/support).
 */
export async function POST(request: Request) {
  const real = await getRealAdminSession();
  if (real?.role !== "admin") return Response.json({ error: "Only admins can switch views." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const jar = await cookies();
  // No max-age: like the admin session, it ends when the browser closes
  if (parsed.data.as === "support") jar.set(VIEW_AS_COOKIE, "support", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  else jar.delete(VIEW_AS_COOKIE);
  return Response.json({ ok: true });
}
