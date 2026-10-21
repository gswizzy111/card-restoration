import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── COMING SOON MODE ───────────────────────────────────────────────────────
// Set to false and push to bring the full site back.
const COMING_SOON = false;
// ────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminCookie = request.cookies.get("admin_auth")?.value;
  const isFullAdmin = !!process.env.ADMIN_PASSWORD && adminCookie === process.env.ADMIN_PASSWORD;
  const isAccountantSession = !isFullAdmin && !!adminCookie?.startsWith("act_");

  // Accountants get the tax reports and nothing else: no orders, customers or
  // settings. Any other admin page sends them back to the tax reports, and any
  // other admin API refuses them (the tax page re-checks the account itself).
  if (isAccountantSession) {
    const within = (base: string) => pathname === base || pathname.startsWith(base + "/");
    const isAuthRoute = pathname === "/api/admin/login" || pathname === "/api/admin/logout";
    if (pathname.startsWith("/api/admin/") && !isAuthRoute && !within("/api/admin/tax/export")) {
      return NextResponse.json({ error: "Not available to accountants" }, { status: 403 });
    }
    if (within("/admin") && !within("/admin/login") && !within("/admin/tax")) {
      return NextResponse.redirect(new URL("/admin/tax", request.url));
    }
  }

  // Admin APIs: each route checks its own role too; this backstop keeps a
  // route that forgets from being open to everyone.
  if (pathname.startsWith("/api/admin/")) {
    const isAuthRoute = pathname === "/api/admin/login" || pathname === "/api/admin/logout";
    const isAdminSession = isFullAdmin || isAccountantSession;
    if (!isAuthRoute && !isAdminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin auth (always runs)
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    // Full admin: exact password match. Accountant: act_<uuid> prefix (DB verified at page level).
    if (!isFullAdmin && !isAccountantSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Account portal — protect all routes except login/signup
  if (
    (pathname === "/account" || pathname.startsWith("/account/")) &&
    !pathname.startsWith("/account/login") &&
    !pathname.startsWith("/account/signup")
  ) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = new URL("/account/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Coming soon — rewrite all public pages to homepage.
  // /privacy must always be accessible (Meta Platform Terms require it to be public).
  if (COMING_SOON && pathname !== "/" && pathname !== "/privacy" && !pathname.startsWith("/privacy/")) {
    return NextResponse.rewrite(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/admin/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp).*)",
  ],
};
