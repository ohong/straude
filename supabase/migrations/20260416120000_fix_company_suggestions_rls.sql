-- Fix company_suggestions RLS: users were hitting 42501 on INSERT from /token-rich.
-- Recreate policies idempotently and add a SELECT policy so `.insert().select()`
-- can return the newly inserted row via RETURNING.

ALTER TABLE public.company_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own company suggestions" ON public.company_suggestions;
CREATE POLICY "Users can create their own company suggestions"
  ON public.company_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own company suggestions" ON public.company_suggestions;
CREATE POLICY "Users can view their own company suggestions"
  ON public.company_suggestions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
