import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { TaskDecisionDetails } from "./TaskDecisionDetails";
import { StandaloneDecisionCreator } from "./StandaloneDecisionCreator";
import { DecisionEditDialog } from "./DecisionEditDialog";

import { DecisionSidebar } from "./DecisionSidebar";
import { DecisionComments } from "./DecisionComments";
import { DecisionCardActivity } from "./DecisionCardActivity";
import { UserBadge } from "@/components/ui/user-badge";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { 
  Check, X, MessageCircle, Send, Vote, CheckSquare, Globe, Edit, Trash2, 
  MoreVertical, Archive, RotateCcw, Paperclip, CheckCircle, ClipboardList, 
  Search, FolderArchive, MessageSquare
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";

// Truncated description component
const TruncatedDescription = ({ content, maxLength = 150 }: { content: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  
  const plainText = content.replace(/<[^>]*>/g, '');
  const isTruncated = plainText.length > maxLength;
  
  if (!isTruncated || expanded) {
    return (
      <div>
        <RichTextDisplay content={content} className="text-sm text-muted-foreground" />
        {isTruncated && (
          <Button 
            variant="link" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
          >
            weniger
          </Button>
        )}
      </div>
    );
  }
  
  const truncatedPlain = plainText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  
  return (
    <div>
      <p className="text-sm text-muted-foreground">{truncatedPlain}</p>
      <Button 
        variant="link" 
        size="sm" 
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        className="text-xs p-0 h-auto text-muted-foreground hover:text-primary"
      >
        mehr
      </Button>
    </div>
  );
};

interface DecisionRequest {
  id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  visible_to_all?: boolean;
  status: string;
  archived_at: string | null;
  archived_by: string | null;
  task: {
    title: string;
  } | null;
  hasResponded: boolean;
  isParticipant?: boolean;
  isStandalone: boolean;
  isCreator: boolean;
  attachmentCount?: number;
  topicIds?: string[];
  creator?: {
    user_id: string;
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  participants?: Array<{
    id: string;
    user_id: string;
    profile?: {
      display_name: string | null;
      badge_color: string | null;
      avatar_url: string | null;
    };
    responses: Array<{
      id: string;
      response_type: string;
      comment: string | null;
      creator_response: string | null;
      created_at: string;
    }>;
  }>;
}

export const DecisionOverview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [creatorResponses, setCreatorResponses] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("for-me");
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creatingTaskFromDecisionId, setCreatingTaskFromDecisionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentsDecisionId, setCommentsDecisionId] = useState<string | null>(null);
  const [commentsDecisionTitle, setCommentsDecisionTitle] = useState<string>("");
  // Handle URL action parameter for QuickActions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-decision') {
      setIsCreateDialogOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (user?.id) {
      loadDecisionRequests(user.id);
    }
  }, [user?.id]);

  const loadDecisionRequests = async (currentUserId: string) => {
    try {
      // Load active decisions where user is a participant
      const { data: participantDecisions, error: participantError } = await supabase
        .from('task_decision_participants')
        .select(`
          id,
          decision_id,
          task_decisions!inner (
            id,
            task_id,
            title,
            description,
            created_at,
            created_by,
            status,
            archived_at,
            archived_by,
            visible_to_all,
            tasks (
              title
            ),
            task_decision_attachments (count)
          ),
          task_decision_responses (
            id
          )
        `)
        .eq('user_id', currentUserId)
        .in('task_decisions.status', ['active', 'open']);

      if (participantError) throw participantError;

      // Load all active decisions created by user, assigned to user, or visible to all
      const { data: allDecisions, error: allError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          created_by,
          status,
          archived_at,
          archived_by,
          visible_to_all,
          tasks (
            title,
            assigned_to
          ),
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              id
            )
          ),
          task_decision_attachments (count)
        `)
        .in('status', ['active', 'open']);

      if (allError) throw allError;

      // Load archived decisions
      const { data: archivedDecisions, error: archivedError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          created_by,
          status,
          archived_at,
          archived_by,
          visible_to_all,
          tasks (
            title,
            assigned_to
          ),
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              id
            )
          ),
          task_decision_attachments (count)
        `)
        .eq('status', 'archived');

      if (archivedError) throw archivedError;

      // Combine active and archived decisions
      const combinedDecisions = [...(allDecisions || []), ...(archivedDecisions || [])];

      // Format participant decisions
      const formattedParticipantData = participantDecisions?.map(item => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
        status: item.task_decisions.status,
        archived_at: item.task_decisions.archived_at,
        archived_by: item.task_decisions.archived_by,
        visible_to_all: item.task_decisions.visible_to_all,
        participant_id: item.id,
        task: item.task_decisions.tasks ? {
          title: item.task_decisions.tasks.title,
        } : null,
        hasResponded: item.task_decision_responses.length > 0,
        isParticipant: true,
        isStandalone: !item.task_decisions.task_id,
        isCreator: item.task_decisions.created_by === currentUserId,
        attachmentCount: item.task_decisions.task_decision_attachments?.[0]?.count || 0,
      })) || [];

      // Format all decisions - filter for relevant ones
      const formattedAllData = combinedDecisions
        ?.filter(item => {
          const isCreator = item.created_by === currentUserId;
          const isParticipant = item.task_decision_participants.some(p => p.user_id === currentUserId);
          const assignedTo = item.tasks?.assigned_to;
          const isAssigned = assignedTo ? assignedTo.includes(currentUserId) : false;
          const isVisibleToAll = item.visible_to_all === true;
          return isCreator || isParticipant || isAssigned || isVisibleToAll;
        })
        ?.map(item => {
          const userParticipant = item.task_decision_participants.find(p => p.user_id === currentUserId);
          return {
            id: item.id,
            task_id: item.task_id,
            title: item.title,
            description: item.description,
            created_at: item.created_at,
            created_by: item.created_by,
            status: item.status,
            archived_at: item.archived_at,
            archived_by: item.archived_by,
            visible_to_all: item.visible_to_all,
            participant_id: userParticipant?.id || null,
            task: item.tasks ? {
              title: item.tasks.title,
            } : null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
            isParticipant: !!userParticipant,
            isStandalone: !item.task_id,
            isCreator: item.created_by === currentUserId,
            attachmentCount: item.task_decision_attachments?.[0]?.count || 0,
          };
        }) || [];

      // Merge and deduplicate
      const decisionsMap = new Map<string, any>();
      formattedAllData.forEach(decision => {
        decisionsMap.set(decision.id, decision);
      });
      formattedParticipantData.forEach(participantDecision => {
        const existing = decisionsMap.get(participantDecision.id);
        if (existing) {
          decisionsMap.set(participantDecision.id, {
            ...existing,
            participant_id: participantDecision.participant_id,
            hasResponded: participantDecision.hasResponded,
            isParticipant: true,
          });
        } else {
          decisionsMap.set(participantDecision.id, participantDecision);
        }
      });

      const allDecisionsList = Array.from(decisionsMap.values());

      // Load participants and responses
      if (allDecisionsList.length > 0) {
        const decisionIds = allDecisionsList.map(d => d.id);

        const { data: participantsData, error: participantsError } = await supabase
          .from('task_decision_participants')
          .select(`
            id,
            user_id,
            decision_id,
            task_decision_responses (
              id,
              response_type,
              comment,
              creator_response,
              created_at,
              updated_at
            )
          `)
          .in('decision_id', decisionIds);

        if (participantsError) throw participantsError;

        const { data: topicsData, error: topicsError } = await supabase
          .from('task_decision_topics')
          .select('decision_id, topic_id')
          .in('decision_id', decisionIds);

        if (topicsError) throw topicsError;

        const topicsByDecision = new Map<string, string[]>();
        topicsData?.forEach(topic => {
          if (!topicsByDecision.has(topic.decision_id)) {
            topicsByDecision.set(topic.decision_id, []);
          }
          topicsByDecision.get(topic.decision_id)!.push(topic.topic_id);
        });

        const allUserIds = [...new Set([
          ...participantsData?.map(p => p.user_id) || [],
          ...allDecisionsList.map(d => d.created_by)
        ])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, badge_color, avatar_url')
          .in('user_id', allUserIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const participantsByDecision = new Map();
        participantsData?.forEach(participant => {
          if (!participantsByDecision.has(participant.decision_id)) {
            participantsByDecision.set(participant.decision_id, []);
          }
          participantsByDecision.get(participant.decision_id).push({
            id: participant.id,
            user_id: participant.user_id,
            profile: {
              display_name: profileMap.get(participant.user_id)?.display_name || null,
              badge_color: profileMap.get(participant.user_id)?.badge_color || null,
              avatar_url: profileMap.get(participant.user_id)?.avatar_url || null,
            },
            responses: (participant.task_decision_responses || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          });
        });

        allDecisionsList.forEach((decision: any) => {
          decision.participants = participantsByDecision.get(decision.id) || [];
          decision.topicIds = topicsByDecision.get(decision.id) || [];
          const creatorProfile = profileMap.get(decision.created_by);
          decision.creator = {
            user_id: decision.created_by,
            display_name: creatorProfile?.display_name || null,
            badge_color: creatorProfile?.badge_color || null,
            avatar_url: creatorProfile?.avatar_url || null,
          };
        });
      }

      // Sort decisions
      allDecisionsList.sort((a, b) => {
        const summaryA = getResponseSummary(a.participants);
        const summaryB = getResponseSummary(b.participants);
        
        const aIsUnansweredParticipant = a.isParticipant && !a.hasResponded;
        const bIsUnansweredParticipant = b.isParticipant && !b.hasResponded;
        
        if (aIsUnansweredParticipant && !bIsUnansweredParticipant) return -1;
        if (!aIsUnansweredParticipant && bIsUnansweredParticipant) return 1;
        
        const aHasQuestions = summaryA.questionCount > 0;
        const bHasQuestions = summaryB.questionCount > 0;
        
        if (aHasQuestions && !bHasQuestions) return -1;
        if (!aHasQuestions && bHasQuestions) return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setDecisions(allDecisionsList);
    } catch (error) {
      console.error('Error loading decision requests:', error);
    }
  };

  const sendCreatorResponse = async (responseId: string, responseText?: string) => {
    const text = responseText || creatorResponses[responseId];
    if (!text?.trim()) return;

    setIsLoading(true);
    
    try {
      // Kernoperation ZUERST: Update der creator_response
      const { error: updateError } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: text.trim() })
        .eq('id', responseId);

      if (updateError) throw updateError;

      // Erfolg melden sofort
      toast({
        title: "Erfolgreich",
        description: "Antwort wurde gesendet.",
      });

      setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));

      // Best-effort: Notification senden (in separatem try/catch)
      try {
        const { data: responseData } = await supabase
          .from('task_decision_responses')
          .select(`
            id,
            decision_id,
            task_decision_participants!inner(user_id),
            task_decisions!inner(title)
          `)
          .eq('id', responseId)
          .maybeSingle();

        if (responseData) {
          const participantUserId = (responseData as any).task_decision_participants?.user_id;
          const decisionTitle = (responseData as any).task_decisions?.title;

          if (participantUserId && participantUserId !== user?.id) {
            await supabase.rpc('create_notification', {
              user_id_param: participantUserId,
              type_name: 'task_decision_creator_response',
              title_param: 'Antwort auf Ihren Kommentar',
              message_param: `Der Ersteller hat auf Ihren Kommentar zu "${decisionTitle}" geantwortet.`,
              data_param: {
                decision_id: responseData.decision_id,
                decision_title: decisionTitle
              },
              priority_param: 'medium'
            });
          }
        }
      } catch (notifError) {
        console.warn('Notification send failed (non-critical):', notifError);
      }

      // Liste neu laden
      if (user?.id) await loadDecisionRequests(user.id);
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

  const handleResponseSubmitted = () => {
    if (user?.id) loadDecisionRequests(user.id);
  };

  const handleOpenDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedDecisionId(null);
  };

  const handleDecisionArchived = () => {
    if (user?.id) loadDecisionRequests(user.id);
    handleCloseDetails();
  };

  const archiveDecision = async (decisionId: string) => {
    if (!user?.id) {
      toast({ title: "Fehler", description: "Nicht angemeldet.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({ 
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq('id', decisionId);

      if (error) throw error;

      toast({ title: "Archiviert", description: "Entscheidung wurde archiviert." });
      loadDecisionRequests(user.id);
    } catch (error) {
      console.error('Error archiving decision:', error);
      toast({ title: "Fehler", description: "Entscheidung konnte nicht archiviert werden.", variant: "destructive" });
    }
  };

  const handleDeleteDecision = async () => {
    if (!deletingDecisionId) return;

    try {
      const { error } = await supabase
        .from('task_decisions')
        .delete()
        .eq('id', deletingDecisionId);

      if (error) throw error;

      toast({ title: "Gelöscht", description: "Entscheidung wurde endgültig gelöscht." });
      setDeletingDecisionId(null);
      if (user?.id) loadDecisionRequests(user.id);
    } catch (error) {
      console.error('Error deleting decision:', error);
      toast({ title: "Fehler", description: "Entscheidung konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const restoreDecision = async (decisionId: string) => {
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({ status: 'active', archived_at: null, archived_by: null })
        .eq('id', decisionId);

      if (error) throw error;
      toast({ title: "Erfolgreich", description: "Entscheidung wurde wiederhergestellt." });
      if (user?.id) loadDecisionRequests(user.id);
    } catch (error) {
      console.error('Error restoring decision:', error);
      toast({ title: "Fehler", description: "Entscheidung konnte nicht wiederhergestellt werden.", variant: "destructive" });
    }
  };

  const createTaskFromDecision = async (decision: DecisionRequest) => {
    if (!user?.id || !currentTenant?.id) {
      toast({ title: "Fehler", description: "Nicht angemeldet", variant: "destructive" });
      return;
    }
    
    setCreatingTaskFromDecisionId(decision.id);
    const summary = getResponseSummary(decision.participants);
    
    let resultText = 'Ergebnis: ';
    if (summary.yesCount > summary.noCount) resultText += 'Angenommen';
    else if (summary.noCount > summary.yesCount) resultText += 'Abgelehnt';
    else resultText += 'Unentschieden';
    
    const taskDescription = `
      <h3>Aus Entscheidung: ${decision.title}</h3>
      <p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>
      ${decision.description ? `<div>${decision.description}</div>` : ''}
    `;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: `[Entscheidung] ${decision.title}`,
          description: taskDescription,
          assigned_to: user.id,
          tenant_id: currentTenant.id,
          status: 'todo',
          priority: 'medium',
          category: 'personal'
        });
      
      if (error) throw error;
      toast({ title: "Aufgabe erstellt", description: "Die Aufgabe wurde aus der Entscheidung erstellt." });
      setCreatingTaskFromDecisionId(null);
      loadDecisionRequests(user.id);
    } catch (error) {
      console.error('Error creating task from decision:', error);
      toast({ title: "Fehler", description: "Aufgabe konnte nicht erstellt werden.", variant: "destructive" });
      setCreatingTaskFromDecisionId(null);
    }
  };

  const getResponseSummary = (participants: DecisionRequest['participants'] = []) => {
    const yesCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
    const noCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
    const questionCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
    const otherCount = participants.filter(p => {
      if (p.responses.length === 0) return false;
      const rt = p.responses[0].response_type;
      return rt !== 'yes' && rt !== 'no' && rt !== 'question';
    }).length;
    const pending = participants.length - (yesCount + noCount + questionCount + otherCount);
    return { yesCount, noCount, questionCount, otherCount, pending, total: participants.length };
  };

  const getBorderColor = (summary: ReturnType<typeof getResponseSummary>) => {
    const hasResponses = summary.yesCount + summary.noCount + summary.questionCount > 0;
    const allResponsesReceived = summary.pending === 0;
    
    if (summary.questionCount > 0) return 'border-l-orange-500';
    if (!allResponsesReceived || !hasResponses) return 'border-l-gray-400';
    if (summary.yesCount > summary.noCount) return 'border-l-green-500';
    return 'border-l-red-600';
  };

  // Sidebar data
  const sidebarData = useMemo(() => {
    const openQuestions: Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      participantName: string | null;
      participantBadgeColor: string | null;
      participantUserId: string;
      participantAvatarUrl: string | null;
      comment: string | null;
      createdAt: string;
      hasCreatorResponse: boolean;
    }> = [];

    const newComments: Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      participantName: string | null;
      participantBadgeColor: string | null;
      participantUserId: string;
      participantAvatarUrl: string | null;
      responseType: string;
      comment: string | null;
      createdAt: string;
    }> = [];

    // Find open questions (for creator) and new comments
    decisions.forEach(decision => {
      if (decision.status === 'archived') return;
      
      decision.participants?.forEach(participant => {
        const latestResponse = participant.responses[0];
        if (!latestResponse) return;

        // Open questions: questions without creator response (for decision creator)
        if (decision.isCreator && latestResponse.response_type === 'question' && !latestResponse.creator_response) {
          openQuestions.push({
            id: latestResponse.id,
            decisionId: decision.id,
            decisionTitle: decision.title,
            participantName: participant.profile?.display_name || null,
            participantBadgeColor: participant.profile?.badge_color || null,
            participantUserId: participant.user_id,
            participantAvatarUrl: participant.profile?.avatar_url || null,
            comment: latestResponse.comment,
            createdAt: latestResponse.created_at,
            hasCreatorResponse: false,
          });
        }

        // New comments: responses with comments in the last 7 days (for non-creators)
        if (decision.isCreator && latestResponse.comment) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (new Date(latestResponse.created_at) > sevenDaysAgo && latestResponse.response_type !== 'question') {
            newComments.push({
              id: latestResponse.id,
              decisionId: decision.id,
              decisionTitle: decision.title,
              participantName: participant.profile?.display_name || null,
              participantBadgeColor: participant.profile?.badge_color || null,
              participantUserId: participant.user_id,
              participantAvatarUrl: participant.profile?.avatar_url || null,
              responseType: latestResponse.response_type,
              comment: latestResponse.comment,
              createdAt: latestResponse.created_at,
            });
          }
        }
      });
    });

    return { openQuestions, newComments };
  }, [decisions]);

  // Get decision IDs for comment counts
  const decisionIds = useMemo(() => decisions.map(d => d.id), [decisions]);
  const { getCommentCount, refresh: refreshCommentCounts } = useDecisionComments(decisionIds);

  // Tab counts
  const tabCounts = useMemo(() => {
    const active = decisions.filter(d => d.status !== 'archived');
    return {
      forMe: active.filter(d => 
        (d.isParticipant && !d.hasResponded && !d.isCreator) ||
        (d.isCreator && (() => { const s = getResponseSummary(d.participants); return s.questionCount > 0 || (s.total > 0 && s.pending < s.total); })())
      ).length,
      answered: active.filter(d => d.isParticipant && d.hasResponded && !d.isCreator).length,
      myDecisions: active.filter(d => d.isCreator).length,
      public: active.filter(d => d.visible_to_all && !d.isCreator && !d.isParticipant).length,
      questions: active.filter(d => {
        if (!d.isCreator) return false;
        const summary = getResponseSummary(d.participants);
        return summary.questionCount > 0;
      }).length,
      archived: decisions.filter(d => d.status === 'archived').length,
    };
  }, [decisions]);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    let filtered = decisions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(query) ||
        (d.description && d.description.toLowerCase().includes(query))
      );
    }

    // Tab filter
    if (activeTab === "archived") {
      return filtered.filter(d => d.status === 'archived');
    }

    filtered = filtered.filter(d => d.status !== 'archived');

    switch (activeTab) {
      case "for-me": {
        const forMe = filtered.filter(d => d.isParticipant && !d.hasResponded && !d.isCreator);
        const myWithActivity = filtered.filter(d => {
          if (!d.isCreator) return false;
          const s = getResponseSummary(d.participants);
          return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
        });
        const ids = new Set(forMe.map(d => d.id));
        return [...forMe, ...myWithActivity.filter(d => !ids.has(d.id))];
      }
      case "answered":
        return filtered.filter(d => d.isParticipant && d.hasResponded && !d.isCreator);
      case "my-decisions":
        return filtered.filter(d => d.isCreator);
      case "public":
        return filtered.filter(d => d.visible_to_all && !d.isCreator && !d.isParticipant);
      case "questions":
        return filtered.filter(d => {
          if (!d.isCreator) return false;
          const summary = getResponseSummary(d.participants);
          return summary.questionCount > 0;
        });
      default:
        return filtered;
    }
  }, [decisions, activeTab, searchQuery]);

  const openComments = (decisionId: string, decisionTitle: string) => {
    setCommentsDecisionId(decisionId);
    setCommentsDecisionTitle(decisionTitle);
  };

  const renderCompactCard = (decision: DecisionRequest) => {
    const summary = getResponseSummary(decision.participants);
    
    // Prepare avatar stack data
    const avatarParticipants = (decision.participants || []).map(p => ({
      user_id: p.user_id,
      display_name: p.profile?.display_name || null,
      badge_color: p.profile?.badge_color || null,
      avatar_url: p.profile?.avatar_url || null,
      response_type: p.responses[0]?.response_type || null,
    }));

    const getInitials = (name: string | null) => {
      if (!name) return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
      <Card 
        key={decision.id}
        ref={highlightRef(decision.id)}
        className={cn(
          "group border-l-4 hover:bg-muted/50 transition-colors cursor-pointer",
          getBorderColor(summary),
          isHighlighted(decision.id) && "notification-highlight"
        )}
        onClick={() => handleOpenDetails(decision.id)}
      >
        <CardContent className="p-4">
          {/* Header: Status badges + Actions */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {summary.questionCount > 0 ? (
                <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-sm px-3 py-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5 inline-block" />
                  Rückfrage
                </Badge>
              ) : summary.pending === 0 && summary.total > 0 ? (
                <Badge className="bg-green-100 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-sm px-3 py-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 inline-block" />
                  Entschieden
                </Badge>
              ) : summary.total > 0 ? (
                <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-sm px-3 py-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 inline-block" />
                  Ausstehend
                </Badge>
              ) : null}

              {decision.hasResponded && decision.isParticipant && (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
            </div>

            {decision.isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingDecisionId(decision.id); }}>
                    <Edit className="h-4 w-4 mr-2" />Bearbeiten
                  </DropdownMenuItem>
                  {decision.status !== 'archived' && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); archiveDecision(decision.id); }}>
                      <Archive className="h-4 w-4 mr-2" />Archivieren
                    </DropdownMenuItem>
                  )}
                  {summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); createTaskFromDecision(decision); }}
                        disabled={creatingTaskFromDecisionId === decision.id}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {creatingTaskFromDecisionId === decision.id ? 'Erstelle...' : 'Aufgabe erstellen'}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setDeletingDecisionId(decision.id); }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Endgültig löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-lg mb-1 line-clamp-1 group-hover:line-clamp-none">{decision.title}</h3>

          {/* Description */}
          {decision.description && (
            <div onClick={(e) => e.stopPropagation()}>
              <TruncatedDescription content={decision.description} maxLength={120} />
            </div>
          )}

          {/* Metadata row - no borders, more spacing */}
          <div className="flex items-center flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
            {/* Date */}
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              {new Date(decision.created_at).toLocaleDateString('de-DE')}
            </span>

            {/* Creator */}
            {decision.creator && (
              <span className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  {decision.creator.avatar_url && (
                    <AvatarImage src={decision.creator.avatar_url} alt={decision.creator.display_name || 'Avatar'} />
                  )}
                  <AvatarFallback 
                    className="text-[8px]"
                    style={{ backgroundColor: decision.creator.badge_color || undefined }}
                  >
                    {getInitials(decision.creator.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{decision.creator.display_name || 'Unbekannt'}</span>
              </span>
            )}

            {/* Comments */}
            <button
              onClick={(e) => { e.stopPropagation(); openComments(decision.id, decision.title); }}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {getCommentCount(decision.id) > 0 
                ? `${getCommentCount(decision.id)} Kommentar${getCommentCount(decision.id) !== 1 ? 'e' : ''}`
                : 'Kommentar schreiben'
              }
            </button>

            {/* Public */}
            {decision.visible_to_all && (
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Öffentlich
              </span>
            )}

            {/* Attachments */}
            {(decision.attachmentCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {decision.attachmentCount}
              </span>
            )}

            {/* Topics */}
            {decision.topicIds && decision.topicIds.length > 0 && (
              <TopicDisplay topicIds={decision.topicIds} maxDisplay={2} />
            )}
          </div>

          {/* Voting row: buttons left, results + avatars right */}
          {decision.participants && decision.participants.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              {/* Left: Inline voting for unanswered participants */}
              <div onClick={(e) => e.stopPropagation()}>
                {decision.isParticipant && decision.participant_id && !decision.hasResponded && !decision.isCreator ? (
                  <TaskDecisionResponse 
                    decisionId={decision.id}
                    participantId={decision.participant_id}
                    onResponseSubmitted={handleResponseSubmitted}
                    hasResponded={decision.hasResponded}
                    creatorId={decision.created_by}
                  />
                ) : null}
              </div>

              {/* Right: Voting results + AvatarStack */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-green-600">{summary.yesCount}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-orange-600">{summary.questionCount}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-red-600">{summary.noCount}</span>
                  {summary.otherCount > 0 && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-blue-600">{summary.otherCount}</span>
                    </>
                  )}
                </div>
                <AvatarStack participants={avatarParticipants} maxVisible={4} size="sm" />
              </div>
            </div>
          )}

          {/* Activity preview */}
          <DecisionCardActivity 
            participants={decision.participants} 
            maxItems={2} 
            isCreator={decision.isCreator}
            creatorProfile={decision.creator ? {
              display_name: decision.creator.display_name,
              badge_color: decision.creator.badge_color,
              avatar_url: decision.creator.avatar_url,
            } : undefined}
            onReply={(responseId, text) => sendCreatorResponse(responseId, text)}
          />

        </CardContent>
      </Card>
    );
  };

  const renderArchivedCard = (decision: DecisionRequest) => {
    const summary = getResponseSummary(decision.participants);
    
    return (
      <Card 
        key={decision.id}
        ref={highlightRef(decision.id)}
        className={cn(
          "border-l-4 bg-muted/30",
          getBorderColor(summary),
          isHighlighted(decision.id) && "notification-highlight"
        )}
        onClick={() => handleOpenDetails(decision.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground">{decision.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span>Archiviert: {decision.archived_at && new Date(decision.archived_at).toLocaleDateString('de-DE')}</span>
                {decision.creator && (
                  <>
                    <span>•</span>
                    <UserBadge 
                      userId={decision.creator.user_id}
                      displayName={decision.creator.display_name}
                      badgeColor={decision.creator.badge_color}
                      size="sm"
                    />
                  </>
                )}
              </div>
            </div>
            
            {decision.isCreator && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); restoreDecision(decision.id); }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Wiederherstellen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Entscheidungen</h1>
        <p className="text-base text-muted-foreground">
          Verwalten Sie Entscheidungsanfragen und Abstimmungen
        </p>
      </div>
      
      {/* Search + Create */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Entscheidungen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <StandaloneDecisionCreator 
          onDecisionCreated={() => user?.id && loadDecisionRequests(user.id)} 
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>

      {/* Tabs + Grid Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* TabsList AUSSERHALB des Grids */}
        <TabsList className="grid w-full grid-cols-6 h-9 mb-4">
          <TabsTrigger value="for-me" className="text-xs">
            Für mich
            {tabCounts.forMe > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                {tabCounts.forMe}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="answered" className="text-xs">
            Beantwortet ({tabCounts.answered})
          </TabsTrigger>
          <TabsTrigger value="my-decisions" className="text-xs">
            Von mir ({tabCounts.myDecisions})
          </TabsTrigger>
          <TabsTrigger value="public" className="text-xs">
            Öffentlich ({tabCounts.public})
          </TabsTrigger>
          <TabsTrigger value="questions" className="text-xs">
            Rückfragen
            {tabCounts.questions > 0 && (
              <Badge variant="outline" className="ml-1.5 text-orange-600 border-orange-600 text-[10px] px-1.5 py-0">
                {tabCounts.questions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs">
            <FolderArchive className="h-3 w-3 mr-1" />
            Archiv ({tabCounts.archived})
          </TabsTrigger>
        </TabsList>
        
        {/* Grid: Content + Sidebar auf GLEICHER HÖHE */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Main Content */}
          <TabsContent value={activeTab} className="mt-0 space-y-3">
            {filteredDecisions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {activeTab === "for-me" && "Keine offenen Entscheidungen für Sie."}
                {activeTab === "answered" && "Keine beantworteten Entscheidungen vorhanden."}
                {activeTab === "my-decisions" && "Sie haben noch keine Entscheidungsanfragen erstellt."}
                {activeTab === "public" && "Keine öffentlichen Entscheidungen vorhanden."}
                {activeTab === "questions" && "Keine offenen Rückfragen vorhanden."}
                {activeTab === "archived" && "Keine archivierten Entscheidungen vorhanden."}
              </div>
            ) : (
              <div className="space-y-3">
                {activeTab === "archived" 
                  ? filteredDecisions.map(renderArchivedCard)
                  : filteredDecisions.map(renderCompactCard)
                }
              </div>
            )}
          </TabsContent>

          {/* Right Sidebar */}
          <DecisionSidebar
            openQuestions={sidebarData.openQuestions}
            newComments={sidebarData.newComments}
            onQuestionClick={handleOpenDetails}
            onCommentClick={handleOpenDetails}
            onResponseSent={() => user?.id && loadDecisionRequests(user.id)}
          />
        </div>
      </Tabs>

      {/* Dialogs */}
      {selectedDecisionId && (
        <TaskDecisionDetails
          decisionId={selectedDecisionId}
          isOpen={isDetailsOpen}
          onClose={handleCloseDetails}
          onArchived={handleDecisionArchived}
        />
      )}

      {editingDecisionId && (
        <DecisionEditDialog
          decisionId={editingDecisionId}
          isOpen={true}
          onClose={() => setEditingDecisionId(null)}
          onUpdated={() => {
            setEditingDecisionId(null);
            if (user?.id) loadDecisionRequests(user.id);
          }}
        />
      )}

      {/* Comments Sheet */}
      {commentsDecisionId && (
        <DecisionComments
          decisionId={commentsDecisionId}
          decisionTitle={commentsDecisionTitle}
          isOpen={!!commentsDecisionId}
          onClose={() => setCommentsDecisionId(null)}
          onCommentAdded={() => {
            refreshCommentCounts();
            if (user?.id) loadDecisionRequests(user.id);
          }}
        />
      )}

      <AlertDialog open={!!deletingDecisionId} onOpenChange={() => setDeletingDecisionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidung endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion löscht die Entscheidung unwiderruflich. Alle zugehörigen Antworten und Kommentare werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDecision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
