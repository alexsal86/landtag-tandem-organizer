import { useMemo, useState } from "react";
import { CommentData, CommentThread } from "@/components/task-decisions/CommentThread";
import { Button } from "@/components/ui/button";

const NOW = new Date();

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const INITIAL_COMMENTS: CommentData[] = [
  {
    id: "root-1",
    user_id: "u1",
    content: "Das ist der Startkommentar (1. Ebene).",
    created_at: minutesAgo(220),
    updated_at: minutesAgo(220),
    parent_id: null,
    profile: { display_name: "Mitarbeiter", badge_color: null, avatar_url: null },
    replies: [
      {
        id: "r1-1",
        user_id: "u2",
        content: "Antwort Ebene 2 mit etwas längerem Text, damit wir Zeilenumbrüche und Connector-Längen sehen.",
        created_at: minutesAgo(180),
        updated_at: minutesAgo(180),
        parent_id: "root-1",
        profile: { display_name: "Alexander Salomon", badge_color: null, avatar_url: null },
        replies: [
          {
            id: "r1-1-1",
            user_id: "u1",
            content: "Ebene 3 – kurze Antwort.",
            created_at: minutesAgo(170),
            updated_at: minutesAgo(170),
            parent_id: "r1-1",
            profile: { display_name: "Mitarbeiter", badge_color: null, avatar_url: null },
            replies: [
              {
                id: "r1-1-1-1",
                user_id: "u2",
                content: "Ebene 4 – letzter direkter Reply, hier muss die Elternlinie sauber enden.",
                created_at: minutesAgo(160),
                updated_at: minutesAgo(160),
                parent_id: "r1-1-1",
                profile: { display_name: "Alexander Salomon", badge_color: null, avatar_url: null },
                replies: [],
              },
            ],
          },
          {
            id: "r1-1-2",
            user_id: "u3",
            content: "Zweiter Geschwister-Reply auf Ebene 3 – für vertikale Rail-Kontinuität.",
            created_at: minutesAgo(150),
            updated_at: minutesAgo(150),
            parent_id: "r1-1",
            profile: { display_name: "Julia Ne", badge_color: null, avatar_url: null },
            replies: [],
          },
        ],
      },
      {
        id: "r1-2",
        user_id: "u4",
        content: "Zweite Antwort auf Ebene 2.",
        created_at: minutesAgo(140),
        updated_at: minutesAgo(140),
        parent_id: "root-1",
        profile: { display_name: "Sissy Zündorf", badge_color: null, avatar_url: null },
        replies: [],
      },
    ],
  },
];

const updateCommentContent = (items: CommentData[], id: string, content: string): CommentData[] => {
  return items.map((item) => {
    if (item.id === id) {
      return { ...item, content, updated_at: new Date().toISOString() };
    }

    if (!item.replies?.length) return item;

    return { ...item, replies: updateCommentContent(item.replies, id, content) };
  });
};

const removeComment = (items: CommentData[], id: string): CommentData[] => {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      replies: item.replies?.length ? removeComment(item.replies, id) : item.replies,
    }));
};

const addReply = (items: CommentData[], parentId: string, reply: CommentData): CommentData[] => {
  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, replies: [...(item.replies || []), reply] };
    }

    if (!item.replies?.length) return item;

    return { ...item, replies: addReply(item.replies, parentId, reply) };
  });
};

export default function CommentThreadPlayground() {
  const [comments, setComments] = useState<CommentData[]>(INITIAL_COMMENTS);
  const [counter, setCounter] = useState(1);
  const [connectorPreset, setConnectorPreset] = useState<"facebook" | "compact">("facebook");

  const total = useMemo(() => {
    const count = (list: CommentData[]): number => list.reduce((acc, c) => acc + 1 + count(c.replies || []), 0);
    return count(comments);
  }, [comments]);

  const onReply = async (parentId: string, content: string) => {
    const id = `new-${counter}`;
    setCounter((v) => v + 1);
    setComments((prev) =>
      addReply(prev, parentId, {
        id,
        user_id: "u1",
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        parent_id: parentId,
        profile: { display_name: "Mitarbeiter", badge_color: null, avatar_url: null },
        replies: [],
      })
    );
  };

  const onEdit = async (commentId: string, content: string) => {
    setComments((prev) => updateCommentContent(prev, commentId, content));
  };

  const onDelete = async (commentId: string, hasReplies: boolean) => {
    if (hasReplies) {
      setComments((prev) => updateCommentContent(prev, commentId, "Dieser Kommentar wurde gelöscht."));
      return;
    }

    setComments((prev) => removeComment(prev, commentId));
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">CommentThread Playground</h1>
          <p className="text-sm text-muted-foreground">
            Lokale Demo ohne Plattformdaten. Hier kannst du nur die Thread-Linien und Endpunkte prüfen.
          </p>
          <p className="text-xs text-muted-foreground">Kommentare gesamt: {total}</p>
        </div>

        <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setComments(INITIAL_COMMENTS)}>
              Auf Initialzustand zurücksetzen
            </Button>
            <Button
              size="sm"
              variant={connectorPreset === "facebook" ? "default" : "outline"}
              onClick={() => setConnectorPreset("facebook")}
            >
              Connector: Facebook
            </Button>
            <Button
              size="sm"
              variant={connectorPreset === "compact" ? "default" : "outline"}
              onClick={() => setConnectorPreset("compact")}
            >
              Connector: Compact
            </Button>
          </div>

          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUserId="u1"
                connectorPreset={connectorPreset}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
