-- Existing profiles keep their audience. An unattended first sync stays private.
alter table public.users alter column is_public set default false;

-- Only accepted relationships belong in follows. Existing feed, DM, and RLS
-- checks can continue treating a follow row as permission to read.
create table public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follow_requests_inbox on public.follow_requests (following_id, created_at);
alter table public.follow_requests enable row level security;
revoke all on public.follow_requests from public, anon, authenticated;
grant select, insert, delete on public.follow_requests to service_role;

alter table public.notifications add column follow_request_id uuid
  references public.follow_requests(id) on delete cascade;
create index notifications_follow_request on public.notifications(follow_request_id)
  where follow_request_id is not null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow','kudos','comment','mention','message','referral','follow_request'));

-- Lock the recipient while checking visibility, so a concurrent privacy change
-- cannot grant a new follow after the account has gone private.
create function public.change_follow(p_actor uuid, p_target uuid, p_action text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  target_public boolean;
  request_id uuid;
begin
  select is_public into strict target_public from public.users
    where id = p_target and deleted_at is null for update;
  if p_actor = p_target then raise exception 'Cannot follow yourself'; end if;

  if p_action = 'unfollow' then
    delete from public.follow_requests where follower_id = p_actor and following_id = p_target;
    delete from public.follows where follower_id = p_actor and following_id = p_target;
    return 'none';
  end if;
  if p_action not in ('follow', 'suggested') or p_action is null then
    raise exception 'Unknown follow action';
  end if;
  if exists (select from public.follows where follower_id = p_actor and following_id = p_target) then
    return 'following';
  end if;
  if not target_public then
    if p_action = 'suggested' then return 'none'; end if;
    insert into public.follow_requests(follower_id,following_id) values(p_actor,p_target)
      on conflict (follower_id,following_id) do nothing returning id into request_id;
    if found then
      insert into public.notifications(user_id,actor_id,type,follow_request_id)
        values(p_target,p_actor,'follow_request',request_id);
    end if;
    return 'requested';
  end if;

  insert into public.follows(follower_id,following_id) values(p_actor,p_target);
  delete from public.follow_requests where follower_id = p_actor and following_id = p_target;
  if p_action = 'follow' then
    insert into public.notifications(user_id,actor_id,type) values(p_target,p_actor,'follow');
  end if;
  return 'following';
end;
$$;

create function public.review_follow_request(p_owner uuid, p_request uuid, p_approve boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  requester uuid;
begin
  perform 1 from public.users where id = p_owner and deleted_at is null for update;
  if not found then raise exception 'Account unavailable'; end if;
  delete from public.follow_requests where id = p_request and following_id = p_owner
    returning follower_id into requester;
  -- Repeated decisions and withdrawn requests cannot create new access.
  if found and p_approve then
    insert into public.follows(follower_id,following_id) values(requester,p_owner)
      on conflict (follower_id,following_id) do nothing;
  end if;
end;
$$;
revoke all on function public.change_follow(uuid,uuid,text),
  public.review_follow_request(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.change_follow(uuid,uuid,text),
  public.review_follow_request(uuid,uuid,boolean) to service_role;

-- Account deletion keeps a tombstone in users, so ON DELETE alone is insufficient.
create function public.clear_deleted_follow_requests() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.follow_requests where follower_id = new.id or following_id = new.id;
  return new;
end;
$$;
revoke all on function public.clear_deleted_follow_requests() from public, anon, authenticated;
create trigger clear_deleted_follow_requests after update of deleted_at on public.users
for each row when (old.deleted_at is null and new.deleted_at is not null)
execute function public.clear_deleted_follow_requests();
