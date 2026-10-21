import { NextResponse } from "next/server";

// Signs out the admin or accountant session. Answers with a 303 so the
// browser follows it with a GET to the login page after a form post.
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  res.cookies.delete("admin_auth");
  return res;
}
