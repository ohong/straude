-- Multi-select acquisition sources captured by the onboarding survey.
--
-- Separate from `users.heard_about`, which keeps its original free-text role
-- (the optional "Other" detail). Keys are stable machine values defined in
-- apps/web/lib/onboarding/heard-about-options.ts; the API validates them.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS heard_about_sources TEXT[]
CHECK (
  heard_about_sources IS NULL
  OR cardinality(heard_about_sources) <= 20
);;
