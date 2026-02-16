import { useState } from "react";
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
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className={cn("space-y-2 relative", depth > 0 && "ml-5")}>
      {depth > 0 && (
        <>
          {/* Parent-center to child-center connector with small gaps to avatars */}
          <div className="absolute -left-4 -top-4 h-7 w-px bg-border/70" aria-hidden="true" />
          <div className="absolute -left-4 top-3 h-px w-3 bg-border/70" aria-hidden="true" />
        </>
      )}

      <div className="group flex items-start gap-2">
        <Avatar className="h-6 w-6 flex-shrink-0">
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
                <Button
                  size="sm"
                  onClick={handleSubmitEdit}
                  disabled={isSubmitting || !editContent.trim()}
                  className="text-xs"
                >
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="text-xs"
                >
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
        <div className="ml-8 space-y-2">
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
                <Button
                  size="sm"
                  onClick={handleSubmitReply}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="text-xs"
                >
                  <Send className="h-3 w-3 mr-1" />
                  {isSubmitting ? "Senden..." : "Senden"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setIsReplying(false); setReplyContent(""); }}
                  className="text-xs"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
