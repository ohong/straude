-- Device dedupe at submit time.
--
-- One machine can appear as two installations (reset config, reinstall, a
-- ccusage data directory synced elsewhere). Both push the same ccusage data, so
-- the per-device sum counts it twice. Hostname quarantine already holds the
-- second installation back, but only the manual repair batch computed overlap,
-- and it required cost_usd and collector to match exactly: a pricing refresh or
-- collector bump broke the proof. ccusage owns tokens and pricing, so token
-- counts alone decide whether two devices hold the same day.

-- Ordered per-agent token counts for one device-day, NULL when it has no rows.
CREATE OR REPLACE FUNCTION public.usage_device_day_token_fingerprint(
  p_user_id UUID,
  p_date DATE,
  p_device_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT jsonb_agg(
    jsonb_build_object(
      'agent', rows.agent,
      'input_tokens', rows.input_tokens,
      'output_tokens', rows.output_tokens,
      'reasoning_output_tokens', rows.reasoning_output_tokens,
      'cache_creation_tokens', rows.cache_creation_tokens,
      'cache_read_tokens', rows.cache_read_tokens,
      'total_tokens', rows.total_tokens
    )
    ORDER BY rows.agent
  )
  FROM public.usage_agent_daily AS rows
  WHERE rows.user_id = p_user_id
    AND rows.date = p_date
    AND rows.device_id = p_device_id;
$function$;

-- The same fingerprint for an incoming submit entry.
CREATE OR REPLACE FUNCTION public.usage_entry_token_fingerprint(p_entry JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT jsonb_agg(
    jsonb_build_object(
      'agent', agent ->> 'agent',
      'input_tokens', (agent ->> 'input_tokens')::BIGINT,
      'output_tokens', (agent ->> 'output_tokens')::BIGINT,
      'reasoning_output_tokens', (agent ->> 'reasoning_output_tokens')::BIGINT,
      'cache_creation_tokens', (agent ->> 'cache_creation_tokens')::BIGINT,
      'cache_read_tokens', (agent ->> 'cache_read_tokens')::BIGINT,
      'total_tokens', (agent ->> 'total_tokens')::BIGINT
    )
    ORDER BY agent ->> 'agent'
  )
  FROM jsonb_array_elements(p_entry -> 'agents') AS agent;
$function$;

-- Compare an incoming date with the other device of a candidate pair, store the
-- evidence on the candidate and act on it. Returns the candidate's resulting
-- status: 'merged' means the pair is one identity now, 'ambiguous' and
-- 'proof_merge' keep the incoming device blocked, and 'kept_separate' means the
-- user's decision stands.
CREATE OR REPLACE FUNCTION public.apply_usage_device_overlap_evidence(
  p_user_id UUID,
  p_candidate_id UUID,
  p_device_ids UUID[],
  p_date DATE,
  p_entry JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_candidate public.usage_device_reconciliation_candidates%ROWTYPE;
  v_incoming UUID;
  v_other UUID;
  v_other_fingerprint JSONB;
  v_identical BOOLEAN;
  v_overlap DATE[];
  v_divergent DATE[];
  v_status TEXT;
BEGIN
  SELECT *
  INTO v_candidate
  FROM public.usage_device_reconciliation_candidates
  WHERE id = p_candidate_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'merged';
  END IF;
  IF v_candidate.status = 'merged' THEN
    RETURN 'merged';
  END IF;

  SELECT candidate_device
  INTO v_incoming
  FROM unnest(ARRAY[v_candidate.device_id_a, v_candidate.device_id_b]) AS candidate_device
  WHERE candidate_device = ANY(p_device_ids)
    OR candidate_device IN (
      SELECT alias.canonical_device_id
      FROM public.usage_installation_aliases AS alias
      WHERE alias.user_id = p_user_id
        AND alias.device_id = ANY(p_device_ids)
    )
  LIMIT 1;
  IF v_incoming IS NULL THEN
    RETURN v_candidate.status;
  END IF;
  v_other := CASE
    WHEN v_incoming = v_candidate.device_id_a THEN v_candidate.device_id_b
    ELSE v_candidate.device_id_a
  END;

  v_other_fingerprint := public.usage_device_day_token_fingerprint(
    p_user_id, p_date, v_other
  );
  IF v_other_fingerprint IS NULL THEN
    RETURN v_candidate.status;
  END IF;
  v_identical := v_other_fingerprint
    IS NOT DISTINCT FROM public.usage_entry_token_fingerprint(p_entry);

  IF v_candidate.status = 'kept_separate' THEN
    -- A user's decision is never merged automatically. Identical data
    -- submitted after it is new evidence, so the pair goes back to review.
    IF NOT v_identical THEN
      RETURN 'kept_separate';
    END IF;
    UPDATE public.usage_device_reconciliation_candidates
    SET status = 'ambiguous',
        resolved_at = NULL,
        overlap_dates = ARRAY[p_date],
        divergent_dates = '{}',
        proof = jsonb_build_object(
          'algorithm', 'token-overlap-at-submit-v1',
          'identical_overlap_count', 1,
          'divergent_overlap_count', 0,
          'reopened_after_kept_separate', true
        )
    WHERE id = p_candidate_id;
    RETURN 'ambiguous';
  END IF;

  v_overlap := array_remove(v_candidate.overlap_dates, p_date);
  v_divergent := array_remove(v_candidate.divergent_dates, p_date);
  IF v_identical THEN
    v_overlap := array_append(v_overlap, p_date);
  ELSE
    v_divergent := array_append(v_divergent, p_date);
  END IF;
  SELECT COALESCE(array_agg(day ORDER BY day), '{}') INTO v_overlap
  FROM unnest(v_overlap) AS day;
  SELECT COALESCE(array_agg(day ORDER BY day), '{}') INTO v_divergent
  FROM unnest(v_divergent) AS day;

  v_status := CASE
    WHEN cardinality(v_overlap) >= 2 AND cardinality(v_divergent) = 0
      THEN 'proof_merge'
    ELSE 'ambiguous'
  END;
  UPDATE public.usage_device_reconciliation_candidates
  SET status = v_status,
      overlap_dates = v_overlap,
      divergent_dates = v_divergent,
      proof = jsonb_build_object(
        'algorithm', 'token-overlap-at-submit-v1',
        'identical_overlap_count', cardinality(v_overlap),
        'divergent_overlap_count', cardinality(v_divergent)
      )
  WHERE id = p_candidate_id;

  IF v_status = 'proof_merge' THEN
    BEGIN
      PERFORM public.resolve_usage_device_candidate(
        p_user_id, p_candidate_id, 'merge'
      );
      RETURN 'merged';
    EXCEPTION
      -- Stored rows on a date this candidate has not seen can still diverge.
      -- Leave the pair for review instead of failing the submit.
      WHEN SQLSTATE '23000' OR SQLSTATE 'P0002' THEN
        UPDATE public.usage_device_reconciliation_candidates
        SET status = 'ambiguous'
        WHERE id = p_candidate_id;
        RETURN 'ambiguous';
    END;
  END IF;
  RETURN v_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.usage_device_day_token_fingerprint(UUID, DATE, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.usage_entry_token_fingerprint(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_usage_device_overlap_evidence(UUID, UUID, UUID[], DATE, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_device_day_token_fingerprint(UUID, DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.usage_entry_token_fingerprint(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_usage_device_overlap_evidence(UUID, UUID, UUID[], DATE, JSONB) TO service_role;

-- Merging compares token counts only. The canonical device keeps its own prices
-- and collector, and the duplicate rows are dropped so the day counts once.
CREATE OR REPLACE FUNCTION public.resolve_usage_device_candidate(
  p_user_id UUID,
  p_candidate_id UUID,
  p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_candidate public.usage_device_reconciliation_candidates%ROWTYPE;
  v_canonical UUID;
  v_other UUID;
  v_batch UUID;
  v_decision_id UUID;
  v_owned_batch BOOLEAN := false;
BEGIN
  -- Reconciliation can nest discovery and resolution. Take one maintenance
  -- lock before row locks to avoid inversions; ordinary syncs do not take it.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('usage-reconciliation', 0)
  );
  IF p_decision NOT IN ('merge', 'keep_separate') THEN
    RAISE EXCEPTION 'invalid reconciliation decision' USING ERRCODE = '22023';
  END IF;


  SELECT *
  INTO v_candidate
  FROM public.usage_device_reconciliation_candidates
  WHERE id = p_candidate_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_candidate.status NOT IN ('proof_merge', 'ambiguous') THEN
    RAISE EXCEPTION 'candidate not found or already resolved' USING ERRCODE = 'P0002';
  END IF;

  IF p_decision = 'keep_separate' THEN
    UPDATE public.usage_device_reconciliation_candidates
    SET status = 'kept_separate', resolved_at = now()
    WHERE id = p_candidate_id;
    INSERT INTO public.usage_device_reconciliation_decisions (
      candidate_id, user_id, decision
    ) VALUES (p_candidate_id, p_user_id, p_decision);
    RETURN jsonb_build_object(
      'id', p_candidate_id, 'status', 'kept_separate', 'decision', p_decision
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usage_installation_aliases
    WHERE user_id = p_user_id
      AND device_id IN (v_candidate.device_id_a, v_candidate.device_id_b)
      AND canonical_device_id NOT IN (v_candidate.device_id_a, v_candidate.device_id_b)
  ) THEN
    RAISE EXCEPTION 'candidate identity already resolved' USING ERRCODE = 'P0002';
  END IF;

  SELECT alias.canonical_device_id
  INTO v_canonical
  FROM public.usage_installation_aliases AS alias
  WHERE alias.user_id = p_user_id
    AND alias.canonical_device_id IN (v_candidate.device_id_a, v_candidate.device_id_b)
  ORDER BY alias.created_at, alias.canonical_device_id
  LIMIT 1;
  v_canonical := COALESCE(v_canonical, v_candidate.device_id_a);
  v_other := CASE
    WHEN v_canonical = v_candidate.device_id_a
      THEN v_candidate.device_id_b
    ELSE v_candidate.device_id_a
  END;

  -- Pending candidates quarantine both devices from new submissions. Lock the
  -- existing rows before checking proof, and reject before changing any alias
  -- or ledger: one identity cannot retain divergent copies of the same date.
  PERFORM 1 FROM public.usage_agent_daily
  WHERE user_id = p_user_id AND device_id IN (v_canonical, v_other)
  ORDER BY date, device_id, agent FOR UPDATE;
  PERFORM 1 FROM public.device_usage
  WHERE user_id = p_user_id AND device_id IN (v_canonical, v_other)
  ORDER BY date, device_id FOR UPDATE;

  -- Token counts decide whether two devices hold the same usage. Prices and
  -- collector metadata may differ between installations of the same data.
  IF EXISTS (
    SELECT 1
    FROM public.device_usage AS canonical
    JOIN public.device_usage AS other
      ON other.user_id = canonical.user_id AND other.date = canonical.date
      AND other.device_id = v_other
    WHERE canonical.user_id = p_user_id AND canonical.device_id = v_canonical
      AND (
        public.usage_device_day_token_fingerprint(p_user_id, canonical.date, v_canonical)
          IS DISTINCT FROM
        public.usage_device_day_token_fingerprint(p_user_id, canonical.date, v_other)
        OR public.usage_device_day_token_fingerprint(p_user_id, canonical.date, v_canonical) IS NULL
        OR jsonb_build_array(
          canonical.input_tokens, canonical.output_tokens,
          canonical.reasoning_output_tokens, canonical.cache_creation_tokens,
          canonical.cache_read_tokens, canonical.total_tokens
        ) IS DISTINCT FROM jsonb_build_array(
          other.input_tokens, other.output_tokens,
          other.reasoning_output_tokens, other.cache_creation_tokens,
          other.cache_read_tokens, other.total_tokens
        )
      )
  ) THEN
    RAISE EXCEPTION 'Devices have divergent overlapping usage; keep them separate'
      USING ERRCODE = '23000';
  END IF;

  v_batch := NULLIF(
    pg_catalog.current_setting('straude.usage_repair_batch_id', true), ''
  )::UUID;
  IF v_batch IS NULL THEN
    INSERT INTO public.usage_repair_batches(reason, status)
    VALUES ('manual device reconciliation ' || p_candidate_id::TEXT, 'running')
    RETURNING id INTO v_batch;
    v_owned_batch := true;
  END IF;

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  VALUES (
    v_batch,
    p_user_id,
    'device reconciliation state',
    'usage_device_reconciliation_candidates',
    jsonb_build_object('id', v_candidate.id),
    to_jsonb(v_candidate)
  );

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  SELECT
    v_batch, p_user_id, 'manual device merge', 'usage_installation_aliases',
    jsonb_build_object('device_id', alias.device_id), to_jsonb(alias)
  FROM public.usage_installation_aliases AS alias
  WHERE alias.user_id = p_user_id
    AND alias.canonical_device_id IN (v_candidate.device_id_a, v_candidate.device_id_b);

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  SELECT
    v_batch, p_user_id, 'manual device merge', 'usage_agent_daily',
    jsonb_build_object(
      'user_id', rows.user_id, 'date', rows.date,
      'device_id', rows.device_id, 'agent', rows.agent
    ),
    to_jsonb(rows)
  FROM public.usage_agent_daily AS rows
  WHERE rows.user_id = p_user_id
    AND rows.device_id IN (v_candidate.device_id_a, v_candidate.device_id_b);

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  SELECT
    v_batch, p_user_id, 'manual device merge', 'device_usage',
    jsonb_build_object(
      'user_id', rows.user_id, 'date', rows.date, 'device_id', rows.device_id
    ),
    to_jsonb(rows)
  FROM public.device_usage AS rows
  WHERE rows.user_id = p_user_id
    AND rows.device_id IN (v_candidate.device_id_a, v_candidate.device_id_b);

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  SELECT
    v_batch, p_user_id, 'recompute daily aggregate', 'daily_usage',
    jsonb_build_object('user_id', daily.user_id, 'date', daily.date),
    to_jsonb(daily)
  FROM public.daily_usage AS daily
  WHERE daily.user_id = p_user_id
    AND daily.date IN (
      SELECT date FROM public.device_usage
      WHERE user_id = p_user_id
        AND device_id IN (v_candidate.device_id_a, v_candidate.device_id_b)
    );

  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, before_row
  )
  SELECT
    v_batch, p_user_id, 'generated post title', 'posts',
    jsonb_build_object('id', post.id), to_jsonb(post)
  FROM public.posts AS post
  JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
  WHERE daily.user_id = p_user_id
    AND post.usage_generated_title
    AND daily.date IN (
      SELECT date FROM public.device_usage
      WHERE user_id = p_user_id
        AND device_id IN (v_candidate.device_id_a, v_candidate.device_id_b)
    );

  UPDATE public.usage_installation_aliases
  SET canonical_device_id = v_canonical, updated_at = now()
  WHERE user_id = p_user_id
    AND canonical_device_id IN (v_candidate.device_id_a, v_candidate.device_id_b);

  DELETE FROM public.usage_agent_daily AS duplicate
  USING public.usage_agent_daily AS canonical
  WHERE duplicate.user_id = p_user_id
    AND duplicate.device_id = v_other
    AND canonical.user_id = duplicate.user_id
    AND canonical.date = duplicate.date
    AND canonical.device_id = v_canonical
    AND canonical.agent = duplicate.agent
    AND canonical.input_tokens = duplicate.input_tokens
    AND canonical.output_tokens = duplicate.output_tokens
    AND canonical.reasoning_output_tokens = duplicate.reasoning_output_tokens
    AND canonical.cache_creation_tokens = duplicate.cache_creation_tokens
    AND canonical.cache_read_tokens = duplicate.cache_read_tokens
    AND canonical.total_tokens = duplicate.total_tokens;
  UPDATE public.usage_agent_daily AS rows
  SET device_id = v_canonical, updated_at = now()
  WHERE rows.user_id = p_user_id
    AND rows.device_id = v_other
    AND NOT EXISTS (
      SELECT 1
      FROM public.usage_agent_daily AS canonical
      WHERE canonical.user_id = rows.user_id
        AND canonical.date = rows.date
        AND canonical.device_id = v_canonical
        AND canonical.agent = rows.agent
    );

  DELETE FROM public.device_usage AS duplicate
  USING public.device_usage AS canonical
  WHERE duplicate.user_id = p_user_id
    AND duplicate.device_id = v_other
    AND canonical.user_id = duplicate.user_id
    AND canonical.date = duplicate.date
    AND canonical.device_id = v_canonical
    AND canonical.input_tokens = duplicate.input_tokens
    AND canonical.output_tokens = duplicate.output_tokens
    AND canonical.reasoning_output_tokens = duplicate.reasoning_output_tokens
    AND canonical.cache_creation_tokens = duplicate.cache_creation_tokens
    AND canonical.cache_read_tokens = duplicate.cache_read_tokens
    AND canonical.total_tokens = duplicate.total_tokens;
  UPDATE public.device_usage AS rows
  SET device_id = v_canonical, updated_at = now()
  WHERE rows.user_id = p_user_id
    AND rows.device_id = v_other
    AND NOT EXISTS (
      SELECT 1
      FROM public.device_usage AS canonical
      WHERE canonical.user_id = rows.user_id
        AND canonical.date = rows.date
        AND canonical.device_id = v_canonical
    );

  WITH totals AS (
    SELECT
      user_id, date,
      sum(cost_usd) AS cost_usd,
      sum(input_tokens) AS input_tokens,
      sum(output_tokens) AS output_tokens,
      sum(reasoning_output_tokens) AS reasoning_output_tokens,
      sum(cache_creation_tokens) AS cache_creation_tokens,
      sum(cache_read_tokens) AS cache_read_tokens,
      sum(total_tokens) AS total_tokens,
      sum(session_count)::INTEGER AS session_count,
      bool_or(COALESCE((collector_meta ->> 'is_verified')::BOOLEAN, false))
        AS collector_verified
    FROM public.device_usage
    WHERE user_id = p_user_id
    GROUP BY user_id, date
  ),
  model_names AS (
    SELECT
      rows.user_id,
      rows.date,
      COALESCE(jsonb_agg(DISTINCT model ORDER BY model), '[]'::JSONB) AS models
    FROM public.device_usage AS rows
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(rows.models, '[]'::JSONB)
    ) AS model
    WHERE rows.user_id = p_user_id
    GROUP BY rows.user_id, rows.date
  ),
  model_costs AS (
    SELECT
      costs.user_id,
      costs.date,
      COALESCE(jsonb_agg(
        jsonb_build_object('model', costs.model, 'cost_usd', costs.cost_usd)
        ORDER BY costs.model
      ), '[]'::JSONB) AS model_breakdown
    FROM (
      SELECT
        source.user_id,
        source.date,
        breakdown ->> 'model' AS model,
        sum((breakdown ->> 'cost_usd')::NUMERIC) AS cost_usd
      FROM public.device_usage AS source
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(source.model_breakdown, '[]'::JSONB)
      ) AS breakdown
      WHERE source.user_id = p_user_id
      GROUP BY source.user_id, source.date, breakdown ->> 'model'
    ) AS costs
    GROUP BY costs.user_id, costs.date
  )
  UPDATE public.daily_usage AS daily
  SET cost_usd = totals.cost_usd,
      input_tokens = totals.input_tokens,
      output_tokens = totals.output_tokens,
      reasoning_output_tokens = totals.reasoning_output_tokens,
      cache_creation_tokens = totals.cache_creation_tokens,
      cache_read_tokens = totals.cache_read_tokens,
      total_tokens = totals.total_tokens,
      models = COALESCE(model_names.models, '[]'::JSONB),
      model_breakdown = COALESCE(model_costs.model_breakdown, '[]'::JSONB),
      session_count = totals.session_count,
      is_verified = daily.is_verified OR totals.collector_verified,
      updated_at = now()
  FROM totals
  LEFT JOIN model_names USING (user_id, date)
  LEFT JOIN model_costs USING (user_id, date)
  WHERE daily.user_id = totals.user_id
    AND daily.date = totals.date;

  UPDATE public.posts AS post
  SET title = pg_catalog.to_char(daily.date, 'Mon FMDD')
        || CASE
          WHEN daily.cost_usd > 0
          THEN ', $' || pg_catalog.to_char(daily.cost_usd, 'FM999999990.00')
          ELSE ''
        END,
      updated_at = now()
  FROM public.daily_usage AS daily
  WHERE post.daily_usage_id = daily.id
    AND post.usage_generated_title
    AND EXISTS (
      SELECT 1
      FROM public.usage_corrections_ledger AS ledger
      WHERE ledger.batch_id = v_batch
        AND ledger.table_name = 'posts'
        AND (ledger.row_key ->> 'id')::UUID = post.id
    );

  UPDATE public.usage_corrections_ledger AS ledger
  SET after_row = CASE ledger.table_name
    WHEN 'usage_installation_aliases' THEN (
      SELECT to_jsonb(alias)
      FROM public.usage_installation_aliases AS alias
      WHERE alias.user_id = ledger.user_id
        AND alias.device_id = (ledger.row_key ->> 'device_id')::UUID
    )
    WHEN 'usage_agent_daily' THEN (
      SELECT to_jsonb(rows)
      FROM public.usage_agent_daily AS rows
      WHERE rows.user_id = (ledger.row_key ->> 'user_id')::UUID
        AND rows.date = (ledger.row_key ->> 'date')::DATE
        AND rows.agent = ledger.row_key ->> 'agent'
        AND rows.device_id = v_canonical
    )
    WHEN 'device_usage' THEN (
      SELECT to_jsonb(rows)
      FROM public.device_usage AS rows
      WHERE rows.user_id = (ledger.row_key ->> 'user_id')::UUID
        AND rows.date = (ledger.row_key ->> 'date')::DATE
        AND rows.device_id = v_canonical
    )
    WHEN 'daily_usage' THEN (
      SELECT to_jsonb(daily)
      FROM public.daily_usage AS daily
      WHERE daily.user_id = (ledger.row_key ->> 'user_id')::UUID
        AND daily.date = (ledger.row_key ->> 'date')::DATE
    )
    WHEN 'posts' THEN (
      SELECT to_jsonb(post)
      FROM public.posts AS post
      WHERE post.id = (ledger.row_key ->> 'id')::UUID
    )
  END
  WHERE ledger.batch_id = v_batch;

  INSERT INTO public.usage_device_reconciliation_decisions (
    candidate_id, user_id, decision, canonical_device_id
  ) VALUES (p_candidate_id, p_user_id, p_decision, v_canonical)
  RETURNING id INTO v_decision_id;
  UPDATE public.usage_device_reconciliation_candidates
  SET status = 'merged', resolved_at = now()
  WHERE id = p_candidate_id;
  INSERT INTO public.usage_corrections_ledger (
    batch_id, user_id, reason, table_name, row_key, after_row
  )
  SELECT
    v_batch, p_user_id, 'device reconciliation decision',
    'usage_device_reconciliation_decisions',
    jsonb_build_object('id', decision.id),
    to_jsonb(decision)
  FROM public.usage_device_reconciliation_decisions AS decision
  WHERE decision.id = v_decision_id;
  UPDATE public.usage_corrections_ledger AS ledger
  SET after_row = to_jsonb(candidate)
  FROM public.usage_device_reconciliation_candidates AS candidate
  WHERE ledger.batch_id = v_batch
    AND ledger.table_name = 'usage_device_reconciliation_candidates'
    AND candidate.id = (ledger.row_key ->> 'id')::UUID;
  IF v_owned_batch THEN
    UPDATE public.usage_repair_batches
    SET status = 'completed', processed_count = 1,
        updated_at = now(), completed_at = now()
    WHERE id = v_batch;
  END IF;

  PERFORM public.recalculate_user_level(p_user_id);

  RETURN jsonb_build_object(
    'id', p_candidate_id,
    'status', 'merged',
    'decision', p_decision,
    'canonical_device_id', v_canonical,
    'repair_batch_id', v_batch
  );
END;
$function$;

-- Expose divergent days so `straude devices` can show real evidence.
DROP FUNCTION public.list_usage_device_candidates(UUID);
CREATE FUNCTION public.list_usage_device_candidates(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  device_id_a UUID,
  device_id_b UUID,
  normalized_hostname TEXT,
  overlap_dates DATE[],
  divergent_dates DATE[],
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT
    candidate.id,
    candidate.device_id_a,
    candidate.device_id_b,
    candidate.normalized_hostname,
    candidate.overlap_dates,
    candidate.divergent_dates,
    candidate.status,
    candidate.created_at
  FROM public.usage_device_reconciliation_candidates AS candidate
  WHERE candidate.user_id = p_user_id
    AND candidate.status IN ('proof_merge', 'ambiguous')
  ORDER BY candidate.created_at, candidate.id;
$function$;
REVOKE ALL ON FUNCTION public.list_usage_device_candidates(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_usage_device_candidates(UUID) TO service_role;

-- Submit: record token-only overlap evidence while a pair is quarantined, merge
-- on proof, and reopen a kept-separate pair when identical data arrives later.
CREATE OR REPLACE FUNCTION public.submit_usage_day_v2(
  p_user_id UUID,
  p_request_id TEXT,
  p_source TEXT,
  p_timezone TEXT,
  p_installation JSONB,
  p_collector JSONB,
  p_entry JSONB,
  p_canonical_payload_hash TEXT,
  p_is_verified BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_date DATE := (p_entry ->> 'date')::DATE;
  v_content_hash TEXT := p_entry ->> 'content_hash';
  v_device_id UUID := (p_installation ->> 'id')::UUID;
  v_previous_device_id UUID := NULLIF(p_installation ->> 'previous_device_id', '')::UUID;
  v_device_name TEXT := NULLIF(p_installation ->> 'name', '');
  v_lock_device_id UUID;
  v_current_canonical UUID;
  v_previous_canonical UUID;
  v_canonical_device_id UUID;
  v_existing_outcome public.usage_submission_outcomes%ROWTYPE;
  v_existing_agent public.usage_agent_daily%ROWTYPE;
  v_agent JSONB;
  v_existing_collector JSONB;
  v_migration_id TEXT := NULLIF(p_entry ->> 'migration_id', '');
  v_trusted_partitioned_snapshot BOOLEAN :=
    p_is_verified
    AND p_source = 'cli'
    AND p_collector ->> 'name' = 'ccusage'
    AND COALESCE(
      public.usage_collector_version(p_collector ->> 'version') >= ARRAY[20, 0, 18]::NUMERIC[],
      false
    )
    AND p_collector ->> 'pricing_mode' = 'online';
  v_authoritative BOOLEAN :=
    v_trusted_partitioned_snapshot
    AND COALESCE((p_entry ->> 'authoritative_correction')::BOOLEAN, false)
    AND NULLIF(p_entry ->> 'migration_id', '') = 'ccusage-by-agent-v2';
  v_legacy_authoritative BOOLEAN :=
    p_is_verified
    AND p_source = 'cli'
    AND p_collector ->> 'name' = 'legacy-ccusage'
    AND COALESCE((p_entry ->> 'authoritative_correction')::BOOLEAN, false)
    AND NULLIF(p_entry ->> 'migration_id', '') = 'legacy-codex-correction-v1';
  v_previous_cost NUMERIC;
  v_usage_id UUID;
  v_post_id UUID;
  v_action TEXT;
  v_device_count INTEGER;
  v_daily_total NUMERIC;
  v_outcome JSONB;
  v_reconciliation_candidate_id UUID;
  v_possible_duplicate_device_id UUID;
  v_candidate_status TEXT;
BEGIN
  IF p_source NOT IN ('cli', 'web') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_timezone IS NULL OR p_timezone = '' THEN
    RAISE EXCEPTION 'timezone is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_installation) <> 'object'
    OR jsonb_typeof(p_collector) <> 'object'
    OR jsonb_typeof(p_entry) <> 'object'
    OR jsonb_typeof(p_entry -> 'agents') <> 'array'
  THEN
    RAISE EXCEPTION 'invalid usage payload' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'web' THEN
    v_device_id := public.usage_web_installation_id(p_user_id);
    v_previous_device_id := NULL;
    v_device_name := COALESCE(v_device_name, 'web-import');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::TEXT || ':' || v_date::TEXT, 0)
  );
  FOR v_lock_device_id IN
    SELECT DISTINCT device_id
    FROM unnest(ARRAY[v_device_id, v_previous_device_id]) AS ids(device_id)
    WHERE device_id IS NOT NULL
    ORDER BY device_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('usage-installation:' || v_lock_device_id::TEXT, 0)
    );
  END LOOP;

  SELECT *
  INTO v_existing_outcome
  FROM public.usage_submission_outcomes
  WHERE user_id = p_user_id
    AND request_id = p_request_id
    AND date = v_date
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_outcome.content_hash = v_content_hash
      AND v_existing_outcome.canonical_payload_hash = p_canonical_payload_hash
    THEN
      RETURN v_existing_outcome.outcome || jsonb_build_object('status', 'unchanged');
    END IF;
    RETURN jsonb_build_object(
      'date', v_date,
      'status', 'identity_conflict',
      'error', jsonb_build_object(
        'code', 'idempotency_conflict',
        'message', 'request_id and date already committed with different content'
      )
    );
  END IF;

  -- A pending candidate blocks the device until it is merged or resolved. Each
  -- blocked date adds token-only evidence; proof merges the pair in place.
  LOOP
    SELECT candidate.id
    INTO v_reconciliation_candidate_id
    FROM public.usage_device_reconciliation_candidates AS candidate
    WHERE candidate.user_id = p_user_id
      AND candidate.status IN ('proof_merge', 'ambiguous')
      AND (
        candidate.device_id_a IN (v_device_id, v_previous_device_id)
        OR candidate.device_id_b IN (v_device_id, v_previous_device_id)
      )
    ORDER BY candidate.created_at
    LIMIT 1;
    EXIT WHEN v_reconciliation_candidate_id IS NULL;

    v_candidate_status := public.apply_usage_device_overlap_evidence(
      p_user_id,
      v_reconciliation_candidate_id,
      ARRAY[v_device_id, v_previous_device_id],
      v_date,
      p_entry
    );
    IF v_candidate_status <> 'merged' THEN
      RETURN jsonb_build_object(
        'date', v_date,
        'status', 'identity_conflict',
        'error', jsonb_build_object(
          'code', 'device_reconciliation_required',
          'message', 'Device identity must be resolved before usage can be submitted'
        )
      );
    END IF;
  END LOOP;

  SELECT canonical_device_id
  INTO v_current_canonical
  FROM public.usage_installation_aliases
  WHERE user_id = p_user_id
    AND device_id = v_device_id
  FOR UPDATE;

  IF v_previous_device_id IS NOT NULL THEN
    SELECT canonical_device_id
    INTO v_previous_canonical
    FROM public.usage_installation_aliases
    WHERE user_id = p_user_id
      AND device_id = v_previous_device_id
    FOR UPDATE;
  END IF;

  IF v_current_canonical IS NOT NULL
    AND v_previous_canonical IS NOT NULL
    AND v_current_canonical <> v_previous_canonical
  THEN
    RETURN jsonb_build_object(
      'date', v_date,
      'status', 'identity_conflict',
      'error', jsonb_build_object(
        'code', 'installation_alias_conflict',
        'message', 'installation and previous_device_id resolve to different identities'
      )
    );
  END IF;

  v_canonical_device_id := COALESCE(
    v_current_canonical,
    v_previous_canonical,
    v_previous_device_id,
    v_device_id
  );
  INSERT INTO public.usage_installation_aliases (
    device_id,
    user_id,
    canonical_device_id,
    name,
    updated_at
  )
  VALUES (
    v_device_id,
    p_user_id,
    v_canonical_device_id,
    v_device_name,
    pg_catalog.now()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, public.usage_installation_aliases.name),
      updated_at = pg_catalog.now();

  IF v_previous_device_id IS NOT NULL THEN
    INSERT INTO public.usage_installation_aliases (
      device_id,
      user_id,
      canonical_device_id,
      updated_at
    )
    VALUES (
      v_previous_device_id,
      p_user_id,
      v_canonical_device_id,
      pg_catalog.now()
    )
    ON CONFLICT (user_id, device_id) DO NOTHING;
  END IF;

  IF v_device_name IS NOT NULL THEN
    SELECT alias.canonical_device_id
    INTO v_possible_duplicate_device_id
    FROM public.usage_installation_aliases AS alias
    WHERE alias.user_id = p_user_id
      AND alias.canonical_device_id <> v_canonical_device_id
      AND lower(pg_catalog.regexp_replace(alias.name, '[^a-zA-Z0-9]+', '', 'g'))
        = lower(pg_catalog.regexp_replace(v_device_name, '[^a-zA-Z0-9]+', '', 'g'))
    ORDER BY alias.created_at, alias.canonical_device_id
    LIMIT 1;

    IF v_possible_duplicate_device_id IS NOT NULL THEN
      INSERT INTO public.usage_device_reconciliation_candidates (
        user_id,
        device_id_a,
        device_id_b,
        normalized_hostname,
        status,
        proof
      )
      VALUES (
        p_user_id,
        CASE
          WHEN v_canonical_device_id::TEXT < v_possible_duplicate_device_id::TEXT
            THEN v_canonical_device_id
          ELSE v_possible_duplicate_device_id
        END,
        CASE
          WHEN v_canonical_device_id::TEXT < v_possible_duplicate_device_id::TEXT
            THEN v_possible_duplicate_device_id
          ELSE v_canonical_device_id
        END,
        lower(pg_catalog.regexp_replace(v_device_name, '[^a-zA-Z0-9]+', '', 'g')),
        'ambiguous',
        jsonb_build_object('algorithm', 'hostname-quarantine-v1')
      )
      ON CONFLICT (user_id, device_id_a, device_id_b) DO NOTHING;

      SELECT candidate.id
      INTO v_reconciliation_candidate_id
      FROM public.usage_device_reconciliation_candidates AS candidate
      WHERE candidate.user_id = p_user_id
        AND candidate.device_id_a IN (
          v_canonical_device_id, v_possible_duplicate_device_id
        )
        AND candidate.device_id_b IN (
          v_canonical_device_id, v_possible_duplicate_device_id
        );
      IF v_reconciliation_candidate_id IS NOT NULL THEN
        -- Token-identical overlap proves a duplicate. It merges a pending pair
        -- and reopens a pair the user kept separate.
        v_candidate_status := public.apply_usage_device_overlap_evidence(
          p_user_id,
          v_reconciliation_candidate_id,
          ARRAY[v_canonical_device_id],
          v_date,
          p_entry
        );
        IF v_candidate_status = 'merged' THEN
          SELECT alias.canonical_device_id
          INTO v_canonical_device_id
          FROM public.usage_installation_aliases AS alias
          WHERE alias.user_id = p_user_id
            AND alias.device_id = v_device_id;
        ELSIF v_candidate_status IN ('proof_merge', 'ambiguous') THEN
          RETURN jsonb_build_object(
            'date', v_date,
            'status', 'identity_conflict',
            'error', jsonb_build_object(
              'code', 'device_reconciliation_required',
              'message', 'Device identity must be resolved before usage can be submitted'
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT cost_usd
  INTO v_previous_cost
  FROM public.daily_usage
  WHERE user_id = p_user_id
    AND date = v_date
  FOR UPDATE;
  v_action := CASE WHEN FOUND THEN 'updated' ELSE 'created' END;

  -- Decide the whole date before writing any agent. A skipped component must
  -- never be reported as committed or seal the CLI's contiguous watermark.
  FOR v_agent IN
    SELECT value FROM jsonb_array_elements(p_entry -> 'agents')
  LOOP
    IF v_agent ->> 'agent' = 'legacy-unpartitioned' AND EXISTS (
      SELECT 1 FROM public.usage_agent_daily
      WHERE user_id = p_user_id AND date = v_date
        AND device_id = v_canonical_device_id AND agent <> 'legacy-unpartitioned'
    ) THEN
      RETURN jsonb_build_object(
        'date', v_date, 'status', 'permanent_error',
        'error', jsonb_build_object(
          'code', 'usage_protocol_upgrade_required',
          'message', 'This date already uses per-agent accounting. Update the CLI with npx straude@latest.'
        )
      );
    END IF;

    IF v_agent ->> 'agent' = 'legacy-unpartitioned' THEN
      -- The old server can write after the migration backfill. Compare its
      -- current device total, so a stale legacy retry cannot erase those writes.
      SELECT cost_usd, input_tokens, output_tokens, reasoning_output_tokens,
        cache_creation_tokens, cache_read_tokens, total_tokens,
        (
          SELECT collector FROM public.usage_agent_daily AS legacy
          WHERE legacy.user_id = p_user_id AND legacy.date = v_date
            AND legacy.device_id = v_canonical_device_id
            AND legacy.agent = 'legacy-unpartitioned'
        )
      INTO v_existing_agent.cost_usd, v_existing_agent.input_tokens,
        v_existing_agent.output_tokens, v_existing_agent.reasoning_output_tokens,
        v_existing_agent.cache_creation_tokens, v_existing_agent.cache_read_tokens,
        v_existing_agent.total_tokens, v_existing_collector
      FROM public.device_usage
      WHERE user_id = p_user_id AND date = v_date AND device_id = v_canonical_device_id
      FOR UPDATE;
    ELSE
      SELECT * INTO v_existing_agent FROM public.usage_agent_daily
      WHERE user_id = p_user_id AND date = v_date
        AND device_id = v_canonical_device_id AND agent = v_agent ->> 'agent'
      FOR UPDATE;
      v_existing_collector := v_existing_agent.collector;
    END IF;

    IF FOUND AND NOT (
      v_authoritative
      OR (v_legacy_authoritative AND v_agent ->> 'agent' = 'legacy-unpartitioned')
      -- Trusted complete source snapshots may reprice or redistribute tokens.
      -- Total tokens measures snapshot progress; prices and categories do not.
      OR (v_trusted_partitioned_snapshot
        AND (v_agent ->> 'total_tokens')::BIGINT >= v_existing_agent.total_tokens)
      -- A newer ccusage collector is the source of truth for rows an older one
      -- wrote, even when the corrected snapshot is smaller. An unparseable or
      -- missing stored version counts as older.
      OR (v_trusted_partitioned_snapshot
        AND COALESCE(
          public.usage_collector_version(v_existing_collector ->> 'version'),
          ARRAY[-1]::NUMERIC[]
        ) < public.usage_collector_version(p_collector ->> 'version'))
      OR (
        (v_agent ->> 'cost_usd')::NUMERIC >= v_existing_agent.cost_usd
        AND (v_agent ->> 'input_tokens')::BIGINT >= v_existing_agent.input_tokens
        AND (v_agent ->> 'output_tokens')::BIGINT >= v_existing_agent.output_tokens
        AND (v_agent ->> 'reasoning_output_tokens')::BIGINT >= v_existing_agent.reasoning_output_tokens
        AND (v_agent ->> 'cache_creation_tokens')::BIGINT >= v_existing_agent.cache_creation_tokens
        AND (v_agent ->> 'cache_read_tokens')::BIGINT >= v_existing_agent.cache_read_tokens
        AND (v_agent ->> 'total_tokens')::BIGINT >= v_existing_agent.total_tokens
      )
    ) THEN
      RETURN jsonb_build_object(
        'date', v_date, 'status', 'permanent_error',
        'error', jsonb_build_object(
          'code', 'usage_regression_rejected',
          'message', 'The snapshot has less usage than stored. Restore complete local logs and retry this date.'
        )
      );
    END IF;
  END LOOP;

  FOR v_agent IN
    SELECT value FROM jsonb_array_elements(p_entry -> 'agents')
  LOOP
      INSERT INTO public.usage_agent_daily (
        user_id,
        date,
        device_id,
        agent,
        models,
        input_tokens,
        output_tokens,
        reasoning_output_tokens,
        cache_creation_tokens,
        cache_read_tokens,
        total_tokens,
        cost_usd,
        model_breakdown,
        content_hash,
        collector,
        migration_id,
        updated_at
      )
      VALUES (
        p_user_id,
        v_date,
        v_canonical_device_id,
        v_agent ->> 'agent',
        ARRAY(SELECT jsonb_array_elements_text(v_agent -> 'models')),
        (v_agent ->> 'input_tokens')::BIGINT,
        (v_agent ->> 'output_tokens')::BIGINT,
        (v_agent ->> 'reasoning_output_tokens')::BIGINT,
        (v_agent ->> 'cache_creation_tokens')::BIGINT,
        (v_agent ->> 'cache_read_tokens')::BIGINT,
        (v_agent ->> 'total_tokens')::BIGINT,
        (v_agent ->> 'cost_usd')::NUMERIC,
        v_agent -> 'model_breakdown',
        v_content_hash,
        p_collector,
        v_migration_id,
        pg_catalog.now()
      )
      ON CONFLICT (user_id, date, device_id, agent) DO UPDATE
      SET models = EXCLUDED.models,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
          cache_creation_tokens = EXCLUDED.cache_creation_tokens,
          cache_read_tokens = EXCLUDED.cache_read_tokens,
          total_tokens = EXCLUDED.total_tokens,
          cost_usd = EXCLUDED.cost_usd,
          model_breakdown = EXCLUDED.model_breakdown,
          content_hash = EXCLUDED.content_hash,
          collector = EXCLUDED.collector,
          migration_id = EXCLUDED.migration_id,
          updated_at = pg_catalog.now();
  END LOOP;

  IF v_trusted_partitioned_snapshot
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_entry -> 'agents') AS submitted(value)
      WHERE submitted.value ->> 'agent' = 'legacy-unpartitioned'
    )
  THEN
    DELETE FROM public.usage_agent_daily
    WHERE user_id = p_user_id
      AND date = v_date
      AND device_id = v_canonical_device_id
      AND agent = 'legacy-unpartitioned';
  END IF;

  IF v_authoritative THEN
    DELETE FROM public.usage_agent_daily
    WHERE user_id = p_user_id
      AND date = v_date
      AND device_id = v_canonical_device_id
      AND agent NOT IN (
        SELECT value ->> 'agent'
        FROM jsonb_array_elements(p_entry -> 'agents')
      );
  END IF;

  WITH agent_totals AS (
    SELECT
      COALESCE(sum(cost_usd), 0) AS cost_usd,
      COALESCE(sum(input_tokens), 0) AS input_tokens,
      COALESCE(sum(output_tokens), 0) AS output_tokens,
      COALESCE(sum(reasoning_output_tokens), 0) AS reasoning_output_tokens,
      COALESCE(sum(cache_creation_tokens), 0) AS cache_creation_tokens,
      COALESCE(sum(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      count(*)::INTEGER AS session_count
    FROM public.usage_agent_daily
    WHERE user_id = p_user_id
      AND date = v_date
      AND device_id = v_canonical_device_id
  ),
  model_names AS (
    SELECT COALESCE(jsonb_agg(DISTINCT model ORDER BY model), '[]'::JSONB) AS models
    FROM public.usage_agent_daily rows
    CROSS JOIN LATERAL unnest(rows.models) AS model
    WHERE rows.user_id = p_user_id
      AND rows.date = v_date
      AND rows.device_id = v_canonical_device_id
  ),
  model_costs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('model', model, 'cost_usd', cost_usd)
        ORDER BY model
      ),
      '[]'::JSONB
    ) AS model_breakdown
    FROM (
      SELECT
        breakdown ->> 'model' AS model,
        sum((breakdown ->> 'cost_usd')::NUMERIC) AS cost_usd
      FROM public.usage_agent_daily rows
      CROSS JOIN LATERAL jsonb_array_elements(rows.model_breakdown) AS breakdown
      WHERE rows.user_id = p_user_id
        AND rows.date = v_date
        AND rows.device_id = v_canonical_device_id
      GROUP BY breakdown ->> 'model'
    ) costs
  )
  INSERT INTO public.device_usage (
    user_id,
    device_id,
    device_name,
    date,
    cost_usd,
    input_tokens,
    output_tokens,
    reasoning_output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
    models,
    model_breakdown,
    session_count,
    raw_hash,
    collector_meta,
    updated_at
  )
  SELECT
    p_user_id,
    v_canonical_device_id,
    v_device_name,
    v_date,
    agent_totals.cost_usd,
    agent_totals.input_tokens,
    agent_totals.output_tokens,
    agent_totals.reasoning_output_tokens,
    agent_totals.cache_creation_tokens,
    agent_totals.cache_read_tokens,
    agent_totals.total_tokens,
    model_names.models,
    model_costs.model_breakdown,
    agent_totals.session_count,
    v_content_hash,
    p_collector,
    pg_catalog.now()
  FROM agent_totals, model_names, model_costs
  ON CONFLICT (user_id, date, device_id) DO UPDATE
  SET device_name = COALESCE(EXCLUDED.device_name, public.device_usage.device_name),
      cost_usd = EXCLUDED.cost_usd,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
      cache_creation_tokens = EXCLUDED.cache_creation_tokens,
      cache_read_tokens = EXCLUDED.cache_read_tokens,
      total_tokens = EXCLUDED.total_tokens,
      models = EXCLUDED.models,
      model_breakdown = EXCLUDED.model_breakdown,
      session_count = EXCLUDED.session_count,
      raw_hash = EXCLUDED.raw_hash,
      collector_meta = EXCLUDED.collector_meta,
      updated_at = pg_catalog.now();

  WITH device_totals AS (
    SELECT
      COALESCE(sum(cost_usd), 0) AS cost_usd,
      COALESCE(sum(input_tokens), 0) AS input_tokens,
      COALESCE(sum(output_tokens), 0) AS output_tokens,
      COALESCE(sum(reasoning_output_tokens), 0) AS reasoning_output_tokens,
      COALESCE(sum(cache_creation_tokens), 0) AS cache_creation_tokens,
      COALESCE(sum(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      count(*)::INTEGER AS device_count
    FROM public.device_usage
    WHERE user_id = p_user_id
      AND date = v_date
  ),
  model_names AS (
    SELECT COALESCE(jsonb_agg(DISTINCT model ORDER BY model), '[]'::JSONB) AS models
    FROM public.device_usage rows
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(rows.models, '[]'::JSONB)
    ) AS model
    WHERE rows.user_id = p_user_id
      AND rows.date = v_date
  ),
  model_costs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('model', model, 'cost_usd', cost_usd)
        ORDER BY model
      ),
      '[]'::JSONB
    ) AS model_breakdown
    FROM (
      SELECT
        breakdown ->> 'model' AS model,
        sum((breakdown ->> 'cost_usd')::NUMERIC) AS cost_usd
      FROM public.device_usage rows
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rows.model_breakdown, '[]'::JSONB)) AS breakdown
      WHERE rows.user_id = p_user_id
        AND rows.date = v_date
      GROUP BY breakdown ->> 'model'
    ) costs
  )
  INSERT INTO public.daily_usage (
    user_id,
    date,
    cost_usd,
    input_tokens,
    output_tokens,
    reasoning_output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
    models,
    model_breakdown,
    session_count,
    is_verified,
    raw_hash,
    collector_meta,
    updated_at
  )
  SELECT
    p_user_id,
    v_date,
    device_totals.cost_usd,
    device_totals.input_tokens,
    device_totals.output_tokens,
    device_totals.reasoning_output_tokens,
    device_totals.cache_creation_tokens,
    device_totals.cache_read_tokens,
    device_totals.total_tokens,
    model_names.models,
    model_costs.model_breakdown,
    device_totals.device_count,
    p_is_verified,
    v_content_hash,
    p_collector,
    pg_catalog.now()
  FROM device_totals, model_names, model_costs
  ON CONFLICT (user_id, date) DO UPDATE
  SET cost_usd = EXCLUDED.cost_usd,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
      cache_creation_tokens = EXCLUDED.cache_creation_tokens,
      cache_read_tokens = EXCLUDED.cache_read_tokens,
      total_tokens = EXCLUDED.total_tokens,
      models = EXCLUDED.models,
      model_breakdown = EXCLUDED.model_breakdown,
      session_count = EXCLUDED.session_count,
      is_verified = public.daily_usage.is_verified OR EXCLUDED.is_verified,
      raw_hash = EXCLUDED.raw_hash,
      collector_meta = EXCLUDED.collector_meta,
      updated_at = pg_catalog.now()
  RETURNING id, cost_usd
  INTO v_usage_id, v_daily_total;

  INSERT INTO public.posts (
    user_id,
    daily_usage_id,
    title,
    usage_generated_title,
    updated_at
  )
  VALUES (
    p_user_id,
    v_usage_id,
    pg_catalog.to_char(v_date, 'Mon FMDD')
      || CASE
        WHEN v_daily_total > 0
        THEN ', $' || pg_catalog.to_char(v_daily_total, 'FM999999990.00')
        ELSE ''
      END,
    true,
    pg_catalog.now()
  )
  ON CONFLICT (daily_usage_id) DO UPDATE
  SET title = CASE
        WHEN public.posts.usage_generated_title THEN EXCLUDED.title
        ELSE public.posts.title
      END,
      updated_at = pg_catalog.now()
  RETURNING id
  INTO v_post_id;

  SELECT count(*)::INTEGER
  INTO v_device_count
  FROM public.device_usage
  WHERE user_id = p_user_id
    AND date = v_date;

  v_outcome := jsonb_build_object(
    'date', v_date,
    'status', 'committed',
    'result', jsonb_strip_nulls(jsonb_build_object(
      'usage_id', v_usage_id,
      'post_id', v_post_id,
      'action', v_action,
      'previous_cost', v_previous_cost,
      'daily_total', v_daily_total,
      'device_count', v_device_count
    ))
  );

  INSERT INTO public.usage_submission_outcomes (
    user_id,
    request_id,
    date,
    content_hash,
    canonical_payload_hash,
    outcome
  )
  VALUES (
    p_user_id,
    p_request_id,
    v_date,
    v_content_hash,
    p_canonical_payload_hash,
    v_outcome
  );

  RETURN v_outcome;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_usage_day_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_usage_day_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  BOOLEAN
) FROM anon;
REVOKE ALL ON FUNCTION public.submit_usage_day_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  BOOLEAN
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_usage_day_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  TEXT,
  BOOLEAN
) TO service_role;
