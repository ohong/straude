-- Private work usage never enters the community usage/post tables.
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  email text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON public.workspace_members(user_id);
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  revoked_at timestamptz,
  accepted_at timestamptz
);
CREATE INDEX workspace_invites_workspace_idx ON public.workspace_invites(workspace_id);
CREATE TABLE public.workspace_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  installation_id uuid NOT NULL,
  previous_device_id uuid,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  start_date date NOT NULL DEFAULT ((clock_timestamp() AT TIME ZONE 'UTC')::date + 1),
  first_sync_at timestamptz,
  last_received_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workspace_sources_active_installation_idx
  ON public.workspace_sources(user_id, installation_id) WHERE revoked_at IS NULL;
CREATE INDEX workspace_sources_workspace_idx ON public.workspace_sources(workspace_id);
CREATE TABLE public.workspace_usage_days (
  source_id uuid NOT NULL REFERENCES public.workspace_sources(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  date date NOT NULL,
  agents jsonb NOT NULL CHECK (jsonb_typeof(agents) = 'array'),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, date)
);
CREATE INDEX workspace_usage_days_workspace_date_idx ON public.workspace_usage_days(workspace_id, date);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces, public.workspace_members, public.workspace_invites,
  public.workspace_sources, public.workspace_usage_days FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces, public.workspace_members,
  public.workspace_invites, public.workspace_sources, public.workspace_usage_days TO service_role;

-- The trusted server supplies actor identity after checking Auth/CLI credentials.
-- One workspace lock serializes membership removal, invite revocation and sync.
CREATE OR REPLACE FUNCTION public.workspace_action(p_actor uuid, p_action text, p_workspace uuid DEFAULT NULL, p_input jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  w public.workspaces%ROWTYPE;
  m public.workspace_members%ROWTYPE;
  i public.workspace_invites%ROWTYPE;
  s public.workspace_sources%ROWTYPE;
  d jsonb;
  result jsonb;
  day date;
  identities uuid[];
  identity uuid;
  today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'list' THEN
    RETURN jsonb_build_object('workspaces', COALESCE((
      SELECT jsonb_agg(to_jsonb(ws) || jsonb_build_object('role', mem.role) ORDER BY ws.created_at)
      FROM public.workspaces ws JOIN public.workspace_members mem ON mem.workspace_id = ws.id
      WHERE mem.user_id = p_actor AND mem.removed_at IS NULL
    ), '[]'::jsonb));
  END IF;
  IF p_action = 'create' THEN
    INSERT INTO public.workspaces(name, created_by) VALUES (p_input->>'name', p_actor) RETURNING * INTO w;
    INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES (w.id,p_actor,'owner');
    RETURN jsonb_build_object('workspace',to_jsonb(w));
  END IF;
  IF p_action = 'join' THEN
    SELECT * INTO i FROM public.workspace_invites WHERE token_hash = p_input->>'token_hash';
    IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE = '42501'; END IF;
    p_workspace := i.workspace_id;
  END IF;
  SELECT * INTO w FROM public.workspaces WHERE id = p_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501'; END IF;
  IF p_action = 'join' THEN
    SELECT * INTO i FROM public.workspace_invites WHERE id = i.id FOR UPDATE;
    IF i.revoked_at IS NOT NULL OR i.accepted_at IS NOT NULL OR i.expires_at <= now()
      OR i.email IS DISTINCT FROM lower(p_input->>'actor_email')
      OR EXISTS (SELECT 1 FROM public.workspace_members former
        WHERE former.workspace_id=w.id AND former.user_id=p_actor
          AND former.removed_at IS NOT NULL AND i.created_at<=former.removed_at) THEN
      RAISE EXCEPTION 'Invitation unavailable for this account' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.workspace_members(workspace_id,user_id,role,email) VALUES (w.id,p_actor,'member',lower(p_input->>'actor_email'))
    ON CONFLICT (workspace_id,user_id) DO UPDATE SET removed_at = NULL, email = EXCLUDED.email,
      joined_at = CASE WHEN public.workspace_members.removed_at IS NULL THEN public.workspace_members.joined_at ELSE now() END;
    UPDATE public.workspace_invites SET accepted_at = now() WHERE id = i.id;
    RETURN jsonb_build_object('workspace_id',w.id);
  END IF;
  SELECT * INTO m FROM public.workspace_members
    WHERE workspace_id = w.id AND user_id = p_actor AND removed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501'; END IF;
  IF p_action IN ('detail','report') THEN
    result := jsonb_build_object('workspace',to_jsonb(w),'role',m.role,
      'members',COALESCE((SELECT jsonb_agg(to_jsonb(mem) || jsonb_build_object('display_name',COALESCE(u.display_name,u.username),'email',mem.email) ORDER BY mem.joined_at)
        FROM public.workspace_members mem JOIN public.users u ON u.id=mem.user_id WHERE mem.workspace_id=w.id),'[]'::jsonb),
      'sources',COALESCE((SELECT jsonb_agg(to_jsonb(src) || jsonb_build_object(
        'latest_usage_date',(SELECT max(usage.date) FROM public.workspace_usage_days usage WHERE usage.source_id=src.id)
      ) ORDER BY src.created_at) FROM public.workspace_sources src WHERE src.workspace_id=w.id),'[]'::jsonb));
    IF p_action = 'detail' THEN
      RETURN result || jsonb_build_object('invites',CASE WHEN m.role='owner' THEN COALESCE((
        SELECT jsonb_agg(to_jsonb(inv)-'token_hash' ORDER BY inv.created_at) FROM public.workspace_invites inv WHERE inv.workspace_id=w.id
      ),'[]'::jsonb) ELSE '[]'::jsonb END);
    END IF;
    IF (p_input->>'end')::date < (p_input->>'start')::date
      OR (p_input->>'end')::date - (p_input->>'start')::date > 366 THEN
      RAISE EXCEPTION 'Invalid report range' USING ERRCODE='22023';
    END IF;
    RETURN result || jsonb_build_object('days',COALESCE((
      SELECT jsonb_agg(to_jsonb(usage) ORDER BY usage.date,usage.source_id) FROM public.workspace_usage_days usage
      WHERE usage.workspace_id=w.id AND usage.date BETWEEN (p_input->>'start')::date AND (p_input->>'end')::date
    ),'[]'::jsonb));
  END IF;
  IF p_action = 'source' THEN
    IF p_input->'work_only' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'A work-only source must be explicitly confirmed' USING ERRCODE='22023';
    END IF;
    -- Protect the durable installation and the device identity used by older CLIs.
    -- Expand known aliases so two workspaces cannot adopt the same canonical source.
    SELECT array_agg(DISTINCT candidate) INTO identities FROM (
      SELECT unnest(ARRAY[(p_input->>'installation_id')::uuid,(p_input->>'previous_device_id')::uuid]) AS candidate
      UNION SELECT alias.canonical_device_id FROM public.usage_installation_aliases alias
        WHERE alias.user_id=p_actor AND alias.device_id=ANY(ARRAY[(p_input->>'installation_id')::uuid,(p_input->>'previous_device_id')::uuid])
    ) candidates WHERE candidate IS NOT NULL;
    FOR identity IN SELECT unnest(identities) ORDER BY 1 LOOP
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':work-source:' || identity::text,0));
    END LOOP;
    SELECT * INTO s FROM public.workspace_sources
      WHERE user_id=p_actor AND installation_id=(p_input->>'installation_id')::uuid AND revoked_at IS NULL;
    IF EXISTS (SELECT 1 FROM public.workspace_sources src
      WHERE src.user_id=p_actor AND src.revoked_at IS NULL AND src.id IS DISTINCT FROM s.id AND (
        src.installation_id=ANY(identities) OR src.previous_device_id=ANY(identities)
        OR EXISTS (SELECT 1 FROM public.usage_installation_aliases alias
          WHERE alias.user_id=p_actor AND alias.device_id=ANY(ARRAY[src.installation_id,src.previous_device_id])
            AND alias.canonical_device_id=ANY(identities))
      )) THEN
      RAISE EXCEPTION 'This device identity already belongs to an active work source' USING ERRCODE='22023';
    END IF;
    IF s.id IS NOT NULL THEN
      IF s.workspace_id<>w.id THEN RAISE EXCEPTION 'Source belongs to another workspace' USING ERRCODE='22023'; END IF;
      IF s.previous_device_id IS NOT NULL AND p_input->>'previous_device_id' IS NOT NULL
        AND s.previous_device_id<>(p_input->>'previous_device_id')::uuid THEN
        RAISE EXCEPTION 'The previous device identity cannot be changed' USING ERRCODE='22023';
      END IF;
      UPDATE public.workspace_sources SET previous_device_id=COALESCE(previous_device_id,(p_input->>'previous_device_id')::uuid)
        WHERE id=s.id RETURNING * INTO s;
      RETURN jsonb_build_object('source',to_jsonb(s));
    END IF;
    INSERT INTO public.workspace_sources(workspace_id,user_id,installation_id,previous_device_id,name)
      VALUES(w.id,p_actor,(p_input->>'installation_id')::uuid,(p_input->>'previous_device_id')::uuid,p_input->>'name') RETURNING * INTO s;
    RETURN jsonb_build_object('source',to_jsonb(s));
  END IF;
  IF p_action = 'sync' THEN
    SELECT * INTO s FROM public.workspace_sources WHERE id=(p_input->>'source_id')::uuid
      AND workspace_id=w.id AND user_id=p_actor AND installation_id=(p_input->>'installation_id')::uuid AND revoked_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Work source unavailable; enroll a work-only source' USING ERRCODE='42501'; END IF;
    IF p_input->>'timezone' IS DISTINCT FROM 'UTC' OR jsonb_typeof(p_input->'entries') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_input->'entries') NOT BETWEEN 1 AND 31 THEN
      RAISE EXCEPTION 'Invalid private sync' USING ERRCODE='22023';
    END IF;
    FOR d IN SELECT value FROM jsonb_array_elements(p_input->'entries') LOOP
      day := (d->>'date')::date;
      IF day IS NULL OR day < s.start_date OR day > today OR day < today-30 THEN
        RAISE EXCEPTION 'Date outside this source sharing window' USING ERRCODE='22023';
      END IF;
      -- Missing or rotated collector logs must not erase already received work.
      -- Corrections that reduce counters require an explicit future correction flow.
      IF EXISTS (
        SELECT 1 FROM public.workspace_usage_days previous,
          LATERAL jsonb_array_elements(previous.agents) old_agent
        WHERE previous.source_id=s.id AND previous.date=day AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(d->'agents') new_agent
          WHERE new_agent->>'agent'=old_agent->>'agent'
            AND (new_agent->>'input_tokens')::numeric >= (old_agent->>'input_tokens')::numeric
            AND (new_agent->>'output_tokens')::numeric >= (old_agent->>'output_tokens')::numeric
            AND (new_agent->>'reasoning_output_tokens')::numeric >= (old_agent->>'reasoning_output_tokens')::numeric
            AND (new_agent->>'cache_creation_tokens')::numeric >= (old_agent->>'cache_creation_tokens')::numeric
            AND (new_agent->>'cache_read_tokens')::numeric >= (old_agent->>'cache_read_tokens')::numeric
            AND (new_agent->>'total_tokens')::numeric >= (old_agent->>'total_tokens')::numeric
        )
      ) THEN
        RAISE EXCEPTION 'Previously received usage decreased. Restore this work source logs and retry; automatic corrections are not supported.' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.workspace_usage_days(source_id,workspace_id,user_id,date,agents)
        VALUES(s.id,w.id,p_actor,day,d->'agents')
        ON CONFLICT(source_id,date) DO UPDATE SET agents=EXCLUDED.agents,received_at=now();
    END LOOP;
    UPDATE public.workspace_sources SET first_sync_at=COALESCE(first_sync_at,now()),last_received_at=now()
      WHERE id=s.id RETURNING * INTO s;
    RETURN jsonb_build_object('accepted_days',jsonb_array_length(p_input->'entries'),'first_sync_at',s.first_sync_at,'last_received_at',s.last_received_at);
  END IF;
  IF m.role <> 'owner' THEN RAISE EXCEPTION 'Workspace owner required' USING ERRCODE='42501'; END IF;
  IF p_action = 'invite' THEN
    INSERT INTO public.workspace_invites(workspace_id,email,token_hash)
      VALUES(w.id,lower(p_input->>'email'),p_input->>'token_hash') RETURNING * INTO i;
    RETURN jsonb_build_object('invite',to_jsonb(i)-'token_hash');
  ELSIF p_action = 'revoke' THEN
    UPDATE public.workspace_invites SET revoked_at=now() WHERE id=(p_input->>'invite_id')::uuid AND workspace_id=w.id;
    RETURN jsonb_build_object('ok',true);
  ELSIF p_action = 'remove' THEN
    IF p_input->>'user_id'=p_actor::text THEN RAISE EXCEPTION 'The owner cannot remove themselves' USING ERRCODE='22023'; END IF;
    UPDATE public.workspace_members SET removed_at=now() WHERE workspace_id=w.id AND user_id=(p_input->>'user_id')::uuid AND role='member';
    UPDATE public.workspace_invites SET revoked_at=now() WHERE workspace_id=w.id AND accepted_at IS NULL AND email=(SELECT email FROM public.workspace_members WHERE workspace_id=w.id AND user_id=(p_input->>'user_id')::uuid);
    UPDATE public.workspace_sources SET revoked_at=now() WHERE workspace_id=w.id AND user_id=(p_input->>'user_id')::uuid AND revoked_at IS NULL;
    RETURN jsonb_build_object('ok',true);
  END IF;
  RAISE EXCEPTION 'Unknown workspace action' USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public.workspace_action(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_action(uuid,text,uuid,jsonb) TO service_role;

-- A stale CLI/public outbox cannot publish any designated source snapshot.
-- Legacy senders aggregate in local time, so a pre-start date may contain work
-- after UTC consent. Preserve stored personal history but block every public
-- insert/update for these identities, including after source revocation.
CREATE OR REPLACE FUNCTION public.guard_private_work_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text || ':work-source:' || NEW.device_id::text,0));
  IF EXISTS (SELECT 1 FROM public.workspace_sources src
    LEFT JOIN public.usage_installation_aliases alias ON alias.user_id=src.user_id AND alias.device_id=ANY(ARRAY[src.installation_id,src.previous_device_id])
    WHERE src.user_id=NEW.user_id AND (src.installation_id=NEW.device_id OR src.previous_device_id=NEW.device_id OR alias.canonical_device_id=NEW.device_id)) THEN
    RAISE EXCEPTION 'This installation shares work usage privately; use workspace sync' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_private_work_source() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_private_work_source() TO service_role;
CREATE TRIGGER private_work_source_guard BEFORE INSERT OR UPDATE ON public.usage_agent_daily
  FOR EACH ROW EXECUTE FUNCTION public.guard_private_work_source();
CREATE TRIGGER private_work_device_guard BEFORE INSERT OR UPDATE ON public.device_usage
  FOR EACH ROW EXECUTE FUNCTION public.guard_private_work_source();
