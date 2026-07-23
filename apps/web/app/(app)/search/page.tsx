import SearchClient, {
  type SearchUser,
} from "@/components/app/search/SearchClient";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_USER_FIELDS =
  "id, username, display_name, bio, avatar_url, is_public";

function sanitizeSearchFilter(value: string): string {
  return value.replace(/[,()\\@]/g, "");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  let initialResults: SearchUser[] = [];

  if (query.length >= 2) {
    const supabase = await createClient();
    const safe = sanitizeSearchFilter(query);
    const { data } = await supabase
      .from("users")
      .select(PUBLIC_USER_FIELDS)
      .eq("is_public", true)
      .or(
        `username.ilike.%${safe}%,display_name.ilike.%${safe}%,github_username.ilike.%${safe}%`,
      )
      .limit(20);

    initialResults = data ?? [];
  }

  return (
    <SearchClient initialQuery={query} initialResults={initialResults} />
  );
}
