import { useUserPreference } from "@/hooks/useUserPreference";
import { berlinDay } from "@/utils/dashboard/daySummary";
import { visibleSentChanges } from "./sentChangeVisibility";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Clock, MapPin, MessageSquare, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  CHANGE_QUICK_MINUTES,
  addMinutesToStart,
  changeKindLabel,
  changeSummary,
  changeTitle,
  formatChangeClock,
  formatChangeDay,
  nextStartFromChange,
  type AppointmentChangeKind,
} from "./changeModel";

const KEY = "appointment-change-alerts";
const fmt = (d: string) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

const KIND_ICON: Record<AppointmentChangeKind, typeof Clock> = {
  time: Clock,
  location: MapPin,
  note: MessageSquare,
};

const KIND_TITLE: Record<AppointmentChangeKind, string> = {
  time: "Zeit ändern",
  location: "Ort ändern",
  note: "Anderen Hinweis senden",
};

export interface AppointmentChangeTarget {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
}

export function useAlerts() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: [KEY, tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("appointment_change_alerts")
        .select("id, appointment_id, title, message, kind, new_start_time, new_location, created_by_name, created_at, acknowledged_at")
        .eq("tenant_id", tenantId ?? "")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Rotes Eil-Banner für den Abgeordneten mit „Verstanden“. */
export function AppointmentChangeBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useAlerts();
  const open = data.filter((a) => !a.acknowledged_at);
  if (!open.length) return null;
  const ack = async (id: string) => {
    const { error } = await supabase.from("appointment_change_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? "" }).eq("id", id);
    if (error) return notify.error("Konnte nicht bestätigt werden");
    qc.invalidateQueries({ queryKey: [KEY] });
  };
  return (
    <div className="space-y-2">
      {open.map((a) => {
        const Icon = KIND_ICON[(a.kind as AppointmentChangeKind)] ?? MessageSquare;
        return (
          <div key={a.id} role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 shadow-sm">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-pill bg-destructive/10 px-2 py-0.5 text-caption font-medium text-destructive">
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {changeKindLabel(a.kind)}
                </span>
                <p className="min-w-0 truncate font-medium text-foreground">{a.title}</p>
              </div>
              <p className="mt-1 text-sm text-foreground">{changeSummary(a)}</p>
              <p className="text-caption text-muted-foreground">von {a.created_by_name ?? "Büro"} · {fmt(a.created_at)}</p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => ack(a.id)}>Verstanden</Button>
          </div>
        );
      })}
    </div>
  );
}

/** Büro: zuletzt gemeldete Änderungen samt Lesebestätigung. */
export function AppointmentChangeSentList() {
  const { data = [] } = useAlerts();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const [dismissed, setDismissed] = useUserPreference<string[]>(
    `appointment-change-hidden:${currentTenant?.id}:${user?.id}:${berlinDay(now)}`, [],
  );
  const visible = visibleSentChanges(data, Array.isArray(dismissed) ? dismissed : [], now);
  if (!visible.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2">
      <p className="mb-1 text-label font-semibold uppercase tracking-wide text-muted-foreground">Zuletzt gemeldete Änderungen · Heute</p>
      <ul className="space-y-1">
        {visible.slice(0, 3).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
            <span className="rounded-pill bg-muted px-1.5 py-0.5 font-medium text-foreground">{changeKindLabel(a.kind)}</span>
            <span className="text-muted-foreground">Heute {fmt(a.created_at)}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.title} · {changeSummary(a)}</span>
            <span className={a.acknowledged_at ? "text-palette-green" : "text-palette-amber"}>
              {a.acknowledged_at ? `Gelesen ${fmt(a.acknowledged_at)}` : "noch nicht gelesen"}
            </span>
            <button type="button" aria-label={`Änderung für mich ausblenden: ${a.title}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => setDismissed(previous => [...new Set([...(Array.isArray(previous) ? previous : []), a.id])])}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rechtsklick-Menü auf einem Termin im Mitarbeiter-Dashboard: Zeit, Ort oder
 * freier Hinweis. Das Menü öffnet für die Eingabe einen passenden Dialog.
 */
export function AppointmentChangeMenu({ appointment, children }: {
  appointment: AppointmentChangeTarget;
  children: ReactNode;
}) {
  const [kind, setKind] = useState<AppointmentChangeKind | null>(null);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-72 rounded-xl border-border/70 p-1.5 shadow-xl">
        <ContextMenuLabel className="px-3 pb-1.5 pt-2">
          <span className="block text-label font-semibold uppercase tracking-wide text-muted-foreground">Termin ändern</span>
          <span className="mt-0.5 block truncate text-sm font-semibold normal-case tracking-normal text-foreground">{appointment.title}</span>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setKind("time")} className="items-start gap-3 rounded-lg px-3 py-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-palette-amber/15 text-palette-amber">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
              Zeit ändern
              <span className="text-caption font-normal text-muted-foreground">ab {formatChangeClock(appointment.start_time)}</span>
            </span>
            <span className="block text-caption text-muted-foreground">+15, +30, +60 Minuten oder eigene Uhrzeit</span>
          </span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setKind("location")} className="items-start gap-3 rounded-lg px-3 py-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-palette-indigo/15 text-palette-indigo">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Ort ändern</span>
            <span className="block truncate text-caption text-muted-foreground">
              {appointment.location ? `Bisher: ${appointment.location}` : "Neuen Ort selbst eintragen"}
            </span>
          </span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setKind("note")} className="items-start gap-3 rounded-lg px-3 py-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Anderer Hinweis</span>
            <span className="block text-caption text-muted-foreground">Freier Text als Chip in „Dein Tag“</span>
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
      <AppointmentChangeDialog kind={kind} appointment={appointment} onClose={() => setKind(null)} />
    </ContextMenu>
  );
}

function AppointmentChangeDialog({ kind, appointment, onClose }: {
  kind: AppointmentChangeKind | null;
  appointment: AppointmentChangeTarget;
  onClose: () => void;
}) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [quickMinutes, setQuickMinutes] = useState<number | null>(null);
  const [clock, setClock] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setQuickMinutes(null);
    setClock("");
    setLocation("");
    setNote("");
    setSending(false);
  }, [kind, appointment.id]);

  const newStart = useMemo(
    () => (kind === "time" ? nextStartFromChange(appointment.start_time, quickMinutes, clock) : null),
    [kind, appointment.start_time, quickMinutes, clock],
  );
  const startChanged = !!newStart && newStart !== new Date(appointment.start_time).toISOString();
  const canSend = kind === "time"
    ? startChanged
    : kind === "location"
      ? location.trim().length > 0
      : note.trim().length > 0;

  const send = async () => {
    if (!kind || !canSend || !currentTenant?.id || !user) return;
    setSending(true);
    const name = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? null;
    const { error } = await supabase.from("appointment_change_alerts").insert({
      tenant_id: currentTenant.id,
      appointment_id: appointment.id,
      title: changeTitle(kind, appointment.title),
      message: note.trim(),
      kind,
      new_start_time: kind === "time" ? newStart : null,
      new_location: kind === "location" ? location.trim() : null,
      created_by: user.id,
      created_by_name: name,
    });
    setSending(false);
    if (error) {
      notify.error("Änderung konnte nicht gesendet werden");
      return;
    }
    notify.success("Änderung an den Abgeordneten gesendet", {
      description: kind === "time" && newStart
        ? `Neue Zeit ${formatChangeClock(newStart)}`
        : kind === "location"
          ? `Neuer Ort: ${location.trim()}`
          : "Hinweis wird in „Dein Tag“ als Chip angezeigt",
    });
    await qc.invalidateQueries({ queryKey: [KEY] });
    onClose();
  };

  const Icon = kind ? KIND_ICON[kind] : MessageSquare;
  const newStartDay = newStart ? formatChangeDay(newStart) : "";
  const startDay = formatChangeDay(appointment.start_time);
  const crossesDay = !!newStart && newStartDay !== startDay;

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {kind ? KIND_TITLE[kind] : "Termin ändern"}
          </DialogTitle>
          <DialogDescription className="truncate">
            {appointment.title}
            {appointment.location ? ` · ${appointment.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {kind === "time" && (
            <>
              <div className="space-y-2">
                <Label className="text-caption font-medium text-muted-foreground">Schnell verschieben</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CHANGE_QUICK_MINUTES.map((minutes) => {
                    const preview = addMinutesToStart(appointment.start_time, minutes);
                    const selected = quickMinutes === minutes && !clock.trim();
                    return (
                      <button
                        key={minutes}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => { setQuickMinutes(minutes); setClock(""); }}
                        className={cn(
                          "rounded-xl border px-2 py-2.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                          selected
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/60",
                        )}
                      >
                        <span className="block text-lg font-semibold leading-tight">+{minutes}</span>
                        <span className="block text-caption text-muted-foreground">Minuten</span>
                        <span className={cn("mt-0.5 block text-caption tabular-nums", selected ? "text-primary" : "text-foreground")}>
                          {formatChangeClock(preview)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="appointment-change-clock">Eigene Uhrzeit</Label>
                <Input
                  id="appointment-change-clock"
                  type="time"
                  value={clock}
                  onChange={(event) => { setClock(event.target.value); setQuickMinutes(null); }}
                  className="h-10 text-base tabular-nums"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground line-through decoration-destructive/70 decoration-2">
                  {formatChangeClock(appointment.start_time)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className={cn("font-semibold tabular-nums", newStart ? "text-destructive" : "text-muted-foreground")}>
                  {newStart ? formatChangeClock(newStart) : "–"}
                </span>
                {crossesDay && <span className="text-caption text-muted-foreground">({newStartDay})</span>}
              </div>
            </>
          )}

          {kind === "location" && (
            <div className="space-y-1.5">
              <Label htmlFor="appointment-change-location">Neuer Ort</Label>
              <Input
                id="appointment-change-location"
                autoFocus
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={appointment.location ? `Bisher: ${appointment.location}` : "z. B. Raum 2 im Bürgerhaus"}
              />
              {appointment.location && (
                <p className="text-caption text-muted-foreground">
                  Der bisherige Ort <span className="line-through">{appointment.location}</span> wird beim Abgeordneten durchgestrichen.
                </p>
              )}
            </div>
          )}

          {kind === "note" ? (
            <div className="space-y-1.5">
              <Label htmlFor="appointment-change-note">Hinweis</Label>
              <Textarea
                id="appointment-change-note"
                autoFocus
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="z. B. Unterlagen liegen im Büro bereit"
              />
              <p className="text-caption text-muted-foreground">Der Hinweis erscheint in „Dein Tag“ als Chip am Termin.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="appointment-change-note-optional" className="text-caption text-muted-foreground">
                Zusatzhinweis (optional)
              </Label>
              <Textarea
                id="appointment-change-note-optional"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Kurzer Hinweis als Chip in „Dein Tag“"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={sending}>Abbrechen</Button>
          <Button onClick={send} disabled={!canSend || sending}>
            {sending ? "Sendet …" : <><Send className="mr-1.5 h-4 w-4" aria-hidden="true" />Änderung senden</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
