import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { CommentThread, CommentData } from "@/components/task-decisions/CommentThread";
import { Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const DELETED_COMMENT_TEXT = "Dieser Kommentar wurde gelöscht.";

interface TaskCommentSidebarProps {
  taskId: string | null;
  taskTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentAdded?: () => void;
}

export function TaskCommentSidebar({ 
  taskId, 
  taskTitle,
  isOpen, 
  onOpenChange,
  onCommentAdded,
}: TaskCommentSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentEditorKey, setNewCommentEditorKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, task_id, user_id, content, created_at, updated_at, parent_id')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load profiles for all users
      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build nested structure
      const commentsWithProfiles: CommentData[] = (data || []).map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
        replies: [],
      }));

      // Organize into tree structure
      const commentMap = new Map<string, CommentData>();
      const rootComments: CommentData[] = [];

      commentsWithProfiles.forEach(c => {
        commentMap.set(c.id, c);
      });

      commentsWithProfiles.forEach(c => {
        if (c.parent_id && commentMap.has(c.parent_id)) {
          const parent = commentMap.get(c.parent_id)!;
          if (!parent.replies) parent.replies = [];
          parent.replies.push(c);
        } else {
          rootComments.push(c);
        }
      });

      setComments(rootComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast({
        title: "Fehler",
        description: "Kommentare konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    if (isOpen && taskId) {
      loadComments();
    }
  }, [isOpen, taskId, loadComments]);

  const handleSubmitComment = async (parentId: string | null = null, content?: string) => {
    const commentContent = content || newComment;
    if (!commentContent.trim() || !user || !taskId) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          parent_id: parentId,
          content: commentContent.trim(),
        });

      if (error) throw error;

      toast({ title: "Kommentar hinzugefügt" });

      setNewComment("");
      setNewCommentEditorKey((prev) => prev + 1);
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    await handleSubmitComment(parentId, content);
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: content.trim() })
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: "Kommentar aktualisiert" });
      loadComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string, hasReplies: boolean) => {
    if (!user) return;

    try {
      if (hasReplies) {
        const { error } = await supabase
          .from('task_comments')
          .update({ content: DELETED_COMMENT_TEXT })
          .eq('id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_comments')
          .delete()
          .eq('id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({ title: hasReplies ? "Kommentar als gelöscht markiert" : "Kommentar gelöscht" });
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  // Count total comments including nested
  const countComments = (list: CommentData[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? countComments(c.replies) : 0), 0);
  };

  const totalComments = countComments(comments);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Kommentare ({totalComments})
          </SheetTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground truncate">{taskTitle}</p>
          )}
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-10rem)] mt-4">
          {/* Comments list */}
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Noch keine Kommentare.</p>
                <p className="text-xs mt-1">Schreiben Sie den ersten Kommentar!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    onReply={handleReply}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* New comment input */}
          <div className="border-t pt-4 mt-4 space-y-2">
            <SimpleRichTextEditor
              key={newCommentEditorKey}
              initialContent=""
              onChange={setNewComment}
              placeholder="Kommentar schreiben..."
              minHeight="60px"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => handleSubmitComment()}
                disabled={isSubmitting || !newComment.trim()}
                size="sm"
              >
                <Send className="h-3 w-3 mr-1" />
                {isSubmitting ? "Senden..." : "Senden"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
