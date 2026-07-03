-- Grant the server-side service role explicit write access to the tables that
-- POST /api/usage/submit writes through the service client.
--
-- These tables (daily_usage, device_usage, posts) were only ever GRANTed to
-- `authenticated`; service_role's access relied on Postgres default
-- privileges. Newer local Supabase images enforce table-level GRANTs for
-- service_role instead of falling back to those defaults, so the usage-submit
-- route started returning `permission denied for table device_usage` (500)
-- against a freshly-booted `supabase start` stack — breaking the real-Supabase
-- integration test. In hosted Supabase service_role already holds these
-- privileges, so these statements are idempotent no-ops there.

GRANT SELECT, INSERT, UPDATE ON public.daily_usage TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.device_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;
