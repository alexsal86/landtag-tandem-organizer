import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserBadge } from "@/components/ui/user-badge";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Check, X, MessageCircle, Send, Archive, History, Paperclip, Vote, CheckCircle2, XCircle, HelpCircle, Reply, Edit, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResponseHistoryTimeline } from "./ResponseHistoryTimeline";
import { CommentThread, CommentData } from "./CommentThread";
import { DecisionFileUpload } from "./DecisionFileUpload";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { DecisionEditDialog } from "./DecisionEditDialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ResponseOption, getColorClasses, getDefaultOptions } from "@/lib/decisionTemplates";

interface ResponseThread {
  id: string;
  response_type: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  creator_response: string | null;
  parent_response_id: string | null;
  participant_id: string;
  // Profile of the participant who wrote this response
  participant_profile?: {
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  replies?: ResponseThread[];
}

const DELETED_COMMENT_TEXT = "Dieser Kommentar wurde gelöscht.";

interface Participant {
  id: string;
  user_id: string;
  profile: {
    display_name: string | null;
    badge_color: string | null;
  };
  responses: Array<{
    id: string;
    response_type: string;
    comment: string | null;
    created_at: string;
    creator_response?: string;
    parent_response_id?: string | null;
  }>;
}

interface TaskDecisionDetailsProps {
  decisionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onArchived?: () => void;
  highlightCommentId?: string | null;
  highlightResponseId?: string | null;
}

export const TaskDecisionDetails = ({ decisionId, isOpen, onClose, onArchived, highlightCommentId = null, highlightResponseId = null }: TaskDecisionDetailsProps) => {
  const [decision, setDecision] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [creatorResponses, setCreatorResponses] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [responseThreads, setResponseThreads] = useState<ResponseThread[]>([]);
  const [decisionComments, setDecisionComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentEditorKey, setNewCommentEditorKey] = useState(0);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<{ display_name: string | null; badge_color: string | null; avatar_url: string | null } | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<string | null>(null);
  const [activeHighlightResponseId, setActiveHighlightResponseId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (decisionId && isOpen) {
      loadDecisionDetails();
    }
  }, [decisionId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveHighlightCommentId(highlightCommentId);
    setActiveHighlightResponseId(highlightResponseId);

    if (!highlightCommentId && !highlightResponseId) return;
    const timeoutId = window.setTimeout(() => {
      setActiveHighlightCommentId(null);
      setActiveHighlightResponseId(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightCommentId, highlightResponseId, isOpen]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadDecisionDetails = async () => {
    if (!decisionId) return;

    try {
      // Load decision details
      const { data: decisionData, error: decisionError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          title,
          description,
          response_options,
          response_deadline,
          created_by,
          created_at,
          status,
          tasks (
            id,
            title
          )
        `)
        .eq('id', decisionId)
        .maybeSingle();

      if (decisionError) throw decisionError;
      
      if (!decisionData) {
        toast({
          title: "Info",
          description: "Diese Entscheidung ist nicht mehr verfügbar.",
        });
        onClose();
        return;
      }

      // Load topic IDs
      const { data: topicsData } = await supabase
        .from('task_decision_topics')
        .select('topic_id')
        .eq('decision_id', decisionId);
      
      const topicIds = topicsData?.map(t => t.topic_id) || [];

      // Load participants with responses including parent_response_id
      const { data: participantsData, error: participantsError } = await supabase
        .from('task_decision_participants')
        .select(`
          id,
          user_id,
          task_decision_responses (
            id,
            response_type,
            comment,
            created_at,
            updated_at,
            creator_response,
            parent_response_id,
            participant_id
          )
        `)
        .eq('decision_id', decisionId);

      if (participantsError) throw participantsError;

      // Get user profiles separately (including creator)
      const userIds = [...new Set([
        ...(participantsData?.map(p => p.user_id) || []),
        decisionData.created_by,
      ])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const { data: commentsData, error: commentsError } = await supabase
        .from('task_decision_comments')
        .select('id, content, created_at, updated_at, parent_id, user_id')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const commentsWithProfiles: CommentData[] = (commentsData || []).map((comment) => ({
        ...comment,
        profile: {
          display_name: profileMap.get(comment.user_id)?.display_name || null,
          badge_color: profileMap.get(comment.user_id)?.badge_color || null,
          avatar_url: profileMap.get(comment.user_id)?.avatar_url || null,
        },
        replies: [],
      }));

      const commentMap = new Map<string, CommentData>();
      const rootComments: CommentData[] = [];

      commentsWithProfiles.forEach((comment) => {
        commentMap.set(comment.id, comment);
      });

      commentsWithProfiles.forEach((comment) => {
        if (comment.parent_id && commentMap.has(comment.parent_id)) {
          commentMap.get(comment.parent_id)?.replies?.push(comment);
        } else {
          rootComments.push(comment);
        }
      });

      rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDecisionComments(rootComments);

      // Store creator profile for display
      const creatorProf = profileMap.get(decisionData.created_by);
      setCreatorProfile(creatorProf ? {
        display_name: creatorProf.display_name,
        badge_color: creatorProf.badge_color,
        avatar_url: creatorProf.avatar_url,
      } : null);

      // Build participant-id-to-profile map for threading
      const participantProfileMap = new Map<string, { display_name: string | null; badge_color: string | null; avatar_url: string | null }>();
      participantsData?.forEach(p => {
        const prof = profileMap.get(p.user_id);
        participantProfileMap.set(p.id, {
          display_name: prof?.display_name || null,
          badge_color: prof?.badge_color || null,
          avatar_url: prof?.avatar_url || null,
        });
      });

      // Collect ALL responses across participants for threading
      const allResponses: ResponseThread[] = [];
      participantsData?.forEach(p => {
        (p.task_decision_responses || []).forEach(r => {
          allResponses.push({
            ...r,
            participant_profile: participantProfileMap.get(r.participant_id),
          });
        });
      });

      // Build thread tree
      const responseMap = new Map<string, ResponseThread>();
      allResponses.forEach(r => responseMap.set(r.id, { ...r, replies: [] }));
      
      const rootResponses: ResponseThread[] = [];
      allResponses.forEach(r => {
        const node = responseMap.get(r.id)!;
        if (r.parent_response_id && responseMap.has(r.parent_response_id)) {
          responseMap.get(r.parent_response_id)!.replies!.push(node);
        } else {
          rootResponses.push(node);
        }
      });

      responseMap.forEach((response) => {
        response.replies?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      // Sort root responses by date desc
      rootResponses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setResponseThreads(rootResponses);

      const formattedParticipants = participantsData?.map(participant => ({
        id: participant.id,
        user_id: participant.user_id,
        profile: {
          display_name: profileMap.get(participant.user_id)?.display_name || null,
          badge_color: profileMap.get(participant.user_id)?.badge_color || null,
        },
        responses: (participant.task_decision_responses || [])
          .filter(r => !r.parent_response_id) // Only root responses for summary
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(response => ({
            ...response,
            response_type: response.response_type
          })),
      })) || [];

      setDecision({ ...decisionData, topicIds });
      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Error loading decision details:', error);
      toast({
        title: "Fehler",
        description: "Entscheidungsdetails konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const sendCreatorResponse = async (responseId: string) => {
    const responseText = creatorResponses[responseId];
    if (!responseText?.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: responseText })
        .eq('id', responseId);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Antwort wurde gesendet.",
      });

      setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));
      loadDecisionDetails();
    } catch (error) {
      console.error('Error sending creator response:', error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Participant replying to a creator_response (creates a new response with parent_response_id)
  const sendParticipantReply = async (parentResponseId: string, participantId: string) => {
    if (!replyText.trim() || !currentUserId || !decisionId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .insert({
          decision_id: decisionId,
          participant_id: participantId,
          response_type: 'question',
          comment: replyText.trim(),
          parent_response_id: parentResponseId,
        });

      if (error) throw error;

      toast({ title: "Erfolgreich", description: "Antwort wurde gesendet." });
      setReplyText("");
      setReplyingToId(null);
      loadDecisionDetails();
    } catch (error) {
      console.error('Error sending participant reply:', error);
      toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (parentId: string | null = null, content?: string) => {
    const commentContent = content || newComment;
    if (!commentContent.trim() || !currentUserId || !decisionId) return;

    setIsCommentSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_decision_comments')
        .insert({
          decision_id: decisionId,
          user_id: currentUserId,
          parent_id: parentId,
          content: commentContent.trim(),
        });

      if (error) throw error;

      if (decision) {
        const { data: participantsData } = await supabase
          .from('task_decision_participants')
          .select('user_id')
          .eq('decision_id', decisionId);

        const notifyUserIds = new Set<string>();
        if (decision.created_by !== currentUserId) {
          notifyUserIds.add(decision.created_by);
        }

        participantsData?.forEach((participant) => {
          if (participant.user_id !== currentUserId) {
            notifyUserIds.add(participant.user_id);
          }
        });

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', currentUserId)
          .single();

        for (const recipientId of notifyUserIds) {
          await supabase.rpc('create_notification', {
            user_id_param: recipientId,
            type_name: 'task_decision_comment_received',
            title_param: 'Neuer Kommentar',
            message_param: `${profile?.display_name || 'Jemand'} hat einen Kommentar zu "${decision.title}" hinterlassen.`,
            data_param: JSON.stringify({
              decision_id: decisionId,
              decision_title: decision.title,
            }),
            priority_param: 'low',
          });
        }
      }

      toast({
        title: 'Erfolg',
        description: 'Diskussionsbeitrag wurde hinzugefügt.',
      });

      setNewComment('');
      setNewCommentEditorKey((prev) => prev + 1);
      await loadDecisionDetails();
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Fehler',
        description: 'Kommentar konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    await handleSubmitComment(parentId, content);
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!currentUserId || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('task_decision_comments')
        .update({ content: content.trim() })
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({ title: 'Kommentar aktualisiert' });
      await loadDecisionDetails();
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: 'Fehler',
        description: 'Kommentar konnte nicht bearbeitet werden.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteComment = async (commentId: string, hasReplies: boolean) => {
    if (!currentUserId) return;

    try {
      if (hasReplies) {
        const { error } = await supabase
          .from('task_decision_comments')
          .update({ content: DELETED_COMMENT_TEXT })
          .eq('id', commentId)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_decision_comments')
          .delete()
          .eq('id', commentId)
          .eq('user_id', currentUserId);

        if (error) throw error;
      }

      toast({ title: hasReplies ? 'Kommentar als gelöscht markiert' : 'Kommentar gelöscht' });
      await loadDecisionDetails();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Fehler',
        description: 'Kommentar konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const archiveDecision = async () => {
    if (!decision || !currentUserId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: currentUserId,
        })
        .eq('id', decision.id);

      if (error) throw error;

      // Erfolg melden BEVOR optionale Operationen laufen
      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde archiviert.",
      });

      onArchived?.();
      onClose();

      // Best-effort: Notifications als gelesen markieren
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUserId)
          .eq('navigation_context', 'decisions');
      } catch (e) {
        console.warn('Notifications update failed:', e);
      }
    } catch (error) {
      console.error('Error archiving decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht archiviert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getResponseSummary = () => {
    const responseOptions: ResponseOption[] = (decision?.response_options && Array.isArray(decision.response_options))
      ? decision.response_options
      : getDefaultOptions();

    const optionCounts = responseOptions.reduce<Record<string, number>>((acc, option) => {
      acc[option.key] = participants.filter(
        p => p.responses.length > 0 && p.responses[0].response_type === option.key
      ).length;
      return acc;
    }, {});

    const yesCount = optionCounts.yes || 0;
    const noCount = optionCounts.no || 0;
    const questionCount = optionCounts.question || 0;
    const responded = participants.filter(p => p.responses.length > 0).length;
    const pending = participants.length - responded;

    return { yesCount, noCount, questionCount, pending, total: participants.length, optionCounts, responseOptions };
  };

  if (!decision) return null;

  const isCreator = currentUserId === decision.created_by;
  const summary = getResponseSummary();
  const currentUserParticipant = participants.find(p => p.user_id === currentUserId);
  const responseOptionKeys = summary.responseOptions.map(option => option.key).sort();
  const isYesNoTypeDecision =
    responseOptionKeys.length === 2 &&
    responseOptionKeys[0] === 'no' &&
    responseOptionKeys[1] === 'yes';
  const isYesNoQuestionTypeDecision =
    responseOptionKeys.length === 3 &&
    responseOptionKeys[0] === 'no' &&
    responseOptionKeys[1] === 'question' &&
    responseOptionKeys[2] === 'yes';
  const shouldShowDecisionResultBadge = isYesNoTypeDecision || isYesNoQuestionTypeDecision;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };


  const renderResponseThread = (thread: ResponseThread, participantId: string, depth: number): React.ReactNode => {
    return (
      <div
        key={thread.id}
        data-response-id={thread.id}
        ref={depth === 0 && activeHighlightResponseId === thread.id ? (el) => el?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined}
        className={cn("space-y-2 rounded-md", depth > 0 && "ml-6 pl-4 border-l-2 border-muted", activeHighlightResponseId === thread.id && "notification-highlight")}
      >
        {/* The response message */}
        {thread.comment && (
          <div className="flex items-start justify-between">
            <div className="text-sm text-muted-foreground flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Avatar className="h-4 w-4">
                  {thread.participant_profile?.avatar_url && (
                    <AvatarImage src={thread.participant_profile.avatar_url} />
                  )}
                  <AvatarFallback className="text-[7px]" style={{ backgroundColor: thread.participant_profile?.badge_color || undefined }}>
                    {getInitials(thread.participant_profile?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground">
                  {thread.participant_profile?.display_name || 'Unbekannt'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: de })}
                </span>
              </div>
              <RichTextDisplay content={thread.comment} className="text-sm" />
            </div>
          </div>
        )}

        {/* Creator response to this message */}
        {thread.creator_response && (
          <div className="bg-muted p-2 rounded text-sm flex items-start gap-2 ml-4">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                {creatorProfile && (
                  <Avatar className="h-4 w-4">
                    {creatorProfile.avatar_url && <AvatarImage src={creatorProfile.avatar_url} />}
                    <AvatarFallback className="text-[7px]" style={{ backgroundColor: creatorProfile.badge_color || undefined }}>
                      {getInitials(creatorProfile.display_name)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-xs font-medium text-foreground">
                  {creatorProfile?.display_name || 'Ersteller'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.updated_at || thread.created_at), { addSuffix: true, locale: de })}
                </span>
              </div>
              <RichTextDisplay content={thread.creator_response} className="text-sm" />
            </div>
          </div>
        )}

        {/* Participant can reply after creator responded */}
        {thread.creator_response && !isCreator && currentUserId && (
          <>
            {replyingToId === thread.id ? (
              <div className="ml-4 space-y-2">
                <SimpleRichTextEditor
                  initialContent=""
                  onChange={setReplyText}
                  placeholder="Ihre Antwort..."
                  minHeight="60px"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => sendParticipantReply(thread.id, participantId)}
                    disabled={isLoading || !replyText.trim()}
                  >
                    <Send className="h-3 w-3 mr-1" />Senden
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyingToId(null); setReplyText(""); }}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs ml-4"
                onClick={() => setReplyingToId(thread.id)}
              >
                <Reply className="h-3 w-3 mr-1" />Antworten
              </Button>
            )}
          </>
        )}

        {/* Creator can respond to reply threads */}
        {isCreator && thread.comment && !thread.creator_response && depth > 0 && (
          <div className="ml-4 space-y-2">
            <SimpleRichTextEditor
              initialContent={creatorResponses[thread.id] || ''}
              onChange={(html) => setCreatorResponses(prev => ({ ...prev, [thread.id]: html }))}
              placeholder="Antwort eingeben..."
              minHeight="60px"
            />
            <Button
              size="sm"
              onClick={() => sendCreatorResponse(thread.id)}
              disabled={isLoading || !creatorResponses[thread.id]?.trim()}
            >
              <Send className="h-3 w-3 mr-1" />Senden
            </Button>
          </div>
        )}

        {/* Nested replies */}
        {thread.replies && thread.replies.length > 0 && (
          <div className="space-y-2">
            {thread.replies.map(reply => renderResponseThread(reply, participantId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{decision.title}</DialogTitle>
            {isCreator && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                  disabled={isLoading}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={archiveDecision}
                  disabled={isLoading}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archivieren
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Aufgabe: {decision.tasks?.title}
          </p>
          {decision.description && (
            <RichTextDisplay content={decision.description} className="mt-2" />
          )}
          {decision.topicIds && decision.topicIds.length > 0 && (
            <div className="mt-2">
              <TopicDisplay topicIds={decision.topicIds} maxDisplay={10} expandable />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Erstellt am: {new Date(decision.created_at).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {decision.response_deadline && (
            <p className="text-xs text-muted-foreground">
              Antwortfrist: {new Date(decision.response_deadline).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className={cn("grid gap-4", currentUserParticipant ? "md:grid-cols-2" : "grid-cols-1")}>
          {/* Response Summary */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Abstimmungsübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {summary.responseOptions.map((option) => {
                  const colorClasses = getColorClasses(option.color);
                  return (
                    <div key={option.key} className="flex items-start justify-between gap-2">
                      <span className={cn("font-medium", colorClasses.textClass)}>
                        {option.label}
                        {option.description ? ` – ${option.description}` : ""}
                      </span>
                      <span className={cn("font-semibold", colorClasses.textClass)}>
                        {summary.optionCounts[option.key] || 0}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-2 text-muted-foreground border-t">
                  ({summary.pending} ausstehend)
                </div>
              </div>
              
              {/* Result badge when all have responded */}
              {shouldShowDecisionResultBadge && summary.pending === 0 && summary.total > 0 && (
                <div className="mt-3 pt-3 border-t">
                  {summary.responseOptions.some(option => option.key === 'question') && summary.questionCount > 0 ? (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950"
                    >
                      <HelpCircle className="h-3.5 w-3.5 mr-1" />
                      Rückfragen offen
                    </Badge>
                  ) : summary.yesCount > summary.noCount ? (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-green-600 border-green-600 bg-green-50 dark:bg-green-950"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Angenommen
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-red-600 border-red-600 bg-red-50 dark:bg-red-950"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Abgelehnt
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          

          {/* Current User's Response Section */}
          {currentUserParticipant && (
            <Card className="border-primary/30 bg-primary/5 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  Ihre Antwort
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskDecisionResponse
                  decisionId={decisionId!}
                  participantId={currentUserParticipant.id}
                  onResponseSubmitted={loadDecisionDetails}
                  hasResponded={currentUserParticipant.responses && currentUserParticipant.responses.length > 0}
                  creatorId={decision.created_by}
                />
              </CardContent>
            </Card>
          )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Diskussion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {decisionComments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border rounded-md">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Noch keine Diskussionsbeiträge.</p>
                  <p className="text-xs mt-1">Hinterlassen Sie einen Hinweis oder starten Sie die Diskussion!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {decisionComments.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      onReply={handleReply}
                      onEdit={handleEditComment}
                      onDelete={handleDeleteComment}
                      currentUserId={currentUserId || undefined}
                      highlightedCommentId={activeHighlightCommentId}
                    />
                  ))}
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
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
                    disabled={isCommentSubmitting || !newComment.trim()}
                    size="sm"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {isCommentSubmitting ? 'Senden...' : 'Beitrag senden'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participants with threaded conversations */}
          <div className="space-y-3">
            <h4 className="font-medium">Teilnehmer</h4>
            {participants.map((participant) => {
              const latestResponse = participant.responses[0];
              // Get the thread for this participant's root responses
              const participantThreads = responseThreads.filter(
                r => r.participant_id === participant.id && !r.parent_response_id
              );

              return (
                <Card key={participant.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <UserBadge 
                          userId={participant.user_id}
                          displayName={participant.profile?.display_name}
                          badgeColor={participant.profile?.badge_color}
                          size="sm"
                        />
                      </CardTitle>
                      {latestResponse ? (
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const responseOptions: ResponseOption[] = (decision.response_options && Array.isArray(decision.response_options))
                              ? decision.response_options
                              : getDefaultOptions();
                            const selectedOption = responseOptions.find(option => option.key === latestResponse.response_type);

                            if (!selectedOption) {
                              return (
                                <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">
                                  {latestResponse.response_type}
                                </Badge>
                              );
                            }

                            const colorClasses = getColorClasses(selectedOption.color);
                            return (
                              <Badge variant="outline" className={cn(colorClasses.textClass, colorClasses.borderClass)}>
                                {selectedOption.label}
                                {selectedOption.description ? ` – ${selectedOption.description}` : ""}
                              </Badge>
                            );
                          })()}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Ausstehend</Badge>
                      )}
                    </div>
                  </CardHeader>
                  {latestResponse && (
                    <CardContent className="pt-0">
                      {/* Render threaded conversation */}
                      {participantThreads.map(thread => (
                        <div key={thread.id} className="space-y-2">
                          {renderResponseThread(thread, participant.id, 0)}
                        </div>
                      ))}
                      
                      {/* Creator Response Input for unanswered root responses */}
                      {isCreator && latestResponse.comment && !latestResponse.creator_response && (
                        <div className="space-y-2 mt-2">
                          <SimpleRichTextEditor
                            initialContent={creatorResponses[latestResponse.id] || ''}
                            onChange={(html) => setCreatorResponses(prev => ({
                              ...prev,
                              [latestResponse.id]: html
                            }))}
                            placeholder="Antwort eingeben..."
                            minHeight="80px"
                          />
                          <Button
                            size="sm"
                            onClick={() => sendCreatorResponse(latestResponse.id)}
                            disabled={isLoading || !creatorResponses[latestResponse.id]?.trim()}
                          >
                            <Send className="h-4 w-4 mr-1" />Senden
                          </Button>
                        </div>
                      )}
                      
                      {/* Response History Timeline */}
                      {participant.responses.length > 0 && (
                        <Collapsible className="mt-2">
                          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                            <History className="h-3 w-3 mr-1" />Verlauf anzeigen
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ResponseHistoryTimeline 
                              participantId={participant.id}
                              decisionId={decisionId}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* File Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <Paperclip className="h-4 w-4 mr-2" />
                Anhänge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DecisionFileUpload 
                decisionId={decisionId}
                onFilesChange={loadDecisionDetails}
                canUpload={true}
              />
            </CardContent>
          </Card>
        </div>
      </DialogContent>

      {decisionId && (
        <DecisionEditDialog
          decisionId={decisionId}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onUpdated={async () => {
            setIsEditDialogOpen(false);
            await loadDecisionDetails();
          }}
        />
      )}
    </Dialog>
  );
};
