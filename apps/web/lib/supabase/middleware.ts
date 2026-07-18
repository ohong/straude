import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  formatSupabaseEnvHelp,
  getMissingSupabaseBrowserEnv,
} from "./env";

export async function updateSession(request: NextRequest) {
  const missing = getMissingSupabaseBrowserEnv();
  if (missing.length > 0) {
    if (process.env.NODE_ENV === "development") {
      if (
        request.nextUrl.pathname === "/dev/local-env" ||
        request.nextUrl.pathname === "/manifest.webmanifest"
      ) {
        return NextResponse.next({ request });
      }

      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Local Supabase env is not configured.",
            missing,
            next: [
              "bun run local:up",
              "bun run local:env",
              "bun run local:seed",
              "bun run dev:local",
            ],
          },
          { status: 503 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/dev/local-env";
      url.searchParams.set("from", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    throw new Error(formatSupabaseEnvHelp(missing));
  }

  let supabaseResponse = NextResponse.next({ request });
  type CookieOptions = Parameters<typeof supabaseResponse.cookies.set>[2];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const authStart = Date.now();
  const { data } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims.sub === "string" ? data.claims.sub : null;
  // Surfaced to the perf harness and RUM via the Server-Timing response header
  supabaseResponse.headers.set(
    "Server-Timing",
    `mw-auth;dur=${Date.now() - authStart}`
  );

  // Redirect authenticated users from landing to feed
  const redirectWithSession = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie)
    );
    const serverTiming = supabaseResponse.headers.get("Server-Timing");
    if (serverTiming) {
      redirectResponse.headers.set("Server-Timing", serverTiming);
    }
    return redirectResponse;
  };

  if (userId && request.nextUrl.pathname === "/") {
    return redirectWithSession("/feed");
  }

  // Protect app routes
  const protectedPaths = ["/settings", "/post/new", "/search", "/prompts", "/messages", "/notifications", "/recap", "/admin"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!userId && isProtected) {
    return redirectWithSession("/login");
  }

  return supabaseResponse;
}
