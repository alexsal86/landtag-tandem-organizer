import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { CommentThread, CommentData } from "./CommentThread";
import { Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { buildReactionMap, sortReactionEntries, type ReactionRow } from "./commentReactions";
import { shouldHandleReactionEvent } from "./reactionEventVisibility";
import type { ParticipantProfile, ReactionProfile } from "@/types/taskDecisions";

type DecisionCommentProfile = ParticipantProfile;

const DELETED_COMMENT_TEXT = "Dieser Kommentar wurde gelöscht.";
const REACTION_TOGGLE_DEBOUNCE_MS = 250;
const REACTION_NOTIFICATION_WINDOW_MS = 60_000;

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
  const [newCommentEditorKey, setNewCommentEditorKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reactionDebounceRef = useRef<Map<string, number>>(new Map());
  const pendingReactionOpsRef = useRef<Set<string>>(new Set());
  const lastReactionNotificationRef = useRef<Map<string, number>>(new Map());
  const visibleCommentIdsRef = useRef<Set<string>>(new Set());

  const loadReactionRowsWithProfiles = useCallback(async (commentIds: string[]) => {
    if (commentIds.length === 0) return [] as ReactionRow[];

    const { data: reactionRows, error: reactionError } = await supabase
      .from('task_decision_comment_reactions')
      .select('comment_id, emoji, user_id')
      .in('comment_id', commentIds);

    if (reactionError) throw reactionError;

    const reactionUserIds = [...new Set((reactionRows || []).map((row: Record<string, any>) => row.user_id))];
    const { data: reactionProfiles, error: reactionProfilesError } = reactionUserIds.length
      ? await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', reactionUserIds)
      : { data: [], error: null };

    if (reactionProfilesError) throw reactionProfilesError;

    const reactionProfileMap = new Map<string, ReactionProfile>(
      (reactionProfiles || []).map((profile: Record<string, any>) => [profile.user_id, { ...profile, display_name: profile.display_name ?? null }]),
    );

    return (reactionRows || []).map((row: Record<string, any>) => ({
      ...row,
      profile: reactionProfileMap.get(row.user_id)
        ? { display_name: reactionProfileMap.get(row.user_id)?.display_name ?? null }
        : null,
    })) as ReactionRow[];
  }, []);

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
          updated_at,
          parent_id
        `)
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentIds = (data || []).map((comment: Record<string, any>) => comment.id);
      visibleCommentIdsRef.current = new Set(commentIds);

      // Produktentscheidung: Client-seitige Gruppierung für Reaktionen über alle sichtbaren Kommentare
      // (ein Query für alle commentIds, danach Aggregation in Map-Struktur).
      const reactionRows = await loadReactionRowsWithProfiles(commentIds);

      // Load profiles for all users
      const userIds = [...new Set(data?.map((c: Record<string, any>) => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map<string, DecisionCommentProfile>(
        (profiles ?? []).map((profile: Record<string, any>) => [profile.user_id, profile]),
      );

      const reactionsByCommentId = buildReactionMap(reactionRows || [], user?.id);

      // Build nested structure
      const commentsWithProfiles: CommentData[] = (data || []).map((c: Record<string, any>) => ({
        ...c,
        profile: profileMap.get(c.user_id) ?? undefined,
        replies: [],
        reactions: sortReactionEntries(reactionsByCommentId.get(c.id) ?? []),
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
      debugConsole.error('Error loading comments:', error);
      toast({
        title: "Fehler",
        description: "Kommentare konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [decisionId, loadReactionRowsWithProfiles, toast, user?.id]);

  useEffect(() => {
    if (isOpen && decisionId) {
      loadComments();
    }
  }, [isOpen, decisionId, loadComments]);

  useEffect(() => {
    if (!isOpen) {
      visibleCommentIdsRef.current.clear();
    }
  }, [isOpen]);

  const handleSubmitComment = async (parentId: string | null = null, content?: string) => {
    const commentContent = content || newComment;
    if (!commentContent.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_decision_comments')
        .insert([{
          decision_id: decisionId,
          user_id: user.id,
          parent_id: parentId,
          content: commentContent.trim(),
        }]);

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
        participants?.forEach((p: Record<string, any>) => {
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
      setNewCommentEditorKey((prev) => prev + 1);
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      debugConsole.error('Error submitting comment:', error);
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

  const updateCommentReactions = (
    commentList: CommentData[],
    commentId: string,
    emoji: string,
    nextReacted: boolean,
  ): CommentData[] => {
    return commentList.map((comment) => {
      const updatedReplies = comment.replies
        ? updateCommentReactions(comment.replies, commentId, emoji, nextReacted)
        : comment.replies;

      if (comment.id !== commentId) {
        return updatedReplies === comment.replies ? comment : { ...comment, replies: updatedReplies };
      }

      const reactions = [...(comment.reactions || [])];
      const reactionIndex = reactions.findIndex((reaction) => reaction.emoji === emoji);

      if (reactionIndex >= 0) {
        const current = reactions[reactionIndex];
        const nextCount = Math.max(0, current.count + (nextReacted ? 1 : -1));
        if (nextCount === 0) {
          reactions.splice(reactionIndex, 1);
        } else {
          reactions[reactionIndex] = {
            ...current,
            count: nextCount,
            currentUserReacted: nextReacted,
          };
        }
      } else if (nextReacted) {
        reactions.push({
          emoji,
          count: 1,
          currentUserReacted: true,
        });
      }

      return {
        ...comment,
        replies: updatedReplies,
        reactions,
      };
    });
  };


  const applyReactionEventToComments = useCallback((commentId: string, rows: ReactionRow[]) => {
    const reactionsByCommentId = buildReactionMap(rows, user?.id);

    const updateBranch = (branch: CommentData[]): CommentData[] =>
      branch.map((comment) => {
        const updatedReplies = comment.replies ? updateBranch(comment.replies) : comment.replies;
        if (comment.id !== commentId) {
          return updatedReplies === comment.replies ? comment : { ...comment, replies: updatedReplies };
        }

        return {
          ...comment,
          reactions: sortReactionEntries(reactionsByCommentId.get(comment.id) ?? []),
          replies: updatedReplies,
        };
      });

    setComments((prev) => updateBranch(prev));
  }, [user?.id]);

  const refreshSingleCommentReactions = useCallback(async (commentId: string) => {
    const reactionRows = await loadReactionRowsWithProfiles([commentId]);
    applyReactionEventToComments(commentId, reactionRows);
  }, [applyReactionEventToComments, loadReactionRowsWithProfiles]);

  useEffect(() => {
    if (!isOpen || !decisionId) return;

    const channel = supabase
      .channel(`decision-comment-reactions-${decisionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_decision_comment_reactions',
      }, async (payload: Record<string, any>) => {
        const newRow = payload.new as { comment_id?: string } | null;
        const oldRow = payload.old as { comment_id?: string } | null;
        const commentId = newRow?.comment_id ?? oldRow?.comment_id;
        if (!shouldHandleReactionEvent(commentId, visibleCommentIdsRef.current)) return;

        try {
          await refreshSingleCommentReactions(commentId);
        } catch (error) {
          debugConsole.error('Error refreshing incremental reactions:', error);
          loadComments();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [decisionId, isOpen, loadComments, refreshSingleCommentReactions]);

  const notifyReactionRecipients = useCallback(async (commentId: string, emoji: string) => {
    if (!user) return;

    const dedupeKey = `${commentId}:${emoji}:${user.id}`;
    const now = Date.now();
    const lastSent = lastReactionNotificationRef.current.get(dedupeKey) ?? 0;
    if (now - lastSent < REACTION_NOTIFICATION_WINDOW_MS) return;

    const { data: comment } = await supabase
      .from('task_decision_comments')
      .select('id, user_id, decision_id')
      .eq('id', commentId)
      .single();

    if (!comment) return;

    const { data: decision } = await supabase
      .from('task_decisions')
      .select('created_by, title')
      .eq('id', comment.decision_id)
      .single();

    const { data: participants } = await supabase
      .from('task_decision_participants')
      .select('user_id')
      .eq('decision_id', comment.decision_id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    const recipientIds = new Set<string>();
    if (comment.user_id !== user.id) recipientIds.add(comment.user_id);
    if (decision?.created_by && decision.created_by !== user.id) recipientIds.add(decision.created_by);
    participants?.forEach((participant: Record<string, any>) => {
      if (participant.user_id !== user.id) recipientIds.add(participant.user_id);
    });

    for (const recipientId of recipientIds) {
      await supabase.rpc('create_notification', {
        user_id_param: recipientId,
        type_name: 'task_decision_comment_reaction_received',
        title_param: 'Neue Reaktion',
        message_param: `${profile?.display_name || 'Jemand'} hat mit ${emoji} reagiert.`,
        data_param: JSON.stringify({ decision_id: comment.decision_id, decision_title: decision?.title ?? '' }),
        priority_param: 'low',
      });
    }

    lastReactionNotificationRef.current.set(dedupeKey, now);
  }, [user]);

  const trackReactionMetric = useCallback(async (emoji: string, eventType: 'insert' | 'delete') => {
    if (!user) return;
    const analyticsAllowed = window.localStorage.getItem('allowReactionAnalytics') === 'true';
    if (!analyticsAllowed) return;

    await supabase.functions.invoke('log-audit-event', {
      body: {
        action: `comment_reaction_${eventType}`,
        resource_type: 'task_decision_comment_reaction',
        metadata: { emoji },
      },
    });
  }, [user]);

  const handleToggleReaction = async (commentId: string, emoji: string, currentlyReacted: boolean) => {
    if (!user) return;

    const actionKey = `${commentId}:${emoji}:${user.id}`;
    if (pendingReactionOpsRef.current.has(actionKey)) return;

    const now = Date.now();
    const lastToggle = reactionDebounceRef.current.get(actionKey) ?? 0;
    if (now - lastToggle < REACTION_TOGGLE_DEBOUNCE_MS) return;
    reactionDebounceRef.current.set(actionKey, now);

    const nextReacted = !currentlyReacted;
    pendingReactionOpsRef.current.add(actionKey);
    setComments((prev) => updateCommentReactions(prev, commentId, emoji, nextReacted));

    try {
      if (nextReacted) {
        const { error } = await supabase
          .from('task_decision_comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            emoji,
          });

        if (error) throw error;

        try {
          await notifyReactionRecipients(commentId, emoji);
        } catch (notificationError) {
          debugConsole.error('Error sending reaction notifications:', notificationError);
        }

        try {
          await trackReactionMetric(emoji, 'insert');
        } catch (analyticsError) {
          debugConsole.error('Error tracking reaction metric (insert):', analyticsError);
        }
      } else {
        const { error } = await supabase
          .from('task_decision_comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);

        if (error) throw error;

        try {
          await trackReactionMetric(emoji, 'delete');
        } catch (analyticsError) {
          debugConsole.error('Error tracking reaction metric (delete):', analyticsError);
        }
      }
    } catch (error) {
      debugConsole.error('Error toggling comment reaction:', error);
      setComments((prev) => updateCommentReactions(prev, commentId, emoji, currentlyReacted));

      const isInvalidReactionError =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23514";

      toast({
        title: "Fehler",
        description: isInvalidReactionError
          ? "Ungültige Reaktion"
          : "Reaktion konnte nicht gespeichert werden. Die Ansicht wurde zurückgesetzt.",
        variant: "destructive",
      });
    } finally {
      pendingReactionOpsRef.current.delete(actionKey);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('task_decision_comments')
        .update({ content: content.trim() })
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: "Kommentar aktualisiert" });
      loadComments();
    } catch (error) {
      debugConsole.error('Error updating comment:', error);
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
          .from('task_decision_comments')
          .update({ content: DELETED_COMMENT_TEXT })
          .eq('id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_decision_comments')
          .delete()
          .eq('id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({ title: hasReplies ? "Kommentar als gelöscht markiert" : "Kommentar gelöscht" });
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      debugConsole.error('Error deleting comment:', error);
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
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                    onToggleReaction={handleToggleReaction}
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
