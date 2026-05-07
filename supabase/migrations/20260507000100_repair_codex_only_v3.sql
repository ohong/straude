-- Codex-only inflation repair (v3)
--
-- The two prior repair migrations (legacy_codex_inflation_repair_2026_05 and
-- native_v1_inflation_repair_2026_05) had a bug: they applied a single
-- proportional `correction_factor` to every entry in `model_breakdown`,
-- including Claude entries. Claude usage comes from ccusage (a separate,
-- working pipeline) and was never inflated by the codex bug. Scaling Claude
-- entries down by the codex correction factor under-counted ~$173k of
-- legitimate Claude spend across 2,646 rows.
--
-- 20260507000000_restore_claude_costs_after_codex_repair.sql restored Claude
-- entries on rows still tagged with the prior `repair` markers. But many rows
-- have since been overwritten by fresh pushes from the older collector
-- (auto-push, hooks),
-- which strip the tags. Those rows are inflated again AND any future repair
-- needs to leave Claude alone from the start.
--
-- This migration is the codex-only repair: it ONLY scales codex breakdown
-- entries (gpt-*, o3, o4) by an inclusive-cache correction factor computed
-- from those entries alone. Claude entries are passed through untouched. The
-- daily `cost_usd` becomes the sum of the new breakdown.
--
-- For token columns: we clamp `cache_read_tokens <= input_tokens` at the
-- daily/device aggregate level. Claude's contribution (cache <= input by the
-- ccusage convention) is preserved within the clamp; only the codex-introduced
-- inflation is removed. We do NOT modify `input_tokens`, `output_tokens`, or
-- `cache_creation_tokens`.
--
-- Idempotent via `collector_meta->>'repair_v3_codex_only' = 'true'`. A fresh
-- A push from the older collector overwrites the tag, so this migration can be re-applied to catch
-- rows that have been re-uploaded since it last ran.

DO $repair$
DECLARE
  v_pricing  jsonb;
  v_codex_pat text := '^(gpt-|o3|o4)';
  v_claude_pat text := 'claude|opus|sonnet|haiku';
  v_row record;
  v_dev record;
  v_eff_cache_read bigint;
  v_old_codex_est numeric;
  v_new_codex_est numeric;
  v_codex_factor numeric;
  v_old_breakdown jsonb;
  v_new_breakdown jsonb;
  v_corrected_cost numeric;
  v_new_total_tokens bigint;
  v_entry jsonb;
  v_entry_model text;
  v_entry_cost numeric;
  v_entry_price jsonb;
  v_new_entry_cost numeric;
  v_repaired_count int := 0;
  v_failed_count int := 0;
  v_total_delta numeric := 0;
BEGIN
  v_pricing := jsonb_build_object(
    'gpt-5',                    jsonb_build_object('input', 0.00000125, 'output', 0.00001,    'cache_read', 0.000000125),
    'gpt-5-2025-08-07',         jsonb_build_object('input', 0.00000125, 'output', 0.00001,    'cache_read', 0.000000125),
    'gpt-5.1',                  jsonb_build_object('input', 0.00000125, 'output', 0.00001,    'cache_read', 0.000000125),
    'gpt-5.1-codex',            jsonb_build_object('input', 0.00000125, 'output', 0.00001,    'cache_read', 0.000000125),
    'gpt-5.1-codex-max',        jsonb_build_object('input', 0.00000125, 'output', 0.00001,    'cache_read', 0.000000125),
    'gpt-5.1-codex-mini',       jsonb_build_object('input', 0.00000025, 'output', 0.000002,   'cache_read', 0.000000025),
    'gpt-5.2',                  jsonb_build_object('input', 0.00000175, 'output', 0.000014,   'cache_read', 0.000000175),
    'gpt-5.2-codex',            jsonb_build_object('input', 0.00000175, 'output', 0.000014,   'cache_read', 0.000000175),
    'gpt-5.3-codex',            jsonb_build_object('input', 0.00000175, 'output', 0.000014,   'cache_read', 0.000000175),
    'gpt-5.3-codex-spark',      jsonb_build_object('input', 0.00000175, 'output', 0.000014,   'cache_read', 0.000000175),
    'gpt-5.4',                  jsonb_build_object('input', 0.0000025,  'output', 0.000015,   'cache_read', 0.00000025),
    'gpt-5.4-2026-03-05',       jsonb_build_object('input', 0.0000025,  'output', 0.000015,   'cache_read', 0.00000025),
    'gpt-5.4-mini',             jsonb_build_object('input', 0.00000075, 'output', 0.0000045,  'cache_read', 0.000000075),
    'gpt-5.4-nano',             jsonb_build_object('input', 0.0000002,  'output', 0.00000125, 'cache_read', 0.00000002),
    'gpt-5.5',                  jsonb_build_object('input', 0.000005,   'output', 0.00003,    'cache_read', 0.0000005),
    'gpt-5.5-pro',              jsonb_build_object('input', 0.00003,    'output', 0.00018,    'cache_read', 0.00003),
    'gpt-5-mini',               jsonb_build_object('input', 0.00000025, 'output', 0.000002,   'cache_read', 0.000000025),
    'gpt-5-mini-2025-08-07',    jsonb_build_object('input', 0.00000025, 'output', 0.000002,   'cache_read', 0.000000025),
    'gpt-5-nano',               jsonb_build_object('input', 0.00000005, 'output', 0.0000004,  'cache_read', 0.000000005),
    'gpt-5-nano-2025-08-07',    jsonb_build_object('input', 0.00000005, 'output', 0.0000004,  'cache_read', 0.000000005)
  );

  FOR v_row IN
    SELECT * FROM public.daily_usage
    WHERE cache_read_tokens > input_tokens
      AND date < CURRENT_DATE
      AND (collector_meta IS NULL OR collector_meta->>'codex' = 'straude-codex-native-v1')
      AND COALESCE(collector_meta->>'repair_v3_codex_only', '') <> 'true'
    ORDER BY date, user_id
  LOOP
    BEGIN
      v_eff_cache_read := LEAST(v_row.cache_read_tokens, v_row.input_tokens);
      v_old_breakdown := COALESCE(v_row.model_breakdown, '[]'::jsonb);
      v_old_codex_est := 0;
      v_new_codex_est := 0;

      -- Walk codex entries only. Allocate row's tokens proportionally to each
      -- codex model's share of the total codex cost. (Same approach as the
      -- prior migrations, but the share is computed only over codex entries
      -- and applied only to codex entries.)
      DECLARE
        v_codex_cost_total numeric := 0;
        v_share numeric;
        v_share_input numeric;
        v_share_output numeric;
        v_share_cache_read numeric;
      BEGIN
        IF jsonb_typeof(v_old_breakdown) = 'array' THEN
          FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
            v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
            v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
            IF v_entry_model ~* v_codex_pat AND v_pricing ? v_entry_model THEN
              v_codex_cost_total := v_codex_cost_total + v_entry_cost;
            END IF;
          END LOOP;
        END IF;

        IF v_codex_cost_total > 0 THEN
          FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
            v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
            v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
            IF NOT (v_entry_model ~* v_codex_pat) OR NOT (v_pricing ? v_entry_model) THEN
              CONTINUE;
            END IF;
            v_entry_price := v_pricing -> v_entry_model;
            v_share := v_entry_cost / v_codex_cost_total;
            v_share_input := v_row.input_tokens * v_share;
            v_share_output := v_row.output_tokens * v_share;
            v_share_cache_read := v_row.cache_read_tokens * v_share;

            v_old_codex_est := v_old_codex_est
              + v_share_input * (v_entry_price ->> 'input')::numeric
              + v_share_output * (v_entry_price ->> 'output')::numeric
              + v_share_cache_read * (v_entry_price ->> 'cache_read')::numeric;

            v_new_codex_est := v_new_codex_est
              + (v_share_input - LEAST(v_share_cache_read, v_share_input)) * (v_entry_price ->> 'input')::numeric
              + v_share_output * (v_entry_price ->> 'output')::numeric
              + LEAST(v_share_cache_read, v_share_input) * (v_entry_price ->> 'cache_read')::numeric;
          END LOOP;
        END IF;
      END;

      IF v_old_codex_est > 0 THEN
        v_codex_factor := v_new_codex_est / v_old_codex_est;
      ELSE
        -- No usable codex breakdown — fall back to a token-based heuristic.
        v_codex_factor := GREATEST(0.05, (v_row.input_tokens + v_eff_cache_read * 0.1)::numeric
          / NULLIF((v_row.input_tokens + v_row.cache_read_tokens)::numeric, 0));
      END IF;
      IF v_codex_factor IS NULL OR v_codex_factor <= 0 THEN v_codex_factor := 0.05; END IF;
      v_codex_factor := LEAST(v_codex_factor, 1.0);
      v_codex_factor := GREATEST(v_codex_factor, 0.01);

      -- Build new breakdown: scale codex entries by the codex factor; pass
      -- through Claude and unknown-model entries untouched.
      v_new_breakdown := '[]'::jsonb;
      IF jsonb_typeof(v_old_breakdown) = 'array' THEN
        FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
          v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
          v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
          IF v_entry_model ~* v_codex_pat AND v_pricing ? v_entry_model THEN
            v_new_entry_cost := round(v_entry_cost * v_codex_factor, 6);
            v_new_breakdown := v_new_breakdown || jsonb_build_array(jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_new_entry_cost)));
          ELSE
            v_new_breakdown := v_new_breakdown || jsonb_build_array(v_entry);
          END IF;
        END LOOP;
      END IF;

      -- New daily cost = sum of breakdown.
      SELECT COALESCE(SUM((e ->> 'cost_usd')::numeric), 0) INTO v_corrected_cost
      FROM jsonb_array_elements(v_new_breakdown) e;
      v_corrected_cost := round(v_corrected_cost, 4);
      v_new_total_tokens := COALESCE(v_row.input_tokens, 0)
        + COALESCE(v_row.output_tokens, 0)
        + COALESCE(v_row.cache_creation_tokens, 0)
        + COALESCE(v_eff_cache_read, 0);

      UPDATE public.daily_usage
      SET cost_usd          = v_corrected_cost,
          cache_read_tokens = v_eff_cache_read,
          total_tokens      = v_new_total_tokens,
          model_breakdown   = v_new_breakdown,
          is_verified       = TRUE,
          collector_meta    = COALESCE(collector_meta, '{}'::jsonb)
            || jsonb_build_object(
                 'repair_v3_codex_only', 'true',
                 'cost_before_v3',                v_row.cost_usd,
                 'total_tokens_before_v3',        v_row.total_tokens,
                 'cache_read_before_v3',          v_row.cache_read_tokens,
                 'model_breakdown_before_v3',     v_old_breakdown,
                 'repaired_at_v3',                now()
               ),
          updated_at        = now()
      WHERE id = v_row.id;

      -- Cascade to device_usage rows. Use the same per-row logic on each
      -- device's own breakdown.
      FOR v_dev IN
        SELECT * FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
      LOOP
        DECLARE
          v_dev_old_bd jsonb := COALESCE(v_dev.model_breakdown, '[]'::jsonb);
          v_dev_codex_total numeric := 0;
          v_dev_old_est numeric := 0;
          v_dev_new_est numeric := 0;
          v_dev_factor numeric;
          v_dev_share numeric;
          v_dev_share_input numeric;
          v_dev_share_output numeric;
          v_dev_share_cache numeric;
          v_dev_new_bd jsonb := '[]'::jsonb;
          v_dev_new_cost numeric;
          v_dev_eff_cache bigint;
          v_dev_new_total bigint;
        BEGIN
          IF jsonb_typeof(v_dev_old_bd) = 'array' THEN
            FOR v_entry IN SELECT * FROM jsonb_array_elements(v_dev_old_bd) LOOP
              v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
              v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
              IF v_entry_model ~* v_codex_pat AND v_pricing ? v_entry_model THEN
                v_dev_codex_total := v_dev_codex_total + v_entry_cost;
              END IF;
            END LOOP;
          END IF;

          IF v_dev_codex_total > 0 THEN
            FOR v_entry IN SELECT * FROM jsonb_array_elements(v_dev_old_bd) LOOP
              v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
              v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
              IF NOT (v_entry_model ~* v_codex_pat) OR NOT (v_pricing ? v_entry_model) THEN CONTINUE; END IF;
              v_entry_price := v_pricing -> v_entry_model;
              v_dev_share := v_entry_cost / v_dev_codex_total;
              v_dev_share_input := v_dev.input_tokens * v_dev_share;
              v_dev_share_output := v_dev.output_tokens * v_dev_share;
              v_dev_share_cache := v_dev.cache_read_tokens * v_dev_share;
              v_dev_old_est := v_dev_old_est
                + v_dev_share_input * (v_entry_price ->> 'input')::numeric
                + v_dev_share_output * (v_entry_price ->> 'output')::numeric
                + v_dev_share_cache * (v_entry_price ->> 'cache_read')::numeric;
              v_dev_new_est := v_dev_new_est
                + (v_dev_share_input - LEAST(v_dev_share_cache, v_dev_share_input)) * (v_entry_price ->> 'input')::numeric
                + v_dev_share_output * (v_entry_price ->> 'output')::numeric
                + LEAST(v_dev_share_cache, v_dev_share_input) * (v_entry_price ->> 'cache_read')::numeric;
            END LOOP;
            v_dev_factor := CASE WHEN v_dev_old_est > 0 THEN v_dev_new_est / v_dev_old_est ELSE 1 END;
          ELSE
            v_dev_factor := 1;
          END IF;
          v_dev_factor := LEAST(GREATEST(v_dev_factor, 0.01), 1.0);

          IF jsonb_typeof(v_dev_old_bd) = 'array' THEN
            FOR v_entry IN SELECT * FROM jsonb_array_elements(v_dev_old_bd) LOOP
              v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
              v_entry_cost := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
              IF v_entry_model ~* v_codex_pat AND v_pricing ? v_entry_model THEN
                v_new_entry_cost := round(v_entry_cost * v_dev_factor, 6);
                v_dev_new_bd := v_dev_new_bd || jsonb_build_array(jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_new_entry_cost)));
              ELSE
                v_dev_new_bd := v_dev_new_bd || jsonb_build_array(v_entry);
              END IF;
            END LOOP;
          END IF;

          SELECT COALESCE(SUM((e ->> 'cost_usd')::numeric), 0) INTO v_dev_new_cost
          FROM jsonb_array_elements(v_dev_new_bd) e;
          v_dev_new_cost := round(v_dev_new_cost, 4);
          v_dev_eff_cache := LEAST(v_dev.cache_read_tokens, v_dev.input_tokens);
          v_dev_new_total := COALESCE(v_dev.input_tokens, 0)
            + COALESCE(v_dev.output_tokens, 0)
            + COALESCE(v_dev.cache_creation_tokens, 0)
            + COALESCE(v_dev_eff_cache, 0);

          UPDATE public.device_usage
          SET cost_usd          = v_dev_new_cost,
              cache_read_tokens = v_dev_eff_cache,
              total_tokens      = v_dev_new_total,
              model_breakdown   = v_dev_new_bd,
              collector_meta    = COALESCE(collector_meta, '{}'::jsonb)
                || jsonb_build_object('repair_v3_codex_only', 'true',
                     'cost_before_v3', v_dev.cost_usd,
                     'total_tokens_before_v3', v_dev.total_tokens,
                     'cache_read_before_v3', v_dev.cache_read_tokens),
              updated_at = now()
          WHERE id = v_dev.id;
        END;
      END LOOP;

      -- Reconcile rounding drift on the most recent device row so the device
      -- sums match the daily totals exactly.
      WITH summed AS (
        SELECT SUM(cost_usd) AS s_cost,
               SUM(cache_read_tokens) AS s_cache,
               SUM(total_tokens) AS s_total
        FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
      ),
      last_dev AS (
        SELECT id FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
        ORDER BY updated_at DESC, id DESC LIMIT 1
      )
      UPDATE public.device_usage du
      SET cost_usd          = du.cost_usd          + (v_corrected_cost - (SELECT s_cost  FROM summed)),
          cache_read_tokens = du.cache_read_tokens + (v_eff_cache_read - (SELECT s_cache FROM summed))::bigint,
          total_tokens      = du.total_tokens      + (v_new_total_tokens - (SELECT s_total FROM summed))::bigint
      WHERE du.id = (SELECT id FROM last_dev)
        AND EXISTS (SELECT 1 FROM summed s WHERE s.s_cost IS NOT NULL);

      INSERT INTO public.corrections_log (user_id, date, table_name, reason, previous_values, new_values)
      VALUES (v_row.user_id, v_row.date, 'daily_usage', 'repair_v3_codex_only_2026_05_07',
        jsonb_build_object('cost_usd', v_row.cost_usd, 'cache_read_tokens', v_row.cache_read_tokens, 'total_tokens', v_row.total_tokens, 'model_breakdown', v_old_breakdown, 'collector_meta', v_row.collector_meta),
        jsonb_build_object('cost_usd', v_corrected_cost, 'cache_read_tokens', v_eff_cache_read, 'total_tokens', v_new_total_tokens, 'model_breakdown', v_new_breakdown, 'codex_factor', v_codex_factor, 'note', 'Codex entries scaled, Claude entries left untouched.'));

      v_repaired_count := v_repaired_count + 1;
      v_total_delta := v_total_delta + (v_row.cost_usd - v_corrected_cost);

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'v3 repair failed for daily_usage id=% user=% date=%: % / %',
        v_row.id, v_row.user_id, v_row.date, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'repair_v3_codex_only_2026_05_07: repaired=% failed=% total_cost_delta_usd=%',
    v_repaired_count, v_failed_count, v_total_delta;
END
$repair$;

DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_daily;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_daily failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_weekly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_weekly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_monthly;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_monthly failed: %', SQLERRM; END $$;
DO $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_all_time;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'refresh leaderboard_all_time failed: %', SQLERRM; END $$;
