create table public.weekly_build_highlights (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  post_id uuid not null unique references public.posts(id) on delete cascade,
  primary key (user_id, week_start)
);
alter table public.weekly_build_highlights enable row level security;
revoke all on public.weekly_build_highlights from public, anon, authenticated;
grant select on public.weekly_build_highlights to anon, authenticated;
grant insert, update, delete on public.weekly_build_highlights to authenticated;
grant all on public.weekly_build_highlights to service_role;

create policy "Highlights follow post visibility" on public.weekly_build_highlights
for select using (exists (select 1 from public.posts p where p.id = post_id));

create policy "Select an owned post from the same week" on public.weekly_build_highlights
for all to authenticated using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.posts p join public.daily_usage d on d.id = p.daily_usage_id
    where p.id = post_id and p.user_id = (select auth.uid())
      and week_start = date_trunc('week', d.date::timestamp)::date
      and ((not p.usage_generated_title and nullif(btrim(p.title), '') is not null)
        or nullif(btrim(p.description), '') is not null or jsonb_array_length(p.images) > 0)
  )
);
