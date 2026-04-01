alter table public.comments
  add column parent_comment_id uuid;

alter table public.comments
  add constraint comments_id_post_id_key unique (id, post_id);

alter table public.comments
  add constraint comments_parent_comment_not_self
  check (parent_comment_id is null or parent_comment_id <> id);

alter table public.comments
  add constraint comments_parent_comment_id_fkey
  foreign key (parent_comment_id, post_id)
  references public.comments(id, post_id)
  on delete cascade;

create index idx_comments_post_parent_created
  on public.comments(post_id, parent_comment_id, created_at asc);

create table public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index idx_comment_reactions_comment_id
  on public.comment_reactions(comment_id, created_at desc);

create index idx_comment_reactions_user_id
  on public.comment_reactions(user_id);

alter table public.comment_reactions enable row level security;

create policy "Anyone can view comment reactions"
  on public.comment_reactions for select
  using (true);

create policy "Users can react to comments"
  on public.comment_reactions for insert
  with check (user_id = auth.uid());

create policy "Users can remove own comment reactions"
  on public.comment_reactions for delete
  using (user_id = auth.uid());

revoke all on public.comment_reactions from anon;
grant select on public.comment_reactions to anon;

revoke all on public.comment_reactions from authenticated;
grant select, insert, delete on public.comment_reactions to authenticated;;
