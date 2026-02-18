import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

interface TaskCommentSidebarProps {
  taskId: string | null;
  taskTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCommentSidebar({ 
  taskId, 
  taskTitle,
  isOpen, 
  onOpenChange 
}: TaskCommentSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentEditorKey, setNewCommentEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      loadComments();
    }
  }, [isOpen, taskId]);

  const loadComments = async () => {
    if (!taskId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, task_id, user_id, content, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user names
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setComments((data || []).map(c => ({
        ...c,
        user_name: userMap.get(c.user_id) || 'Unbekannt'
      })));
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!taskId || !user || !newComment.trim()) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      setNewCommentEditorKey((prev) => prev + 1);
      await loadComments();
      toast({ title: "Kommentar hinzugefügt" });
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      toast({ title: "Kommentar gelöscht" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Kommentare</SheetTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground truncate">{taskTitle}</p>
          )}
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-10rem)] mt-4">
          <ScrollArea className="flex-1 pr-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Noch keine Kommentare
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="group flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.user_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "dd.MM.yy HH:mm", { locale: de })}
                        </span>
                        {comment.user_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <RichTextDisplay content={comment.content} className="text-sm text-foreground mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t pt-4 mt-4">
            <SimpleRichTextEditor
              key={newCommentEditorKey}
              initialContent=""
              onChange={setNewComment}
              placeholder="Kommentar schreiben..."
              minHeight="80px"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">Strg+Enter zum Senden</span>
              <Button 
                onClick={handleSubmit} 
                disabled={!newComment.trim() || submitting}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Senden
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
