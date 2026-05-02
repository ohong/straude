export { updateSession as proxy } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|ingest|images|og-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
