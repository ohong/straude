-- Roll back the abandoned direct SQL Codex repair passes.
--
-- Some environments briefly ran the 2026-05-06/07 repair migrations before we
-- decided that historical Codex usage must only be healed by a user re-pushing
-- from the fixed CLI. Those migrations lowered costs heuristically and, worse,
-- produced impossible token buckets such as input_tokens = 0 with huge
-- total_tokens. If the audit table exists, restore affected rows to the values
-- captured before the first repair pass. Fresh environments where the repair
-- migrations are now no-ops simply skip this file.

DO $rollback$
DECLARE
  v_fixed_codex_collector text := 'straude-codex-native-last-token-usage';
  v_restored_daily int := 0;
  v_restored_device int := 0;
  v_post_titles int := 0;
  v_uid uuid;
BEGIN
  IF to_regclass('public.corrections_log') IS NULL THEN
    RAISE NOTICE 'rollback_codex_sql_repairs: corrections_log missing, nothing to restore';
    RETURN;
  END IF;

  CREATE TEMP TABLE _codex_repair_daily_restore ON COMMIT DROP AS
    SELECT DISTINCT ON (user_id, date)
      user_id,
      date,
      previous_values
    FROM public.corrections_log
    WHERE table_name = 'daily_usage'
      AND reason IN (
        'legacy_codex_inflation_repair_2026_05',
        'native_v1_inflation_repair_2026_05'
      )
    ORDER BY user_id, date, created_at ASC;

  CREATE TEMP TABLE _codex_repair_device_restore ON COMMIT DROP AS
    SELECT DISTINCT ON ((previous_values->>'id'))
      (previous_values->>'id')::uuid AS id,
      user_id,
      date,
      previous_values
    FROM public.corrections_log
    WHERE table_name = 'device_usage'
      AND previous_values ? 'id'
      AND reason IN (
        'legacy_codex_inflation_repair_2026_05',
        'native_v1_inflation_repair_2026_05'
      )
    ORDER BY (previous_values->>'id'), created_at ASC;

  UPDATE public.daily_usage du
  SET cost_usd = (r.previous_values->>'cost_usd')::numeric,
      input_tokens = (r.previous_values->>'input_tokens')::bigint,
      cache_read_tokens = (r.previous_values->>'cache_read_tokens')::bigint,
      total_tokens = COALESCE(
        (r.previous_values->>'total_tokens')::bigint,
        (r.previous_values->>'previous_total_tokens')::bigint,
        du.total_tokens
      ),
      model_breakdown = CASE
        WHEN r.previous_values ? 'model_breakdown' THEN r.previous_values->'model_breakdown'
        ELSE du.model_breakdown
      END,
      collector_meta = CASE
        WHEN r.previous_values ? 'collector_meta' THEN r.previous_values->'collector_meta'
        ELSE NULL
      END,
      is_verified = COALESCE((r.previous_values->>'is_verified')::boolean, du.is_verified),
      updated_at = now()
  FROM _codex_repair_daily_restore r
  WHERE du.user_id = r.user_id
    AND du.date = r.date
    AND (
      du.collector_meta ? 'repair'
      OR du.collector_meta ? 'repair_v3_codex_only'
      OR du.collector_meta ? 'claude_restore_2026_05_07'
    )
    AND COALESCE(du.collector_meta->>'codex', '') <> v_fixed_codex_collector;
  GET DIAGNOSTICS v_restored_daily = ROW_COUNT;

  UPDATE public.device_usage du
  SET cost_usd = (r.previous_values->>'cost_usd')::numeric,
      input_tokens = (r.previous_values->>'input_tokens')::bigint,
      cache_read_tokens = (r.previous_values->>'cache_read_tokens')::bigint,
      total_tokens = COALESCE(
        (r.previous_values->>'total_tokens')::bigint,
        (r.previous_values->>'previous_total_tokens')::bigint,
        du.total_tokens
      ),
      model_breakdown = CASE
        WHEN r.previous_values ? 'model_breakdown' THEN r.previous_values->'model_breakdown'
        ELSE du.model_breakdown
      END,
      collector_meta = CASE
        WHEN dr.previous_values ? 'collector_meta' THEN dr.previous_values->'collector_meta'
        ELSE NULL
      END,
      updated_at = now()
  FROM _codex_repair_device_restore r
  LEFT JOIN _codex_repair_daily_restore dr ON dr.user_id = r.user_id AND dr.date = r.date
  WHERE du.id = r.id
    AND COALESCE(du.collector_meta->>'codex', '') <> v_fixed_codex_collector;
  GET DIAGNOSTICS v_restored_device = ROW_COUNT;

  -- Auto-generated post titles include the old cost. Keep user-authored titles
  -- intact, but regenerate titles that still match the auto-title shape so the
  -- visible card does not contradict the restored usage row.
  FOR v_uid IN
    SELECT DISTINCT user_id FROM _codex_repair_daily_restore
  LOOP
    BEGIN
      PERFORM public.recalculate_user_level(v_uid);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'rollback_codex_sql_repairs: recalculate_user_level failed for user=%: % / %',
        v_uid, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  WITH restored_posts AS (
    SELECT
      p.id,
      du.date,
      du.cost_usd,
      du.models,
      EXISTS (
        SELECT 1 FROM unnest(du.models) AS m
        WHERE m ILIKE '%claude%' OR m ILIKE '%opus%' OR m ILIKE '%sonnet%' OR m ILIKE '%haiku%'
      ) AS has_claude,
      (
        SELECT CASE
          WHEN m ILIKE 'gpt-%' THEN regexp_replace(regexp_replace(m, '^gpt', 'GPT', 'i'), '-codex$', '-Codex', 'i')
          WHEN m ILIKE 'o3%' THEN 'o3'
          WHEN m ILIKE 'o4%' THEN 'o4'
          ELSE m
        END
        FROM unnest(du.models) AS m
        WHERE m ~* '^(gpt-|o3|o4)'
        LIMIT 1
      ) AS codex_label,
      CASE
        WHEN EXISTS (SELECT 1 FROM unnest(du.models) AS m WHERE m ILIKE '%opus%') THEN 'Claude Opus'
        WHEN EXISTS (SELECT 1 FROM unnest(du.models) AS m WHERE m ILIKE '%sonnet%') THEN 'Claude Sonnet'
        WHEN EXISTS (SELECT 1 FROM unnest(du.models) AS m WHERE m ILIKE '%haiku%') THEN 'Claude Haiku'
        ELSE NULL
      END AS claude_label
    FROM public.posts p
    JOIN public.daily_usage du ON du.id = p.daily_usage_id
    JOIN _codex_repair_daily_restore r ON r.user_id = du.user_id AND r.date = du.date
    WHERE (p.title IS NULL OR p.title ~ '^[A-Z][a-z]{2} [0-9]{1,2}( — .+)?$')
      AND COALESCE(du.collector_meta->>'codex', '') <> v_fixed_codex_collector
  ),
  titled AS (
    SELECT
      id,
      concat_ws(
        '',
        to_char(date, 'Mon FMDD'),
        CASE
          WHEN array_remove(ARRAY[claude_label, codex_label], NULL) IS NOT NULL
               AND cardinality(array_remove(ARRAY[claude_label, codex_label], NULL)) > 0
            THEN ' — ' || array_to_string(array_remove(ARRAY[claude_label, codex_label], NULL), ' + ')
          WHEN has_claude THEN ' — Claude'
          ELSE ''
        END,
        CASE
          WHEN cost_usd > 0 THEN ', $' || trim(to_char(round(cost_usd::numeric, 2), 'FM999G999G999G990D00'))
          ELSE ''
        END
      ) AS title
    FROM restored_posts
  )
  UPDATE public.posts p
  SET title = titled.title,
      updated_at = now()
  FROM titled
  WHERE p.id = titled.id
    AND p.title IS DISTINCT FROM titled.title;
  GET DIAGNOSTICS v_post_titles = ROW_COUNT;

  RAISE NOTICE 'rollback_codex_sql_repairs: restored daily=% device=% auto_titles=%',
    v_restored_daily, v_restored_device, v_post_titles;
END
$rollback$;

DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_daily;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_daily failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_weekly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_weekly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_monthly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_monthly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_all_time;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_all_time failed: %', SQLERRM; END $$;
