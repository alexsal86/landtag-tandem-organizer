import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Reply, Send, CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const DELETED_COMMENT_TEXT = "Dieser Kommentar wurde gelöscht.";

export interface CommentData {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  parent_id: string | null;
  profile?: {
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  replies?: CommentData[];
}

interface CommentThreadProps {
  comment: CommentData;
  depth?: number;
  maxDepth?: number;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string, hasReplies: boolean) => Promise<void>;
  currentUserId?: string;
  isLastReply?: boolean;
  avatarRef?: (node: HTMLElement | null) => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function CommentThread({
  comment,
  depth = 0,
  maxDepth = 3,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
  isLastReply = false,
  avatarRef,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const [lastReplyTerminalAvatarEl, setLastReplyTerminalAvatarEl] = useState<HTMLElement | null>(null);
  const [connectorBottomOffset, setConnectorBottomOffset] = useState(0);

  const isOwnComment = currentUserId === comment.user_id;
  const isDeleted = comment.content === DELETED_COMMENT_TEXT;
  const hasReplies = Boolean(comment.replies?.length);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent("");
      setIsReplying(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      hasReplies
        ? "Dieser Kommentar hat Antworten und wird als gelöscht markiert. Fortfahren?"
        : "Möchten Sie diesen Kommentar wirklich löschen?"
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await onDelete(comment.id, hasReplies);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canReply = depth < maxDepth && !isDeleted;
  const showEditedLabel = Boolean(comment.updated_at && new Date(comment.updated_at) > new Date(comment.created_at));

  // Avatar size is 24px (h-6), center is at 12px
  const AVATAR_SIZE = 24;
  const AVATAR_CENTER = AVATAR_SIZE / 2; // 12px
  const CONNECTOR_RADIUS = 8;
  const CONNECTOR_STROKE = 2;

  useLayoutEffect(() => {
    if (!hasReplies || !threadRef.current || !lastReplyTerminalAvatarEl) {
      setConnectorBottomOffset(0);
      return;
    }

    const updateConnectorBottom = () => {
      if (!threadRef.current || !lastReplyTerminalAvatarEl) return;

      const threadRect = threadRef.current.getBoundingClientRect();
      const lastAvatarRect = lastReplyTerminalAvatarEl.getBoundingClientRect();
      const lastAvatarCenterY = lastAvatarRect.top + AVATAR_CENTER;
      const bottomOffset = threadRect.bottom - lastAvatarCenterY;

      setConnectorBottomOffset(Math.max(0, bottomOffset));
    };

    updateConnectorBottom();

    const resizeObserver = new ResizeObserver(updateConnectorBottom);
    resizeObserver.observe(threadRef.current);
    resizeObserver.observe(lastReplyTerminalAvatarEl);

    window.addEventListener("resize", updateConnectorBottom);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnectorBottom);
    };
  }, [AVATAR_CENTER, hasReplies, lastReplyTerminalAvatarEl]);

  useLayoutEffect(() => {
    if (!hasReplies || !threadRef.current || !lastDirectReplyAvatarEl) {
      setConnectorBottomOffset(0);
      return;
    }

    const updateConnectorBottom = () => {
      if (!threadRef.current || !lastDirectReplyAvatarEl) return;

      const threadRect = threadRef.current.getBoundingClientRect();
      const lastAvatarRect = lastDirectReplyAvatarEl.getBoundingClientRect();
      const lastAvatarCenterY = lastAvatarRect.top + AVATAR_CENTER;
      const bottomOffset = threadRect.bottom - lastAvatarCenterY;

      setConnectorBottomOffset(Math.max(0, bottomOffset));
    };

    updateConnectorBottom();

    const resizeObserver = new ResizeObserver(updateConnectorBottom);
    resizeObserver.observe(threadRef.current);
    resizeObserver.observe(lastDirectReplyAvatarEl);

    window.addEventListener("resize", updateConnectorBottom);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnectorBottom);
    };
  }, [AVATAR_CENTER, hasReplies, lastDirectReplyAvatarEl]);

  return (
    <div className={cn("relative", depth > 0 && "ml-8")} ref={threadRef}>
      {/* Vertical line from this comment's avatar down through all replies */}
      {hasReplies && (
        <div
          className="absolute bg-border/70"
          aria-hidden="true"
          style={{
            left: `${AVATAR_CENTER}px`,
            top: `${AVATAR_SIZE + 4}px`,
            bottom: `${connectorBottomOffset}px`,
            width: '2px',
          }}
        />
      )}

      {/* SVG connector for reply elbow and optional sibling continuation */}
      {depth > 0 && (
        <svg
          className="absolute pointer-events-none overflow-visible"
          aria-hidden="true"
          style={{
            left: `-${AVATAR_CENTER + 8}px`,
            top: 0,
            width: `${AVATAR_CENTER + 8 + CONNECTOR_STROKE}px`,
            height: '100%',
          }}
        >
          <path
            d={`M ${CONNECTOR_STROKE / 2} ${AVATAR_CENTER - CONNECTOR_RADIUS} Q ${CONNECTOR_STROKE / 2} ${AVATAR_CENTER} ${CONNECTOR_STROKE / 2 + CONNECTOR_RADIUS} ${AVATAR_CENTER} L ${AVATAR_CENTER + 8} ${AVATAR_CENTER}`}
            fill="none"
            stroke="hsl(var(--border) / 0.7)"
            strokeWidth={CONNECTOR_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {!isLastReply && (
            <line
              x1={CONNECTOR_STROKE / 2}
              y1={AVATAR_CENTER}
              x2={CONNECTOR_STROKE / 2}
              y2="100%"
              stroke="hsl(var(--border) / 0.7)"
              strokeWidth={CONNECTOR_STROKE}
              strokeLinecap="round"
            />
          )}
        </svg>
      )}

      {/* The comment itself */}
      <div className="group flex items-start gap-2 relative">

        <Avatar className="h-6 w-6 flex-shrink-0 relative z-10" ref={!hasReplies ? avatarRef : undefined}>
          {comment.profile?.avatar_url && (
            <AvatarImage src={comment.profile.avatar_url} alt={comment.profile.display_name || 'Avatar'} />
          )}
          <AvatarFallback
            className="text-[9px]"
            style={{ backgroundColor: comment.profile?.badge_color || undefined }}
          >
            {getInitials(comment.profile?.display_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold">
              {comment.profile?.display_name || 'Unbekannt'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: de
              })}
            </span>
            {showEditedLabel && (
              <span className="text-[10px] text-muted-foreground">(bearbeitet)</span>
            )}

            {isOwnComment && !isDeleted && (
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing((value) => !value)}
                  className="h-6 w-6"
                  disabled={isSubmitting}
                  aria-label="Kommentar bearbeiten"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  disabled={isSubmitting}
                  aria-label="Kommentar löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <SimpleRichTextEditor
                initialContent={comment.content}
                onChange={setEditContent}
                minHeight="60px"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSubmitEdit} disabled={isSubmitting || !editContent.trim()} className="text-xs">
                  Speichern
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(comment.content); }} className="text-xs">
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <RichTextDisplay content={comment.content} className={cn("text-xs mt-1", isDeleted && "italic text-muted-foreground")} />
          )}

          {canReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReplying(!isReplying)}
              className="text-[10px] h-6 px-2 mt-1 text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3 w-3 mr-1" />
              Antworten
            </Button>
          )}
        </div>
      </div>

      {/* Reply input */}
      {isReplying && (
        <div className="ml-8 mt-2 space-y-2">
          <div className="flex items-start gap-2">
            <CornerDownRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-2" />
            <div className="flex-1">
              <SimpleRichTextEditor
                initialContent=""
                onChange={setReplyContent}
                placeholder="Ihre Antwort..."
                minHeight="60px"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleSubmitReply} disabled={isSubmitting || !replyContent.trim()} className="text-xs">
                  <Send className="h-3 w-3 mr-1" />
                  {isSubmitting ? "Senden..." : "Senden"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsReplying(false); setReplyContent(""); }} className="text-xs">
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply, index) => (
            <div key={reply.id} className={cn(index < comment.replies!.length - 1 && "pb-2")}>
              <CommentThread
                comment={reply}
                depth={depth + 1}
                maxDepth={maxDepth}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUserId={currentUserId}
                isLastReply={index === comment.replies!.length - 1}
                avatarRef={index === comment.replies!.length - 1 ? (node) => {
                  setLastReplyTerminalAvatarEl(node);
                  avatarRef?.(node);
                } : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
