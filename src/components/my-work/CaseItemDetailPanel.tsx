import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, Archive, CheckCircle2, ChevronDown, Clock, Download, ExternalLink, FileEdit, FileText, Gavel, Globe, Loader2, Mail, MessageSquare, Phone, Search, Trash2, Users, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { debugConsole } from "@/utils/debugConsole";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { DecisionFileUpload } from "@/components/task-decisions/DecisionFileUpload";
import type { CaseItemInteractionDocument, EditableCaseItem, TimelineInteractionType, TimelineDocumentAttachment } from "@/components/my-work/hooks/useCaseItemEdit";
import { LinkedValueChip } from "@/components/my-work/LinkedValueChip";
import { stripHtml } from "@/utils/textDiff";

type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  safeNoteHtml?: string;
  documents?: TimelineDocumentAttachment[];
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

type LinkedDecision = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  response_deadline: string | null;
  created_by: string | null;
  task_decision_participants: Array<{
    id: string;
    user_id: string;
    task_decision_responses: Array<{ id: string; response_type: string }>;
  }>;
};

const interactionTypeOptions: Array<{ value: TimelineInteractionType | "entscheidung"; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "dokument", label: "Dokument", icon: FileText },
  { value: "notiz", label: "Notiz", icon: MessageSquare },
  { value: "entscheidung", label: "Entscheidung", icon: Gavel },
];

export function CaseItemDetailPanel({
  itemId,
  itemCaseFileId,
  editableCaseItem,
  statusOptions,
  categoryOptions,
  teamUsers,
  currentUserId,
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
  onDownloadDocument,
  onRenameDocument,
  onDeleteDocument,
  onUpdateDocumentMeta,
  onCreateCaseFile,
  onNavigateToCaseFile,
  contactDisplay,
  contactPerson,
  contactEmail,
  contactPhone,
  selectedContactId,
  onContactPersonChange,
  onContactEmailChange,
  onContactPhoneChange,
  onContactSelected,
  onArchive,
  archiveLabel,
  onDelete,
}: {
  itemId: string;
  itemCaseFileId: string | null;
  editableCaseItem: EditableCaseItem;
  statusOptions: Array<{ value: string; label: string }>;
  categoryOptions: readonly string[];
  teamUsers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  currentUserId: string | null;
  linkedDecisions: LinkedDecision[];
  loadingDecisions: boolean;
  timelineEntries: TimelineEntry[];
  toEditorHtml: (value: string | null | undefined) => string;
  caseFilesById: Record<string, CaseFile>;
  onUpdate: (patch: Partial<EditableCaseItem>) => void;
  onSave: () => void;
  onDecisionRequest: () => void;
  onDecisionReceived: () => void;
  onAddInteraction: (files?: File[]) => void;
  onDownloadDocument: (document: CaseItemInteractionDocument) => Promise<void> | void;
  onRenameDocument: (documentId: string, title: string) => Promise<void> | void;
  onDeleteDocument: (documentId: string) => Promise<void> | void;
  onUpdateDocumentMeta: (documentId: string, patch: { shortText?: string | null; documentDate?: string | null }) => Promise<void> | void;
  onCreateCaseFile: (itemId: string) => void;
  onNavigateToCaseFile: (caseFileId: string) => void;
  contactDisplay: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  selectedContactId: string | null;
  onContactPersonChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  onContactSelected: (contact: { id: string; name: string; email: string | null; phone: string | null } | null) => void;
  onArchive?: () => void;
  archiveLabel?: string;
  onDelete?: () => void;
}) {
  const [showMetaFields, setShowMetaFields] = useState(false);
  const [activeSection, setActiveSection] = useState<"sachlage" | TimelineInteractionType | "entscheidung">("sachlage");
  const [interactionFiles, setInteractionFiles] = useState<File[]>([]);
  const showInteractionComposer = activeSection !== "sachlage" && activeSection !== "entscheidung";

  useEffect(() => {
    setActiveSection("sachlage");
    setInteractionFiles([]);
  }, [itemId]);

  // Contact search effect
  useEffect(() => {
    if (!currentTenant) return;

    const query = contactPerson.trim();
    if (query.length < 2) {
      setContactSearchResults([]);
      setSearchingContacts(false);
      return;
    }

    // Don't search if a contact is already selected with this exact name
    if (selectedContactId) return;

    const timer = setTimeout(async () => {
      const requestId = ++contactSearchRef.current;
      setSearchingContacts(true);

      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone, organization")
        .eq("tenant_id", currentTenant.id)
        .neq("contact_type", "archive")
        .ilike("name", `%${query}%`)
        .order("is_favorite", { ascending: false })
        .order("name")
        .limit(8);

      if (requestId !== contactSearchRef.current) return;

      if (error) {
        debugConsole.error("Error searching contacts:", error);
        setContactSearchResults([]);
      } else {
        setContactSearchResults((data ?? []) as Array<{ id: string; name: string; email: string | null; phone: string | null; organization: string | null }>);
        setShowSearchResults(true);
      }

      setSearchingContacts(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [contactPerson, currentTenant, selectedContactId]);

  // Close search results on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectContact = (contact: { id: string; name: string; email: string | null; phone: string | null }) => {
    onContactPersonChange(contact.name);
    onContactEmailChange(contact.email || "");
    onContactPhoneChange(contact.phone || "");
    onContactSelected(contact);
    setShowSearchResults(false);
  };

  const handleClearContact = () => {
    onContactSelected(null);
  };

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

  const teamUsersById = useMemo(() => new Map(teamUsers.map((u) => [u.id, u] as const)), [teamUsers]);

  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDecisionDetailsOpen, setIsDecisionDetailsOpen] = useState(false);

  const toPlainText = (value: string) => value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  const getDecisionCounts = (decision: LinkedDecision) => {
    const participants = decision.task_decision_participants || [];
    const counts = { yes: 0, no: 0, question: 0, pending: 0, responded: 0, total: participants.length };

    participants.forEach((p) => {
      const responseType = p.task_decision_responses?.[0]?.response_type;
      if (!responseType) {
        counts.pending += 1;
        return;
      }
      counts.responded += 1;
      if (responseType === "yes") counts.yes += 1;
      else if (responseType === "no") counts.no += 1;
      else if (responseType === "question") counts.question += 1;
      else counts.yes += 1; // custom options → zählen als beantwortet
    });

    return counts;
  };


  const sortedInteractionDocuments = useMemo(
    () => [...editableCaseItem.interactionDocuments].sort((a, b) => a.title.localeCompare(b.title, "de", { sensitivity: "base" })),
    [editableCaseItem.interactionDocuments],
  );

  const beginRenameDocument = (document: CaseItemInteractionDocument) => {
    setEditingDocumentId(document.id);
    setEditingDocumentTitle(document.title);
  };

  const saveRenameDocument = async () => {
    if (!editingDocumentId) return;
    await onRenameDocument(editingDocumentId, editingDocumentTitle.trim());
    setEditingDocumentId(null);
    setEditingDocumentTitle("");
  };

  const getDecisionIcon = (decision: LinkedDecision) => {
    const participants = decision.task_decision_participants || [];
    const userParticipant = currentUserId ? participants.find((p) => p.user_id === currentUserId) ?? null : null;
    const userHasResponded = !currentUserId
      ? true
      : decision.created_by === currentUserId
        ? true
        : !userParticipant
          ? true
          : (userParticipant.task_decision_responses?.length ?? 0) > 0;

    return {
      icon: userHasResponded ? CheckCircle2 : Clock,
      iconClass: userHasResponded ? "text-success" : "text-warning",
    };
  };

  const openDecision = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDecisionDetailsOpen(true);
  };

  return (
    <div className="mx-2 mb-3 rounded-md border bg-muted/20 p-3 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(230px,1fr)_minmax(0,2.8fr)]">
        <div className="space-y-3">
          <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
            <Label className="font-bold" htmlFor="detail-contact-name">Von / Gesprächspartner</Label>
            <div className="relative" ref={searchContainerRef}>
              {selectedContactId ? (
                <LinkedValueChip
                  label="Verknüpfter Kontakt"
                  value={contactPerson || contactDisplay}
                  onRemove={handleClearContact}
                  className="w-full justify-between"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground shrink-0 w-14" htmlFor="detail-contact-name">Name</Label>
                  <div className="relative flex-1">
                    <Input
                      id="detail-contact-name"
                      value={contactPerson}
                      placeholder={contactDisplay || "Suchen…"}
                      onChange={(event) => {
                        onContactPersonChange(event.target.value);
                        if (selectedContactId) handleClearContact();
                      }}
                      onFocus={() => { if (contactSearchResults.length > 0) setShowSearchResults(true); }}
                      className="pr-8 h-8"
                    />
                    {searchingContacts && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    {!searchingContacts && !selectedContactId && contactPerson.length >= 2 && <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              )}
              {showSearchResults && contactSearchResults.length > 0 && (
                <div className="absolute left-14 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
                  {contactSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      onClick={() => handleSelectContact(result)}
                    >
                      <span className="font-medium">{result.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[result.organization, result.email, result.phone].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold text-muted-foreground shrink-0 w-14" htmlFor="detail-contact-email">E-Mail</Label>
              <div className="flex-1">
                {selectedContactId && contactEmail ? (
                  <LinkedValueChip label="E-Mail" value={contactEmail} onRemove={() => onContactEmailChange("")} className="w-full justify-between" />
                ) : (
                  <Input
                    id="detail-contact-email"
                    type="email"
                    value={contactEmail}
                    placeholder="name@beispiel.de"
                    onChange={(event) => onContactEmailChange(event.target.value)}
                    className="h-8"
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold text-muted-foreground shrink-0 w-14" htmlFor="detail-contact-phone">Telefon</Label>
              <div className="flex-1">
                {selectedContactId && contactPhone ? (
                  <LinkedValueChip label="Telefon" value={contactPhone} onRemove={() => onContactPhoneChange("")} className="w-full justify-between" />
                ) : (
                  <Input
                    id="detail-contact-phone"
                    type="tel"
                    value={contactPhone}
                    placeholder="+49 …"
                    onChange={(event) => onContactPhoneChange(event.target.value)}
                    className="h-8"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <p className="font-bold mb-3">Zeitstrahl</p>
            <div className="relative space-y-4 pl-8">
              {timelineEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Einträge im Zeitstrahl.</p>
              ) : (
                <>
                  {timelineEntries.map((entry, index) => {
                    const isLastEntry = index === timelineEntries.length - 1;
                    const isFrist = entry.title === "Frist";

                    const decisionId = entry.id.startsWith("dec-") ? entry.id.slice(4) : null;
                    const decision = decisionId ? (linkedDecisions.find((d) => d.id === decisionId) ?? null) : null;
                    const decisionMeta = decision ? getDecisionIcon(decision) : null;
                    const CircleIcon = decisionMeta ? decisionMeta.icon : entry.icon;

                    const participants = decision?.task_decision_participants || [];
                    const counts = decision ? getDecisionCounts(decision) : null;

                    return (
                      <div key={entry.id} className="relative">
                        {/* Vertical line */}
                        {!isLastEntry && <span className="absolute -left-[17px] top-[12px] bottom-[-16px] w-0.5 bg-border" />}

                        {/* Circle — vertically aligned to the date text */}
                        <span
                          className={cn(
                            "absolute -left-[27px] top-[2px] h-5 w-5 rounded-full flex items-center justify-center",
                            decision ? "bg-background border border-border" : `${entry.accentClass} text-white`,
                          )}
                        >
                          {CircleIcon ? <CircleIcon className={cn("h-3 w-3", decisionMeta?.iconClass)} /> : null}
                        </span>

                        <div className={cn("group py-1 text-xs", decisionId && "cursor-pointer")}
                        >
                          <p className="text-[10px] font-medium text-muted-foreground">
                            {formatTimelineDateOnly(entry.timestamp)}
                            <span className="ml-1.5 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100">{formatTimelineTimeOnly(entry.timestamp)} Uhr</span>
                          </p>

                          <div className="flex items-start justify-between gap-2">
                            {decision ? (
                              <HoverCard openDelay={350} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn("font-bold leading-4 text-left hover:underline")}
                                    onClick={() => openDecision(decisionId!)}
                                  >
                                    {entry.title}
                                  </button>
                                </HoverCardTrigger>

                                <HoverCardContent align="start" className="w-80">
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{decision.title}</p>
                                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                                        {decision.description ? toPlainText(decision.description) : "Keine Beschreibung."}
                                      </p>
                                    </div>

                                    {decision.response_deadline && (
                                      <p className="text-xs text-muted-foreground">
                                        Antwort bis <span className="font-medium text-foreground">{formatDecisionDate(decision.response_deadline)}</span>
                                      </p>
                                    )}

                                    {counts && (
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{counts.responded}</span>/{counts.total} beantwortet · {counts.pending} ausstehend
                                      </div>
                                    )}

                                    {counts && (
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                        {counts.yes > 0 && <span className="text-success">Ja {counts.yes}</span>}
                                        {counts.question > 0 && <span className="text-secondary">Rückfrage {counts.question}</span>}
                                        {counts.no > 0 && <span className="text-destructive">Nein {counts.no}</span>}
                                      </div>
                                    )}

                                    <div className="space-y-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Teilnehmer</p>
                                      {participants.length > 0 ? (
                                        <ul className="space-y-1">
                                          {participants.slice(0, 8).map((p) => (
                                            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                                              <span className="truncate">{teamUsersById.get(p.user_id)?.name || "Unbekannt"}</span>
                                              <span className="text-muted-foreground">{(p.task_decision_responses?.length ?? 0) > 0 ? "beantwortet" : "ausstehend"}</span>
                                            </li>
                                          ))}
                                          {participants.length > 8 && (
                                            <li className="text-xs text-muted-foreground">+{participants.length - 8} weitere…</li>
                                          )}
                                        </ul>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">Keine Teilnehmer.</p>
                                      )}
                                    </div>

                                    <p className="text-[10px] text-muted-foreground">Klick öffnet Details</p>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <p className={cn("font-bold leading-4", isFrist && "text-amber-700 dark:text-amber-400")}>{entry.title}</p>
                            )}

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

                          {entry.safeNoteHtml && (
                            <div className="mt-1 font-normal text-muted-foreground" dangerouslySetInnerHTML={{ __html: entry.safeNoteHtml }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <Collapsible defaultOpen={false} className="rounded-md border bg-background">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left">
                <span className="text-sm font-semibold">Dokumente ({sortedInteractionDocuments.length})</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-3 pb-3">
              {sortedInteractionDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Dokumente vorhanden.</p>
              ) : (
                sortedInteractionDocuments.map((document) => {
                  const isEditing = editingDocumentId === document.id;
                  return (
                    <div key={document.id} className="rounded-md border p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <Input value={editingDocumentTitle} onChange={(event) => setEditingDocumentTitle(event.target.value)} className="h-8" />
                            <Button type="button" size="sm" onClick={saveRenameDocument}>Speichern</Button>
                          </>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="truncate text-sm font-medium text-left" onClick={() => onDownloadDocument(document)}>
                                  {document.title}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm text-xs">
                                <p>Hochgeladen von: {document.uploadedByName || 'Unbekannt'}</p>
                                <p>Upload: {formatTimelineDateOnly(document.uploadedAt)} {formatTimelineTimeOnly(document.uploadedAt)} Uhr</p>
                                {document.documentDate && <p>Dokumentdatum: {formatTimelineDateOnly(document.documentDate)}</p>}
                                {document.shortText && <p>Kurztext: {stripHtml(document.shortText)}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownloadDocument(document)}><Download className="h-3.5 w-3.5" /></Button>
                          {!isEditing && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginRenameDocument(document)}><FileEdit className="h-3.5 w-3.5" /></Button>}
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteDocument(document.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={document.documentDate ? format(new Date(document.documentDate), 'yyyy-MM-dd') : ''}
                          onChange={(event) => onUpdateDocumentMeta(document.id, { documentDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })}
                        />
                        <Input
                          value={document.shortText || ''}
                          placeholder="Kurztext"
                          onChange={(event) => onUpdateDocumentMeta(document.id, { shortText: event.target.value })}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-1.5">
            <Label className="font-bold" htmlFor="detail-due">Fällig am</Label>
            <Input id="detail-due" type="date" value={editableCaseItem.dueAt} onChange={(event) => onUpdate({ dueAt: event.target.value })} />
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
                  <Label className="font-bold" htmlFor="detail-received">Eingangsdatum</Label>
                  <Input id="detail-received" type="date" value={editableCaseItem.sourceReceivedAt} onChange={(event) => onUpdate({ sourceReceivedAt: event.target.value })} />
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
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Öffentlich</Label>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-emerald-600" />
                    <span>{editableCaseItem.visibleToAll ? "Öffentlich" : "Nicht öffentlich"}</span>
                  </div>
                  <Switch checked={editableCaseItem.visibleToAll} onCheckedChange={(checked) => onUpdate({ visibleToAll: checked })} />
                </div>
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

              {/* Verknüpfte Fallakte */}
              {itemCaseFileId && caseFilesById[itemCaseFileId] ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verknüpfte Fallakte</p>
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
                <div className="space-y-3 rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <p>Keine Akte verknüpft.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onCreateCaseFile(itemId)}>Neue Akte anlegen</Button>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

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
          
        </div>

        <div className="space-y-3">
          <div className="rounded-md border bg-background p-3 space-y-2">
            <p className="font-bold">Interaktion erfassen</p>
            <div className="flex flex-wrap gap-2 xl:flex-nowrap">
              {interactionTypeOptions.map((option) => {
                // Special handling for "Entscheidung stellen" button
                if (option.value === "entscheidung") {
                  const OptionIcon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={onDecisionRequest}
                    >
                      <OptionIcon className="mr-1 h-3.5 w-3.5" />
                      {option.label}
                    </Button>
                  );
                }

                // wir wissen hier, dass value eine TimelineInteractionType ist, da wir "entscheidung" abgefangen haben.
                const typeValue = option.value as TimelineInteractionType;
                const selected = editableCaseItem.interactionType === typeValue;
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
                      onUpdate({ interactionType: typeValue });
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
                {editableCaseItem.interactionType === "dokument" && (
                  <DecisionFileUpload
                    mode="creation"
                    canUpload
                    onFilesSelected={(files) => setInteractionFiles(files)}
                  />
                )}
                <Input type="datetime-local" value={editableCaseItem.interactionDateTime} onChange={(event) => onUpdate({ interactionDateTime: event.target.value })} />
                <SimpleRichTextEditor
                  key={editableCaseItem.timelineEvents.length}
                  initialContent={editableCaseItem.interactionNote}
                  onChange={(value) => onUpdate({ interactionNote: value })}
                  placeholder="Kurztext"
                  minHeight="120px"
                  maxHeight="180px"
                  scrollable
                />
                <Button type="button" size="sm" onClick={() => onAddInteraction(interactionFiles)}>Interaktion hinzufügen</Button>
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

      <TaskDecisionDetails
        decisionId={selectedDecisionId}
        isOpen={isDecisionDetailsOpen}
        onClose={() => {
          setIsDecisionDetailsOpen(false);
          setSelectedDecisionId(null);
        }}
      />

      <div className="mt-4 pt-4 border-t border-dashed flex items-center justify-between">
        <Button disabled={!editableCaseItem.category} onClick={onSave}>Speichern</Button>
        <div className="flex items-center gap-2">
          {onArchive && (
            <Button variant="ghost" size="sm" className="hover:bg-muted" onClick={onArchive}>
              <Archive className="mr-2 h-3.5 w-3.5" />
              {archiveLabel || "Archivieren"}
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Vorgang löschen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
