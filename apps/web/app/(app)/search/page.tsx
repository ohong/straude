import SearchClient, {
  type SearchUser,
} from "@/components/app/search/SearchClient";
import { createClient } from "@/lib/supabase/server";

import { buildUserSearchFilter, PUBLIC_USER_FIELDS } from "@/lib/data/user-search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  let initialResults: SearchUser[] = [];

  const search = buildUserSearchFilter(query);
  if (search.ok) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("users")
      .select(PUBLIC_USER_FIELDS)
      .eq("is_public", true)
      .or(search.filter)
      .limit(20);

    initialResults = data ?? [];
  }

  return (
    <SearchClient initialQuery={query} initialResults={initialResults} />
  );
}
