import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_SESSION_COOKIE, lookupAdminSession } from "@/lib/admin-session";

// ─── COMING SOON MODE ───────────────────────────────────────────────────────
// Set to false and push to bring the full site back.
const COMING_SOON = false;
// ────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin and accountant sign-in sessions (lib/admin-session.ts), looked up
  // only on admin paths. Each page and route checks the role again itself.
  const onAdminPath = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  // Signing in and recovering a forgotten password work without a session
  const isAuthRoute = ["/api/admin/login", "/api/admin/logout", "/api/admin/forgot-password", "/api/admin/reset-password"].includes(pathname);
  const isAuthPage = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"].some((p) => pathname === p || pathname.startsWith(p + "/"));
  const adminSession = onAdminPath
    ? await lookupAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
    : null;
  const isFullAdmin = adminSession?.role === "admin";
  const isAccountantSession = adminSession?.role === "accountant";

  // Accountants get the tax reports and nothing else: no orders, customers or
  // settings. Any other admin page sends them back to the tax reports, and any
  // other admin API refuses them (the tax page re-checks the account itself).
  if (isAccountantSession) {
    const within = (base: string) => pathname === base || pathname.startsWith(base + "/");
    if (pathname.startsWith("/api/admin/") && !isAuthRoute && !within("/api/admin/tax/export")) {
      return NextResponse.json({ error: "Not available to accountants" }, { status: 403 });
    }
    if (within("/admin") && !isAuthPage && !within("/admin/tax")) {
      return NextResponse.redirect(new URL("/admin/tax", request.url));
    }
  }

  // Admin APIs: each route checks its own role too; this backstop keeps a
  // route that forgets from being open to everyone.
  if (pathname.startsWith("/api/admin/")) {
    const isAdminSession = isFullAdmin || isAccountantSession;
    if (!isAuthRoute && !isAdminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin auth (always runs)
  if (pathname.startsWith("/admin")) {
    if (isAuthPage) return NextResponse.next();
    if (!isFullAdmin && !isAccountantSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Account portal — protect all routes except login/signup and password recovery
  if (
    (pathname === "/account" || pathname.startsWith("/account/")) &&
    !pathname.startsWith("/account/login") &&
    !pathname.startsWith("/account/signup") &&
    !pathname.startsWith("/account/forgot-password") &&
    !pathname.startsWith("/account/reset-password")
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
