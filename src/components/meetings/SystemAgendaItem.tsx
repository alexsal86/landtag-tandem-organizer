import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, StickyNote, ListTodo, Trash, Cake, Scale, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UpcomingAppointmentsSection } from './UpcomingAppointmentsSection';
import { BirthdayAgendaItem } from './BirthdayAgendaItem';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, Profile } from './types';

interface SystemAgendaItemProps {
  systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays' | 'decisions' | 'case_items';
  meetingDate?: string | Date;
  meetingId?: string;
  allowStarring?: boolean;
  linkedQuickNotes?: LinkedQuickNote[];
  linkedTasks?: LinkedTask[];
  linkedDecisions?: RelevantDecision[];
  linkedCaseItems?: LinkedCaseItem[];
  profiles?: Profile[];
  resultText?: string | null;
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  onUpdateResult?: (result: string) => void;
  onDelete?: () => void;
  className?: string;
  isEmbedded?: boolean;
  defaultCollapsed?: boolean;
  allProfiles?: Profile[];
  agendaNumber?: string;
  compact?: boolean;
}

function ProfileBadge({ userId, profiles }: { userId?: string; profiles?: Profile[] }) {
  if (!userId || !profiles) return null;
  const profile = profiles.find(p => p.user_id === userId);
  if (!profile) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Avatar className="h-5 w-5">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">{(profile.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback>
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
  linkedCaseItems = [],
  profiles,
  resultText,
  onUpdateResult,
  onDelete,
  className,
  isEmbedded = false,
  defaultCollapsed = false,
  agendaNumber,
  compact = false,
}: SystemAgendaItemProps) {
  const [upcomingAppointmentsCount, setUpcomingAppointmentsCount] = useState(0);

  const getBorderColor = () => {
    switch (systemType) {
      case 'upcoming_appointments': return 'border-l-blue-500';
      case 'quick_notes': return 'border-l-amber-500';
      case 'tasks': return 'border-l-green-500';
      case 'birthdays': return 'border-l-pink-500';
      case 'decisions': return 'border-l-violet-500';
      case 'case_items': return 'border-l-teal-500';
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
      case 'case_items': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800';
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
      case 'case_items': return <Briefcase className="h-4 w-4 text-teal-500" />;
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
      case 'case_items': return 'Vorgänge';
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
      case 'case_items': return <Briefcase className="h-3 w-3 mr-1" />;
      default: return null;
    }
  };

  const getCountBadge = () => {
    switch (systemType) {
      case 'upcoming_appointments': return upcomingAppointmentsCount > 0 ? upcomingAppointmentsCount : undefined;
      case 'quick_notes': return linkedQuickNotes.length > 0 ? linkedQuickNotes.length : undefined;
      case 'tasks': return linkedTasks.length > 0 ? linkedTasks.length : undefined;
      case 'decisions': return linkedDecisions.length > 0 ? linkedDecisions.length : undefined;
      case 'case_items': return linkedCaseItems.length > 0 ? linkedCaseItems.length : undefined;
      default: return undefined;
    }
  };

  const renderCompactItem = (label: string, icon: ReactNode, idx: number, ownerLabel?: string | null) => (
    <li key={`${label}-${idx}`} className="rounded bg-muted/40 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="min-w-[2rem] text-[11px] font-medium text-foreground/70">{String.fromCharCode(97 + idx)})</span>
        {icon}
        <span className="text-foreground">{label}</span>
        {ownerLabel && <span className="text-muted-foreground/80">({ownerLabel})</span>}
      </div>
    </li>
  );

  const renderHeader = () => {
    const count = getCountBadge();
    return (
      <CardHeader className="py-2 px-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {agendaNumber && <span className="text-muted-foreground font-medium min-w-[2rem] text-right">{agendaNumber}</span>}
            {getIcon()}
            {getTitle()}
          </CardTitle>
          <div className="flex items-center gap-1">
            {count !== undefined && <Badge variant="secondary" className="text-xs">{count}</Badge>}
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Punkt löschen">
                <Trash className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    );
  };

  if (systemType === 'upcoming_appointments') {
    return (
      <Card className={cn('border-l-4', getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          <UpcomingAppointmentsSection
            meetingDate={meetingDate!}
            meetingId={meetingId}
            allowStarring={allowStarring}
            profiles={profiles}
            className="border-0 shadow-none bg-transparent p-0"
            defaultCollapsed={defaultCollapsed}
            showCountBadge={false}
            onAppointmentsCountChange={setUpcomingAppointmentsCount}
          />
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'quick_notes') {
    return (
      <Card className={cn('border-l-4', getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          {linkedQuickNotes.length > 0 ? (
            compact ? (
              <ul className="space-y-1">
                {linkedQuickNotes.map((note, index) => renderCompactItem(note.title || `Notiz ${index + 1}`, <StickyNote className="h-2.5 w-2.5 text-amber-500" />, index, note.user_id ? `von ${profiles?.find(p => p.user_id === note.user_id)?.display_name || 'unbekannt'}` : null))}
              </ul>
            ) : (
              <div className="space-y-2">
                {linkedQuickNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                    {note.title && <h4 className="font-semibold text-sm mb-1">{note.title}</h4>}
                    <RichTextDisplay content={note.content} className="text-sm" />
                    <ProfileBadge userId={note.user_id} profiles={profiles} />
                    {note.meeting_result && <p className="text-xs text-muted-foreground mt-1">Ergebnis: {note.meeting_result}</p>}
                  </div>
                ))}
              </div>
            )
          ) : <p className="text-sm text-muted-foreground">Keine Notizen für dieses Meeting vorhanden.</p>}
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'tasks') {
    return (
      <Card className={cn('border-l-4', getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          {linkedTasks.length > 0 ? (
            compact ? (
              <ul className="space-y-1">
                {linkedTasks.map((task, index) => renderCompactItem(task.title || 'Ohne Titel', <ListTodo className="h-2.5 w-2.5 text-green-500" />, index, task.user_id ? `von ${profiles?.find(p => p.user_id === task.user_id)?.display_name || 'unbekannt'}` : null))}
              </ul>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <div key={task.id} className="p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
                    {task.description && <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />}
                    <ProfileBadge userId={task.user_id} profiles={profiles} />
                    {task.due_date && <p className="text-xs text-muted-foreground mt-1">Frist: {format(new Date(task.due_date), 'dd.MM.yyyy', { locale: de })}</p>}
                  </div>
                ))}
              </div>
            )
          ) : <p className="text-sm text-muted-foreground">Keine Aufgaben für dieses Meeting vorhanden.</p>}
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'decisions') {
    return (
      <Card className={cn('border-l-4', getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          {!compact && (
            <p className="text-xs text-muted-foreground mb-3">
              Es werden automatisch aktive Entscheidungen geladen, die priorisiert sind, deren Frist bereits abgelaufen ist oder deren Frist in den nächsten 7 Tagen endet.
            </p>
          )}
          {linkedDecisions.length > 0 ? (
            compact ? (
              <ul className="space-y-1">
                {linkedDecisions.map((decision, index) => renderCompactItem(decision.title || 'Ohne Titel', <Scale className="h-2.5 w-2.5 text-violet-500" />, index, decision.user_id ? `von ${profiles?.find(p => p.user_id === decision.user_id)?.display_name || 'unbekannt'}` : null))}
              </ul>
            ) : (
              <div className="space-y-2">
                {linkedDecisions.map((decision) => (
                  <div key={decision.id} className="p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-sm mb-1">{decision.title}</h4>
                    {decision.description && <RichTextDisplay content={decision.description} className="text-sm text-muted-foreground" />}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                      {decision.response_deadline && <span>Frist: {format(new Date(decision.response_deadline), 'dd.MM.yyyy', { locale: de })}</span>}
                      {decision.priority !== null && decision.priority !== undefined && <span>Priorität: {decision.priority}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : <p className="text-sm text-muted-foreground">Keine relevanten Entscheidungen für dieses Meeting vorhanden.</p>}
        </CardContent>
      </Card>
    );
  }

  if (systemType === 'case_items') {
    return (
      <Card className={cn('border-l-4', getBorderColor(), className)}>
        {renderHeader()}
        <CardContent className="px-3 pb-2 pt-0">
          {linkedCaseItems.length > 0 ? (
            compact ? (
              <ul className="space-y-1">
                {linkedCaseItems.map((ci, index) => renderCompactItem(ci.subject || 'Ohne Betreff', <Briefcase className="h-2.5 w-2.5 text-teal-500" />, index, ci.owner_user_id ? `von ${profiles?.find(p => p.user_id === ci.owner_user_id)?.display_name || 'unbekannt'}` : null))}
              </ul>
            ) : (
              <div className="space-y-2">
                {linkedCaseItems.map((ci) => (
                  <div key={ci.id} className="p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-sm mb-1">{ci.subject || '(Kein Betreff)'}</h4>
                    <ProfileBadge userId={ci.owner_user_id || undefined} profiles={profiles} />
                  </div>
                ))}
              </div>
            )
          ) : <p className="text-sm text-muted-foreground">Keine Vorgänge für dieses Meeting vorhanden.</p>}
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
