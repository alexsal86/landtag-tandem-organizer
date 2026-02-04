import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, StickyNote, ListTodo } from 'lucide-react';
import { UpcomingAppointmentsSection } from './UpcomingAppointmentsSection';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface LinkedTask {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string;
  status?: string;
}

interface SystemAgendaItemProps {
  systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks';
  meetingDate?: string | Date;
  meetingId?: string;
  allowStarring?: boolean;
  linkedQuickNotes?: any[];
  linkedTasks?: LinkedTask[];
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  className?: string;
  isEmbedded?: boolean;
  defaultCollapsed?: boolean;
}

export function SystemAgendaItem({
  systemType,
  meetingDate,
  meetingId,
  allowStarring = false,
  linkedQuickNotes = [],
  linkedTasks = [],
  onUpdateNoteResult,
  className,
  isEmbedded = false,
  defaultCollapsed = false
}: SystemAgendaItemProps) {
  // Color scheme based on system type
  const getBorderColor = () => {
    switch (systemType) {
      case 'upcoming_appointments':
        return 'border-l-blue-500';
      case 'quick_notes':
        return 'border-l-amber-500';
      case 'tasks':
        return 'border-l-green-500';
      default:
        return 'border-l-muted';
    }
  };

  const getBadgeColors = () => {
    switch (systemType) {
      case 'upcoming_appointments':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
      case 'quick_notes':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'tasks':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (systemType) {
      case 'upcoming_appointments':
        return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case 'quick_notes':
        return <StickyNote className="h-4 w-4 text-amber-500" />;
      case 'tasks':
        return <ListTodo className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (systemType) {
      case 'upcoming_appointments':
        return 'Kommende Termine';
      case 'quick_notes':
        return 'Meine Notizen';
      case 'tasks':
        return 'Aufgaben';
      default:
        return '';
    }
  };

  if (systemType === 'upcoming_appointments') {
    return (
      <Card className={cn(
        "border-l-4",
        getBorderColor(),
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {getIcon()}
              {getTitle()}
            </CardTitle>
            <Badge variant="outline" className={cn("text-xs", getBadgeColors())}>
              <CalendarDays className="h-3 w-3 mr-1" />
              System
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <UpcomingAppointmentsSection 
            meetingDate={meetingDate} 
            meetingId={meetingId}
            allowStarring={allowStarring}
            className="border-0 shadow-none bg-transparent p-0"
            defaultCollapsed={defaultCollapsed}
          />
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'quick_notes') {
    return (
      <Card className={cn(
        "border-l-4",
        getBorderColor(),
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {getIcon()}
              {getTitle()}
              {linkedQuickNotes.length > 0 && (
                <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
              )}
            </CardTitle>
            <Badge variant="outline" className={cn("text-xs", getBadgeColors())}>
              <StickyNote className="h-3 w-3 mr-1" />
              System
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {linkedQuickNotes.length > 0 ? (
            <div className="space-y-2">
              {linkedQuickNotes.map((note) => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                  {note.title && (
                    <h4 className="font-semibold text-sm mb-1">{note.title}</h4>
                  )}
                  <RichTextDisplay content={note.content} className="text-sm" />
                  {note.meeting_result && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ergebnis: {note.meeting_result}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Notizen für dieses Meeting vorhanden.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'tasks') {
    return (
      <Card className={cn(
        "border-l-4",
        getBorderColor(),
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {getIcon()}
              {getTitle()}
              {linkedTasks.length > 0 && (
                <Badge variant="secondary">{linkedTasks.length}</Badge>
              )}
            </CardTitle>
            <Badge variant="outline" className={cn("text-xs", getBadgeColors())}>
              <ListTodo className="h-3 w-3 mr-1" />
              System
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {linkedTasks.length > 0 ? (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div key={task.id} className="p-3 bg-muted/50 rounded-md">
                  <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
                  {task.description && (
                    <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />
                  )}
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Aufgaben für dieses Meeting vorhanden.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
