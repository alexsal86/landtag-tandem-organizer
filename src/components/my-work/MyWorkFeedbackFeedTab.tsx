import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CheckCircle2, Paperclip, CheckSquare, MessageSquare, Loader2 } from 'lucide-react';
import { useTeamFeedbackFeed } from '@/hooks/useTeamFeedbackFeed';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export function MyWorkFeedbackFeedTab() {
  const { data: entries, isLoading } = useTeamFeedbackFeed();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Rückmeldungen werden geladen…
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Noch keine Rückmeldungen vorhanden</p>
        <p className="text-xs mt-1">
          Sobald Termine mit Notiz abgeschlossen werden, erscheinen sie hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Alle abgeschlossenen Termin-Rückmeldungen des Teams – chronologisch sortiert.
      </p>

      {entries.map((entry) => (
        <Card key={entry.id} className="border-border">
          <CardContent className="pt-4 pb-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-semibold text-sm truncate">
                    {entry.appointment_title || 'Unbekannter Termin'}
                  </h3>
                </div>
                {entry.appointment_start_time && (
                  <p className="text-xs text-muted-foreground ml-6">
                    {format(new Date(entry.appointment_start_time), 'EEEE, dd. MMMM yyyy', { locale: de })}
                    {entry.completed_at && (
                      <span className="ml-2">
                        · Rückmeldung {format(new Date(entry.completed_at), 'd. MMM HH:mm', { locale: de })}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex gap-1 shrink-0">
                {entry.has_documents && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Paperclip className="w-3 h-3" />
                    Anhang
                  </Badge>
                )}
                {entry.has_tasks && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckSquare className="w-3 h-3" />
                    Aufgabe
                  </Badge>
                )}
              </div>
            </div>

            {/* Note content */}
            <div className="ml-6 pl-3 border-l border-border">
              <RichTextDisplay content={entry.notes} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
