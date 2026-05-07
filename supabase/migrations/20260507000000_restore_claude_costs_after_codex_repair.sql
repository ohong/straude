-- Restore Claude model costs that were incorrectly scaled down by the
-- legacy and previous native Codex inflation repair migrations
-- (20260506120100_repair_legacy_codex_inflation.sql and
--  20260506120200_repair_native_v1_codex_inflation.sql).
--
-- BUG: Both repair migrations applied a single proportional `correction_factor`
-- to every entry in `model_breakdown`, including Claude entries. Claude usage
-- comes from ccusage (a separate, working pipeline) and was never inflated by
-- the codex bug. So the migrations under-counted ~$173k of legitimate Claude
-- spend by scaling those entries down by the same factor as codex.
--
-- THIS FIX: for every `daily_usage` row tagged with one of the codex repair
-- reasons, restore the original Claude entry costs from corrections_log
-- (`previous_values.model_breakdown`), keep the codex entry costs as the
-- migration corrected them, recompute `cost_usd` = sum of breakdown, and
-- cascade the same restoration onto every linked `device_usage` row so device
-- sums still equal the daily totals.
--
-- Properties:
--   - Idempotent via `collector_meta->>'claude_restore_2026_05_07'` tag.
--   - Per-row exception handling — failures RAISE NOTICE and continue.
--   - Touches only rows with a codex `repair` tag; other rows untouched.
--   - Tokens are NOT modified — we don't have per-source (claude vs codex)
--     token splits stored, so we leave the migration-corrected token totals
--     in place. Costs (which is what users see) are made correct.

DO $restore$
DECLARE
  v_codex_pat text := '^(gpt-|o3|o4)';
  v_claude_pat text := 'claude|opus|sonnet|haiku';
  v_row record;
  v_dev record;
  v_orig_bd jsonb;
  v_new_bd jsonb;
  v_entry jsonb;
  v_entry_model text;
  v_orig_cost_for_model numeric;
  v_new_cost numeric;
  v_repaired_count int := 0;
  v_skipped_count  int := 0;
  v_failed_count   int := 0;
  v_total_delta    numeric := 0;
BEGIN
  FOR v_row IN
    SELECT du.*
    FROM public.daily_usage du
    WHERE du.collector_meta->>'repair' IN (
      'legacy_codex_inflation_repair_2026_05',
      'native_v1_inflation_repair_2026_05'
    )
    AND COALESCE(du.collector_meta->>'claude_restore_2026_05_07', '') <> 'true'
  LOOP
    BEGIN
      -- Pull the original (pre-codex-repair) breakdown from corrections_log.
      SELECT cl.previous_values->'model_breakdown' INTO v_orig_bd
      FROM public.corrections_log cl
      WHERE cl.user_id = v_row.user_id
        AND cl.date = v_row.date
        AND cl.table_name = 'daily_usage'
        AND cl.reason IN (
          'legacy_codex_inflation_repair_2026_05',
          'native_v1_inflation_repair_2026_05'
        )
      ORDER BY cl.created_at DESC
      LIMIT 1;

      IF v_orig_bd IS NULL OR jsonb_typeof(v_orig_bd) <> 'array' THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- Build new breakdown: walk current entries; for claude entries replace
      -- cost_usd with the original (pre-codex-repair) value; for codex / other
      -- entries keep the current (corrected) value.
      v_new_bd := '[]'::jsonb;

      IF jsonb_typeof(v_row.model_breakdown) = 'array' THEN
        FOR v_entry IN SELECT * FROM jsonb_array_elements(v_row.model_breakdown)
        LOOP
          v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
          IF v_entry_model ~* v_claude_pat AND NOT (v_entry_model ~* v_codex_pat) THEN
            -- Look up the same model in the original breakdown.
            SELECT (e ->> 'cost_usd')::numeric INTO v_orig_cost_for_model
            FROM jsonb_array_elements(v_orig_bd) e
            WHERE lower(e ->> 'model') = v_entry_model
            LIMIT 1;

            IF v_orig_cost_for_model IS NOT NULL THEN
              v_new_bd := v_new_bd || jsonb_build_array(
                jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_orig_cost_for_model))
              );
            ELSE
              v_new_bd := v_new_bd || jsonb_build_array(v_entry);
            END IF;
          ELSE
            v_new_bd := v_new_bd || jsonb_build_array(v_entry);
          END IF;
        END LOOP;
      END IF;

      -- New daily cost = sum of breakdown.
      SELECT COALESCE(SUM((e ->> 'cost_usd')::numeric), 0)
      INTO v_new_cost
      FROM jsonb_array_elements(v_new_bd) e;
      v_new_cost := round(v_new_cost, 4);

      UPDATE public.daily_usage
      SET cost_usd        = v_new_cost,
          model_breakdown = v_new_bd,
          collector_meta  = collector_meta
            || jsonb_build_object(
              'claude_restore_2026_05_07', 'true',
              'cost_before_claude_restore', v_row.cost_usd
            ),
          updated_at      = now()
      WHERE id = v_row.id;

      -- Cascade to every linked device_usage row. Each device row's breakdown
      -- gets the same per-model restoration. Daily cost = SUM(device costs)
      -- holds because we recompute device costs the same way.
      FOR v_dev IN
        SELECT * FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
      LOOP
        DECLARE
          v_dev_orig_bd jsonb;
          v_dev_new_bd jsonb := '[]'::jsonb;
          v_dev_new_cost numeric;
        BEGIN
          -- Look up this device's original breakdown.
          SELECT cl.previous_values->'model_breakdown' INTO v_dev_orig_bd
          FROM public.corrections_log cl
          WHERE cl.user_id = v_dev.user_id
            AND cl.date = v_dev.date
            AND cl.table_name = 'device_usage'
            AND cl.previous_values->>'id' = v_dev.id::text
            AND cl.reason IN (
              'legacy_codex_inflation_repair_2026_05',
              'native_v1_inflation_repair_2026_05'
            )
          ORDER BY cl.created_at DESC
          LIMIT 1;

          IF jsonb_typeof(v_dev.model_breakdown) = 'array' THEN
            FOR v_entry IN SELECT * FROM jsonb_array_elements(v_dev.model_breakdown)
            LOOP
              v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
              IF v_entry_model ~* v_claude_pat AND NOT (v_entry_model ~* v_codex_pat)
                 AND v_dev_orig_bd IS NOT NULL AND jsonb_typeof(v_dev_orig_bd) = 'array' THEN
                SELECT (e ->> 'cost_usd')::numeric INTO v_orig_cost_for_model
                FROM jsonb_array_elements(v_dev_orig_bd) e
                WHERE lower(e ->> 'model') = v_entry_model
                LIMIT 1;

                IF v_orig_cost_for_model IS NOT NULL THEN
                  v_dev_new_bd := v_dev_new_bd || jsonb_build_array(
                    jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_orig_cost_for_model))
                  );
                ELSE
                  v_dev_new_bd := v_dev_new_bd || jsonb_build_array(v_entry);
                END IF;
              ELSE
                v_dev_new_bd := v_dev_new_bd || jsonb_build_array(v_entry);
              END IF;
            END LOOP;
          END IF;

          SELECT COALESCE(SUM((e ->> 'cost_usd')::numeric), 0)
          INTO v_dev_new_cost
          FROM jsonb_array_elements(v_dev_new_bd) e;
          v_dev_new_cost := round(v_dev_new_cost, 4);

          UPDATE public.device_usage
          SET cost_usd        = v_dev_new_cost,
              model_breakdown = v_dev_new_bd,
              collector_meta  = COALESCE(collector_meta, '{}'::jsonb)
                || jsonb_build_object('claude_restore_2026_05_07', 'true',
                                       'cost_before_claude_restore', v_dev.cost_usd),
              updated_at      = now()
          WHERE id = v_dev.id;
        END;
      END LOOP;

      -- Reconcile any drift so SUM(device cost) == daily cost (rounding can
      -- leave sub-cent gaps after multiple per-device round() calls).
      WITH summed AS (
        SELECT SUM(cost_usd) AS s_cost FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
      ),
      last_dev AS (
        SELECT id FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
        ORDER BY updated_at DESC, id DESC LIMIT 1
      )
      UPDATE public.device_usage du
      SET cost_usd = du.cost_usd + (v_new_cost - (SELECT s_cost FROM summed))
      WHERE du.id = (SELECT id FROM last_dev)
        AND EXISTS (SELECT 1 FROM summed s WHERE s.s_cost IS NOT NULL);

      -- Audit entry.
      INSERT INTO public.corrections_log
        (user_id, date, table_name, reason, previous_values, new_values)
      VALUES (
        v_row.user_id, v_row.date, 'daily_usage', 'claude_restore_2026_05_07',
        jsonb_build_object(
          'cost_usd', v_row.cost_usd,
          'model_breakdown', v_row.model_breakdown
        ),
        jsonb_build_object(
          'cost_usd', v_new_cost,
          'model_breakdown', v_new_bd,
          'note', 'Restored Claude entry costs from pre-codex-repair snapshot. Codex entries unchanged.'
        )
      );

      v_repaired_count := v_repaired_count + 1;
      v_total_delta := v_total_delta + (v_new_cost - v_row.cost_usd);

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'claude_restore failed for daily_usage id=% user=% date=%: % / %',
        v_row.id, v_row.user_id, v_row.date, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'claude_restore_2026_05_07: repaired=% skipped=% failed=% total_cost_delta_usd=%',
    v_repaired_count, v_skipped_count, v_failed_count, v_total_delta;
END
$restore$;

-- Refresh leaderboard materialized views so the restored totals propagate.
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_daily;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_daily failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_weekly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_weekly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_monthly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_monthly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_all_time;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_all_time failed: %', SQLERRM; END $$;
