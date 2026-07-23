ALTER TABLE public.posts
  ADD COLUMN usage_generated_title BOOLEAN NOT NULL DEFAULT false;

UPDATE public.posts AS post
SET usage_generated_title = true
FROM public.daily_usage AS daily
WHERE post.daily_usage_id = daily.id
  AND (
    post.title = pg_catalog.to_char(daily.date, 'Mon FMDD')
      || CASE
        WHEN daily.cost_usd > 0
        THEN ', $' || pg_catalog.to_char(daily.cost_usd, 'FM999999990.00')
        ELSE ''
      END
    OR post.title ~ '^[A-Z][a-z]{2} [0-9]{1,2}( — .+)?$'
  );

CREATE TABLE public.usage_device_reconciliation_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id_a UUID NOT NULL,
  device_id_b UUID NOT NULL,
  normalized_hostname TEXT NOT NULL,
  overlap_dates DATE[] NOT NULL DEFAULT '{}',
  divergent_dates DATE[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (
    status IN ('proof_merge', 'ambiguous', 'merged', 'kept_separate')
  ),
  proof JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(proof) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (device_id_a::TEXT < device_id_b::TEXT),
  UNIQUE (user_id, device_id_a, device_id_b)
);

CREATE INDEX usage_device_candidates_user_status_idx
  ON public.usage_device_reconciliation_candidates(user_id, status, created_at);

CREATE TABLE public.usage_device_reconciliation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL
    REFERENCES public.usage_device_reconciliation_candidates(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('merge', 'keep_separate')),
  canonical_device_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_repair_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'rolled_back', 'failed')),
  cursor_candidate_id UUID,
  processed_count INTEGER NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.usage_corrections_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.usage_repair_batches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  table_name TEXT NOT NULL CHECK (
    table_name IN (
      'usage_installation_aliases',
      'usage_agent_daily',
      'device_usage',
      'daily_usage',
      'posts',
      'usage_device_reconciliation_candidates',
      'usage_device_reconciliation_decisions'
    )
  ),
  row_key JSONB NOT NULL CHECK (jsonb_typeof(row_key) = 'object'),
  before_row JSONB,
  after_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_corrections_ledger_batch_idx
  ON public.usage_corrections_ledger(batch_id, id);

ALTER TABLE public.usage_device_reconciliation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_device_reconciliation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_repair_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_corrections_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usage_device_reconciliation_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.usage_device_reconciliation_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.usage_repair_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.usage_corrections_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_device_reconciliation_candidates TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.usage_device_reconciliation_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_repair_batches TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_corrections_ledger TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.usage_corrections_ledger_id_seq TO service_role;
GRANT DELETE ON TABLE public.device_usage TO service_role;

CREATE OR REPLACE FUNCTION public.list_usage_device_candidates(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  device_id_a UUID,
  device_id_b UUID,
  normalized_hostname TEXT,
  overlap_dates DATE[],
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
    candidate.status,
    candidate.created_at
  FROM public.usage_device_reconciliation_candidates AS candidate
  WHERE candidate.user_id = p_user_id
    AND candidate.status IN ('proof_merge', 'ambiguous')
  ORDER BY candidate.created_at, candidate.id;
$function$;

CREATE OR REPLACE FUNCTION public.discover_usage_device_candidates(
  p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_inserted INTEGER;
BEGIN
  INSERT INTO public.usage_installation_aliases (
    device_id, user_id, canonical_device_id, name
  )
  SELECT
    usage.device_id,
    usage.user_id,
    usage.device_id,
    max(usage.device_name)
  FROM public.device_usage AS usage
  WHERE p_user_id IS NULL OR usage.user_id = p_user_id
  GROUP BY usage.user_id, usage.device_id
  ON CONFLICT (user_id, device_id) DO NOTHING;

  WITH named_devices AS (
    SELECT
      alias.user_id,
      alias.canonical_device_id AS device_id,
      lower(pg_catalog.regexp_replace(alias.name, '[^a-zA-Z0-9]+', '', 'g'))
        AS normalized_hostname
    FROM public.usage_installation_aliases AS alias
    WHERE alias.name IS NOT NULL
      AND (p_user_id IS NULL OR alias.user_id = p_user_id)
    GROUP BY alias.user_id, alias.canonical_device_id,
      lower(pg_catalog.regexp_replace(alias.name, '[^a-zA-Z0-9]+', '', 'g'))
  ),
  pairs AS (
    SELECT
      left_device.user_id,
      left_device.device_id AS device_id_a,
      right_device.device_id AS device_id_b,
      left_device.normalized_hostname
    FROM named_devices AS left_device
    JOIN named_devices AS right_device
      ON right_device.user_id = left_device.user_id
      AND right_device.normalized_hostname = left_device.normalized_hostname
      AND left_device.device_id::TEXT < right_device.device_id::TEXT
    WHERE left_device.normalized_hostname <> ''
  ),
  agent_fingerprints AS (
    SELECT
      rows.user_id,
      rows.device_id,
      rows.date,
      jsonb_agg(
        jsonb_build_object(
          'agent', rows.agent,
          'models', rows.models,
          'input_tokens', rows.input_tokens,
          'output_tokens', rows.output_tokens,
          'reasoning_output_tokens', rows.reasoning_output_tokens,
          'cache_creation_tokens', rows.cache_creation_tokens,
          'cache_read_tokens', rows.cache_read_tokens,
          'total_tokens', rows.total_tokens,
          'cost_usd', rows.cost_usd,
          'model_breakdown', rows.model_breakdown,
          'collector', rows.collector
        )
        ORDER BY rows.agent
      ) AS fingerprint
    FROM public.usage_agent_daily AS rows
    GROUP BY rows.user_id, rows.device_id, rows.date
  ),
  fingerprints AS (
    SELECT
      pair.*,
      COALESCE(array_agg(left_usage.date ORDER BY left_usage.date)
        FILTER (
          WHERE left_usage.date IS NOT NULL
            AND right_usage.date IS NOT NULL
            AND left_agents.fingerprint IS NOT NULL
            AND left_agents.fingerprint = right_agents.fingerprint
            AND jsonb_build_array(
              left_usage.cost_usd, left_usage.input_tokens, left_usage.output_tokens,
              left_usage.reasoning_output_tokens, left_usage.cache_creation_tokens,
              left_usage.cache_read_tokens, left_usage.total_tokens,
              left_usage.models, left_usage.model_breakdown
            ) = jsonb_build_array(
              right_usage.cost_usd, right_usage.input_tokens, right_usage.output_tokens,
              right_usage.reasoning_output_tokens, right_usage.cache_creation_tokens,
              right_usage.cache_read_tokens, right_usage.total_tokens,
              right_usage.models, right_usage.model_breakdown
            )
        ), '{}') AS overlap_dates,
      COALESCE(array_agg(left_usage.date ORDER BY left_usage.date)
        FILTER (
          WHERE left_usage.date IS NOT NULL
            AND right_usage.date IS NOT NULL
            AND (
              left_agents.fingerprint IS DISTINCT FROM right_agents.fingerprint
              OR jsonb_build_array(
                left_usage.cost_usd, left_usage.input_tokens, left_usage.output_tokens,
                left_usage.reasoning_output_tokens, left_usage.cache_creation_tokens,
                left_usage.cache_read_tokens, left_usage.total_tokens,
                left_usage.models, left_usage.model_breakdown
              ) IS DISTINCT FROM jsonb_build_array(
                right_usage.cost_usd, right_usage.input_tokens, right_usage.output_tokens,
                right_usage.reasoning_output_tokens, right_usage.cache_creation_tokens,
                right_usage.cache_read_tokens, right_usage.total_tokens,
                right_usage.models, right_usage.model_breakdown
              )
            )
        ), '{}') AS divergent_dates
    FROM pairs AS pair
    LEFT JOIN public.device_usage AS left_usage
      ON left_usage.user_id = pair.user_id
      AND left_usage.device_id = pair.device_id_a
    LEFT JOIN public.device_usage AS right_usage
      ON right_usage.user_id = pair.user_id
      AND right_usage.device_id = pair.device_id_b
      AND right_usage.date = left_usage.date
    LEFT JOIN agent_fingerprints AS left_agents
      ON left_agents.user_id = pair.user_id
      AND left_agents.device_id = pair.device_id_a
      AND left_agents.date = left_usage.date
    LEFT JOIN agent_fingerprints AS right_agents
      ON right_agents.user_id = pair.user_id
      AND right_agents.device_id = pair.device_id_b
      AND right_agents.date = left_usage.date
    GROUP BY pair.user_id, pair.device_id_a, pair.device_id_b,
      pair.normalized_hostname
  )
  INSERT INTO public.usage_device_reconciliation_candidates (
    user_id, device_id_a, device_id_b, normalized_hostname,
    overlap_dates, divergent_dates, status, proof
  )
  SELECT
    user_id,
    device_id_a,
    device_id_b,
    normalized_hostname,
    overlap_dates,
    divergent_dates,
    CASE
      WHEN cardinality(overlap_dates) >= 2 AND cardinality(divergent_dates) = 0
        THEN 'proof_merge'
      ELSE 'ambiguous'
    END,
    jsonb_build_object(
      'algorithm', 'canonical-accounting-v1',
      'identical_overlap_count', cardinality(overlap_dates),
      'divergent_overlap_count', cardinality(divergent_dates)
    )
  FROM fingerprints
  ON CONFLICT (user_id, device_id_a, device_id_b) DO UPDATE
  SET normalized_hostname = EXCLUDED.normalized_hostname,
      overlap_dates = EXCLUDED.overlap_dates,
      divergent_dates = EXCLUDED.divergent_dates,
      proof = EXCLUDED.proof,
      status = CASE
        WHEN public.usage_device_reconciliation_candidates.status
          IN ('merged', 'kept_separate')
          THEN public.usage_device_reconciliation_candidates.status
        ELSE EXCLUDED.status
      END;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;

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
    AND canonical.models IS NOT DISTINCT FROM duplicate.models
    AND canonical.input_tokens = duplicate.input_tokens
    AND canonical.output_tokens = duplicate.output_tokens
    AND canonical.reasoning_output_tokens = duplicate.reasoning_output_tokens
    AND canonical.cache_creation_tokens = duplicate.cache_creation_tokens
    AND canonical.cache_read_tokens = duplicate.cache_read_tokens
    AND canonical.total_tokens = duplicate.total_tokens
    AND canonical.cost_usd = duplicate.cost_usd
    AND canonical.model_breakdown IS NOT DISTINCT FROM duplicate.model_breakdown
    AND canonical.collector IS NOT DISTINCT FROM duplicate.collector;
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
    AND canonical.cost_usd = duplicate.cost_usd
    AND canonical.input_tokens = duplicate.input_tokens
    AND canonical.output_tokens = duplicate.output_tokens
    AND canonical.reasoning_output_tokens = duplicate.reasoning_output_tokens
    AND canonical.cache_creation_tokens = duplicate.cache_creation_tokens
    AND canonical.cache_read_tokens = duplicate.cache_read_tokens
    AND canonical.total_tokens = duplicate.total_tokens
    AND canonical.models IS NOT DISTINCT FROM duplicate.models
    AND canonical.model_breakdown IS NOT DISTINCT FROM duplicate.model_breakdown;
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

CREATE OR REPLACE FUNCTION public.start_usage_repair_batch(p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_batch UUID;
BEGIN
  INSERT INTO public.usage_repair_batches(reason)
  VALUES (p_reason)
  RETURNING id INTO v_batch;
  RETURN v_batch;
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_usage_repair_batch(
  p_batch_id UUID,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_batch public.usage_repair_batches%ROWTYPE;
  v_candidate RECORD;
  v_processed INTEGER := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid repair batch limit' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_batch
  FROM public.usage_repair_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND OR v_batch.status IN ('completed', 'rolled_back') THEN
    RAISE EXCEPTION 'repair batch is not runnable' USING ERRCODE = '55000';
  END IF;
  UPDATE public.usage_repair_batches
  SET status = 'running', updated_at = now()
  WHERE id = p_batch_id;
  PERFORM public.discover_usage_device_candidates(NULL);
  PERFORM pg_catalog.set_config(
    'straude.usage_repair_batch_id', p_batch_id::TEXT, true
  );

  FOR v_candidate IN
    SELECT id, user_id
    FROM public.usage_device_reconciliation_candidates
    WHERE status = 'proof_merge'
      AND (v_batch.cursor_candidate_id IS NULL OR id > v_batch.cursor_candidate_id)
    ORDER BY id
    LIMIT p_limit
  LOOP
    PERFORM public.resolve_usage_device_candidate(
      v_candidate.user_id, v_candidate.id, 'merge'
    );
    v_processed := v_processed + 1;
    UPDATE public.usage_repair_batches
    SET cursor_candidate_id = v_candidate.id,
        processed_count = processed_count + 1,
        updated_at = now()
    WHERE id = p_batch_id;
  END LOOP;

  IF v_processed < p_limit THEN
    WITH derived AS (
      SELECT
        devices.user_id,
        devices.date,
        sum(devices.cost_usd) AS cost_usd,
        sum(devices.input_tokens) AS input_tokens,
        sum(devices.output_tokens) AS output_tokens,
        sum(devices.reasoning_output_tokens) AS reasoning_output_tokens,
        sum(devices.cache_creation_tokens) AS cache_creation_tokens,
        sum(devices.cache_read_tokens) AS cache_read_tokens,
        sum(devices.total_tokens) AS total_tokens,
        sum(devices.session_count)::INTEGER AS session_count,
        COALESCE((
          SELECT jsonb_agg(DISTINCT model ORDER BY model)
          FROM public.device_usage AS model_rows
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(model_rows.models, '[]'::JSONB)
          ) AS model
          WHERE model_rows.user_id = devices.user_id
            AND model_rows.date = devices.date
        ), '[]'::JSONB) AS models,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'model', costs.model, 'cost_usd', costs.cost_usd
            ) ORDER BY costs.model
          )
          FROM (
            SELECT
              breakdown ->> 'model' AS model,
              sum((breakdown ->> 'cost_usd')::NUMERIC) AS cost_usd
            FROM public.device_usage AS cost_rows
            CROSS JOIN LATERAL jsonb_array_elements(
              COALESCE(cost_rows.model_breakdown, '[]'::JSONB)
            ) AS breakdown
            WHERE cost_rows.user_id = devices.user_id
              AND cost_rows.date = devices.date
            GROUP BY breakdown ->> 'model'
          ) AS costs
        ), '[]'::JSONB) AS model_breakdown
      FROM public.device_usage AS devices
      GROUP BY devices.user_id, devices.date
    )
    INSERT INTO public.usage_corrections_ledger (
      batch_id, user_id, reason, table_name, row_key, before_row
    )
    SELECT
      p_batch_id,
      daily.user_id,
      'aggregate mismatch repair',
      'daily_usage',
      jsonb_build_object('user_id', daily.user_id, 'date', daily.date),
      to_jsonb(daily)
    FROM public.daily_usage AS daily
    JOIN derived
      ON derived.user_id = daily.user_id AND derived.date = daily.date
    WHERE jsonb_build_array(
      daily.cost_usd, daily.input_tokens, daily.output_tokens,
      daily.reasoning_output_tokens, daily.cache_creation_tokens,
      daily.cache_read_tokens, daily.total_tokens, daily.session_count,
      daily.models, daily.model_breakdown
    ) IS DISTINCT FROM jsonb_build_array(
      derived.cost_usd, derived.input_tokens, derived.output_tokens,
      derived.reasoning_output_tokens, derived.cache_creation_tokens,
      derived.cache_read_tokens, derived.total_tokens, derived.session_count,
      derived.models, derived.model_breakdown
    );

    INSERT INTO public.usage_corrections_ledger (
      batch_id, user_id, reason, table_name, row_key, before_row
    )
    SELECT
      p_batch_id,
      daily.user_id,
      'aggregate mismatch generated title',
      'posts',
      jsonb_build_object('id', post.id),
      to_jsonb(post)
    FROM public.posts AS post
    JOIN public.daily_usage AS daily ON daily.id = post.daily_usage_id
    WHERE post.usage_generated_title
      AND EXISTS (
        SELECT 1
        FROM public.usage_corrections_ledger AS ledger
        WHERE ledger.batch_id = p_batch_id
          AND ledger.table_name = 'daily_usage'
          AND ledger.reason = 'aggregate mismatch repair'
          AND (ledger.row_key ->> 'user_id')::UUID = daily.user_id
          AND (ledger.row_key ->> 'date')::DATE = daily.date
      );

    WITH derived AS (
      SELECT
        devices.user_id,
        devices.date,
        sum(devices.cost_usd) AS cost_usd,
        sum(devices.input_tokens) AS input_tokens,
        sum(devices.output_tokens) AS output_tokens,
        sum(devices.reasoning_output_tokens) AS reasoning_output_tokens,
        sum(devices.cache_creation_tokens) AS cache_creation_tokens,
        sum(devices.cache_read_tokens) AS cache_read_tokens,
        sum(devices.total_tokens) AS total_tokens,
        sum(devices.session_count)::INTEGER AS session_count,
        COALESCE((
          SELECT jsonb_agg(DISTINCT model ORDER BY model)
          FROM public.device_usage AS model_rows
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(model_rows.models, '[]'::JSONB)
          ) AS model
          WHERE model_rows.user_id = devices.user_id
            AND model_rows.date = devices.date
        ), '[]'::JSONB) AS models,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'model', costs.model, 'cost_usd', costs.cost_usd
            ) ORDER BY costs.model
          )
          FROM (
            SELECT
              breakdown ->> 'model' AS model,
              sum((breakdown ->> 'cost_usd')::NUMERIC) AS cost_usd
            FROM public.device_usage AS cost_rows
            CROSS JOIN LATERAL jsonb_array_elements(
              COALESCE(cost_rows.model_breakdown, '[]'::JSONB)
            ) AS breakdown
            WHERE cost_rows.user_id = devices.user_id
              AND cost_rows.date = devices.date
            GROUP BY breakdown ->> 'model'
          ) AS costs
        ), '[]'::JSONB) AS model_breakdown
      FROM public.device_usage AS devices
      GROUP BY devices.user_id, devices.date
    )
    UPDATE public.daily_usage AS daily
    SET cost_usd = derived.cost_usd,
        input_tokens = derived.input_tokens,
        output_tokens = derived.output_tokens,
        reasoning_output_tokens = derived.reasoning_output_tokens,
        cache_creation_tokens = derived.cache_creation_tokens,
        cache_read_tokens = derived.cache_read_tokens,
        total_tokens = derived.total_tokens,
        models = derived.models,
        model_breakdown = derived.model_breakdown,
        session_count = derived.session_count,
        updated_at = now()
    FROM derived
    WHERE daily.user_id = derived.user_id
      AND daily.date = derived.date
      AND EXISTS (
        SELECT 1 FROM public.usage_corrections_ledger AS ledger
        WHERE ledger.batch_id = p_batch_id
          AND ledger.table_name = 'daily_usage'
          AND ledger.reason = 'aggregate mismatch repair'
          AND (ledger.row_key ->> 'user_id')::UUID = daily.user_id
          AND (ledger.row_key ->> 'date')::DATE = daily.date
      );

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
        SELECT 1 FROM public.usage_corrections_ledger AS ledger
        WHERE ledger.batch_id = p_batch_id
          AND ledger.table_name = 'posts'
          AND (ledger.row_key ->> 'id')::UUID = post.id
      );

    UPDATE public.usage_corrections_ledger AS ledger
    SET after_row = CASE ledger.table_name
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
    WHERE ledger.batch_id = p_batch_id
      AND ledger.reason IN (
        'aggregate mismatch repair',
        'aggregate mismatch generated title'
      );

    FOR v_candidate IN
      SELECT DISTINCT user_id
      FROM public.usage_corrections_ledger
      WHERE batch_id = p_batch_id
        AND reason = 'aggregate mismatch repair'
    LOOP
      PERFORM public.recalculate_user_level(v_candidate.user_id);
    END LOOP;
  END IF;

  PERFORM pg_catalog.set_config('straude.usage_repair_batch_id', '', true);

  UPDATE public.usage_repair_batches
  SET status = CASE
        WHEN v_processed < p_limit THEN 'completed'
        ELSE 'running'
      END,
      completed_at = CASE WHEN v_processed < p_limit THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'processed', v_processed,
    'complete', v_processed < p_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rollback_usage_repair_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_entry RECORD;
  v_restored INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usage_repair_batches
    WHERE id = p_batch_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'repair batch is not rollbackable' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.usage_agent_daily AS rows
  WHERE EXISTS (
    SELECT 1
    FROM public.usage_corrections_ledger AS ledger
    WHERE ledger.batch_id = p_batch_id
      AND ledger.table_name = 'usage_agent_daily'
      AND ledger.after_row IS NOT NULL
      AND rows.user_id = (ledger.after_row ->> 'user_id')::UUID
      AND rows.date = (ledger.after_row ->> 'date')::DATE
      AND rows.device_id = (ledger.after_row ->> 'device_id')::UUID
      AND rows.agent = ledger.after_row ->> 'agent'
  );
  DELETE FROM public.device_usage AS rows
  WHERE EXISTS (
    SELECT 1
    FROM public.usage_corrections_ledger AS ledger
    WHERE ledger.batch_id = p_batch_id
      AND ledger.table_name = 'device_usage'
      AND ledger.after_row IS NOT NULL
      AND rows.user_id = (ledger.after_row ->> 'user_id')::UUID
      AND rows.date = (ledger.after_row ->> 'date')::DATE
      AND rows.device_id = (ledger.after_row ->> 'device_id')::UUID
  );
  FOR v_entry IN
    SELECT * FROM public.usage_corrections_ledger
    WHERE batch_id = p_batch_id
    ORDER BY id DESC
  LOOP
    IF v_entry.table_name = 'usage_device_reconciliation_decisions' THEN
      DELETE FROM public.usage_device_reconciliation_decisions
      WHERE id = (v_entry.row_key ->> 'id')::UUID;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'usage_device_reconciliation_candidates'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.usage_device_reconciliation_candidates
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.usage_device_reconciliation_candidates, v_entry.before_row
      )).*
      ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          device_id_a = EXCLUDED.device_id_a,
          device_id_b = EXCLUDED.device_id_b,
          normalized_hostname = EXCLUDED.normalized_hostname,
          overlap_dates = EXCLUDED.overlap_dates,
          divergent_dates = EXCLUDED.divergent_dates,
          status = EXCLUDED.status,
          proof = EXCLUDED.proof,
          created_at = EXCLUDED.created_at,
          resolved_at = EXCLUDED.resolved_at;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'posts'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.posts
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.posts, v_entry.before_row
      )).*
      ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          daily_usage_id = EXCLUDED.daily_usage_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          images = EXCLUDED.images,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          usage_generated_title = EXCLUDED.usage_generated_title;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'usage_installation_aliases'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.usage_installation_aliases
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.usage_installation_aliases, v_entry.before_row
      )).*
      ON CONFLICT (user_id, device_id) DO UPDATE
      SET canonical_device_id = EXCLUDED.canonical_device_id,
          name = EXCLUDED.name,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'usage_agent_daily'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.usage_agent_daily
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.usage_agent_daily, v_entry.before_row
      )).*
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
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'device_usage'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.device_usage
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.device_usage, v_entry.before_row
      )).*
      ON CONFLICT (user_id, date, device_id) DO UPDATE
      SET device_name = EXCLUDED.device_name,
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
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at;
      v_restored := v_restored + 1;
    ELSIF v_entry.table_name = 'daily_usage'
      AND v_entry.before_row IS NOT NULL
    THEN
      INSERT INTO public.daily_usage
      SELECT (pg_catalog.jsonb_populate_record(
        NULL::public.daily_usage, v_entry.before_row
      )).*
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
          is_verified = EXCLUDED.is_verified,
          raw_hash = EXCLUDED.raw_hash,
          collector_meta = EXCLUDED.collector_meta,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at;
      v_restored := v_restored + 1;
    END IF;
  END LOOP;

  FOR v_entry IN
    SELECT DISTINCT user_id
    FROM public.usage_corrections_ledger
    WHERE batch_id = p_batch_id
  LOOP
    PERFORM public.recalculate_user_level(v_entry.user_id);
  END LOOP;

  UPDATE public.usage_repair_batches
  SET status = 'rolled_back', updated_at = now()
  WHERE id = p_batch_id;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'restored_rows', v_restored);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_usage_device_candidates(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.discover_usage_device_candidates(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_usage_device_candidate(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_usage_repair_batch(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_usage_repair_batch(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_usage_repair_batch(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_usage_device_candidates(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.discover_usage_device_candidates(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_usage_device_candidate(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_usage_repair_batch(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_usage_repair_batch(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_usage_repair_batch(UUID) TO service_role;
