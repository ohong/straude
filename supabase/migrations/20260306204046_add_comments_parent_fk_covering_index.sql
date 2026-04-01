create index idx_comments_parent_comment_post
  on public.comments(parent_comment_id, post_id);;
