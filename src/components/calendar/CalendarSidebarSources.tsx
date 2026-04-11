import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckSquare, ChevronDown, ChevronUp, Palette, Square } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface InternalCalendarRow {
  id: string;
  name: string;
  label: string;
  color: string;
  order_index: number;
}

interface ExternalCalendarRow {
  id: string;
  name: string;
  color: string;
  calendar_type: string;
}

export type CalendarSource = {
  id: string;
  name: string;
  color: string;
  scope: "internal" | "external";
  subtitle: string;
};

const FALLBACK_COLOR = "#6b7280";

async function fetchCalendarSources(tenantId: string): Promise<CalendarSource[]> {
  const [{ data: internalData, error: internalError }, { data: externalData, error: externalError }] = await Promise.all([
    supabase
      .from("appointment_categories")
      .select("id, name, label, color, is_active, order_index")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("order_index", { ascending: true }),
    supabase
      .from("external_calendars")
      .select("id, name, color, calendar_type, sync_enabled, user_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  if (internalError) throw internalError;
  if (externalError) throw externalError;

  const internalCalendars = ((internalData ?? []) as InternalCalendarRow[]).map((calendar) => ({
    id: calendar.id,
    name: calendar.label || calendar.name,
    color: calendar.color || FALLBACK_COLOR,
    scope: "internal" as const,
    subtitle: "Interner Kalender",
  }));

  const externalCalendars = ((externalData ?? []) as ExternalCalendarRow[]).map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    color: calendar.color || FALLBACK_COLOR,
    scope: "external" as const,
    subtitle: calendar.calendar_type === "google" ? "Google Calendar" : calendar.calendar_type === "outlook" ? "Outlook" : "Externer ICS-Kalender",
  }));

  return [...internalCalendars, ...externalCalendars];
}

interface CalendarSidebarSourcesProps {
  onColorsUpdated?: () => void;
  hiddenSourceKeys?: string[];
  onToggleVisibility?: (source: CalendarSource) => void;
}

export function CalendarSidebarSources({
  onColorsUpdated,
  hiddenSourceKeys = [],
  onToggleVisibility,
}: CalendarSidebarSourcesProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const { data: calendarSources = [], isLoading } = useQuery({
    queryKey: ["calendar-sidebar-sources", currentTenant?.id],
    queryFn: () => fetchCalendarSources(currentTenant!.id),
    enabled: Boolean(currentTenant?.id),
    staleTime: 60 * 1000,
  });

  const groupedSources = useMemo(() => ({
    internal: calendarSources.filter((calendar) => calendar.scope === "internal"),
    external: calendarSources.filter((calendar) => calendar.scope === "external"),
  }), [calendarSources]);

  const invalidateCalendars = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-sidebar-sources", currentTenant?.id] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] }),
      queryClient.invalidateQueries({ queryKey: ["appointment-categories"] }),
    ]);
    onColorsUpdated?.();
  };

  const updateColor = async (calendar: CalendarSource, color: string) => {
    const savingKey = `${calendar.scope}-${calendar.id}`;
    setSavingIds((prev) => new Set(prev).add(savingKey));

    try {
      if (calendar.scope === "internal") {
        const { error } = await supabase
          .from("appointment_categories")
          .update({ color })
          .eq("id", calendar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("external_calendars")
          .update({ color })
          .eq("id", calendar.id);
        if (error) throw error;
      }

      toast.success(`Farbe für „${calendar.name}“ aktualisiert`);
      await invalidateCalendars();
    } catch (error) {
      console.error("Failed to update calendar color", error);
      toast.error("Die Kalenderfarbe konnte nicht gespeichert werden");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(savingKey);
        return next;
      });
    }
  };

  const renderCalendarList = (title: string, calendars: CalendarSource[]) => {
    if (calendars.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="space-y-1.5">
          {calendars.map((calendar) => {
            const savingKey = `${calendar.scope}-${calendar.id}`;
            const isSaving = savingIds.has(savingKey);
            const visibilityKey = `${calendar.scope}:${calendar.id}`;
            const isVisible = !hiddenSourceKeys.includes(visibilityKey);

            return (
              <div
                key={savingKey}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => onToggleVisibility?.(calendar)}
                  title={isVisible ? `${calendar.name} ausblenden` : `${calendar.name} einblenden`}
                  aria-pressed={isVisible}
                  aria-label={isVisible ? `${calendar.name} ausblenden` : `${calendar.name} einblenden`}
                >
                  {isVisible ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                </Button>
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: calendar.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{calendar.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{calendar.subtitle}</p>
                </div>
                <label
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition hover:bg-muted",
                    isSaving && "cursor-wait opacity-60",
                  )}
                  title={`Farbe für ${calendar.name} ändern`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  <input
                    type="color"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    value={calendar.color}
                    disabled={isSaving}
                    onChange={(event) => void updateColor(calendar, event.target.value)}
                    aria-label={`Farbe für ${calendar.name} ändern`}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 rounded-lg border bg-background/70 p-3">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between px-1 py-1 text-left hover:bg-transparent"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Kalender</p>
            <p className="truncate text-xs text-muted-foreground">Ein- und ausblenden sowie Farben anpassen</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </Button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Kalender werden geladen…</p>
          ) : calendarSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Kalender gefunden.</p>
          ) : (
            <>
              {renderCalendarList("Intern", groupedSources.internal)}
              {renderCalendarList("Extern", groupedSources.external)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
