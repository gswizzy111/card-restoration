import { NextResponse } from "next/server";

// Signs out the admin or accountant session. A 303 so the browser follows the
// form post with a GET, and a relative Location so it stays on the domain it
// is on (on Netlify, request.url is the deploy's own address, not the site's).
export async function POST() {
  const res = new NextResponse(null, { status: 303, headers: { Location: "/admin/login" } });
  res.cookies.delete("admin_auth");
  return res;
}
