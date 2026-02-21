import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, StickyNote, ListTodo, Trash, Cake, Scale } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UpcomingAppointmentsSection } from './UpcomingAppointmentsSection';
import { BirthdayAgendaItem } from './BirthdayAgendaItem';
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
  user_id?: string;
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface LinkedDecision {
  id: string;
  title: string;
  description?: string | null;
  response_deadline?: string | null;
  priority?: number | null;
}

interface SystemAgendaItemProps {
  systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays' | 'decisions';
  meetingDate?: string | Date;
  meetingId?: string;
  allowStarring?: boolean;
  linkedQuickNotes?: any[];
  linkedTasks?: LinkedTask[];
  linkedDecisions?: LinkedDecision[];
  profiles?: ProfileInfo[];
  resultText?: string | null;
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  onUpdateResult?: (result: string) => void;
  onDelete?: () => void;
  className?: string;
  isEmbedded?: boolean;
  defaultCollapsed?: boolean;
  /** Profiles passed through to child components like BirthdayAgendaItem */
  allProfiles?: ProfileInfo[];
}

function ProfileBadge({ userId, profiles }: { userId?: string; profiles?: ProfileInfo[] }) {
  if (!userId || !profiles) return null;
  const profile = profiles.find(p => p.user_id === userId);
  if (!profile) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Avatar className="h-5 w-5">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {(profile.display_name || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">{profile.display_name}</span>
    </div>
  );
}

export function SystemAgendaItem({
  systemType,
  meetingDate,
  meetingId,
  allowStarring = false,
  linkedQuickNotes = [],
  linkedTasks = [],
  linkedDecisions = [],
  profiles,
  resultText,
  onUpdateNoteResult,
  onUpdateResult,
  onDelete,
  className,
  isEmbedded = false,
  defaultCollapsed = false,
}: SystemAgendaItemProps) {
  // Color scheme based on system type
  const getBorderColor = () => {
    switch (systemType) {
      case 'upcoming_appointments': return 'border-l-blue-500';
      case 'quick_notes': return 'border-l-amber-500';
      case 'tasks': return 'border-l-green-500';
      case 'birthdays': return 'border-l-pink-500';
      case 'decisions': return 'border-l-violet-500';
      default: return 'border-l-muted';
    }
  };

  const getBadgeColors = () => {
    switch (systemType) {
      case 'upcoming_appointments': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
      case 'quick_notes': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'tasks': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
      case 'birthdays': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800';
      case 'decisions': return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800';
      default: return '';
    }
  };

  const getIcon = () => {
    switch (systemType) {
      case 'upcoming_appointments': return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case 'quick_notes': return <StickyNote className="h-4 w-4 text-amber-500" />;
      case 'tasks': return <ListTodo className="h-4 w-4 text-green-500" />;
      case 'birthdays': return <Cake className="h-4 w-4 text-pink-500" />;
      case 'decisions': return <Scale className="h-4 w-4 text-violet-500" />;
      default: return null;
    }
  };

  const getTitle = () => {
    switch (systemType) {
      case 'upcoming_appointments': return 'Kommende Termine';
      case 'quick_notes': return 'Meine Notizen';
      case 'tasks': return 'Aufgaben';
      case 'birthdays': return 'Geburtstage';
      case 'decisions': return 'Entscheidungen';
      default: return '';
    }
  };

  const getBadgeIcon = () => {
    switch (systemType) {
      case 'upcoming_appointments': return <CalendarDays className="h-3 w-3 mr-1" />;
      case 'quick_notes': return <StickyNote className="h-3 w-3 mr-1" />;
      case 'tasks': return <ListTodo className="h-3 w-3 mr-1" />;
      case 'birthdays': return <Cake className="h-3 w-3 mr-1" />;
      case 'decisions': return <Scale className="h-3 w-3 mr-1" />;
      default: return null;
    }
  };

  const renderHeader = (extraBadge?: React.ReactNode) => (
    <CardHeader className="py-2 px-3 pb-1">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          {getIcon()}
          {getTitle()}
          {extraBadge}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={cn("text-xs", getBadgeColors())}>
            {getBadgeIcon()}
            System
          </Badge>
          {onDelete && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete} 
              aria-label="Punkt löschen"
            >
              <Trash className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );

  if (systemType === 'upcoming_appointments') {
    return (
      <Card className={cn("border-l-4", getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          <UpcomingAppointmentsSection 
            meetingDate={meetingDate} 
            meetingId={meetingId}
            allowStarring={allowStarring}
            profiles={profiles}
            className="border-0 shadow-none bg-transparent p-0"
            defaultCollapsed={defaultCollapsed}
          />
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'quick_notes') {
    return (
      <Card className={cn("border-l-4", getBorderColor(), className)}>
        {renderHeader(
          linkedQuickNotes.length > 0 ? <Badge variant="secondary">{linkedQuickNotes.length}</Badge> : undefined
        )}
        <CardContent className="px-3 pb-2 pt-0">
          {linkedQuickNotes.length > 0 ? (
            <div className="space-y-2">
              {linkedQuickNotes.map((note) => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                  {note.title && (
                    <h4 className="font-semibold text-sm mb-1">{note.title}</h4>
                  )}
                  <RichTextDisplay content={note.content} className="text-sm" />
                  <ProfileBadge userId={note.user_id} profiles={profiles} />
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
      <Card className={cn("border-l-4", getBorderColor(), className)}>
        {renderHeader(
          linkedTasks.length > 0 ? <Badge variant="secondary">{linkedTasks.length}</Badge> : undefined
        )}
        <CardContent className="px-3 pb-2 pt-0">
          {linkedTasks.length > 0 ? (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div key={task.id} className="p-3 bg-muted/50 rounded-md">
                  <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
                  {task.description && (
                    <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />
                  )}
                  <ProfileBadge userId={task.user_id} profiles={profiles} />
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


  if (systemType === 'decisions') {
    return (
      <Card className={cn("border-l-4", getBorderColor(), className)}>
        {renderHeader(
          linkedDecisions.length > 0 ? <Badge variant="secondary">{linkedDecisions.length}</Badge> : undefined
        )}
        <CardContent className="px-3 pb-2 pt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Es werden automatisch aktive Entscheidungen geladen, die priorisiert sind, deren Frist bereits abgelaufen ist oder deren Frist in den nächsten 7 Tagen endet.
          </p>
          {linkedDecisions.length > 0 ? (
            <div className="space-y-2">
              {linkedDecisions.map((decision) => (
                <div key={decision.id} className="p-3 bg-muted/50 rounded-md">
                  <h4 className="font-semibold text-sm mb-1">{decision.title}</h4>
                  {decision.description && (
                    <RichTextDisplay content={decision.description} className="text-sm text-muted-foreground" />
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                    {decision.response_deadline && (
                      <span>Frist: {format(new Date(decision.response_deadline), "dd.MM.yyyy", { locale: de })}</span>
                    )}
                    {decision.priority !== null && decision.priority !== undefined && (
                      <span>Priorität: {decision.priority}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine relevanten Entscheidungen für dieses Meeting vorhanden.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'birthdays') {
    return (
      <BirthdayAgendaItem
        meetingDate={meetingDate}
        meetingId={meetingId}
        resultText={resultText}
        onUpdateResult={onUpdateResult}
        onDelete={onDelete}
        className={className}
        isEmbedded={isEmbedded}
        profiles={profiles}
      />
    );
  }

  return null;
}
