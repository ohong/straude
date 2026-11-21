-- Membership shares a display name and progress. Posts keep their own audience.
create table public.build_challenges (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.users(id) on delete set null,
  start_date date not null,
  unique (organizer_id, start_date)
);
create table public.build_challenge_members (
  challenge_id uuid references public.build_challenges(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (challenge_id, user_id)
);
create index build_challenge_members_user on public.build_challenge_members(user_id);
create table public.build_challenge_entries (
  challenge_id uuid not null,
  user_id uuid not null,
  day date not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  primary key (challenge_id, user_id, day),
  foreign key (challenge_id, user_id) references public.build_challenge_members on delete cascade
);
create index build_challenge_entries_post on public.build_challenge_entries(post_id);

alter table public.build_challenges enable row level security;
alter table public.build_challenge_members enable row level security;
alter table public.build_challenge_entries enable row level security;
revoke all on public.build_challenges, public.build_challenge_members, public.build_challenge_entries from public,anon,authenticated;
grant all on public.build_challenges, public.build_challenge_members, public.build_challenge_entries to service_role;
grant select on public.build_challenges, public.build_challenge_members, public.build_challenge_entries to authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;
create function private.is_build_challenge_member(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from public.build_challenge_members m where m.challenge_id = target and m.user_id = (select auth.uid()))
$$;
revoke all on function private.is_build_challenge_member(uuid) from public, anon;
grant execute on function private.is_build_challenge_member(uuid) to authenticated;
create policy members_read_challenges on public.build_challenges for select to authenticated using (private.is_build_challenge_member(id));
create policy members_read_roster on public.build_challenge_members for select to authenticated using (private.is_build_challenge_member(challenge_id));
create policy members_read_contributions on public.build_challenge_entries for select to authenticated using (private.is_build_challenge_member(challenge_id));

create function public.update_build_challenge(action text, target uuid default null, post uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  starts date;
  build_day date;
begin
  if not exists(select from public.users where id = actor and deleted_at is null) then
    raise exception 'Sign in to participate.';
  end if;
  if action = 'create' then
    starts := date_trunc('week', today::timestamp)::date;
    insert into public.build_challenges(organizer_id,start_date) values(actor,starts)
      on conflict (organizer_id,start_date) do update set organizer_id = excluded.organizer_id returning id into target;
    action := 'join';
  end if;
  -- Serialize capacity, submissions and departure within this group.
  select start_date into starts from public.build_challenges where id = target for update;
  if not found then raise exception 'This invitation is unavailable.'; end if;
  if action = 'leave' then
    delete from public.build_challenge_members where challenge_id = target and user_id = actor;
    return target;
  end if;
  if today not between starts and starts + 6 then raise exception 'This challenge has ended.'; end if;
  if action = 'join' then
    if private.is_build_challenge_member(target) then return target; end if;
    if (select count(*) from public.build_challenge_members where challenge_id = target) >= 6 then
      raise exception 'This challenge is full.';
    end if;
    insert into public.build_challenge_members values (target,actor);
  elsif action = 'share' and private.is_build_challenge_member(target) then
    select d.date into build_day from public.posts p join public.daily_usage d on d.id = p.daily_usage_id
      where p.id = post and p.user_id = actor and d.user_id = actor and d.date between starts and today
      and ((not p.usage_generated_title and nullif(btrim(p.title),'') is not null)
        or nullif(btrim(p.description),'') is not null or jsonb_array_length(p.images) > 0);
    if not found then raise exception 'Choose one of your authored posts from this week.'; end if;
    insert into public.build_challenge_entries values (target,actor,build_day,post)
      on conflict (challenge_id,user_id,day) do update set post_id = excluded.post_id;
  else raise exception 'This action is unavailable.';
  end if;
  return target;
end;
$$;
revoke all on function public.update_build_challenge(text,uuid,uuid) from public,anon;
grant execute on function public.update_build_challenge(text,uuid,uuid) to authenticated;

-- Straude account deletion soft-deletes the profile. Remove opt-ins at that transition.
create function private.clear_build_challenge_memberships() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.build_challenge_members where user_id = new.id;
  update public.build_challenges set organizer_id = null where organizer_id = new.id;
  return new;
end;
$$;
revoke all on function private.clear_build_challenge_memberships() from public,anon,authenticated;
create trigger clear_deleted_build_challenge_memberships after update of deleted_at on public.users for each row
when (old.deleted_at is null and new.deleted_at is not null) execute function private.clear_build_challenge_memberships();
