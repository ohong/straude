CREATE OR REPLACE FUNCTION public.usage_web_installation_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT (
    substr(pg_catalog.md5('straude-web-import:' || p_user_id::TEXT), 1, 8)
    || '-'
    || substr(pg_catalog.md5('straude-web-import:' || p_user_id::TEXT), 9, 4)
    || '-5'
    || substr(pg_catalog.md5('straude-web-import:' || p_user_id::TEXT), 14, 3)
    || '-8'
    || substr(pg_catalog.md5('straude-web-import:' || p_user_id::TEXT), 18, 3)
    || '-'
    || substr(pg_catalog.md5('straude-web-import:' || p_user_id::TEXT), 21, 12)
  )::UUID
$function$;

REVOKE ALL ON FUNCTION public.usage_web_installation_id(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_web_installation_id(UUID) TO service_role;

-- The legacy browser import used one reserved device UUID for every account.
-- Normalize it before seeding the user-scoped installation alias table.
UPDATE public.device_usage
SET
  device_id = public.usage_web_installation_id(user_id),
  device_name = COALESCE(device_name, 'web-import')
WHERE device_id = '00000000-0000-0000-0000-000000000001'::UUID;

CREATE TABLE public.usage_installation_aliases (
  device_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  canonical_device_id UUID NOT NULL,
  name TEXT CHECK (name IS NULL OR char_length(name) <= 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);

CREATE INDEX usage_installation_aliases_user_canonical_idx
  ON public.usage_installation_aliases(user_id, canonical_device_id);

ALTER TABLE public.usage_installation_aliases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usage_installation_aliases FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_installation_aliases FROM anon;
REVOKE ALL ON TABLE public.usage_installation_aliases FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_installation_aliases TO service_role;

-- Preserve the original installation creation order so deterministic repairs
-- can choose the earliest known installation as canonical.
INSERT INTO public.usage_installation_aliases (
  device_id,
  user_id,
  canonical_device_id,
  name,
  created_at,
  updated_at
)
SELECT
  usage.device_id,
  usage.user_id,
  usage.device_id,
  pg_catalog.left(max(usage.device_name), 255),
  min(COALESCE(usage.created_at, pg_catalog.now())),
  max(COALESCE(usage.updated_at, usage.created_at, pg_catalog.now()))
FROM public.device_usage AS usage
GROUP BY usage.user_id, usage.device_id
ON CONFLICT (user_id, device_id) DO NOTHING;

CREATE TABLE public.usage_agent_daily (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  device_id UUID NOT NULL,
  agent TEXT NOT NULL CHECK (char_length(agent) BETWEEN 1 AND 100),
  models TEXT[] NOT NULL,
  input_tokens BIGINT NOT NULL CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL CHECK (output_tokens >= 0),
  reasoning_output_tokens BIGINT NOT NULL CHECK (reasoning_output_tokens >= 0),
  cache_creation_tokens BIGINT NOT NULL CHECK (cache_creation_tokens >= 0),
  cache_read_tokens BIGINT NOT NULL CHECK (cache_read_tokens >= 0),
  total_tokens BIGINT NOT NULL CHECK (
    total_tokens = input_tokens
      + output_tokens
      + reasoning_output_tokens
      + cache_creation_tokens
      + cache_read_tokens
  ),
  cost_usd NUMERIC(14, 6) NOT NULL CHECK (cost_usd >= 0),
  model_breakdown JSONB NOT NULL CHECK (jsonb_typeof(model_breakdown) = 'array'),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  collector JSONB NOT NULL CHECK (jsonb_typeof(collector) = 'object'),
  migration_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, device_id, agent)
);

CREATE INDEX usage_agent_daily_user_date_idx
  ON public.usage_agent_daily(user_id, date);

ALTER TABLE public.usage_agent_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usage_agent_daily FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_agent_daily FROM anon;
REVOKE ALL ON TABLE public.usage_agent_daily FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage_agent_daily TO service_role;

-- Existing rows predate source partitioning. Keep their accounting under one
-- explicit source until a trusted v2 snapshot atomically replaces it.
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
  created_at,
  updated_at
)
SELECT
  usage.user_id,
  usage.date,
  usage.device_id,
  'legacy-unpartitioned',
  ARRAY(
    SELECT value
    FROM jsonb_array_elements_text(COALESCE(usage.models, '[]'::JSONB)) AS value
  ),
  GREATEST(COALESCE(usage.input_tokens, 0), 0),
  GREATEST(COALESCE(usage.output_tokens, 0), 0),
  GREATEST(COALESCE(usage.reasoning_output_tokens, 0), 0)
    + GREATEST(
      COALESCE(usage.total_tokens, 0)
        - GREATEST(COALESCE(usage.input_tokens, 0), 0)
        - GREATEST(COALESCE(usage.output_tokens, 0), 0)
        - GREATEST(COALESCE(usage.reasoning_output_tokens, 0), 0)
        - GREATEST(COALESCE(usage.cache_creation_tokens, 0), 0)
        - GREATEST(COALESCE(usage.cache_read_tokens, 0), 0),
      0
    ),
  GREATEST(COALESCE(usage.cache_creation_tokens, 0), 0),
  GREATEST(COALESCE(usage.cache_read_tokens, 0), 0),
  GREATEST(
    COALESCE(usage.total_tokens, 0),
    GREATEST(COALESCE(usage.input_tokens, 0), 0)
      + GREATEST(COALESCE(usage.output_tokens, 0), 0)
      + GREATEST(COALESCE(usage.reasoning_output_tokens, 0), 0)
      + GREATEST(COALESCE(usage.cache_creation_tokens, 0), 0)
      + GREATEST(COALESCE(usage.cache_read_tokens, 0), 0)
  ),
  GREATEST(COALESCE(usage.cost_usd, 0), 0),
  COALESCE(usage.model_breakdown, '[]'::JSONB),
  pg_catalog.md5(
    usage.user_id::TEXT || ':' || usage.date::TEXT || ':' || usage.device_id::TEXT
  ) || pg_catalog.md5(COALESCE(usage.raw_hash, 'legacy-unpartitioned')),
  CASE
    WHEN jsonb_typeof(usage.collector_meta) = 'object' THEN usage.collector_meta
    ELSE jsonb_build_object('name', 'legacy-unpartitioned')
  END,
  COALESCE(usage.created_at, pg_catalog.now()),
  COALESCE(usage.updated_at, usage.created_at, pg_catalog.now())
FROM public.device_usage AS usage
ON CONFLICT (user_id, date, device_id, agent) DO NOTHING;

CREATE TABLE public.usage_submission_outcomes (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  date DATE NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  canonical_payload_hash TEXT NOT NULL CHECK (canonical_payload_hash ~ '^[a-f0-9]{64}$'),
  outcome JSONB NOT NULL CHECK (jsonb_typeof(outcome) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id, date)
);

ALTER TABLE public.usage_submission_outcomes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usage_submission_outcomes FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_submission_outcomes FROM anon;
REVOKE ALL ON TABLE public.usage_submission_outcomes FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_submission_outcomes TO service_role;

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
  v_migration_id TEXT := NULLIF(p_entry ->> 'migration_id', '');
  v_trusted_partitioned_snapshot BOOLEAN :=
    p_is_verified
    AND p_source = 'cli'
    AND p_collector ->> 'name' = 'ccusage'
    AND CASE
      WHEN COALESCE(p_collector ->> 'version', '') ~
        '^(0|[1-9][0-9]{0,15})\.(0|[1-9][0-9]{0,15})\.(0|[1-9][0-9]{0,15})(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
      THEN
        split_part(split_part(p_collector ->> 'version', '+', 1), '.', 1)::NUMERIC
          <= 9007199254740991
        AND split_part(split_part(p_collector ->> 'version', '+', 1), '.', 2)::NUMERIC
          <= 9007199254740991
        AND split_part(split_part(p_collector ->> 'version', '+', 1), '.', 3)::NUMERIC
          <= 9007199254740991
        AND (
          split_part(split_part(p_collector ->> 'version', '+', 1), '.', 1)::NUMERIC,
          split_part(split_part(p_collector ->> 'version', '+', 1), '.', 2)::NUMERIC,
          split_part(split_part(p_collector ->> 'version', '+', 1), '.', 3)::NUMERIC
        ) >= (20::NUMERIC, 0::NUMERIC, 18::NUMERIC)
      ELSE false
    END
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
  IF v_reconciliation_candidate_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'date', v_date,
      'status', 'identity_conflict',
      'error', jsonb_build_object(
        'code', 'device_reconciliation_required',
        'message', 'Device identity must be resolved before usage can be submitted'
      )
    );
  END IF;

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
        AND candidate.status IN ('proof_merge', 'ambiguous')
        AND candidate.device_id_a IN (
          v_canonical_device_id, v_possible_duplicate_device_id
        )
        AND candidate.device_id_b IN (
          v_canonical_device_id, v_possible_duplicate_device_id
        )
      LIMIT 1;
      IF v_reconciliation_candidate_id IS NOT NULL THEN
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

  SELECT cost_usd
  INTO v_previous_cost
  FROM public.daily_usage
  WHERE user_id = p_user_id
    AND date = v_date
  FOR UPDATE;
  v_action := CASE WHEN FOUND THEN 'updated' ELSE 'created' END;

  FOR v_agent IN
    SELECT value
    FROM jsonb_array_elements(p_entry -> 'agents')
  LOOP
    SELECT *
    INTO v_existing_agent
    FROM public.usage_agent_daily
    WHERE user_id = p_user_id
      AND date = v_date
      AND device_id = v_canonical_device_id
      AND agent = v_agent ->> 'agent'
    FOR UPDATE;

    IF NOT FOUND
      OR v_authoritative
      OR (
        v_legacy_authoritative
        AND v_agent ->> 'agent' = 'legacy-unpartitioned'
      )
      OR (
        (v_agent ->> 'cost_usd')::NUMERIC >= v_existing_agent.cost_usd
        AND (v_agent ->> 'input_tokens')::BIGINT >= v_existing_agent.input_tokens
        AND (v_agent ->> 'output_tokens')::BIGINT >= v_existing_agent.output_tokens
        AND (v_agent ->> 'reasoning_output_tokens')::BIGINT >= v_existing_agent.reasoning_output_tokens
        AND (v_agent ->> 'cache_creation_tokens')::BIGINT >= v_existing_agent.cache_creation_tokens
        AND (v_agent ->> 'cache_read_tokens')::BIGINT >= v_existing_agent.cache_read_tokens
        AND (v_agent ->> 'total_tokens')::BIGINT >= v_existing_agent.total_tokens
      )
    THEN
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
    END IF;
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
