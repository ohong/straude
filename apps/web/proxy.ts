import { agentNotFoundMarkdown, getAgentMarkdown } from "@/lib/agent-content";
import { getCookieConsentFromCookieString } from "@/lib/cookie-consent";
import {
  appendVary,
  preferredRepresentation,
} from "@/lib/http/content-negotiation";
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const STATIC_PAGE_PATHS = new Set([
  "/",
  "/about",
  "/admin",
  "/card",
  "/cli",
  "/cli/verify",
  "/contact",
  "/dev/local-env",
  "/feed",
  "/leaderboard",
  "/login",
  "/messages",
  "/notifications",
  "/og-image",
  "/og-image/share-assets",
  "/onboarding",
  "/open",
  "/post/new",
  "/privacy",
  "/prompts",
  "/recap",
  "/search",
  "/settings",
  "/settings/import",
  "/signup",
  "/terms",
  "/token-rich",
]);

const DYNAMIC_PAGE_PATTERNS = [
  /^\/join\/[^/]+$/,
  /^\/post\/[^/]+$/,
  /^\/recap\/[^/]+$/,
  /^\/stats\/[^/]+$/,
  /^\/u\/[^/]+(?:\/follows)?$/,
];

function normalizedPathname(pathname: string): string {
  return pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
}

function isKnownPage(pathname: string): boolean {
  const normalized = normalizedPathname(pathname);
  return (
    STATIC_PAGE_PATHS.has(normalized) ||
    DYNAMIC_PAGE_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function isMetadataImagePath(pathname: string): boolean {
  return pathname.split("/").some((segment) =>
    /^(?:opengraph-image|twitter-image|apple-icon)(?:-[a-z0-9]+)?$/i.test(segment),
  );
}

function isDocumentRequest(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const pathname = request.nextUrl.pathname;
  if (
    normalizedPathname(pathname) === "/callback" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/ingest/") ||
    pathname.includes(".") ||
    isMetadataImagePath(pathname)
  ) {
    return false;
  }

  return !(
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch")
  );
}

function notAcceptable(method: string): Response {
  return new Response(
    method === "HEAD"
      ? null
      : "Not Acceptable\n\nAvailable: text/html, text/markdown\n",
    {
      status: 406,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "Accept, Accept-Encoding",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function proxy(request: NextRequest): Promise<Response> {
  if (request.nextUrl.pathname === "/ingest" || request.nextUrl.pathname.startsWith("/ingest/")) {
    // SDK retries can outlive the consent granted at initial capture time.
    let analyticsConsent = false;
    try {
      analyticsConsent = getCookieConsentFromCookieString(request.headers.get("cookie") ?? "")?.analytics === true;
    } catch {
      // Malformed or absent consent always fails closed.
    }
    if (!analyticsConsent) {
      return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.next();
  }

  if (!isDocumentRequest(request)) return updateSession(request);

  const pathname = normalizedPathname(request.nextUrl.pathname);
  const accept = request.headers.get("accept");
  const markdown = getAgentMarkdown(pathname);
  const knownPage = isKnownPage(pathname);

  if (!knownPage) {
    const errorRepresentation = preferredRepresentation(accept);
    if (errorRepresentation === null) return notAcceptable(request.method);
    if (errorRepresentation === "text/markdown") {
      return new Response(
        request.method === "HEAD" ? null : agentNotFoundMarkdown(pathname),
        {
          status: 404,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            Vary: "Accept, Accept-Encoding",
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  const representation = preferredRepresentation(
    accept,
    markdown ? ["text/html", "text/markdown"] : ["text/html"],
  );

  if (representation === null) return notAcceptable(request.method);

  if (representation === "text/markdown") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/api/markdown";
    destination.search = "";
    destination.searchParams.set("path", pathname);
    const response = NextResponse.rewrite(destination);
    appendVary(response.headers, "Accept", "Accept-Encoding");
    return response;
  }

  const response = await updateSession(request);
  appendVary(response.headers, "Accept", "Accept-Encoding");
  return response;
}

export const config = {
  matcher: [
    "/ingest",
    "/ingest/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|ingest|images|og-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
