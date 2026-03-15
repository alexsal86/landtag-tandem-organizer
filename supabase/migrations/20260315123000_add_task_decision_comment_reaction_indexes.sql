-- Indexes for decision comment reaction lookups and client-side grouping by comment/emoji
create index if not exists idx_task_decision_comment_reactions_comment_id
  on public.task_decision_comment_reactions(comment_id);

create index if not exists idx_task_decision_comment_reactions_user_id
  on public.task_decision_comment_reactions(user_id);

create index if not exists idx_task_decision_comment_reactions_comment_emoji
  on public.task_decision_comment_reactions(comment_id, emoji);
