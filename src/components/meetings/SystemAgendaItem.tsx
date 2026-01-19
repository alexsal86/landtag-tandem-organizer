import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, StickyNote } from 'lucide-react';
import { UpcomingAppointmentsSection } from './UpcomingAppointmentsSection';
import { cn } from '@/lib/utils';

interface SystemAgendaItemProps {
  systemType: 'upcoming_appointments' | 'quick_notes';
  meetingDate?: string | Date;
  linkedQuickNotes?: any[];
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  className?: string;
  isEmbedded?: boolean;
  defaultCollapsed?: boolean;
}

export function SystemAgendaItem({
  systemType,
  meetingDate,
  linkedQuickNotes = [],
  onUpdateNoteResult,
  className,
  isEmbedded = false,
  defaultCollapsed = false
}: SystemAgendaItemProps) {
  if (systemType === 'upcoming_appointments') {
    return (
      <div className={cn(
        "relative",
        !isEmbedded && "border-l-4 border-blue-500 rounded-lg overflow-hidden",
        className
      )}>
        {!isEmbedded && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-xs">
              <CalendarDays className="h-3 w-3 mr-1" />
              System
            </Badge>
          </div>
        )}
        <UpcomingAppointmentsSection 
          meetingDate={meetingDate} 
          className={isEmbedded ? "" : "border-0 shadow-none"}
          defaultCollapsed={defaultCollapsed}
        />
      </div>
    );
  }

  if (systemType === 'quick_notes') {
    return (
      <Card className={cn(
        "border-l-4 border-amber-500",
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Meine Notizen
              {linkedQuickNotes.length > 0 && (
                <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
              )}
            </CardTitle>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs">
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
                  <p className="text-sm">{note.content}</p>
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

  return null;
}
