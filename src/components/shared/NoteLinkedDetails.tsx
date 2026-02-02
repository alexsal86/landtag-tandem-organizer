import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CheckSquare, Vote, Calendar as CalendarIcon, ArrowRight, Trash2, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { DecisionResponseSummary } from "@/components/shared/DecisionResponseSummary";

interface NoteLinkedDetailsProps {
  taskId?: string | null;
  decisionId?: string | null;
  meetingId?: string | null;
  isExpanded: boolean;
  onTaskNotFound?: () => void;
  onDecisionNotFound?: () => void;
  onMeetingNotFound?: () => void;
  taskArchivedInfo?: { id: string; title: string; archived_at: string } | null;
  decisionArchivedInfo?: { id: string; title: string; archived_at: string } | null;
  meetingArchivedInfo?: { id: string; title: string; archived_at: string } | null;
}

interface TaskData {
  title: string;
  status: string;
  due_date: string | null;
  progress: number | null;
}

interface MeetingData {
  title: string;
  meeting_date: string;
  status: string | null;
}

function NoteTaskStatus({ taskId, onNotFound }: { taskId: string; onNotFound?: () => void }) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadTask = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, status, due_date, progress')
        .eq('id', taskId)
        .single();
      
      if (error || !data) {
        setNotFound(true);
        onNotFound?.();
        setTask(null);
      } else {
        setTask(data);
      }
      setLoading(false);
    };
    loadTask();
  }, [taskId, onNotFound]);
  
  if (loading) return <Skeleton className="h-4 w-32 mt-1" />;
  
  if (notFound) {
    return (
      <div className="text-xs text-destructive flex items-center gap-1 mt-1">
        <Trash2 className="h-3 w-3" />
        Aufgabe wurde gelöscht
      </div>
    );
  }
  
  if (!task) return <span className="text-xs text-muted-foreground">Aufgabe nicht gefunden</span>;
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'Offen';
      case 'in-progress': return 'In Bearbeitung';
      case 'completed': return 'Erledigt';
      default: return status;
    }
  };
  
  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      default: return 'outline';
    }
  };
  
  return (
    <div 
      className="text-xs text-muted-foreground mt-1 space-y-1 cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors"
      onClick={() => navigate(`/tasks?id=${taskId}`)}
    >
      <p className="truncate font-medium text-foreground">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={getStatusVariant(task.status)} className="text-xs h-5">
          {getStatusLabel(task.status)}
        </Badge>
        {task.due_date && (
          <span className="text-muted-foreground">
            Fällig: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
          </span>
        )}
        {task.progress !== null && task.progress > 0 && (
          <span className="text-muted-foreground">
            {task.progress}%
          </span>
        )}
      </div>
    </div>
  );
}

function NoteMeetingStatus({ meetingId, onNotFound }: { meetingId: string; onNotFound?: () => void }) {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadMeeting = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('title, meeting_date, status')
        .eq('id', meetingId)
        .single();
      
      if (error || !data) {
        setNotFound(true);
        onNotFound?.();
        setMeeting(null);
      } else {
        setMeeting(data);
      }
      setLoading(false);
    };
    loadMeeting();
  }, [meetingId, onNotFound]);
  
  if (loading) return <Skeleton className="h-4 w-32 mt-1" />;
  
  if (notFound) {
    return (
      <div className="text-xs text-destructive flex items-center gap-1 mt-1">
        <Trash2 className="h-3 w-3" />
        Meeting wurde gelöscht
      </div>
    );
  }
  
  if (!meeting) return <span className="text-xs text-muted-foreground">Meeting nicht gefunden</span>;
  
  return (
    <div 
      className="text-xs text-muted-foreground mt-1 space-y-1 cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors"
      onClick={() => navigate(`/meetings?id=${meetingId}`)}
    >
      <p className="truncate font-medium text-foreground">{meeting.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs h-5">
          {format(new Date(meeting.meeting_date), "dd.MM.yyyy", { locale: de })}
        </Badge>
        {meeting.status === 'completed' && (
          <Badge variant="default" className="text-xs h-5">Abgeschlossen</Badge>
        )}
      </div>
    </div>
  );
}

export function NoteLinkedDetails({ 
  taskId, 
  decisionId, 
  meetingId, 
  isExpanded,
  onTaskNotFound,
  onDecisionNotFound,
  onMeetingNotFound,
  taskArchivedInfo,
  decisionArchivedInfo,
  meetingArchivedInfo
}: NoteLinkedDetailsProps) {
  const hasLinks = taskId || decisionId || meetingId || taskArchivedInfo || decisionArchivedInfo || meetingArchivedInfo;
  const navigate = useNavigate();
  
  if (!hasLinks) return null;
  
  return (
    <Collapsible open={isExpanded}>
      <CollapsibleContent className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
        {/* Task Status */}
        {taskId && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900 group/task">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600">
                <CheckSquare className="h-4 w-4" />
                <span className="text-xs font-medium">Aufgabe</span>
              </div>
              <ArrowRight 
                className="h-4 w-4 text-blue-600 opacity-0 group-hover/task:opacity-100 transition-opacity cursor-pointer"
                onClick={() => navigate(`/tasks?id=${taskId}`)}
              />
            </div>
            <NoteTaskStatus taskId={taskId} onNotFound={onTaskNotFound} />
          </div>
        )}
        
        {/* Archived Task Info */}
        {!taskId && taskArchivedInfo && (
          <div className="p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-md border border-blue-100/50 dark:border-blue-900/50">
            <div className="flex items-center gap-2 text-blue-600/70">
              <Archive className="h-4 w-4" />
              <span className="text-xs font-medium">Aufgabe (archiviert)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <p className="truncate">{taskArchivedInfo.title}</p>
              <p className="text-[10px]">Archiviert: {format(new Date(taskArchivedInfo.archived_at), "dd.MM.yyyy", { locale: de })}</p>
            </div>
          </div>
        )}
        
        {/* Decision Status */}
        {decisionId && (
          <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-100 dark:border-purple-900 group/decision">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-600">
                <Vote className="h-4 w-4" />
                <span className="text-xs font-medium">Entscheidung</span>
              </div>
              <ArrowRight 
                className="h-4 w-4 text-purple-600 opacity-0 group-hover/decision:opacity-100 transition-opacity cursor-pointer"
                onClick={() => navigate(`/decisions?id=${decisionId}`)}
              />
            </div>
            <div className="mt-1">
              <DecisionResponseSummary 
                decisionId={decisionId} 
                compact={false}
              />
            </div>
          </div>
        )}
        
        {/* Archived Decision Info */}
        {!decisionId && decisionArchivedInfo && (
          <div className="p-2 bg-purple-50/50 dark:bg-purple-950/20 rounded-md border border-purple-100/50 dark:border-purple-900/50">
            <div className="flex items-center gap-2 text-purple-600/70">
              <Archive className="h-4 w-4" />
              <span className="text-xs font-medium">Entscheidung (archiviert)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <p className="truncate">{decisionArchivedInfo.title}</p>
              <p className="text-[10px]">Archiviert: {format(new Date(decisionArchivedInfo.archived_at), "dd.MM.yyyy", { locale: de })}</p>
            </div>
          </div>
        )}
        
        {/* Meeting Status */}
        {meetingId && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-100 dark:border-emerald-900 group/meeting">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Jour Fixe</span>
              </div>
              <ArrowRight 
                className="h-4 w-4 text-emerald-600 opacity-0 group-hover/meeting:opacity-100 transition-opacity cursor-pointer"
                onClick={() => navigate(`/meetings?id=${meetingId}`)}
              />
            </div>
            <NoteMeetingStatus meetingId={meetingId} onNotFound={onMeetingNotFound} />
          </div>
        )}
        
        {/* Archived Meeting Info */}
        {!meetingId && meetingArchivedInfo && (
          <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-md border border-emerald-100/50 dark:border-emerald-900/50">
            <div className="flex items-center gap-2 text-emerald-600/70">
              <Archive className="h-4 w-4" />
              <span className="text-xs font-medium">Jour Fixe (archiviert)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <p className="truncate">{meetingArchivedInfo.title}</p>
              <p className="text-[10px]">Archiviert: {format(new Date(meetingArchivedInfo.archived_at), "dd.MM.yyyy", { locale: de })}</p>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
