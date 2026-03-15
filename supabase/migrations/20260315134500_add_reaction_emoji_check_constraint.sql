-- Restrict decision comment reactions to a curated emoji allowlist.
-- Erweiterbar: Liste bei Bedarf um weitere freigegebene Emojis ergänzen.
ALTER TABLE public.task_decision_comment_reactions
  DROP CONSTRAINT IF EXISTS task_decision_comment_reactions_emoji_check;

ALTER TABLE public.task_decision_comment_reactions
  ADD CONSTRAINT task_decision_comment_reactions_emoji_check
  CHECK (
    emoji = ANY (
      ARRAY[
        '👍',
        '❤️',
        '🎉',
        '👀',
        '✅',
        '❌',
        '🤔',
        '🙏'
      ]::text[]
    )
  );
