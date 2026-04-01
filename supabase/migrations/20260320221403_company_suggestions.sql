CREATE TABLE IF NOT EXISTS public.company_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  company_url text NOT NULL,
  policy_description text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'accepted', 'rejected', 'published')
  ),
  is_hidden boolean NOT NULL DEFAULT false,
  admin_notes text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_suggestions_status_created_idx
  ON public.company_suggestions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS company_suggestions_user_created_idx
  ON public.company_suggestions (user_id, created_at DESC);
ALTER TABLE public.company_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own company suggestions"
  ON public.company_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);;
