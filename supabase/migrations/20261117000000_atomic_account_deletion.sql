-- A failed cleanup or ban rolls back the whole account transition.
create function public.delete_straude_account(p_user_id uuid, p_username text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile public.users%rowtype;
begin
  select * into profile from public.users where id = p_user_id for update;
  if not found then return false; end if;
  if profile.deleted_at is null and profile.username is distinct from p_username then
    return false;
  end if;

  delete from public.posts where user_id = p_user_id;
  delete from public.user_achievements where user_id = p_user_id;
  delete from public.user_levels where user_id = p_user_id;
  delete from public.device_usage where user_id = p_user_id;
  delete from public.usage_installation_aliases where user_id = p_user_id;
  delete from public.usage_agent_daily where user_id = p_user_id;
  delete from public.usage_submission_outcomes where user_id = p_user_id;
  delete from public.usage_device_reconciliation_decisions where user_id = p_user_id;
  delete from public.usage_corrections_ledger where user_id = p_user_id;
  delete from public.prompt_submissions where user_id = p_user_id;
  delete from public.cli_auth_codes where user_id = p_user_id;
  delete from public.usage_device_reconciliation_candidates where user_id = p_user_id;
  delete from public.follows where follower_id = p_user_id or following_id = p_user_id;
  delete from public.notifications where user_id = p_user_id or actor_id = p_user_id;

  update public.users set
    username = 'deleted_' || left(p_user_id::text, 8), display_name = null, bio = null,
    avatar_url = null, country = null, region = null, link = null, github_username = null,
    team_url = null, team_favicon_url = null, deleted_at = coalesce(deleted_at, now()),
    heard_about = null, heard_about_sources = null, is_public = false,
    email_notifications = false, email_mention_notifications = false, email_dm_notifications = false
  where id = p_user_id;
  update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  if not found then raise exception 'Missing authentication account'; end if;
  return true;
end;
$$;
revoke all on function public.delete_straude_account(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_straude_account(uuid, text) to service_role;
