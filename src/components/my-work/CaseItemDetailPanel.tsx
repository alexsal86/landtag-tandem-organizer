import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, ChevronDown, ExternalLink, Gavel, Loader2, Mail, MessageSquare, Phone, Trash2, Users, Vote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import type { EditableCaseItem, TimelineInteractionType } from "@/components/my-work/hooks/useCaseItemEdit";

type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  safeNoteHtml?: string;
  accentClass: string;
  icon?: typeof Phone;
  canDelete?: boolean;
  onDelete?: () => void;
};

type CaseFile = {
  id: string;
  title: string;
  status: string;
  reference_number: string | null;
  current_status_note: string | null;
  case_type: string | null;
};

const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "gespraech", label: "Gespräch", icon: MessageSquare },
  { value: "notiz", label: "Notiz", icon: MessageSquare },
];

export function CaseItemDetailPanel({
  itemId,
  itemCaseFileId,
  editableCaseItem,
  statusOptions,
  categoryOptions,
  teamUsers,
  linkedDecisions,
  loadingDecisions,
  timelineEntries,
  toEditorHtml,
  caseFilesById,
  onUpdate,
  onSave,
  onDecisionRequest,
  onDecisionReceived,
  onAddInteraction,
  onCreateCaseFile,
  onNavigateToCaseFile,
  contactDisplay,
  contactPerson,
  onContactPersonChange,
}: {
  itemId: string;
  itemCaseFileId: string | null;
  editableCaseItem: EditableCaseItem;
  statusOptions: Array<{ value: string; label: string }>;
  categoryOptions: readonly string[];
  teamUsers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  linkedDecisions: Array<{ id: string; title: string; status: string; created_at: string; response_deadline: string | null }>;
  loadingDecisions: boolean;
  timelineEntries: TimelineEntry[];
  toEditorHtml: (value: string | null | undefined) => string;
  caseFilesById: Record<string, CaseFile>;
  onUpdate: (patch: Partial<EditableCaseItem>) => void;
  onSave: () => void;
  onDecisionRequest: () => void;
  onDecisionReceived: () => void;
  onAddInteraction: () => void;
  onCreateCaseFile: (itemId: string) => void;
  onNavigateToCaseFile: (caseFileId: string) => void;
  contactDisplay: string;
  contactPerson: string;
  onContactPersonChange: (value: string) => void;
}) {
  const [showMetaFields, setShowMetaFields] = useState(false);
  const [showInteractionComposer, setShowInteractionComposer] = useState(false);

  useEffect(() => {
    setShowInteractionComposer(false);
  }, [itemId]);

  const formatDecisionDate = (value: string | null | undefined) => {
    if (!value) return "–";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "–";
    return format(parsed, "dd.MM.yyyy", { locale: de });
  };

  const formatTimelineDateOnly = (timestamp: string) => {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "–";
    return format(parsed, "dd.MM.yyyy", { locale: de });
  };

  const formatTimelineTimeOnly = (timestamp: string) => {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "–";
    return format(parsed, "HH:mm", { locale: de });
  };

  return (
    <div className="mx-2 mb-3 rounded-md border bg-muted/20 p-3 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(230px,1fr)_minmax(0,2.8fr)]">
        <div className="space-y-3">
          <div className="rounded-md border bg-background p-3">
            <p className="font-bold mb-3">Zeitstrahl</p>
            <div className="relative space-y-4 pl-6">
              {timelineEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Einträge im Zeitstrahl.</p>
              ) : (
                <>
                  {timelineEntries.map((entry, index) => {
                    const isLastEntry = index === timelineEntries.length - 1;
                    return (
                      <div key={entry.id} className="relative">
                        {!isLastEntry ? <span className="absolute -left-[12px] top-3 bottom-[-18px] w-px bg-border" /> : null}
                        <span className={`absolute -left-[20px] top-1 h-4 w-4 rounded-full ${entry.accentClass} flex items-center justify-center text-white`}>
                          {entry.icon ? <entry.icon className="h-2.5 w-2.5" /> : null}
                        </span>
                        <div className="group rounded p-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold leading-4">{entry.title}</p>
                            </div>
                            {entry.canDelete && entry.onDelete ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <AlertDialog>
                                    <TooltipTrigger asChild>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 focus-visible:opacity-100"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Interaktion löschen</TooltipContent>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Interaktion löschen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Diese Interaktion wird dauerhaft aus dem Zeitstrahl entfernt.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction onClick={entry.onDelete}>Löschen</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                          </div>
                          {entry.safeNoteHtml && <div className="mt-1 text-muted-foreground" dangerouslySetInnerHTML={{ __html: entry.safeNoteHtml }} />}
                          <div className="mt-2 flex justify-end gap-1 text-[11px] text-muted-foreground">
                            <span>{formatTimelineDateOnly(entry.timestamp)}</span>
                            <span className="opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100">• {formatTimelineTimeOnly(entry.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border bg-background p-3 text-sm">
            <Label className="font-bold" htmlFor="detail-contact-person">Von / Gesprächspartner</Label>
            <div className="flex gap-2">
              <Input
                id="detail-contact-person"
                value={contactPerson}
                placeholder={contactDisplay || "Von / Gesprächspartner"}
                onChange={(event) => onContactPersonChange(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => onContactPersonChange("")}>Löschen</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold" htmlFor="detail-received">Eingangsdatum</Label>
              <Input id="detail-received" type="date" value={editableCaseItem.sourceReceivedAt} onChange={(event) => onUpdate({ sourceReceivedAt: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold" htmlFor="detail-due">Fällig am</Label>
              <Input id="detail-due" type="date" value={editableCaseItem.dueAt} onChange={(event) => onUpdate({ dueAt: event.target.value })} />
            </div>
          </div>

          <Collapsible open={showMetaFields} onOpenChange={setShowMetaFields} className="rounded-md border bg-background">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left">
                <span className="text-sm font-semibold">Erweiterte Angaben</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMetaFields && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 px-3 pb-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-bold">Status</Label>
                  <Select value={editableCaseItem.status} onValueChange={(value) => onUpdate({ status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((statusOption) => (
                        <SelectItem key={statusOption.value} value={statusOption.value}>{statusOption.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">Kategorie *</Label>
                  <Select value={editableCaseItem.category} onValueChange={(value) => onUpdate({ category: value })}>
                    <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((categoryOption) => (
                        <SelectItem key={categoryOption} value={categoryOption}>{categoryOption}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-bold">Priorität</Label>
                  <Select value={editableCaseItem.priority} onValueChange={(value) => onUpdate({ priority: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                      <SelectItem value="urgent">Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">Bearbeiter</Label>
                  <div className="flex flex-wrap gap-2 rounded-md border p-2">
                    {teamUsers.map((member) => {
                      const selected = editableCaseItem.assigneeIds.includes(member.id);
                      return (
                        <Button
                          key={member.id}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() => {
                            const next = selected
                              ? editableCaseItem.assigneeIds.filter((id) => id !== member.id)
                              : [...editableCaseItem.assigneeIds, member.id];
                            onUpdate({ assigneeIds: next });
                          }}
                        >
                          {member.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2 rounded-md border bg-background p-3">
            <Label className="font-bold flex items-center gap-1.5"><Vote className="h-4 w-4" />Verknüpfte Entscheidungen</Label>
            {loadingDecisions ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Lade Entscheidungen…</div>
            ) : linkedDecisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Entscheidungen verknüpft.</p>
            ) : (
              <div className="space-y-2">
                {linkedDecisions.map((decision) => (
                  <div key={decision.id} className="rounded border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{decision.title}</p>
                      <span className="text-muted-foreground">{decision.status}</span>
                    </div>
                    <p className="text-muted-foreground">Erstellt: {formatDecisionDate(decision.created_at)}</p>
                    {decision.response_deadline && <p className="text-muted-foreground">Frist: {formatDecisionDate(decision.response_deadline)}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onDecisionRequest}><Gavel className="mr-1 h-3.5 w-3.5" />Entscheidung stellen</Button>
              <Button type="button" variant="outline" size="sm" onClick={onDecisionReceived} disabled={editableCaseItem.status !== "entscheidung_abwartend"}>Eingegangen</Button>
            </div>
          </div>

          {editableCaseItem.status === "erledigt" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="font-bold" htmlFor="detail-completion-note">Abschlussnotiz</Label>
                <Input id="detail-completion-note" value={editableCaseItem.completionNote} onChange={(event) => onUpdate({ completionNote: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold" htmlFor="detail-completed-at">Abgeschlossen am</Label>
                <Input id="detail-completed-at" type="date" value={editableCaseItem.completedAt} onChange={(event) => onUpdate({ completedAt: event.target.value })} />
              </div>
            </div>
          )}
          <Button disabled={!editableCaseItem.category} onClick={onSave}>Speichern</Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="font-bold" htmlFor="detail-subject">Betreff</Label>
            <Input id="detail-subject" value={editableCaseItem.subject} onChange={(event) => onUpdate({ subject: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold" htmlFor="detail-summary">Beschreibung</Label>
            <SimpleRichTextEditor
              key={`detail-summary-${itemId}`}
              initialContent={toEditorHtml(editableCaseItem.summary)}
              onChange={(html) => onUpdate({ summary: html })}
              placeholder="Beschreibung hinzufügen"
              minHeight="140px"
            />
          </div>
          <div className="rounded-md border bg-background p-3 space-y-2">
            <p className="font-bold">Interaktion erfassen</p>
            <div className="flex flex-wrap gap-2 xl:flex-nowrap">
              {interactionTypeOptions.map((option) => {
                const selected = editableCaseItem.interactionType === option.value;
                const OptionIcon = option.icon;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    className="flex-1 justify-start"
                    onClick={() => {
                      if (selected && showInteractionComposer) {
                        onUpdate({ interactionType: "", interactionContact: "", interactionDateTime: "", interactionNote: "" });
                        setShowInteractionComposer(false);
                        return;
                      }
                      onUpdate({ interactionType: option.value });
                      setShowInteractionComposer(true);
                    }}
                  >
                    <OptionIcon className="mr-1 h-3.5 w-3.5" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
            {showInteractionComposer ? (
              <>
                {(editableCaseItem.interactionType === "anruf" || editableCaseItem.interactionType === "mail" || editableCaseItem.interactionType === "gespraech" || editableCaseItem.interactionType === "treffen") && (
                  <Input
                    placeholder={editableCaseItem.interactionType === "mail" ? "E-Mail-Adresse" : editableCaseItem.interactionType === "anruf" ? "Telefonnummer" : "Kontaktperson"}
                    value={editableCaseItem.interactionContact}
                    onChange={(event) => onUpdate({ interactionContact: event.target.value })}
                  />
                )}
                <Input type="datetime-local" value={editableCaseItem.interactionDateTime} onChange={(event) => onUpdate({ interactionDateTime: event.target.value })} />
                <SimpleRichTextEditor
                  key={editableCaseItem.timelineEvents.length}
                  initialContent={editableCaseItem.interactionNote}
                  onChange={(value) => onUpdate({ interactionNote: value })}
                  placeholder="Notiz"
                  minHeight="120px"
                  maxHeight="180px"
                  scrollable
                />
                <Button type="button" size="sm" onClick={onAddInteraction}>Interaktion hinzufügen</Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Bitte Interaktion wählen, um Details zu öffnen.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="font-bold" htmlFor="detail-subject">Betreff</Label>
            <Input id="detail-subject" value={editableCaseItem.subject} onChange={(event) => onUpdate({ subject: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold" htmlFor="detail-summary">Beschreibung</Label>
            <SimpleRichTextEditor
              key={`detail-summary-${itemId}`}
              initialContent={toEditorHtml(editableCaseItem.summary)}
              onChange={(html) => onUpdate({ summary: html })}
              placeholder="Beschreibung hinzufügen"
              minHeight="140px"
            />
          </div>
        </div>
      </div>

      {itemCaseFileId && caseFilesById[itemCaseFileId] ? (
        <div className="mt-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verknüpfte FallAkte</p>
          <div className="rounded-md border bg-background p-3 text-sm">
            <p className="font-semibold">{caseFilesById[itemCaseFileId].title}</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Status: {caseFilesById[itemCaseFileId].status || "offen"}</li>
              {caseFilesById[itemCaseFileId].reference_number && <li>• Aktenzeichen: {caseFilesById[itemCaseFileId].reference_number}</li>}
              {caseFilesById[itemCaseFileId].case_type && <li>• Typ: {caseFilesById[itemCaseFileId].case_type}</li>}
              {caseFilesById[itemCaseFileId].current_status_note && <li>• Hinweis: {caseFilesById[itemCaseFileId].current_status_note}</li>}
            </ul>
          </div>
          <Button size="sm" variant="outline" onClick={() => onNavigateToCaseFile(itemCaseFileId)}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Vollansicht
          </Button>
        </div>
      ) : (
        <div className="mt-1 space-y-3 rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <p>Keine Akte verknüpft.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onCreateCaseFile(itemId)}>Neue Akte anlegen</Button>
          </div>
        </div>
      )}
    </div>
  );
}
