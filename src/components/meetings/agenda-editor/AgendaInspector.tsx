import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, X, Eye, EyeOff, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import type { AgendaItem, AgendaDocument, Profile } from "../types";
interface Props {
  startTime?: string;
  item: AgendaItem;
  index: number;
  profiles: Profile[];
  hasEditPermission: boolean;
  agendaDocuments: Record<string, AgendaDocument[]>;
  taskDocuments: Record<string, AgendaDocument[]>;
  onUpdateAgendaItem: (
    index: number,
    field: keyof AgendaItem,
    value: unknown,
  ) => void;
  onDeleteAgendaDocument: (id: string, itemId: string, path: string) => void;
  handleAgendaDocumentUpload: (item: AgendaItem, index: number) => void;
  showDocumentActionError: (
    action: "download" | "upload" | "delete",
    error: unknown,
  ) => void;
  onDeleteAgendaItem: (item: AgendaItem, index: number) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
}
export function AgendaInspector({
  item,
  index,
  profiles,
  hasEditPermission,
  agendaDocuments,
  taskDocuments,
  startTime,
  onUpdateAgendaItem,
  onDeleteAgendaDocument,
  handleAgendaDocumentUpload,
  showDocumentActionError,
  onDeleteAgendaItem,
  onToggleVisibility,
}: Props) {
  return (
    <aside
      aria-label="Agenda-Details"
      className="rounded-lg border bg-card p-4 space-y-4 xl:sticky xl:top-4 min-w-0"
    >
      <div>
        <h3 className="font-semibold break-words">
          {item.title || "Neuer Punkt"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.system_type
            ? "Automatischer Baustein. Der Inhalt wird beim Meeting aus der Plattform geladen."
            : item.parent_id || item.parentLocalKey
              ? "Unterpunkt"
              : "Hauptpunkt"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!item.parent_id && !item.parentLocalKey && (
          <div>
            <span className="text-sm">Dauer</span>
            <div className="mt-1 flex items-center rounded-lg border bg-muted/30">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dauer um fünf Minuten verringern"
                disabled={!hasEditPermission}
                onClick={() =>
                  onUpdateAgendaItem(
                    index,
                    "duration_minutes",
                    Math.max(0, (item.duration_minutes ?? 0) - 5),
                  )
                }
              >
                −
              </Button>
              <span className="flex-1 text-center text-sm tabular-nums">
                {item.duration_minutes ?? 0} min
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dauer um fünf Minuten erhöhen"
                disabled={!hasEditPermission}
                onClick={() =>
                  onUpdateAgendaItem(
                    index,
                    "duration_minutes",
                    (item.duration_minutes ?? 0) + 5,
                  )
                }
              >
                +
              </Button>
            </div>
          </div>
        )}
        <div>
          <span className="text-sm">Beginn</span>
          <div className="mt-1 rounded-lg border bg-muted/30 px-3 py-2 text-center text-sm tabular-nums">
            {startTime || "–"}
          </div>
        </div>
      </div>
      {item.system_type ? (
        <>
          <label className="block text-sm space-y-1">
            <span>Ergebnistext</span>
            <Textarea
              aria-label="Ergebnistext"
              readOnly={!hasEditPermission}
              value={item.result_text || ""}
              onChange={(e) =>
                onUpdateAgendaItem(index, "result_text", e.target.value)
              }
            />
          </label>
          {hasEditPermission && (
            <Button
              variant="outline"
              onClick={() => onDeleteAgendaItem(item, index)}
            >
              <Trash className="h-4 w-4 mr-2" />
              Baustein entfernen
            </Button>
          )}
        </>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold">Zuständig</p>
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile) => {
                const selected =
                  item.assigned_to?.includes(profile.user_id) ?? false;
                return (
                  <Button
                    key={profile.user_id}
                    variant="outline"
                    size="sm"
                    disabled={!hasEditPermission}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "h-8 gap-0 rounded-full border-primary bg-primary/10 py-1 pl-1 pr-2.5 text-xs hover:bg-primary/15"
                        : "h-8 gap-0 rounded-full bg-muted/30 py-1 pl-1 pr-2.5 text-xs"
                    }
                    onClick={() => {
                      const ids = selected
                        ? (item.assigned_to ?? []).filter(
                            (id) => id !== profile.user_id,
                          )
                        : [...(item.assigned_to ?? []), profile.user_id];
                      onUpdateAgendaItem(
                        index,
                        "assigned_to",
                        ids.length ? ids : null,
                      );
                    }}
                  >
                    <span className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">
                      {(profile.display_name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    {profile.display_name || "Unbekannt"}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Beschreibung</span>
              <Textarea
                aria-label="Beschreibung"
                placeholder="Worum geht es?"
                className="min-h-24 rounded-xl bg-muted/30 shadow-none"
                value={item.description || ""}
                readOnly={!hasEditPermission}
                onChange={(e) =>
                  onUpdateAgendaItem(index, "description", e.target.value)
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Notizen</span>
              <Textarea
                aria-label="Notizen"
                placeholder="Hinweise für das Meeting"
                className="min-h-24 rounded-xl bg-muted/30 shadow-none"
                value={item.notes || ""}
                readOnly={!hasEditPermission}
                onChange={(e) =>
                  onUpdateAgendaItem(index, "notes", e.target.value)
                }
              />
            </label>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Dokumente</h4>
              {/* Task documents */}
              {item.task_id &&
                taskDocuments[item.task_id] &&
                taskDocuments[item.task_id].length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <FileText className="h-3 w-3" />
                      <span>Aufgaben-Dokumente:</span>
                    </div>
                    <div className="space-y-1">
                      {taskDocuments[item.task_id].map((doc, docIndex) => (
                        <div
                          key={docIndex}
                          className="flex items-center justify-between py-1 px-2 hover:bg-muted/30 rounded text-xs"
                        >
                          <span className="text-muted-foreground truncate">
                            {doc.file_name || "Dokument"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Aufgaben-Dokument herunterladen"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.storage
                                  .from("task-documents")
                                  .download(doc.file_path);
                                if (error) throw error;
                                const url = URL.createObjectURL(data);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = doc.file_name || "download";
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (error) {
                                showDocumentActionError("download", error);
                              }
                            }}
                          >
                            <Download aria-hidden="true" className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Agenda documents */}
              {agendaDocuments[item.id!] &&
                agendaDocuments[item.id!].length > 0 && (
                  <div className="mb-2 bg-muted/30 p-2 rounded-lg border">
                    <h4 className="text-sm font-medium mb-1">
                      Angehängte Dokumente:
                    </h4>
                    <div className="space-y-1">
                      {agendaDocuments[item.id!].map((doc, docIndex) => (
                        <div
                          key={docIndex}
                          className="flex items-center justify-between p-1.5 bg-background rounded border"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-palette-blue" />
                            <span className="text-xs truncate">
                              {doc.file_name}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Dokument herunterladen"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.storage
                                    .from("documents")
                                    .download(doc.file_path);
                                  if (error) throw error;
                                  const url = URL.createObjectURL(data);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = doc.file_name;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch (error) {
                                  showDocumentActionError("download", error);
                                }
                              }}
                            >
                              <Download
                                aria-hidden="true"
                                className="h-3 w-3"
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              aria-label="Dokument löschen"
                              disabled={!hasEditPermission}
                              onClick={() =>
                                onDeleteAgendaDocument(
                                  doc.id,
                                  item.id!,
                                  doc.file_path,
                                )
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-14 flex-1 rounded-xl border-dashed bg-card px-3 py-3 text-muted-foreground whitespace-normal shadow-none"
                  disabled={!hasEditPermission}
                  onClick={() => handleAgendaDocumentUpload(item, index)}
                >
                  Datei auswählen
                </Button>
              </div>
            </div>
          </div>

          <label
            className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm cursor-pointer"
            title="Auf nächstes Meeting übertragen"
          >
            <Checkbox
              disabled={!hasEditPermission}
              checked={!!item.carry_over_to_next}
              onCheckedChange={(v) =>
                onUpdateAgendaItem(index, "carry_over_to_next", v === true)
              }
            />
            <span>
              <span className="block font-semibold">
                Auf nächstes Meeting übertragen
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Der Punkt erscheint dort automatisch wieder.
              </span>
            </span>
          </label>
          {item.is_optional && (
            <Button
              disabled={!hasEditPermission}
              variant="outline"
              onClick={() =>
                item.id
                  ? onToggleVisibility(item.id, item.is_visible !== false)
                  : onUpdateAgendaItem(
                      index,
                      "is_visible",
                      item.is_visible === false,
                    )
              }
            >
              {item.is_visible === false ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Sichtbarkeit:{" "}
              {item.is_visible === false ? "ausgeblendet" : "sichtbar"}
            </Button>
          )}
        </>
      )}
    </aside>
  );
}
