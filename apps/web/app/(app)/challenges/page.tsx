import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstRelation } from "@/lib/utils/first-relation";
import { Challenges, type ChallengeGroup, type ChallengeBuild } from "@/components/app/challenges/Challenges";

type Post = { id: string; title: string | null; description: string | null; images: string[]; usage_generated_title: boolean };
function buildTitle(post: Post | null, day: string) {
  return post && ((!post.usage_generated_title && post.title?.trim()) || post.description?.trim().slice(0, 100)
    || (post.images?.length ? `Screenshot from ${day}` : null));
}
export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const params = await searchParams;
  const id = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.group ?? "") ? params.group : undefined;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(id ? `/challenges?group=${id}` : "/challenges")}`);

  // Group reads use the signed-in client. Embedded posts keep their own row visibility.
  const list = await db.from("build_challenges").select("id,start_date,organizer:users(username,display_name)").order("start_date", { ascending: false }).order("id");
  if (list.error) throw new Error("Could not load challenges.");
  const groups: ChallengeGroup[] = list.data.map(row => {
    const owner = firstRelation(row.organizer);
    return { id: row.id, start: row.start_date, organizer: owner?.display_name || owner?.username || "Builder" };
  });
  const group = groups.find(row => row.id === id);
  if (!group) return <Challenges groups={groups} invitation={id} />;

  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${group.start}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  const [members, entries, days] = await Promise.all([
    db.from("build_challenge_members").select("user_id,profile:users(username,display_name)").eq("challenge_id", group.id),
    db.from("build_challenge_entries").select("user_id,day,post:posts(id,title,description,usage_generated_title,images)").eq("challenge_id", group.id).order("day",{ascending:false}),
    db.from("daily_usage").select("date,post:posts!posts_daily_usage_id_fkey(id,title,description,usage_generated_title,images)").eq("user_id", user.id).gte("date",group.start).lte("date",today < end ? today : end).order("date",{ascending:false}),
  ]);
  if (members.error || entries.error || days.error) throw new Error("Could not load challenge progress.");
  const roster = members.data.map(row => {
    const profile = firstRelation(row.profile);
    return { id: row.user_id as string, name: profile?.display_name || profile?.username || "Builder",
      days: entries.data.filter(entry => entry.user_id === row.user_id).length };
  });
  const gallery: ChallengeBuild[] = entries.data.flatMap(row => {
    const post = firstRelation(row.post);
    const title = buildTitle(post, row.day);
    return post && title ? [{ id: post.id, title, day: row.day, author: roster.find(member => member.id === row.user_id)?.name }] : [];
  });
  const submitted = new Set(entries.data.filter(entry => entry.user_id === user.id).map(entry => entry.day));
  const choices = days.data.flatMap(row => {
    const post = firstRelation(row.post);
    const title = buildTitle(post,row.date);
    return post && title && !submitted.has(row.date) ? [{ id: post.id, title, day: row.date }] : [];
  });
  return <Challenges groups={groups} selected={{ ...group, end, ended: today > end, roster, gallery, choices }} />;
}
