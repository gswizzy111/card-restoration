import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, LEGACY_ADMIN_COOKIE, endAdminSession } from "@/lib/admin-session";

// Signs out the admin or accountant session: ends it in the database and
// clears the cookie. A 303 so the browser follows the form post with a GET,
// and a relative Location so it stays on the domain it is on (on Netlify,
// request.url is the deploy's own address, not the site's).
export async function POST() {
  const jar = await cookies();
  await endAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
  const res = new NextResponse(null, { status: 303, headers: { Location: "/admin/login" } });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  res.cookies.delete(LEGACY_ADMIN_COOKIE);
  return res;
}
