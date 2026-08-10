import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── COMING SOON MODE ───────────────────────────────────────────────────────
// Set to false and push to bring the full site back.
const COMING_SOON = false;
// ────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin auth (always runs)
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    const auth = request.cookies.get("admin_auth")?.value;
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Account portal — protect all routes except login/signup
  if (
    pathname.startsWith("/account") &&
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

  // Coming soon — rewrite all public pages to homepage
  if (COMING_SOON && pathname !== "/") {
    return NextResponse.rewrite(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp).*)",
  ],
};
