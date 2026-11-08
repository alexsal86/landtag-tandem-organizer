import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Search,
  Trash2,
  FileText,
  Globe,
  Lock,
  MoreVertical,
  RotateCcw,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MeetingProtocolView } from "@/features/meetings/components/MeetingProtocolView";
import { debugConsole } from "@/utils/debugConsole";
import { notify } from "@/lib/notify";

interface ArchivedMeeting {
  id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_public?: boolean;
}

interface MeetingArchiveViewProps {
  onBack: () => void;
}

export function MeetingArchiveView({ onBack }: MeetingArchiveViewProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [archivedMeetings, setArchivedMeetings] = useState<ArchivedMeeting[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");

  const [year, setYear] = useState("all");
  const [filter, setFilter] = useState<"all" | "mine" | "public" | "view">(
    "all",
  );
  const [meetingToDelete, setMeetingToDelete] =
    useState<ArchivedMeeting | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<
    Record<
      string,
      { points: number | null; decisions: number | null; tasks: number | null }
    >
  >({});
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setStats({});
    if (viewMode !== "cards") return;
    const load = async () => {
      for (
        let offset = 0;
        offset < archivedMeetings.length && !cancelled;
        offset += 6
      ) {
        await Promise.all(
          archivedMeetings.slice(offset, offset + 6).map(async (meeting) => {
            const [points, decisions, tasks] = await Promise.all([
              supabase
                .from("meeting_agenda_items")
                .select("id", { count: "exact", head: true })
                .eq("meeting_id", meeting.id)
                .is("parent_id", null),
              supabase
                .from("task_decisions")
                .select("id", { count: "exact", head: true })
                .eq("meeting_id", meeting.id),
              supabase
                .from("tasks")
                .select("id", { count: "exact", head: true })
                .eq("meeting_id", meeting.id),
            ]);
            if (!cancelled)
              setStats((previous) => ({
                ...previous,
                [meeting.id]: {
                  points: points.error ? null : points.count,
                  decisions: decisions.error ? null : decisions.count,
                  tasks: tasks.error ? null : tasks.count,
                },
              }));
          }),
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [archivedMeetings, viewMode]);

  useEffect(() => {
    if (user) {
      loadArchivedMeetings();
    }
  }, [user, currentTenant?.id]);

  const loadArchivedMeetings = async () => {
    try {
      setLoading(true);

      const { data: ownMeetings, error: ownError } = await supabase
        .from("meetings")
        .select(
          "id, title, description, meeting_date, location, status, created_at, updated_at, user_id, is_public",
        )
        .eq("user_id", user?.id ?? "")
        .eq("status", "archived")
        .order("meeting_date", { ascending: false });

      if (ownError) throw ownError;

      const { data: participantMeetings, error: participantError } =
        await supabase
          .from("meeting_participants")
          .select(
            "meeting_id, meetings(id, title, description, meeting_date, location, status, created_at, updated_at, user_id, is_public)",
          )
          .eq("user_id", user?.id ?? "");

      if (participantError) {
        debugConsole.error(
          "Error loading participant meetings:",
          participantError,
        );
      }

      const participantArchivedMeetings = (participantMeetings || [])
        .filter(
          (p: Record<string, any>) =>
            p.meetings && p.meetings.status === "archived",
        )
        .map((p: Record<string, any>) => p.meetings);

      const existingMeetingIds = new Set([
        ...(ownMeetings || []).map((m: Record<string, any>) => m.id),
        ...participantArchivedMeetings
          .map((m: Record<string, any>) => m?.id)
          .filter(Boolean),
      ]);

      let publicMeetings: Array<Record<string, unknown>> = [];
      if (currentTenant?.id) {
        const { data: publicData, error: publicError } = await supabase
          .from("meetings")
          .select(
            "id, title, description, meeting_date, location, status, created_at, updated_at, user_id, is_public",
          )
          .eq("status", "archived")
          .eq("is_public", true)
          .eq("tenant_id", currentTenant.id);

        if (publicError) {
          debugConsole.error("Error loading public meetings:", publicError);
        } else {
          publicMeetings = (
            (publicData || []) as Array<Record<string, unknown>>
          ).filter((m) => !existingMeetingIds.has(m.id as string));
        }
      }

      const allMeetingsMap = new Map();
      [
        ...(ownMeetings || []),
        ...participantArchivedMeetings,
        ...publicMeetings,
      ]
        .filter(Boolean)
        .forEach((m) => allMeetingsMap.set(m.id, m));

      const allMeetings = Array.from(allMeetingsMap.values()).sort(
        (a, b) =>
          new Date(b.meeting_date).getTime() -
          new Date(a.meeting_date).getTime(),
      );

      setArchivedMeetings(allMeetings);
    } catch (error) {
      debugConsole.error("Error loading archived meetings:", error);
      notify.error("Fehler", {
        description: "Archivierte Besprechungen konnten nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  };

  const canManageMeeting = (meeting: ArchivedMeeting) => {
    return meeting.user_id === user?.id;
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      await supabase
        .from("meeting_agenda_items")
        .delete()
        .eq("meeting_id", meetingId);

      await supabase.from("meetings").delete().eq("id", meetingId);

      await loadArchivedMeetings();

      notify.success("Besprechung gelöscht", {
        description: "Die archivierte Besprechung wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      debugConsole.error("Error deleting meeting:", error);
      notify.error("Fehler", {
        description: "Die Besprechung konnte nicht gelöscht werden.",
      });
    }
  };

  const restoreMeeting = async (meeting: ArchivedMeeting) => {
    try {
      await supabase
        .from("meetings")
        .update({ status: "planned" })
        .eq("id", meeting.id);

      await loadArchivedMeetings();

      notify.success("Besprechung wiederhergestellt", {
        description: "Die Besprechung wurde aus dem Archiv wiederhergestellt.",
      });
    } catch (error) {
      debugConsole.error("Error restoring meeting:", error);
      notify.error("Fehler", {
        description: "Die Besprechung konnte nicht wiederhergestellt werden.",
      });
    }
  };

  const years = [
    ...new Set(
      archivedMeetings.map((meeting) => meeting.meeting_date.slice(0, 4)),
    ),
  ]
    .sort()
    .reverse();
  const filteredMeetings = archivedMeetings.filter((meeting) => {
    const matchesSearch = [
      meeting.title,
      meeting.description,
      meeting.location,
    ].some((value) =>
      value
        ?.toLocaleLowerCase("de")
        .includes(searchTerm.trim().toLocaleLowerCase("de")),
    );
    return (
      matchesSearch &&
      (year === "all" || meeting.meeting_date.startsWith(year)) &&
      (filter === "all" ||
        (filter === "mine" && canManageMeeting(meeting)) ||
        (filter === "public" && meeting.is_public) ||
        (filter === "view" && !canManageMeeting(meeting)))
    );
  });
  const months = new Map<string, ArchivedMeeting[]>();
  filteredMeetings.forEach((meeting) => {
    const key = meeting.meeting_date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), meeting]);
  });
  const hasFilters = !!searchTerm || year !== "all" || filter !== "all";
  const resetFilters = () => {
    setSearchTerm("");
    setYear("all");
    setFilter("all");
  };
  const dateTile = (meeting: ArchivedMeeting) => (
    <time
      dateTime={meeting.meeting_date}
      aria-label={format(new Date(meeting.meeting_date), "PPP", { locale: de })}
      className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-muted/30 py-1 leading-tight"
    >
      <span className="text-[11px] text-muted-foreground">
        {format(new Date(meeting.meeting_date), "EEEEEE", { locale: de })}
      </span>
      <b className="text-lg">{format(new Date(meeting.meeting_date), "d")}</b>
      <span className="text-[11px] text-muted-foreground">
        {format(new Date(meeting.meeting_date), "MMM", { locale: de }).replace(
          /\.$/,
          "",
        )}
      </span>
    </time>
  );
  const actions = (meeting: ArchivedMeeting) =>
    canManageMeeting(meeting) && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label={`Aktionen für ${meeting.title}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
          <DropdownMenuItem onSelect={() => void restoreMeeting(meeting)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Wiederherstellen
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setMeetingToDelete(meeting)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Endgültig löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  const details = (meeting: ArchivedMeeting) => (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onClick={() => setSelectedMeetingId(meeting.id)}
        >
          {meeting.title}
        </button>
        {!canManageMeeting(meeting) && (
          <Badge
            variant="outline"
            className="text-[11px] text-muted-foreground"
          >
            <Lock className="mr-1 h-3 w-3" />
            Nur Ansicht
          </Badge>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {meeting.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {meeting.location}
          </span>
        )}
        {meeting.is_public && (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Öffentlich
          </span>
        )}
      </div>
      {meeting.description && (
        <p
          className={cn(
            "mt-1 text-sm text-muted-foreground",
            viewMode === "list" && "truncate",
          )}
        >
          {meeting.description}
        </p>
      )}
    </div>
  );

  if (selectedMeetingId)
    return (
      <MeetingProtocolView
        meetingId={selectedMeetingId}
        onBack={() => setSelectedMeetingId(null)}
      />
    );
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-card"
          aria-label="Zurück zur Meeting-Agenda"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">
            Besprechungsarchiv
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Besprechungen werden geladen …"
              : `${filteredMeetings.length} ${filteredMeetings.length === 1 ? "Besprechung" : "Besprechungen"}${filteredMeetings.length !== archivedMeetings.length ? ` von ${archivedMeetings.length}` : ""}`}
          </p>
        </div>
        <div
          className="inline-flex overflow-hidden rounded-lg border bg-card"
          role="group"
          aria-label="Ansicht"
        >
          {(["list", "cards"] as const).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              aria-pressed={viewMode === mode}
              className={cn(
                "rounded-none text-xs",
                viewMode === mode && "bg-primary/10 font-semibold",
              )}
              onClick={() => setViewMode(mode)}
            >
              {mode === "list" ? "Liste" : "Karten"}
            </Button>
          ))}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            aria-label="Besprechungen durchsuchen"
            placeholder="Titel, Ort oder Beschreibung suchen"
            className="bg-card pl-9 pr-9"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7 bg-card"
              aria-label="Suche leeren"
              onClick={() => {
                setSearchTerm("");
                searchRef.current?.focus();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <kbd className="absolute right-3 top-2 rounded border px-1 text-xs text-muted-foreground">
              /
            </kbd>
          )}
        </div>
        <select
          aria-label="Jahr filtern"
          className="h-10 rounded-lg border bg-card px-3 text-sm"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="all">Alle Jahre</option>
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Archiv filtern"
      >
        {(
          [
            { id: "all", label: "Alle" },
            { id: "mine", label: "Meine" },
            { id: "public", label: "Öffentlich" },
            { id: "view", label: "Nur Ansicht" },
          ] as const
        ).map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            aria-pressed={filter === option.id}
            className={cn(
              "h-8 rounded-full bg-card px-4 text-xs shadow-none",
              filter === option.id
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground",
            )}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {loading ? (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Lade archivierte Besprechungen...
        </p>
      ) : filteredMeetings.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <h2 className="font-semibold">
              {hasFilters
                ? "Keine Ergebnisse"
                : "Keine archivierten Besprechungen"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Passe die Suche oder die Filter an."
                : "Beendete Besprechungen erscheinen hier im Archiv."}
            </p>
            {hasFilters && (
              <Button className="mt-4" variant="outline" onClick={resetFilters}>
                Filter zurücksetzen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        [...months.entries()].map(([month, meetings]) => (
          <section
            key={month}
            aria-label={format(new Date(`${month}-15T12:00:00`), "MMMM yyyy", {
              locale: de,
            })}
          >
            <h2 className="sticky top-0 z-10 mb-2 flex items-baseline gap-2 bg-background py-2 text-sm font-bold">
              {format(new Date(`${month}-15T12:00:00`), "MMMM yyyy", {
                locale: de,
              })}
              <span className="text-xs font-normal text-muted-foreground">
                {meetings.length}
              </span>
            </h2>
            <div
              className={
                viewMode === "list"
                  ? "overflow-hidden rounded-xl border bg-card divide-y divide-border"
                  : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {meetings.map((meeting) =>
                viewMode === "list" ? (
                  <article
                    tabIndex={0}
                    aria-label={`Protokoll öffnen: ${meeting.title}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button, a, [role="menu"], [role="menuitem"]')) return;
                      setSelectedMeetingId(meeting.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedMeetingId(meeting.id);
                      }
                    }}
                    key={meeting.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group flex flex-wrap items-center gap-3 px-3 py-3 hover:bg-muted/30 focus-within:bg-muted/30 sm:flex-nowrap"
                  >
                    {dateTile(meeting)}
                    {details(meeting)}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-card text-xs opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                        onClick={() => setSelectedMeetingId(meeting.id)}
                      >
                        Protokoll öffnen
                      </Button>
                      {actions(meeting)}
                    </div>
                  </article>
                ) : (
                  <article
                    tabIndex={0}
                    aria-label={`Protokoll öffnen: ${meeting.title}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button, a, [role="menu"], [role="menuitem"]')) return;
                      setSelectedMeetingId(meeting.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedMeetingId(meeting.id);
                      }
                    }}
                    key={meeting.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      {dateTile(meeting)}
                      {details(meeting)}
                      {actions(meeting)}
                    </div>
                    {stats[meeting.id] && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {(
                          [
                            { key: "points", label: "Punkte" },
                            { key: "decisions", label: "Entscheidungen" },
                            { key: "tasks", label: "Aufgaben" },
                          ] as const
                        ).map(
                          ({ key, label }) =>
                            stats[meeting.id][key] !== null && (
                              <span
                                key={key}
                                className="rounded-md bg-muted/40 px-2 py-1"
                              >
                                <b className="text-foreground">
                                  {stats[meeting.id][key]}
                                </b>{" "}
                                {label}
                              </span>
                            ),
                        )}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="mt-auto w-full bg-card"
                      onClick={() => setSelectedMeetingId(meeting.id)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Protokoll öffnen
                    </Button>
                  </article>
                ),
              )}
            </div>
          </section>
        ))
      )}
      <AlertDialog
        open={!!meetingToDelete}
        onOpenChange={(open) => {
          if (!open) setMeetingToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Besprechung löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie „{meetingToDelete?.title}“ endgültig
              löschen möchten? Diese Aktion kann nicht rückgängig gemacht
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (meetingToDelete) void deleteMeeting(meetingToDelete.id);
                setMeetingToDelete(null);
              }}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
