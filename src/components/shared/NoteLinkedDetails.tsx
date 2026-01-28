import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckSquare, Vote, Calendar as CalendarIcon, ChevronDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { DecisionResponseSummary } from "@/components/shared/DecisionResponseSummary";

interface NoteLinkedDetailsProps {
  taskId?: string | null;
  decisionId?: string | null;
  meetingId?: string | null;
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

function NoteTaskStatus({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadTask = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, status, due_date, progress')
        .eq('id', taskId)
        .single();
      
      if (!error && data) {
        setTask(data);
      }
      setLoading(false);
    };
    loadTask();
  }, [taskId]);
  
  if (loading) return <Skeleton className="h-4 w-32 mt-1" />;
  if (!task) return <span className="text-xs text-muted-foreground">Aufgabe nicht gefunden</span>;
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'Offen';
      case 'in-progress': return 'In Bearbeitung';
      case 'completed': return 'Erledigt';
      default: return status;
    }
  };
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      default: return 'outline';
    }
  };
  
  return (
    <div className="text-xs text-muted-foreground mt-1 space-y-1">
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

function NoteMeetingStatus({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadMeeting = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('title, meeting_date, status')
        .eq('id', meetingId)
        .single();
      
      if (!error && data) {
        setMeeting(data);
      }
      setLoading(false);
    };
    loadMeeting();
  }, [meetingId]);
  
  if (loading) return <Skeleton className="h-4 w-32 mt-1" />;
  if (!meeting) return <span className="text-xs text-muted-foreground">Meeting nicht gefunden</span>;
  
  return (
    <div className="text-xs text-muted-foreground mt-1 space-y-1">
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

export function NoteLinkedDetails({ taskId, decisionId, meetingId }: NoteLinkedDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const hasLinks = taskId || decisionId || meetingId;
  
  if (!hasLinks) return null;
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger 
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 py-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform duration-200",
          !expanded && "-rotate-90"
        )} />
        <Info className="h-3 w-3" />
        <span>Details anzeigen</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
        {/* Task Status */}
        {taskId && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckSquare className="h-4 w-4" />
              <span className="text-xs font-medium">Aufgabe</span>
            </div>
            <NoteTaskStatus taskId={taskId} />
          </div>
        )}
        
        {/* Decision Status */}
        {decisionId && (
          <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-100 dark:border-purple-900">
            <div className="flex items-center gap-2 text-purple-600">
              <Vote className="h-4 w-4" />
              <span className="text-xs font-medium">Entscheidung</span>
            </div>
            <div className="mt-1">
              <DecisionResponseSummary 
                decisionId={decisionId} 
                compact={false}
              />
            </div>
          </div>
        )}
        
        {/* Meeting Status */}
        {meetingId && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-100 dark:border-emerald-900">
            <div className="flex items-center gap-2 text-emerald-600">
              <CalendarIcon className="h-4 w-4" />
              <span className="text-xs font-medium">Jour Fixe</span>
            </div>
            <NoteMeetingStatus meetingId={meetingId} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
