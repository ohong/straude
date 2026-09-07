-- Support the leaderboard_snapshots.user_id foreign key. The query-oriented
-- indexes begin with period, so PostgreSQL cannot use them efficiently when
-- validating deletes or updates to the referenced user row.
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_user_id
  ON public.leaderboard_snapshots (user_id);
