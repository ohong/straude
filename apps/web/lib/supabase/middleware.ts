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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users from landing to feed
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  // Protect app routes
  const protectedPaths = ["/settings", "/post/new", "/search", "/prompts", "/messages", "/admin"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
