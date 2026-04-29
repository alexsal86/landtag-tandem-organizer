import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Reply, Send, CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "@/components/lexical/EmojiPicker";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { DEFAULT_REACTION_ORDER, splitVisibleReactions } from "./commentReactions";

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
  reactions?: CommentReactionData[];
}

export interface CommentReactionData {
  emoji: string;
  count: number;
  currentUserReacted: boolean;
  reactedUsers?: Array<{ userId: string; displayName: string }>;
}

interface CommentThreadProps {
  comment: CommentData;
  depth?: number;
  maxDepth?: number;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string, hasReplies: boolean) => Promise<void>;
  onToggleReaction?: (commentId: string, emoji: string, currentlyReacted: boolean) => Promise<void>;
  currentUserId?: string;
  isLastReply?: boolean;
  highlightedCommentId?: string | null;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const buildReactionUsersLabel = (reaction: CommentReactionData) => {
  if (!reaction.reactedUsers?.length) return "Noch keine Namen verfügbar";
  return reaction.reactedUsers.map((entry) => entry.displayName).join(", ");
};

export function CommentThread({
  comment,
  depth = 0,
  maxDepth = 3,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  currentUserId,
  isLastReply = false,
  highlightedCommentId = null,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const repliesRef = useRef<HTMLDivElement>(null);
  const measureRafIdRef = useRef<number | null>(null);
  const hasReplies = Boolean(comment.replies?.length);
  const [parentLineHeight, setParentLineHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!hasReplies || !containerRef.current || !repliesRef.current) {
      setParentLineHeight(null);
      return;
    }
    const measure = () => {
      const container = containerRef.current;
      const repliesEl = repliesRef.current;
      if (!container || !repliesEl) return;
      const lastChild = repliesEl.lastElementChild as HTMLElement | null;
      if (!lastChild) return;
      const containerTop = container.getBoundingClientRect().top;
      const lastChildTop = lastChild.getBoundingClientRect().top;
      const lineStart = AVATAR_SIZE + 4;
      const lineEnd = lastChildTop - containerTop;
      setParentLineHeight(Math.max(0, lineEnd - lineStart));
    };

    const scheduleMeasure = () => {
      if (measureRafIdRef.current != null) return;
      measureRafIdRef.current = requestAnimationFrame(() => {
        measureRafIdRef.current = null;
        measure();
      });
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(repliesRef.current);
    return () => {
      observer.disconnect();
      if (measureRafIdRef.current != null) {
        cancelAnimationFrame(measureRafIdRef.current);
        measureRafIdRef.current = null;
      }
    };
  }, [hasReplies, comment.replies?.length]);

  const isOwnComment = currentUserId === comment.user_id;
  const isDeleted = comment.content === DELETED_COMMENT_TEXT;

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
  const isHighlighted = highlightedCommentId === comment.id;

  useEffect(() => {
    if (isHighlighted && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);
  const showEditedLabel = Boolean(comment.updated_at && new Date(comment.updated_at) > new Date(comment.created_at));
  const reactionMap = new Map(comment.reactions?.map((reaction) => [reaction.emoji, reaction]) || []);
  const activeReactions = (comment.reactions || []).filter((reaction) => reaction.count > 0);
  const { visible: visibleReactions, overflow: overflowReactions } = splitVisibleReactions(activeReactions);
  const quickReactions = DEFAULT_REACTION_ORDER.filter((emoji) => !reactionMap.has(emoji));

  // Avatar size is 24px (h-6), center is at 12px
  const AVATAR_SIZE = 24;
  const AVATAR_CENTER = AVATAR_SIZE / 2; // 12px

  return (
    <div ref={containerRef} data-comment-id={comment.id} className={cn("relative rounded-md", depth > 0 && "ml-8", depth > 0 && !isLastReply && "mb-2", isHighlighted && "notification-highlight")}>
      {/* Vertical line from this comment's avatar down through all replies */}
      {hasReplies && parentLineHeight != null && parentLineHeight > 0 && (
        <div
          className="absolute bg-border/70"
          aria-hidden="true"
          style={{
            left: `${AVATAR_CENTER}px`,
            top: `${AVATAR_SIZE + 4}px`,
            height: `${parentLineHeight}px`,
            width: '2px',
          }}
        />
      )}

      {/* L-shaped rounded connector from parent's vertical line to this reply's avatar */}
{depth > 0 && (
  <div
    className="absolute"
    aria-hidden="true"
    style={{
      left: `-${AVATAR_CENTER + 8}px`,
      top: 0,
      width: `${AVATAR_CENTER + 8 - 4}px`,
      height: `${AVATAR_CENTER}px`,
      borderLeft: '2px solid hsl(var(--border) / 0.7)',
      borderBottom: '2px solid hsl(var(--border) / 0.7)',
      borderBottomLeftRadius: '8px',
    }}
  />
)}

      {/* The comment itself */}
      <div className="group flex items-start gap-2 relative">

        <Avatar className="h-6 w-6 flex-shrink-0 relative z-10">
          {comment.profile?.avatar_url && (
            <AvatarImage src={comment.profile.avatar_url} alt={comment.profile.display_name || 'Avatar'} />
          )}
          <AvatarFallback
            className="text-[9px]"
            style={{ backgroundColor: comment.profile?.badge_color ?? undefined }}
          >
            {getInitials(comment.profile?.display_name ?? null)}
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
              className="text-[10px] h-6 px-2 mt-0 text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3 w-3 mr-1" />
              Antworten
            </Button>
          )}

          {/* Produktentscheidung: Bei gelöschten Kommentaren keine Reaktionsbar anzeigen,
              Antworten bleiben jedoch im Thread sichtbar. */}
          {!isDeleted && (
            <TooltipProvider>
              <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-full">
              {visibleReactions.map((reaction) => (
                <Tooltip key={reaction.emoji}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleReaction?.(comment.id, reaction.emoji, reaction.currentUserReacted)}
                      className={cn(
                        "h-7 px-2 text-[11px] gap-1 rounded-full min-w-10",
                        reaction.currentUserReacted && "border-primary bg-primary/10 text-primary",
                      )}
                      disabled={isSubmitting}
                      aria-label={`Reaktion ${reaction.emoji} mit ${reaction.count} Stimmen umschalten`}
                    >
                      <span aria-hidden="true">{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-56 text-xs">Wer hat reagiert: {buildReactionUsersLabel(reaction)}</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {overflowReactions.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] rounded-full" disabled={isSubmitting}>
                      +{overflowReactions.length}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="flex flex-wrap gap-1 max-w-56">
                      {overflowReactions.map((reaction) => (
                        <Button
                          key={reaction.emoji}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleReaction?.(comment.id, reaction.emoji, reaction.currentUserReacted)}
                          className={cn(
                            "h-7 px-2 text-[11px] gap-1 rounded-full min-w-10",
                            reaction.currentUserReacted && "border-primary bg-primary/10 text-primary",
                          )}
                          disabled={isSubmitting}
                          aria-label={`Reaktion ${reaction.emoji} mit ${reaction.count} Stimmen umschalten`}
                        >
                          <span aria-hidden="true">{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {quickReactions.map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleReaction?.(comment.id, emoji, false)}
                  className="h-7 px-2 text-[11px] rounded-full"
                  disabled={isSubmitting}
                  aria-label={`Schnellreaktion ${emoji} hinzufügen`}
                >
                  <span aria-hidden="true">{emoji}</span>
                </Button>
              ))}

              <EmojiPicker
                value=""
                compact
                triggerLabel="+"
                triggerClassName="h-6 w-6 text-[10px]"
                onEmojiSelect={(emoji) => {
                  const currentUserReacted = reactionMap.get(emoji)?.currentUserReacted ?? false;
                  onToggleReaction?.(comment.id, emoji, currentUserReacted);
                }}
              />
              </div>
            </TooltipProvider>
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
        <div ref={repliesRef}>
          {comment.replies.map((reply, index) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleReaction={onToggleReaction}
              currentUserId={currentUserId}
              isLastReply={index === comment.replies!.length - 1}
              highlightedCommentId={highlightedCommentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
