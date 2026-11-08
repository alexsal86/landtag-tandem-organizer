import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
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
}: Props) {
  const query = usePlatformAgenda(type, meetingDate);
  useEffect(() => {
    if (type !== "appointment_requests")
      onCountChange?.(
        query.isLoading || query.error ? null : (query.data?.length ?? 0),
      );
  }, [type, query.isLoading, query.error, query.data, onCountChange]);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const profileId = useCurrentProfileId();
  const { role } = useResolvedUserRole();
  const mayApprove = role === "abgeordneter" || role === "bueroleitung";
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
  return (
    <section className="min-w-0" aria-label={option?.label}>
      <div className="flex items-center justify-between gap-2 py-space-xs">
        <span className="text-caption text-muted-foreground">
          {entries.length}{" "}
          {type === "critical_radar" ? "Klärungspunkte" : "Einträge"}
        </span>
        {entries.length === 200 && (
          <Badge variant="outline">Erste 200 Einträge</Badge>
        )}
      </div>
      {!entries.length ? (
        <EmptyState size="sm" title="Keine offenen Punkte in diesem Zeitraum" />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const result = results[entry.id];
            const isExpanded = expanded === entry.id;
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
                        setExpanded(isExpanded ? null : entry.id);
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
                {(isExpanded || !!result?.follow_up) && (
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
                )}
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
