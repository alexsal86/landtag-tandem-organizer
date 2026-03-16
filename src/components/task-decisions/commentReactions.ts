import { CommentReactionData } from "./CommentThread";

export const DEFAULT_REACTION_ORDER = ["👍", "❤️", "🎉", "👀"] as const;
export const MAX_VISIBLE_REACTIONS = 4;

export interface ReactionRow {
  comment_id: string;
  emoji: string;
  user_id: string;
  profile?: {
    display_name: string | null;
  } | null;
}

interface AggregatedReaction {
  count: number;
  reactedUsers: Map<string, string>;
}

export const buildReactionMap = (
  rows: ReactionRow[],
  currentUserId?: string,
): Map<string, CommentReactionData[]> => {
  const grouped = new Map<string, Map<string, AggregatedReaction>>();

  rows.forEach((reaction) => {
    if (!grouped.has(reaction.comment_id)) {
      grouped.set(reaction.comment_id, new Map());
    }

    const byEmoji = grouped.get(reaction.comment_id)!;
    if (!byEmoji.has(reaction.emoji)) {
      byEmoji.set(reaction.emoji, { count: 0, reactedUsers: new Map() });
    }

    const entry = byEmoji.get(reaction.emoji)!;
    entry.count += 1;
    entry.reactedUsers.set(reaction.user_id, reaction.profile?.display_name || "Unbekannt");
  });

  const mapped = new Map<string, CommentReactionData[]>();
  grouped.forEach((emojiMap, commentId) => {
    mapped.set(
      commentId,
      [...emojiMap.entries()].map(([emoji, stats]) => ({
        emoji,
        count: stats.count,
        currentUserReacted: Boolean(currentUserId && stats.reactedUsers.has(currentUserId)),
        reactedUsers: [...stats.reactedUsers.entries()].map(([userId, displayName]) => ({ userId, displayName })),
      })),
    );
  });

  return mapped;
};

export const sortReactionEntries = (
  reactions: CommentReactionData[] = [],
): CommentReactionData[] => {
  const order = new Map(DEFAULT_REACTION_ORDER.map((emoji, index) => [emoji, index]));

  return [...reactions].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    const aOrder = order.get(a.emoji as typeof DEFAULT_REACTION_ORDER[number]) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.emoji as typeof DEFAULT_REACTION_ORDER[number]) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.emoji.localeCompare(b.emoji);
  });
};

export const splitVisibleReactions = (
  reactions: CommentReactionData[] = [],
  maxVisible = MAX_VISIBLE_REACTIONS,
): { visible: CommentReactionData[]; overflow: CommentReactionData[] } => {
  const sorted = sortReactionEntries(reactions);
  return {
    visible: sorted.slice(0, maxVisible),
    overflow: sorted.slice(maxVisible),
  };
};
