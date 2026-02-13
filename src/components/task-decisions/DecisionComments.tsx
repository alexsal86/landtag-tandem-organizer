import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { CommentThread, CommentData } from "./CommentThread";
import { Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface DecisionCommentsProps {
  decisionId: string;
  decisionTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function DecisionComments({
  decisionId,
  decisionTitle,
  isOpen,
  onClose,
  onCommentAdded,
}: DecisionCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!decisionId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_decision_comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          parent_id
        `)
        .eq('decision_id', decisionId)
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
  }, [decisionId, toast]);

  useEffect(() => {
    if (isOpen && decisionId) {
      loadComments();
    }
  }, [isOpen, decisionId, loadComments]);

  const handleSubmitComment = async (parentId: string | null = null, content?: string) => {
    const commentContent = content || newComment;
    if (!commentContent.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_decision_comments')
        .insert({
          decision_id: decisionId,
          user_id: user.id,
          parent_id: parentId,
          content: commentContent.trim(),
        });

      if (error) throw error;

      // Notify all participants and the decision creator (except the commenter)
      const { data: decision } = await supabase
        .from('task_decisions')
        .select('created_by, title')
        .eq('id', decisionId)
        .single();

      if (decision) {
        // Get all participants
        const { data: participants } = await supabase
          .from('task_decision_participants')
          .select('user_id')
          .eq('decision_id', decisionId);

        // Collect unique user IDs to notify (creator + all participants, except commenter)
        const notifyUserIds = new Set<string>();
        if (decision.created_by !== user.id) {
          notifyUserIds.add(decision.created_by);
        }
        participants?.forEach(p => {
          if (p.user_id !== user.id) {
            notifyUserIds.add(p.user_id);
          }
        });

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();

        for (const recipientId of notifyUserIds) {
          await supabase.rpc('create_notification', {
            user_id_param: recipientId,
            type_name: 'task_decision_comment_received',
            title_param: 'Neuer Kommentar',
            message_param: `${profile?.display_name || 'Jemand'} hat einen Kommentar zu "${decision.title}" hinterlassen.`,
            data_param: JSON.stringify({
              decision_id: decisionId,
              decision_title: decision.title
            }),
            priority_param: 'low'
          });
        }
      }

      toast({
        title: "Erfolg",
        description: "Diskussionsbeitrag wurde hinzugefügt.",
      });

      setNewComment("");
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

  // Count total comments including nested
  const countComments = (list: CommentData[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? countComments(c.replies) : 0), 0);
  };

  const totalComments = countComments(comments);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Diskussion ({totalComments})
          </SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{decisionTitle}</p>
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
                <p>Noch keine Diskussionsbeiträge.</p>
                <p className="text-xs mt-1">Hinterlassen Sie einen Hinweis oder starten Sie die Diskussion!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    onReply={handleReply}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* New comment input */}
          <div className="border-t pt-4 mt-4 space-y-2">
            <SimpleRichTextEditor
              initialContent=""
              onChange={setNewComment}
              placeholder="Hinweis oder Diskussionsbeitrag schreiben..."
              minHeight="60px"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => handleSubmitComment()}
                disabled={isSubmitting || !newComment.trim()}
                size="sm"
              >
                <Send className="h-3 w-3 mr-1" />
                {isSubmitting ? "Senden..." : "Beitrag senden"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
