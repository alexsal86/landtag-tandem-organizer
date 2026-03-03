import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { CheckCircle2, Paperclip, CheckSquare, MessageSquare, Loader2, Filter } from 'lucide-react';
import { useTeamFeedbackFeed } from '@/hooks/useTeamFeedbackFeed';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const PERIOD_PRESETS = {
  '3d': 3,
  '7d': 7,
  '14d': 14,
} as const;

export function MyWorkFeedbackFeedTab() {
  const [scope, setScope] = useState<'team' | 'mine' | 'team-plus-relevant'>('team-plus-relevant');
  const [periodPreset, setPeriodPreset] = useState<keyof typeof PERIOD_PRESETS>('7d');
  const [onlyWithAttachments, setOnlyWithAttachments] = useState(false);
  const [onlyWithTasks, setOnlyWithTasks] = useState(false);

  const completedFrom = useMemo(
    () => subDays(new Date(), PERIOD_PRESETS[periodPreset]).toISOString(),
    [periodPreset],
  );

  const { data: entries, isLoading } = useTeamFeedbackFeed({
    scope,
    completedFrom,
    completedTo: new Date().toISOString(),
    onlyWithAttachments,
    onlyWithTasks,
  });

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
      <div className="space-y-4 max-w-4xl">
        <FeedbackFilters
          scope={scope}
          setScope={setScope}
          periodPreset={periodPreset}
          setPeriodPreset={setPeriodPreset}
          onlyWithAttachments={onlyWithAttachments}
          setOnlyWithAttachments={setOnlyWithAttachments}
          onlyWithTasks={onlyWithTasks}
          setOnlyWithTasks={setOnlyWithTasks}
        />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Keine passenden Rückmeldungen gefunden</p>
          <p className="text-xs mt-1">
            Passe die Filter an oder wechsle den Zeitraum.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <FeedbackFilters
        scope={scope}
        setScope={setScope}
        periodPreset={periodPreset}
        setPeriodPreset={setPeriodPreset}
        onlyWithAttachments={onlyWithAttachments}
        setOnlyWithAttachments={setOnlyWithAttachments}
        onlyWithTasks={onlyWithTasks}
        setOnlyWithTasks={setOnlyWithTasks}
      />

      {entries.map((entry) => (
        <Card key={entry.id} className="border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-semibold text-sm truncate">
                    {entry.appointment_title || 'Unbekannter Termin'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {entry.author_name || 'Unbekannt'}
                  {entry.appointment_start_time && (
                    <span className="ml-2">
                      · Termin {format(new Date(entry.appointment_start_time), 'EEEE, dd. MMMM yyyy', { locale: de })}
                    </span>
                  )}
                  {entry.completed_at && (
                    <span className="ml-2">
                      · Rückmeldung {format(new Date(entry.completed_at), 'd. MMM HH:mm', { locale: de })}
                    </span>
                  )}
                </p>
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

            <div className="ml-6 pl-3 border-l border-border">
              <RichTextDisplay content={entry.notes} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FeedbackFilters({
  scope,
  setScope,
  periodPreset,
  setPeriodPreset,
  onlyWithAttachments,
  setOnlyWithAttachments,
  onlyWithTasks,
  setOnlyWithTasks,
}: {
  scope: 'team' | 'mine' | 'team-plus-relevant';
  setScope: (scope: 'team' | 'mine' | 'team-plus-relevant') => void;
  periodPreset: keyof typeof PERIOD_PRESETS;
  setPeriodPreset: (value: keyof typeof PERIOD_PRESETS) => void;
  onlyWithAttachments: boolean;
  setOnlyWithAttachments: (value: boolean) => void;
  onlyWithTasks: boolean;
  setOnlyWithTasks: (value: boolean) => void;
}) {
  return (
    <div className="rounded-md border p-3 space-y-3 bg-card/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4" />
        Feed-Filter
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Sicht</Label>
          <Select value={scope} onValueChange={(value) => setScope(value as 'team' | 'mine' | 'team-plus-relevant')}>
            <SelectTrigger>
              <SelectValue placeholder="Sicht wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Alle Team-Rückmeldungen</SelectItem>
              <SelectItem value="team-plus-relevant">Team + für mich relevant</SelectItem>
              <SelectItem value="mine">Nur meine Rückmeldungen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Zeitraum</Label>
          <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as keyof typeof PERIOD_PRESETS)}>
            <SelectTrigger>
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3d">Letzte 3 Tage</SelectItem>
              <SelectItem value="7d">Letzte 7 Tage</SelectItem>
              <SelectItem value="14d">Letzte 14 Tage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center justify-between text-xs gap-2">
            <span>Nur mit Anhang</span>
            <Switch checked={onlyWithAttachments} onCheckedChange={setOnlyWithAttachments} />
          </label>
          <label className="flex items-center justify-between text-xs gap-2">
            <span>Nur mit Aufgabe</span>
            <Switch checked={onlyWithTasks} onCheckedChange={setOnlyWithTasks} />
          </label>
        </div>
      </div>
    </div>
  );
}
