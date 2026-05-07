-- Repair legacy Codex aggregation inflation
--
-- Older Codex aggregation rows (collector_meta IS NULL) double-counted cached
-- input tokens: cache_read_tokens were added on top of the full input_tokens,
-- and the cost was priced as if cache reads were uncached input. This inflated
-- cost_usd by 5-50x on heavy-cache days.
--
-- This migration re-classifies these rows under "cache is a subset of input"
-- semantics (the correct OpenAI / Anthropic convention), rescales
-- model_breakdown[*].cost_usd proportionally using a hard-coded per-token
-- pricing table, mirrors the correction onto device_usage, and writes one
-- corrections_log row per affected daily_usage row.
--
-- Properties:
--   - Idempotent: rows already tagged with collector_meta->>'repair' =
--     'legacy_codex_inflation_repair_2026_05' are skipped.
--   - Per-row failures are caught, logged via RAISE NOTICE, and do not abort
--     the migration.
--   - Native-collector rows (collector_meta IS NOT NULL) are untouched.
--   - device_usage cascade only fires when matching device rows exist.

DO $repair$
DECLARE
  v_pricing  jsonb;
  v_reason   text := 'legacy_codex_inflation_repair_2026_05';
  v_row      record;
  v_dev      record;

  -- Per-row working state for the daily_usage update
  v_eff_cache_read    bigint;
  v_eff_input         bigint;
  v_old_cost_est      numeric;
  v_new_cost_est      numeric;
  v_correction_factor numeric;
  v_old_breakdown     jsonb;
  v_new_breakdown     jsonb;
  v_corrected_cost    numeric;
  v_entry             jsonb;
  v_entry_model       text;
  v_entry_cost        numeric;
  v_entry_price       jsonb;
  v_new_entry_cost    numeric;
  v_new_entries       jsonb;

  -- Daily totals (used for proportional device cascade)
  v_daily_old_input        bigint;
  v_daily_old_cache_read   bigint;
  v_daily_old_cost         numeric;
  v_daily_old_total        bigint;
  v_daily_new_input        bigint;
  v_daily_new_cache_read   bigint;
  v_daily_new_cost         numeric;
  v_daily_new_total        bigint;

  -- Device cascade per-device working state
  v_dev_share_input    bigint;
  v_dev_share_cache    bigint;
  v_dev_share_cost     numeric;
  v_dev_share_total    bigint;
  v_dev_old_breakdown  jsonb;
  v_dev_new_breakdown  jsonb;
  v_dev_factor         numeric;
  v_dev_factor_input   numeric;
  v_dev_factor_cache   numeric;

  v_repaired_count int := 0;
  v_skipped_count  int := 0;
  v_failed_count   int := 0;
  v_total_delta    numeric := 0;

  -- Tracks user_ids whose daily_usage was lowered by this migration so we
  -- can recompute the cached user_levels rows after the LOOP. Without this,
  -- user_levels.level (read directly by leaderboard + CLI dashboard) keeps
  -- the pre-repair value until the user pushes usage again.
  v_affected_users uuid[] := ARRAY[]::uuid[];
  v_uid            uuid;
BEGIN
  ----------------------------------------------------------------------------
  -- Inline pricing table (per token, USD).
  -- Mirrors packages/cli/src/lib/codex-native.ts:79-98 and
  -- packages/cli/src/lib/ccusage.ts. Keys are matched against
  -- model_breakdown[*].model with case-insensitive equality (lower()).
  -- Models not present in this table fall through and their breakdown
  -- entry is left untouched (and excluded from the rescale numerator and
  -- denominator).
  ----------------------------------------------------------------------------
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
    'gpt-5-nano-2025-08-07',    jsonb_build_object('input', 0.00000005, 'output', 0.0000004,  'cache_read', 0.000000005),
    'claude-opus-4-7',          jsonb_build_object('input', 0.000015,   'output', 0.000075,   'cache_read', 0.0000015,  'cache_creation', 0.00001875),
    'claude-opus-4-6',          jsonb_build_object('input', 0.000015,   'output', 0.000075,   'cache_read', 0.0000015,  'cache_creation', 0.00001875),
    'claude-sonnet-4-6',        jsonb_build_object('input', 0.000003,   'output', 0.000015,   'cache_read', 0.0000003,  'cache_creation', 0.00000375),
    'claude-haiku-4-5-20251001',jsonb_build_object('input', 0.000001,   'output', 0.000005,   'cache_read', 0.0000001,  'cache_creation', 0.00000125)
  );

  ----------------------------------------------------------------------------
  -- Iterate over candidate daily_usage rows.
  -- Filter mirrors the bug signature exactly:
  --   collector_meta IS NULL                  (legacy aggregation)
  --   cache_read_tokens > input_tokens        (only inflated rows)
  --   date < CURRENT_DATE                     (don't touch in-flight today)
  ----------------------------------------------------------------------------
  FOR v_row IN
    SELECT *
    FROM public.daily_usage
    WHERE collector_meta IS NULL
      AND cache_read_tokens > input_tokens
      AND date < CURRENT_DATE
    ORDER BY date, user_id
  LOOP
    BEGIN
      -- Idempotency guard: if this row has already been repaired in a prior
      -- run (collector_meta would be non-NULL, so the outer filter already
      -- excludes it), this is a defense-in-depth check in case the filter
      -- changes.
      IF v_row.collector_meta IS NOT NULL
         AND v_row.collector_meta ->> 'repair' = v_reason THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- 1. Corrected token split (inclusive-cache).
      v_eff_cache_read := LEAST(v_row.cache_read_tokens, v_row.input_tokens);
      v_eff_input      := v_row.input_tokens - v_eff_cache_read;

      -- 2. Compute cost estimates from the inline pricing table.
      --
      --    The bug in the legacy collector wasn't a mis-priced bucket — the
      --    pricing rates were correct. The bug was that the *token counts*
      --    were inflated: forked / replayed Codex sessions double-counted
      --    cumulative input and cumulative cached_input, then both buckets
      --    were stored separately on daily_usage. So cache_read appeared as
      --    a separate bucket on top of input, even though cached_input is
      --    supposed to be a subset of input.
      --
      --    Old estimate: prices the (inflated) buckets exactly as the
      --      collector did at write time — cache_read at CACHE_READ rate,
      --      input at INPUT rate, output at OUTPUT rate. This estimate
      --      should reproduce daily_usage.cost_usd to within rounding.
      --    New estimate: clamps cache_read to input (inclusive subset) and
      --      reduces input by that amount, then prices each bucket at its
      --      correct rate.
      --    correction_factor = new_estimate / old_estimate, applied to the
      --      stored cost_usd to keep model_breakdown precision intact.
      --
      --    Estimates are computed by walking model_breakdown and weighting
      --    each known model by its share of model_breakdown[*].cost_usd. We
      --    only need the *ratio*, so we approximate per-model token volume
      --    by the model's cost share of the row's totals.
      --
      --    Models not in the pricing table are excluded from BOTH numerator
      --    and denominator (and their breakdown entry is left untouched).
      v_old_breakdown := COALESCE(v_row.model_breakdown, '[]'::jsonb);

      v_old_cost_est := 0;
      v_new_cost_est := 0;

      IF jsonb_typeof(v_old_breakdown) = 'array' AND jsonb_array_length(v_old_breakdown) > 0 THEN
        -- Sum of cost_usd across known-model breakdown entries (used to
        -- proportionally allocate row tokens to each model).
        DECLARE
          v_known_cost_total numeric := 0;
          v_known_share      numeric;
          v_share_input      numeric;
          v_share_output     numeric;
          v_share_cache_read numeric;
          v_share_cache_crea numeric;
        BEGIN
          FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
            v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
            v_entry_cost  := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
            IF v_pricing ? v_entry_model THEN
              v_known_cost_total := v_known_cost_total + v_entry_cost;
            END IF;
          END LOOP;

          IF v_known_cost_total > 0 THEN
            FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
              v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
              v_entry_cost  := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
              IF NOT (v_pricing ? v_entry_model) THEN
                CONTINUE;
              END IF;
              v_entry_price := v_pricing -> v_entry_model;
              v_known_share := v_entry_cost / v_known_cost_total;

              -- Allocate the row's token buckets to this model by its cost
              -- share (best available proxy when per-model token splits are
              -- not stored).
              v_share_input      := v_row.input_tokens          * v_known_share;
              v_share_output     := v_row.output_tokens         * v_known_share;
              v_share_cache_read := v_row.cache_read_tokens     * v_known_share;
              v_share_cache_crea := COALESCE(v_row.cache_creation_tokens, 0) * v_known_share;

              -- Old (buggy) pricing: each bucket at its correct rate, but
              -- against INFLATED token counts (cache_read + input were
              -- double-counted). Reproduces the stored cost_usd ~exactly.
              v_old_cost_est := v_old_cost_est
                + v_share_input      * (v_entry_price ->> 'input')::numeric
                + v_share_output     * (v_entry_price ->> 'output')::numeric
                + v_share_cache_read * COALESCE((v_entry_price ->> 'cache_read')::numeric,
                                                (v_entry_price ->> 'input')::numeric)
                + v_share_cache_crea * COALESCE((v_entry_price ->> 'cache_creation')::numeric, 0);

              -- New (correct) pricing: cache_read at CACHE_READ rate, only
              -- the remaining input portion at INPUT rate.
              v_new_cost_est := v_new_cost_est
                + (v_share_input - LEAST(v_share_cache_read, v_share_input))
                                   * (v_entry_price ->> 'input')::numeric
                + v_share_output   * (v_entry_price ->> 'output')::numeric
                + LEAST(v_share_cache_read, v_share_input)
                                   * COALESCE((v_entry_price ->> 'cache_read')::numeric,
                                              (v_entry_price ->> 'input')::numeric)
                + v_share_cache_crea * COALESCE((v_entry_price ->> 'cache_creation')::numeric, 0);
            END LOOP;
          END IF;
        END;
      END IF;

      -- 3. Correction factor and rescaled model_breakdown.
      IF v_old_cost_est > 0 THEN
        v_correction_factor := v_new_cost_est / v_old_cost_est;
      ELSE
        -- Fallback: no usable breakdown entries. Approximate the correction
        -- factor from the overall token reclassification using a neutral
        -- "input vs cache_read" ratio of 10x (the mid-point of the observed
        -- 5-50x inflation range). This keeps the row's cost directionally
        -- correct without fabricating a per-model split.
        v_correction_factor := GREATEST(
          0.05,
          (v_eff_input + v_eff_cache_read * 0.1)::numeric
            / NULLIF((v_row.input_tokens + v_row.cache_read_tokens)::numeric, 0)
        );
      END IF;

      -- Defensive clamp: never *increase* cost via this repair, and never
      -- drop below 1% of the original.
      IF v_correction_factor IS NULL OR v_correction_factor <= 0 THEN
        v_correction_factor := 0.05;
      END IF;
      v_correction_factor := LEAST(v_correction_factor, 1.0);
      v_correction_factor := GREATEST(v_correction_factor, 0.01);

      v_new_entries := '[]'::jsonb;
      IF jsonb_typeof(v_old_breakdown) = 'array' THEN
        FOR v_entry IN SELECT * FROM jsonb_array_elements(v_old_breakdown) LOOP
          v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
          v_entry_cost  := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
          IF v_pricing ? v_entry_model THEN
            v_new_entry_cost := round(v_entry_cost * v_correction_factor, 6);
            v_new_entries := v_new_entries
              || jsonb_build_array(jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_new_entry_cost)));
          ELSE
            -- Unknown model: leave entry untouched (per spec).
            v_new_entries := v_new_entries || jsonb_build_array(v_entry);
          END IF;
        END LOOP;
      END IF;
      v_new_breakdown := v_new_entries;

      -- 4. Corrected daily cost (rounded to 4 dp to match column precision).
      v_corrected_cost := round(v_row.cost_usd * v_correction_factor, 4);

      -- Snapshot daily totals for the device cascade BEFORE we update the row.
      -- total_tokens is recomputed from the corrected buckets so lifetime
      -- token totals (get_user_usage_totals etc.) shed the phantom cache.
      v_daily_old_input      := v_row.input_tokens;
      v_daily_old_cache_read := v_row.cache_read_tokens;
      v_daily_old_cost       := v_row.cost_usd;
      v_daily_old_total      := v_row.total_tokens;
      v_daily_new_input      := v_eff_input;
      v_daily_new_cache_read := v_eff_cache_read;
      v_daily_new_cost       := v_corrected_cost;
      v_daily_new_total      := v_eff_input
                                + v_row.output_tokens
                                + v_eff_cache_read
                                + COALESCE(v_row.cache_creation_tokens, 0);

      -- 5. Update daily_usage.
      UPDATE public.daily_usage
      SET cost_usd          = v_corrected_cost,
          input_tokens      = v_eff_input,
          cache_read_tokens = v_eff_cache_read,
          total_tokens      = v_daily_new_total,
          model_breakdown   = v_new_breakdown,
          is_verified       = TRUE,
          collector_meta    = jsonb_build_object(
            'repair',                    v_reason,
            'previous_cost_usd',         v_row.cost_usd,
            'previous_input_tokens',     v_row.input_tokens,
            'previous_cache_read_tokens',v_row.cache_read_tokens,
            'previous_total_tokens',     v_row.total_tokens,
            'repaired_at',               now()
          ),
          updated_at        = now()
      WHERE id = v_row.id;

      -- 6. Mirror onto every device_usage row for the same (user_id, date).
      --    Proportional split: each device's share of (input, cache_read,
      --    cost) is preserved, then rescaled so the sum across devices
      --    equals the corrected daily totals.
      FOR v_dev IN
        SELECT *
        FROM public.device_usage
        WHERE user_id = v_row.user_id
          AND date    = v_row.date
      LOOP
        -- Per-bucket scaling factors from old daily totals → new daily totals.
        v_dev_factor_input := CASE
          WHEN v_daily_old_input > 0
            THEN v_daily_new_input::numeric / v_daily_old_input::numeric
          ELSE 0
        END;
        v_dev_factor_cache := CASE
          WHEN v_daily_old_cache_read > 0
            THEN v_daily_new_cache_read::numeric / v_daily_old_cache_read::numeric
          ELSE 0
        END;
        v_dev_factor := CASE
          WHEN v_daily_old_cost > 0
            THEN v_daily_new_cost / v_daily_old_cost
          ELSE 1
        END;

        v_dev_share_input := floor(v_dev.input_tokens      * v_dev_factor_input)::bigint;
        v_dev_share_cache := floor(v_dev.cache_read_tokens * v_dev_factor_cache)::bigint;
        v_dev_share_cost  := round(v_dev.cost_usd          * v_dev_factor, 4);
        -- Recompute device total_tokens from the corrected buckets so the
        -- column stays consistent with input/cache_read/output/cache_creation.
        v_dev_share_total := v_dev_share_input
                             + v_dev.output_tokens
                             + v_dev_share_cache
                             + COALESCE(v_dev.cache_creation_tokens, 0);

        -- Rescale device's model_breakdown the same way.
        v_dev_old_breakdown := COALESCE(v_dev.model_breakdown, '[]'::jsonb);
        v_dev_new_breakdown := '[]'::jsonb;
        IF jsonb_typeof(v_dev_old_breakdown) = 'array' THEN
          FOR v_entry IN SELECT * FROM jsonb_array_elements(v_dev_old_breakdown) LOOP
            v_entry_model := lower(COALESCE(v_entry ->> 'model', ''));
            v_entry_cost  := COALESCE((v_entry ->> 'cost_usd')::numeric, 0);
            IF v_pricing ? v_entry_model THEN
              v_new_entry_cost := round(v_entry_cost * v_dev_factor, 6);
              v_dev_new_breakdown := v_dev_new_breakdown
                || jsonb_build_array(jsonb_set(v_entry, '{cost_usd}', to_jsonb(v_new_entry_cost)));
            ELSE
              v_dev_new_breakdown := v_dev_new_breakdown || jsonb_build_array(v_entry);
            END IF;
          END LOOP;
        END IF;

        UPDATE public.device_usage
        SET cost_usd          = v_dev_share_cost,
            input_tokens      = v_dev_share_input,
            cache_read_tokens = v_dev_share_cache,
            total_tokens      = v_dev_share_total,
            model_breakdown   = v_dev_new_breakdown,
            collector_meta    = jsonb_build_object(
              'repair',                    v_reason,
              'previous_cost_usd',         v_dev.cost_usd,
              'previous_input_tokens',     v_dev.input_tokens,
              'previous_cache_read_tokens',v_dev.cache_read_tokens,
              'previous_total_tokens',     v_dev.total_tokens,
              'repaired_at',               now()
            ),
            updated_at        = now()
        WHERE id = v_dev.id;

        -- One corrections_log entry per affected device row.
        INSERT INTO public.corrections_log
          (user_id, date, table_name, reason, previous_values, new_values)
        VALUES (
          v_dev.user_id,
          v_dev.date,
          'device_usage',
          v_reason,
          jsonb_build_object(
            'id',                v_dev.id,
            'device_id',         v_dev.device_id,
            'cost_usd',          v_dev.cost_usd,
            'input_tokens',      v_dev.input_tokens,
            'cache_read_tokens', v_dev.cache_read_tokens,
            'total_tokens',      v_dev.total_tokens,
            'model_breakdown',   v_dev_old_breakdown
          ),
          jsonb_build_object(
            'cost_usd',          v_dev_share_cost,
            'input_tokens',      v_dev_share_input,
            'cache_read_tokens', v_dev_share_cache,
            'total_tokens',      v_dev_share_total,
            'model_breakdown',   v_dev_new_breakdown
          )
        );
      END LOOP;

      -- Reconcile rounding drift on the LAST device row so the sum across
      -- devices exactly equals the corrected daily row. (Floor rounding on
      -- token splits and 4dp on cost can leave sub-unit gaps.)
      IF EXISTS (
        SELECT 1 FROM public.device_usage
        WHERE user_id = v_row.user_id AND date = v_row.date
      ) THEN
        WITH summed AS (
          SELECT
            SUM(cost_usd)          AS s_cost,
            SUM(input_tokens)      AS s_input,
            SUM(cache_read_tokens) AS s_cache,
            SUM(total_tokens)      AS s_total
          FROM public.device_usage
          WHERE user_id = v_row.user_id AND date = v_row.date
        ),
        last_dev AS (
          SELECT id
          FROM public.device_usage
          WHERE user_id = v_row.user_id AND date = v_row.date
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        )
        UPDATE public.device_usage du
        SET cost_usd          = du.cost_usd          + (v_daily_new_cost      - (SELECT s_cost  FROM summed)),
            input_tokens      = du.input_tokens      + (v_daily_new_input     - (SELECT s_input FROM summed)),
            cache_read_tokens = du.cache_read_tokens + (v_daily_new_cache_read- (SELECT s_cache FROM summed)),
            total_tokens      = du.total_tokens      + (v_daily_new_total     - (SELECT s_total FROM summed))
        WHERE du.id = (SELECT id FROM last_dev);
      END IF;

      -- 7. corrections_log entry for the daily_usage row itself.
      INSERT INTO public.corrections_log
        (user_id, date, table_name, reason, previous_values, new_values)
      VALUES (
        v_row.user_id,
        v_row.date,
        'daily_usage',
        v_reason,
        jsonb_build_object(
          'id',                v_row.id,
          'cost_usd',          v_row.cost_usd,
          'input_tokens',      v_row.input_tokens,
          'cache_read_tokens', v_row.cache_read_tokens,
          'total_tokens',      v_row.total_tokens,
          'model_breakdown',   v_old_breakdown,
          'is_verified',       v_row.is_verified,
          'collector_meta',    v_row.collector_meta
        ),
        jsonb_build_object(
          'cost_usd',          v_corrected_cost,
          'input_tokens',      v_eff_input,
          'cache_read_tokens', v_eff_cache_read,
          'total_tokens',      v_daily_new_total,
          'model_breakdown',   v_new_breakdown,
          'is_verified',       TRUE,
          'correction_factor', v_correction_factor
        )
      );

      v_repaired_count := v_repaired_count + 1;
      v_total_delta    := v_total_delta + (v_row.cost_usd - v_corrected_cost);

      -- Track the user so we can recompute their cached level after the LOOP.
      v_affected_users := array_append(v_affected_users, v_row.user_id);

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'legacy_codex_inflation_repair: failed for daily_usage id=% user=% date=%: % / %',
        v_row.id, v_row.user_id, v_row.date, SQLSTATE, SQLERRM;
      -- Continue with the next row.
    END;
  END LOOP;

  RAISE NOTICE 'legacy_codex_inflation_repair_2026_05: repaired=% skipped=% failed=% total_cost_delta_usd=%',
    v_repaired_count, v_skipped_count, v_failed_count, v_total_delta;

  -- Recompute cached user_levels for every user whose daily_usage we lowered.
  -- recalculate_user_level reads daily_usage directly, so without this step
  -- the leaderboard + CLI dashboard keep showing pre-repair levels until the
  -- user pushes usage again (which retriggers the on-insert recalc).
  FOR v_uid IN SELECT DISTINCT unnest(v_affected_users) LOOP
    BEGIN
      PERFORM public.recalculate_user_level(v_uid);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'legacy_codex_inflation_repair: recalculate_user_level failed for user=%: % / %',
        v_uid, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$repair$;

-- Refresh leaderboard materialized views so the corrected totals propagate.
-- Wrapped in DO blocks so a CONCURRENTLY refresh failure (e.g. view does not
-- exist in some environments) does not abort the migration.
DO $$ BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_daily;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refresh leaderboard_daily failed: %', SQLERRM;
END $$;

DO $$ BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_weekly;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refresh leaderboard_weekly failed: %', SQLERRM;
END $$;

DO $$ BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_monthly;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refresh leaderboard_monthly failed: %', SQLERRM;
END $$;

DO $$ BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_all_time;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refresh leaderboard_all_time failed: %', SQLERRM;
END $$;
