import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { enrichFeedPosts } from "@/lib/feed-enrichment";
import { getServiceClient } from "@/lib/supabase/service";
import { insertUser, openTestDb } from "./db";

it("keeps a quiet post's preview alongside a recently active discussion", async () => {
  const db = await openTestDb();
  const owner = await insertUser(db);
  try {
    const posts = await db.query<{ id: string; title: string }>(
      `WITH days AS (
        INSERT INTO daily_usage (user_id, date, cost_usd, input_tokens, output_tokens, total_tokens)
        VALUES ($1, current_date, 1, 10, 10, 20), ($1, current_date - 1, 1, 10, 10, 20)
        RETURNING id, date
      )
      INSERT INTO posts (user_id, daily_usage_id, title)
      SELECT $1, id, CASE WHEN date = current_date THEN 'Busy' ELSE 'Quiet' END FROM days
      RETURNING id, title`, [owner],
    );
    const busy = posts.rows.find((post) => post.title === "Busy")!.id;
    const quiet = posts.rows.find((post) => post.title === "Quiet")!.id;
    await db.query(
      `INSERT INTO comments (user_id, post_id, content, created_at)
       SELECT $1::uuid, $2::uuid, 'Busy ' || i, now() + i * interval '1 minute' FROM generate_series(1, 6) i
       UNION ALL SELECT $1::uuid, $3::uuid, 'Quiet comment', now() - interval '1 day'`,
      [owner, busy, quiet],
    );
    const guest = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await guest.rpc("get_feed", { p_type: "user", p_user_id: owner, p_limit: 2 });
    expect(error).toBeNull();
    const feed = await enrichFeedPosts({ posts: data, userId: null, userScopedClient: guest });
    const comments = (id: string) => feed.find((post) => post.id === id)?.recent_comments?.map((comment) => comment.content);
    expect(comments(busy)).toEqual(["Busy 5", "Busy 6"]);
    expect(comments(quiet)).toEqual(["Quiet comment"]);
  } finally {
    await getServiceClient().auth.admin.deleteUser(owner);
    await db.end();
  }
});
