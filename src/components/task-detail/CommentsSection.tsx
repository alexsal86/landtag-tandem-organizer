import { MessageCircle, User, Send, Edit2, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import type { TaskComment } from "./types";

interface CommentsSectionProps {
  comments: TaskComment[];
  newComment: string;
  setNewComment: (v: string) => void;
  newCommentEditorKey: number;
  editingComment: Record<string, string>;
  setEditingComment: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentUserId?: string;
  onAdd: () => void;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function CommentsSection({
  comments, newComment, setNewComment, newCommentEditorKey,
  editingComment, setEditingComment, currentUserId,
  onAdd, onUpdate, onDelete,
}: CommentsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <h3 className="font-medium">Kommentare ({comments.length})</h3>
      </div>

      <div className="space-y-2">
        <SimpleRichTextEditor
          initialContent=""
          contentVersion={newCommentEditorKey}
          onChange={setNewComment}
          placeholder="Kommentar hinzufügen..."
          minHeight="72px"
        />
        <Button onClick={onAdd} size="sm" disabled={!newComment.trim()}>
          <Send className="h-4 w-4 mr-2" />Senden
        </Button>
      </div>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.profile?.display_name || "Unbekannter Nutzer"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {comment.user_id === currentUserId && (
                    <div className="flex gap-1">
                      {editingComment[comment.id] !== undefined ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onUpdate(comment.id, editingComment[comment.id])}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingComment((p) => { const u = { ...p }; delete u[comment.id]; return u; })}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingComment((p) => ({ ...p, [comment.id]: comment.content }))}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingComment[comment.id] !== undefined ? (
                  <SimpleRichTextEditor initialContent={editingComment[comment.id]} onChange={(v) => setEditingComment((p) => ({ ...p, [comment.id]: v }))} minHeight="72px" />
                ) : (
                  <RichTextDisplay content={comment.content} className="text-sm" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
