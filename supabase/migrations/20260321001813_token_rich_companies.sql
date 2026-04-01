CREATE TABLE IF NOT EXISTS public.token_rich_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_url text,
  hq_city text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('Big Tech', 'Startup')),
  policy text NOT NULL CHECK (policy IN ('Unlimited', 'Very High')),
  source_text text NOT NULL DEFAULT '',
  source_link_label text,
  source_link_url text,
  display_order integer NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_rich_companies_order_idx
  ON public.token_rich_companies (display_order);

ALTER TABLE public.token_rich_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.token_rich_companies FOR SELECT
  USING (is_published = true);;
