import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { nextWorkingDay, toDateString } from "../utils";
import {
  useDeleteBriefing,
  useMyBriefingForDate,
  useSaveBriefing,
} from "../hooks/useMyDraftBriefing";

export function BriefingComposerCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState<Date>(() => nextWorkingDay());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const briefingDateString = useMemo(() => toDateString(date), [date]);
  const { data: existing, isLoading } = useMyBriefingForDate(briefingDateString);
  const saveMutation = useSaveBriefing();
  const deleteMutation = useDeleteBriefing();

  useEffect(() => {
    if (existing) {
      setTitle(existing.title ?? "");
      setContent(existing.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [existing?.id, briefingDateString]);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const handleSave = async () => {
    if (!content.trim()) {
      toast({ title: "Inhalt fehlt", description: "Bitte schreibe einen kurzen Briefing-Text.", variant: "destructive" });
      return;
    }
    try {
      await saveMutation.mutateAsync({
        id: existing?.id,
        briefing_date: briefingDateString,
        title: title.trim() || null,
        content: content.trim(),
      });
      toast({
        title: existing ? "Briefing aktualisiert" : "Briefing gespeichert",
        description: `Wird am ${format(date, "EEEE, d. MMMM", { locale: de })} im Dashboard angezeigt.`,
      });
      setExpanded(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Speichern fehlgeschlagen", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm("Briefing wirklich löschen?")) return;
    try {
      await deleteMutation.mutateAsync(existing.id);
      toast({ title: "Briefing gelöscht" });
      setTitle("");
      setContent("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Löschen fehlgeschlagen", description: message, variant: "destructive" });
    }
  };

  if (!expanded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Tagesbriefing schreiben</p>
              <p className="text-xs text-muted-foreground">
                Kurzer Überblick fürs Abgeordnetenbüro – mindestens einen Tag im Voraus.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            Briefing verfassen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Tagesbriefing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs">Gültig für</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "EEE, d. MMM", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d < minDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={de}
                  weekStartsOn={1}
                />
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              Frühestens für morgen.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="briefing-title">Titel (optional)</Label>
            <Input
              id="briefing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. „Schwerpunkt Bildungspolitik""
              maxLength={140}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="briefing-content">Briefing</Label>
          <Textarea
            id="briefing-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Was sollte der/die Abgeordnete heute morgen sofort wissen? Termine, sensible Themen, neue Hintergründe…"
            rows={6}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {existing ? "Aktualisieren" : "Speichern"}
            </Button>
            <Button variant="ghost" onClick={() => setExpanded(false)}>
              Abbrechen
            </Button>
          </div>
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
