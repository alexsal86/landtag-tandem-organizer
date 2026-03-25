import { useState } from "react";
import { useUpdateDossier } from "../hooks/useDossiers";
import type { Dossier } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Bell, BellOff, Loader2 } from "lucide-react";
import { format, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";

interface DossierReviewReminderProps {
  dossier: Dossier;
}

const INTERVAL_OPTIONS = [
  { value: "0", label: "Keine Erinnerung" },
  { value: "7", label: "Wöchentlich" },
  { value: "14", label: "Alle 2 Wochen" },
  { value: "30", label: "Monatlich" },
  { value: "90", label: "Quartalsweise" },
  { value: "180", label: "Halbjährlich" },
];

export function DossierReviewReminder({ dossier }: DossierReviewReminderProps) {
  const updateDossier = useUpdateDossier();
  const [interval, setInterval] = useState(
    String(dossier.review_interval_days ?? 0)
  );

  const isOverdue = dossier.next_review_at ? isPast(new Date(dossier.next_review_at)) : false;

  const handleIntervalChange = (value: string) => {
    setInterval(value);
    const days = parseInt(value, 10);
    updateDossier.mutate({
      id: dossier.id,
      review_interval_days: days || null,
      next_review_at: days ? addDays(new Date(), days).toISOString() : null,
    });
  };

  const handleMarkReviewed = () => {
    const days = parseInt(interval, 10);
    updateDossier.mutate({
      id: dossier.id,
      next_review_at: days ? addDays(new Date(), days).toISOString() : null,
    });
  };

  return (
    <Card className={isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border"}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
          Review-Erinnerung
          {isOverdue && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-normal">
              Überfällig
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <Select value={interval} onValueChange={handleIntervalChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.value === "0" ? (
                  <span className="flex items-center gap-1.5"><BellOff className="h-3.5 w-3.5" /> {opt.label}</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> {opt.label}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dossier.next_review_at && (
          <div className="flex items-center justify-between">
            <p className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              Nächster Review: {format(new Date(dossier.next_review_at), "dd.MM.yyyy", { locale: de })}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkReviewed}
              disabled={updateDossier.isPending}
            >
              {updateDossier.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : null}
              Als geprüft markieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
