import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { firstRelation } from "@/lib/utils/first-relation";
import { timeAgo } from "@/lib/utils/format";
import type { PromptSubmission } from "@/types";

type PromptListRow = Pick<PromptSubmission, "id" | "prompt" | "is_anonymous" | "created_at" | "status"> & {
  user: Array<{ username: string | null }> | null;
};

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("prompt_submissions")
    .select(
      "id,prompt,is_anonymous,created_at,status,user:users!prompt_submissions_user_id_fkey(username)"
    )
    .eq("is_public", true)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const prompts = (data ?? []) as PromptListRow[];

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Community Prompts</h3>
        <p className="hidden text-sm text-muted sm:block">
          What people want us to build next
        </p>
      </header>

      {prompts.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">
          No prompts yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {prompts.map((row) => {
            const username = firstRelation(row.user)?.username;
            const isAnonymous = Boolean(row.is_anonymous);
            return (
              <article key={row.id} className="px-4 py-5 sm:px-6">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {isAnonymous ? (
                    <span className="font-semibold text-muted">Anonymous</span>
                  ) : username ? (
                    <Link href={`/u/${username}`} className="font-semibold text-accent hover:underline">
                      @{username}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted">Unknown user</span>
                  )}
                  <span suppressHydrationWarning className="text-muted">
                    {timeAgo(row.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {row.prompt}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
