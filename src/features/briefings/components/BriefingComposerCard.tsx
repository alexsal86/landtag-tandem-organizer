import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SimpleRichTextEditor, { type SimpleRichTextEditorDictation } from "@/components/ui/SimpleRichTextEditor";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { briefingDateOptions, toDateString } from "../utils";
import { useDeleteBriefing, useMyBriefingForDate, useSaveBriefing } from "../hooks/useMyDraftBriefing";
import type { DailyBriefing } from "../types";
import { notify } from "@/lib/notify";

function editorHtml(value: string): string {
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeRichHtml(value);
  return value.split(/\r?\n/).map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
}

export function BriefingComposerCard() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const choices = briefingDateOptions(now);
  const [date, setDate] = useState(() => choices.tomorrow);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const { data: existing, isLoading, isError, refetch } = useMyBriefingForDate(date);
  const selectedDate = parseISO(date);
  const isCustomDate = date !== choices.tomorrow && date !== choices.dayAfter;

  return <Card className="dashboard-motion-card animate-rise">
    <CardHeader className="flex min-h-[52px] flex-row items-center gap-2 space-y-0 pt-5 pb-3 px-5">
      <CardTitle className="inline-flex items-center gap-2 text-base font-medium leading-6">
        <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />Tagesbriefing
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 px-5 pb-5 pt-0">
      <div className="space-y-2">
        <Label className="text-xs">Gültig für</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Datum des Tagesbriefings">
          <Button size="sm" className="rounded-full" variant={date === choices.tomorrow ? "default" : "outline"}
            aria-pressed={date === choices.tomorrow} disabled={editingBusy} onClick={() => setDate(choices.tomorrow)}>
            Morgen · {format(parseISO(choices.tomorrow), 'd. MMM', { locale: de })}
          </Button>
          <Button size="sm" className="rounded-full" variant={date === choices.dayAfter ? "default" : "outline"}
            aria-pressed={date === choices.dayAfter} disabled={editingBusy} onClick={() => setDate(choices.dayAfter)}>
            Übermorgen · {format(parseISO(choices.dayAfter), 'd. MMM', { locale: de })}
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="rounded-full" variant={isCustomDate ? "default" : "outline"} disabled={editingBusy}>
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                {isCustomDate ? format(selectedDate, 'd. MMM yyyy', { locale: de }) : 'Datum wählen'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={value => {
                if (value) { setDate(toDateString(value)); setCalendarOpen(false); }
              }} disabled={value => toDateString(value) < choices.tomorrow} initialFocus locale={de} weekStartsOn={1} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground" role="status">Briefing wird geladen…</p>
        : isError ? <div className="space-y-2"><p className="text-sm text-destructive">Briefing konnte nicht geladen werden.</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Erneut laden</Button></div>
        : <BriefingForm key={`${currentTenant?.id}:${user?.id}:${date}`} date={date} existing={existing ?? null}
          earliestDate={choices.tomorrow} onBusyChange={setEditingBusy} />}
    </CardContent>
  </Card>;
}

function BriefingForm({ date, existing, earliestDate, onBusyChange }: {
  date: string; existing: DailyBriefing | null; earliestDate: string; onBusyChange: (busy: boolean) => void;
}) {
  const initialContent = useMemo(() => editorHtml(existing?.content ?? ''), []);
  const [content, setContent] = useState(initialContent);
  const latestContent = useRef(initialContent);
  const dictationRef = useRef<SimpleRichTextEditorDictation>(null);
  const [dictating, setDictating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveMutation = useSaveBriefing();
  const deleteMutation = useDeleteBriefing();
  const busy = submitting || deleteMutation.isPending;
  useEffect(() => {
    onBusyChange(busy || dictating);
    return () => onBusyChange(false);
  }, [busy, dictating, onBusyChange]);

  const handleSave = async () => {
    if (busy) return;
    if (date < earliestDate) { notify.error('Bitte wähle ein Datum ab morgen.'); return; }
    setSubmitting(true);
    try {
      const finalized = dictating ? await dictationRef.current?.finishAndReadHtml() : latestContent.current;
      if (finalized == null) return;
      const html = sanitizeRichHtml(finalized);
      const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
      if (!text.trim()) { notify.error('Inhalt fehlt', { description: 'Bitte schreibe oder diktiere einen kurzen Briefing-Text.' }); return; }
      await saveMutation.mutateAsync({ id: existing?.id, briefing_date: date, title: existing?.title ?? null, content: html });
      latestContent.current = html;
      setContent(html);
      notify.success(existing ? 'Briefing aktualisiert' : 'Briefing gespeichert', {
        description: `Wird am ${format(parseISO(date), 'EEEE, d. MMMM', { locale: de })} im Dashboard angezeigt.`,
      });
    } catch (error) {
      notify.error('Speichern fehlgeschlagen', { description: error instanceof Error ? error.message : 'Bitte erneut versuchen.' });
    } finally { setSubmitting(false); }
  };
  const handleDelete = async () => {
    if (!existing || busy || !confirm('Briefing wirklich löschen?')) return;
    try {
      await deleteMutation.mutateAsync(existing.id);
      latestContent.current = '';
      setContent('');
      notify.success('Briefing gelöscht');
    } catch (error) {
      notify.error('Löschen fehlgeschlagen', { description: error instanceof Error ? error.message : 'Bitte erneut versuchen.' });
    }
  };
  return <div className="space-y-3">
    <SimpleRichTextEditor key={existing?.id ?? 'new'} initialContent={content} contentVersion={existing?.id ?? 'new'}
      onChange={html => { latestContent.current = html; setContent(html); }}
      placeholder="Was sollte der oder die Abgeordnete wissen? Termine, sensible Themen, neue Hintergründe…"
      minHeight="140px" maxHeight="320px" scrollable compactToolbar disabled={busy}
      dictationRef={dictationRef} onDictationActiveChange={setDictating} onDictatedSave={() => void handleSave()} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button onClick={() => void handleSave()} disabled={busy || date < earliestDate}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {existing ? 'Aktualisieren' : 'Speichern'}
      </Button>
      {existing && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
        disabled={busy || dictating} onClick={() => void handleDelete()}><Trash2 className="mr-2 h-4 w-4" />Löschen</Button>}
    </div>
  </div>;
}
