import { SystemSubpointList } from "./agenda-editor/SystemSubpointList";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronDown,
  Check,
  MessageSquare,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-patterns";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { JourFixeRequestsCard } from "@/features/appointment-requests/JourFixeRequestsCard";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import {
  parseMeetingResults,
  type MeetingEntryResult,
} from "./platformAgendaRules";
import {
  systemAgendaOption,
  type PlatformAgendaType,
} from "./systemAgendaRegistry";
import { usePlatformAgenda } from "./usePlatformAgenda";
import type { Profile } from "./types";

interface Props {
  defaultExpanded?: boolean;
  agendaSubpoints?: { parentNumber?: string };
  onDescriptionChange?: (description: string) => void;
  onCountChange?: (count: number | null) => void;
  type: PlatformAgendaType;
  meetingDate: string | Date;
  resultText?: string | null;
  onUpdateResult?: (value: string) => void;
  profiles?: Profile[];
  readOnly?: boolean;
}

export function PlatformAgendaSection({
  type,
  meetingDate,
  resultText,
  onUpdateResult,
  profiles = [],
  readOnly = false,
  onCountChange,
  onDescriptionChange,
  defaultExpanded = false,
  agendaSubpoints,
}: Props) {
  const query = usePlatformAgenda(type, meetingDate);
  useEffect(() => {
    if (type !== "appointment_requests")
      onCountChange?.(
        query.isLoading || query.error ? null : (query.data?.length ?? 0),
      );
  }, [type, query.isLoading, query.error, query.data, onCountChange]);
  useEffect(() => {
    if (!onDescriptionChange || !query.data) return;
    const entries = query.data;
    if (type === "redaktion") {
      const pending = entries.filter(entry => entry.approval === "social").length;
      onDescriptionChange(pending === 0 ? "Keine Freigabe steht aus" : pending === 1 ? "1 Freigabe steht aus" : `${pending} Freigaben stehen aus`);
    } else if (type === "leave_requests") {
      const absences = new Set(entries.map(entry => entry.deputyName
        ? `${entry.title} ist abwesend und wird vertreten durch ${entry.deputyName}`
        : `${entry.title} ist abwesend · keine Vertretung eingetragen`));
      onDescriptionChange(absences.size ? [...absences].join(" · ") : "Keine Abwesenheit im Zeitraum");
    } else if (type === "event_plannings") {
      const count = entries.length;
      const label = count === 1 ? "1 Veranstaltung" : `${count} Veranstaltungen`;
      const withNames = [label, ...entries.map(entry => entry.title)].join(" · ");
      onDescriptionChange(count === 0 ? "Keine Veranstaltungsplanung vorhanden" : count <= 2 && withNames.length <= 100 ? withNames : label);
    } else if (type === "letters_for_signature") {
      const count = entries.filter(entry => entry.needsApproval).length;
      onDescriptionChange(count === 0 ? "Kein Brief zur Freigabe" : count === 1
        ? "1 Brief muss freigegeben werden" : `${count} Briefe müssen freigegeben werden`);
    } else if (type === "critical_radar") {
      const deadlines = entries.filter(entry => entry.date);
      const count = deadlines.length;
      const byPerson = new Map<string, number>();
      for (const { ownerId } of deadlines) {
        const name = profiles.find(profile => profile.user_id === ownerId)?.display_name;
        if (name) byPerson.set(name, (byPerson.get(name) ?? 0) + 1);
      }
      onDescriptionChange(count === 0 ? "Keine Frist im Radar" : [
        count === 1 ? "1 Frist" : `${count} Fristen`,
        ...Array.from(byPerson, ([name, total]) => `${total}× ${name}`),
      ].join(" · "));
    } else if (type === "past_appointments") {
      const count = entries.filter(entry => entry.needsReview).length;
      onDescriptionChange(count === 0 ? "Kein Termin mit offener Rückschau" : count === 1
        ? "1 Termin mit offener Rückschau" : `${count} Termine mit offener Rückschau`);
    }
  }, [type, query.data, profiles, onDescriptionChange]);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const profileId = useCurrentProfileId();
  const { role } = useResolvedUserRole();
  const mayApprove = role === "abgeordneter" || role === "bueroleitung";
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const results = parseMeetingResults(resultText);
  const option = systemAgendaOption(type);

  const patchResult = (id: string, patch: Partial<MeetingEntryResult>) => {
    onUpdateResult?.(
      JSON.stringify({
        ...results,
        [id]: { ...(results[id] ?? { result: "" }), ...patch },
      }),
    );
  };
  const approve = async (id: string) => {
    if (!currentTenant?.id || !mayApprove) return;
    setPending(id);
    try {
      const { error } = await supabase
        .from("social_content_items")
        .update({ approval_state: "approved" })
        .eq("id", id)
        .eq("tenant_id", currentTenant.id)
        .eq("approval_state", "pending_approval");
      if (error) throw error;
      const verified = await supabase
        .from("social_content_items")
        .select("approval_state")
        .eq("id", id)
        .eq("tenant_id", currentTenant.id)
        .single();
      if (verified.error) throw verified.error;
      if (verified.data.approval_state !== "approved")
        throw new Error("Freigabe wurde nicht gespeichert");
      await qc.invalidateQueries({ queryKey: ["jour-fixe-platform"] });
      notify.success("Beitrag freigegeben");
    } catch (error) {
      notify.error("Freigabe fehlgeschlagen", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPending(null);
    }
  };
  const requestChanges = async (id: string) => {
    if (!currentTenant?.id || !profileId || !changeNote.trim()) return;
    setPending(id);
    try {
      const { error } = await supabase
        .from("social_approval_comments")
        .insert({
          tenant_id: currentTenant.id,
          content_item_id: id,
          author_id: profileId,
          comment: changeNote.trim(),
          is_change_request: true,
        });
      if (error) throw error;
      patchResult(id, { result: changeNote.trim() });
      setChangeNote("");
      notify.success("Korrekturhinweis gespeichert");
    } catch (error) {
      notify.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPending(null);
    }
  };

  if (type === "appointment_requests")
    return (
      <JourFixeRequestsCard
        embedded
        readOnly={readOnly}
        onCountChange={onCountChange}
      />
    );
  if (query.isLoading) return <LoadingState variant="inline" />;
  if (query.error)
    return (
      <ErrorState
        title="Sitzungsinhalt nicht geladen"
        onRetry={() => void query.refetch()}
      />
    );
  const entries = query.data ?? [];
  const renderEntryDetails = (entry: (typeof entries)[number], isExpanded: boolean) => {
    const result = results[entry.id];
    return (isExpanded || !!result?.follow_up) && (
      <div className="mt-space-xs ml-space-lg space-y-space-xs">
        {entry.content && (
          <RichTextDisplay
            content={entry.content}
            className="text-body break-words max-h-80 overflow-auto"
          />
        )}
        {!readOnly && entry.decisionId && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDecisionId(entry.decisionId || null)}
          >
            <Check className="h-4 w-4 mr-1" /> Freigabe /
            Überarbeitung entscheiden
          </Button>
        )}
        {!readOnly && entry.approval === "social" && (
          <div className="flex flex-wrap items-center gap-space-xs">
            {mayApprove && (
              <Button
                size="sm"
                disabled={pending === entry.id}
                onClick={() => void approve(entry.id)}
              >
                <Check className="h-4 w-4 mr-space-2xs" /> Freigeben
              </Button>
            )}
            <Input
              aria-label="Korrekturhinweis"
              placeholder="Korrekturhinweis"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="Korrekturhinweis speichern"
              disabled={!changeNote.trim() || pending === entry.id}
              onClick={() => void requestChanges(entry.id)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        )}
        {onUpdateResult && !readOnly && (
          <>
            <Textarea
              aria-label={`Ergebnis: ${entry.title}`}
              placeholder="Ergebnis / nächster Auftrag"
              value={result?.result || ""}
              onChange={(e) =>
                patchResult(entry.id, { result: e.target.value })
              }
            />
            <div className="flex flex-wrap items-center gap-space-xs">
              <label className="flex items-center gap-space-2xs text-caption">
                <Checkbox
                  checked={!!result?.follow_up}
                  disabled={!result?.result.trim()}
                  onCheckedChange={(value) =>
                    patchResult(entry.id, {
                      follow_up: value === true,
                      assigned_to: result?.assigned_to?.length
                        ? result.assigned_to
                        : entry.ownerId
                          ? [entry.ownerId]
                          : user?.id
                            ? [user.id]
                            : [],
                    })
                  }
                />
                <CornerDownRight className="h-3 w-3" /> Folgeaufgabe
              </label>
              {result?.follow_up && (
                <>
                  <Select
                    value={result.assigned_to?.[0] || user?.id}
                    onValueChange={(id) =>
                      patchResult(entry.id, { assigned_to: [id] })
                    }
                  >
                    <SelectTrigger
                      className="w-44"
                      aria-label="Zuständige Person"
                    >
                      <SelectValue placeholder="Zuständig" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem
                          key={profile.user_id}
                          value={profile.user_id}
                        >
                          {profile.display_name || "Unbekannt"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Frist der Folgeaufgabe"
                    type="date"
                    className="w-40"
                    value={result.due_at?.slice(0, 10) || ""}
                    onChange={(e) =>
                      patchResult(entry.id, {
                        due_at: e.target.value || undefined,
                      })
                    }
                  />
                </>
              )}
            </div>
          </>
        )}
        {readOnly && result?.result && (
          <p className="text-caption text-muted-foreground">
            {result.result}
          </p>
        )}
      </div>
    );
  };
  return (
    <section className="min-w-0" aria-label={option?.label}>
      {(!agendaSubpoints || entries.length === 200) && (
        <div className="flex items-center justify-between gap-2 py-space-xs">
          <span className="text-caption text-muted-foreground">
            {entries.length}{" "}
            {type === "critical_radar" ? "Klärungspunkte" : "Einträge"}
          </span>
          {entries.length === 200 && (
            <Badge variant="outline">Erste 200 Einträge</Badge>
          )}
        </div>
      )}
      {!entries.length ? (
        <EmptyState size="sm" title="Keine offenen Punkte in diesem Zeitraum" />
      ) : agendaSubpoints ? (
        <SystemSubpointList
          entries={entries}
          label={option?.label}
          titleOf={(entry) => entry.title}
          agendaNumber={agendaSubpoints.parentNumber}
          resultText={resultText}
          onUpdateResult={readOnly ? undefined : onUpdateResult}
          checkable
          metadata={(entry) => (
            <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              {entry.date && new Date(entry.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              {entry.ownerId && profiles.find((profile) => profile.user_id === entry.ownerId)?.display_name}
              {entry.status && <Badge variant="outline">{entry.status}</Badge>}
            </span>
          )}
          actions={(entry) => (
            <>
              <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Details zu ${entry.title}`}
                aria-expanded={defaultExpanded ? !collapsedEntries[entry.id] : expanded === entry.id}
                onClick={() => {
                  if (defaultExpanded) setCollapsedEntries((previous) => ({ ...previous, [entry.id]: !previous[entry.id] }));
                  else setExpanded((previous) => previous === entry.id ? null : entry.id);
                  setChangeNote("");
                }}>
                <ChevronDown className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-6 shrink-0" aria-label={`${entry.title} öffnen`} onClick={() => navigate(entry.path)}>
                <ArrowUpRight className="size-4" />
              </Button>
            </>
          )}
          details={(entry) => (
            <>
              {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
              {renderEntryDetails(entry, defaultExpanded ? !collapsedEntries[entry.id] : expanded === entry.id)}
            </>
          )}
        />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const result = results[entry.id];
            const isExpanded = defaultExpanded ? !collapsedEntries[entry.id] : expanded === entry.id;
            return (
              <li key={entry.id} className="py-space-xs min-w-0">
                <div className="flex items-start gap-space-xs">
                  {onUpdateResult && !readOnly && (
                    <Checkbox
                      aria-label={`${entry.title} besprochen`}
                      className="mt-1 shrink-0"
                      checked={!!result?.completed}
                      onCheckedChange={(value) =>
                        patchResult(entry.id, { completed: value === true })
                      }
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 justify-start text-left whitespace-normal"
                      onClick={() => {
                        if (defaultExpanded) setCollapsedEntries(prev => ({ ...prev, [entry.id]: isExpanded }));
                        else setExpanded(isExpanded ? null : entry.id);
                        setChangeNote("");
                      }}
                    >
                      <span
                        className={cn(
                          "text-body font-medium break-words",
                          result?.completed && "text-muted-foreground",
                        )}
                      >
                        {entry.title}
                      </span>
                    </Button>
                    <div className="flex flex-wrap items-center gap-x-space-xs gap-y-space-2xs text-caption text-muted-foreground mt-space-2xs">
                      <span className="tabular-nums">
                        {entry.date
                          ? new Date(entry.date).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "Noch ohne Termin"}
                      </span>
                      {entry.detail && (
                        <span className="break-words">{entry.detail}</span>
                      )}
                      {entry.ownerId && (
                        <span>
                          {
                            profiles.find(
                              (profile) => profile.user_id === entry.ownerId,
                            )?.display_name
                          }
                        </span>
                      )}
                      {entry.status && (
                        <Badge
                          variant={
                            type === "critical_radar"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {entry.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    aria-label={`${entry.title} öffnen`}
                    onClick={() => navigate(entry.path)}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
                {renderEntryDetails(entry, isExpanded)}
              </li>
            );
          })}
        </ul>
      )}
      {decisionId && (
        <TaskDecisionDetails
          decisionId={decisionId}
          isOpen
          onClose={() => {
            setDecisionId(null);
            void qc.invalidateQueries({ queryKey: ["jour-fixe-platform"] });
          }}
        />
      )}
    </section>
  );
}
