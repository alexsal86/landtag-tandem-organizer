import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Clock, Download, FileEdit, FileText, Gavel, Link2, Loader2, Mail, MessageSquare, Phone, Search, Trash2, Users, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { debugConsole } from "@/utils/debugConsole";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { DecisionFileUpload } from "@/components/task-decisions/DecisionFileUpload";
import type { CaseItemInteractionDocument, EditableCaseItem, TimelineInteractionType, TimelineDocumentAttachment } from "@/components/my-work/hooks/useCaseItemEdit";
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
  actorName?: string;
  isSystem?: boolean;
};

type DetailTab = "overview" | "timeline" | "documents";

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

const captureChipOptions: Array<{ value: TimelineInteractionType; label: string }> = [
  { value: "notiz", label: "Notiz" },
  { value: "anruf", label: "Anruf" },
  { value: "mail", label: "Mail" },
  { value: "treffen", label: "Treffen" },
  { value: "dokument", label: "Dokument" },
];

export function CaseItemDetailPanel({
  itemId,
  editableCaseItem,
  currentUserId,
  linkedDecisions,
  loadingDecisions,
  timelineEntries,
  toEditorHtml,
  onUpdate,
  onSave,
  activeTab,
  onDecisionRequest,
  onDecisionReceived,
  onAddInteraction,
  onDownloadDocument,
  onRenameDocument,
  onDeleteDocument,
  onUpdateDocumentMeta,
  contactDisplay,
  contactPerson,
  contactEmail,
  contactPhone,
  selectedContactId,
  onContactPersonChange,
  onContactEmailChange,
  onContactPhoneChange,
  onContactSelected,
  teamUsers = [],
}: {
  itemId: string;
  editableCaseItem: EditableCaseItem;
  currentUserId: string | null;
  linkedDecisions: LinkedDecision[];
  loadingDecisions: boolean;
  timelineEntries: TimelineEntry[];
  toEditorHtml: (value: string | null | undefined) => string;
  onUpdate: (patch: Partial<EditableCaseItem>) => void;
  onSave: () => void;
  activeTab: DetailTab;
  onDecisionRequest: () => void;
  onDecisionReceived: () => void;
  onAddInteraction: (files?: File[]) => void;
  onDownloadDocument: (document: CaseItemInteractionDocument) => Promise<void> | void;
  onRenameDocument: (documentId: string, title: string) => Promise<void> | void;
  onDeleteDocument: (documentId: string) => Promise<void> | void;
  onUpdateDocumentMeta: (documentId: string, patch: { shortText?: string | null; documentDate?: string | null }) => Promise<void> | void;
  contactDisplay: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  selectedContactId: string | null;
  onContactPersonChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  onContactSelected: (contact: { id: string; name: string; email: string | null; phone: string | null } | null) => void;
  teamUsers?: Array<{ id: string; name: string; avatarUrl: string | null }>;
}) {
  const [activeSection, setActiveSection] = useState<"sachlage" | TimelineInteractionType | "entscheidung">("sachlage");
  const [interactionFiles, setInteractionFiles] = useState<File[]>([]);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocumentTitle, setEditingDocumentTitle] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null; organization: string | null }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const contactSearchRef = useRef(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { currentTenant } = useTenant();

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

  const timelineContent = (
    <div className="px-1 pt-2">
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
                  {!isLastEntry && <span className="absolute -left-[17px] top-[12px] bottom-[-16px] w-0.5 bg-border" />}

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
                      {entry.actorName && <span className="ml-1.5">· {entry.actorName}</span>}
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
                        <p className={cn("font-bold leading-4", isFrist && "text-palette-amber", entry.isSystem && "font-semibold text-muted-foreground")}>{entry.title}</p>
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
  );

  const documentsContent = (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-sm font-semibold">Dokumente ({sortedInteractionDocuments.length})</p>
      {sortedInteractionDocuments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Dokumente vorhanden.</p>
      ) : (
        sortedInteractionDocuments.map((document) => {
          const isEditing = editingDocumentId === document.id;
          return (
            <div key={document.id} className="space-y-2 rounded-md border p-2">
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
                        <button type="button" className="truncate text-left text-sm font-medium" onClick={() => onDownloadDocument(document)}>
                          {document.title}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-xs">
                        <p>Hochgeladen von: {document.uploadedByName || "Unbekannt"}</p>
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
                  value={document.documentDate ? format(new Date(document.documentDate), "yyyy-MM-dd") : ""}
                  onChange={(event) => onUpdateDocumentMeta(document.id, { documentDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })}
                />
                <Input
                  value={document.shortText || ""}
                  placeholder="Kurztext"
                  onChange={(event) => onUpdateDocumentMeta(document.id, { shortText: event.target.value })}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (activeTab === "documents") {
    return (
      <div className="mx-2 mb-3 space-y-4">
        {documentsContent}
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3 space-y-4">
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <div className="space-y-3">
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
          {activeTab === "overview" && <div className="space-y-5 rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Von / Gesprächspartner</h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              <div className="group min-w-0">
                <Label className="text-sm font-normal text-muted-foreground transition-colors group-focus-within:text-success" htmlFor="detail-contact-name">Name</Label>
                <div className="relative mt-1" ref={searchContainerRef}>
                  <Input
                    id="detail-contact-name"
                    value={contactPerson}
                    placeholder={contactDisplay || "Suchen…"}
                    onChange={(event) => {
                      onContactPersonChange(event.target.value);
                      if (selectedContactId) handleClearContact();
                    }}
                    onFocus={() => { if (contactSearchResults.length > 0) setShowSearchResults(true); }}
                    className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 pr-10 text-base shadow-none focus-visible:border-success focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base"
                  />
                  {searchingContacts && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  {!searchingContacts && !selectedContactId && contactPerson.length >= 2 && <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                  {selectedContactId && !searchingContacts && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center rounded p-1 text-muted-foreground hover:text-foreground"
                      onClick={handleClearContact}
                      aria-label="Kontaktverknüpfung entfernen"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  )}
                  {showSearchResults && contactSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
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
              </div>
              <div className="group min-w-0">
                <Label className="text-sm font-normal text-muted-foreground transition-colors group-focus-within:text-success" htmlFor="detail-contact-email">E-Mail</Label>
                <div className="relative mt-1">
                  <Input
                    id="detail-contact-email"
                    type="email"
                    value={contactEmail}
                    placeholder="name@beispiel.de"
                    onChange={(event) => onContactEmailChange(event.target.value)}
                    className={cn("h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base shadow-none focus-visible:border-success focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base", selectedContactId ? "pr-8" : undefined)}
                  />
                  {selectedContactId && (
                    <Link2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="group min-w-0">
                <Label className="text-sm font-normal text-muted-foreground transition-colors group-focus-within:text-success" htmlFor="detail-contact-phone">Telefon</Label>
                <div className="relative mt-1">
                  <Input
                    id="detail-contact-phone"
                    type="tel"
                    value={contactPhone}
                    placeholder="+49 …"
                    onChange={(event) => onContactPhoneChange(event.target.value)}
                    className={cn("h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base shadow-none focus-visible:border-success focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base", selectedContactId ? "pr-8" : undefined)}
                  />
                  {selectedContactId && (
                    <Link2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </div>}

          <div className="overflow-hidden rounded-3xl border bg-background shadow-sm" aria-label="Interaktion erfassen">
            <div className="space-y-3 [&_[data-slot=editor-toolbar]]:bg-background [&_[data-slot=editor-toolbar]]:px-5 [&_[data-slot=editor-toolbar]]:py-3 [&_[contenteditable]]:p-5 [&_[data-slot=editor-placeholder]]:left-5 [&_[data-slot=editor-placeholder]]:top-5">
              {activeSection === "sachlage" ? (
                <SimpleRichTextEditor
                  key={`detail-summary-${itemId}`}
                  initialContent={toEditorHtml(editableCaseItem.summary)}
                  onChange={(html) => onUpdate({ summary: html })}
                  placeholder="Sachlage beschreiben …"
                  seamless
                  minHeight="220px"
                />
              ) : (
                <>
                  {(editableCaseItem.interactionType === "anruf" || editableCaseItem.interactionType === "mail" || editableCaseItem.interactionType === "gespraech" || editableCaseItem.interactionType === "treffen") && (
                    <div className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-[1fr_200px]">
                      <Input
                        className="h-8 text-sm"
                        placeholder={editableCaseItem.interactionType === "mail" ? "E-Mail-Adresse" : editableCaseItem.interactionType === "anruf" ? "Telefonnummer" : "Kontaktperson"}
                        value={editableCaseItem.interactionContact}
                        onChange={(event) => onUpdate({ interactionContact: event.target.value })}
                      />
                      <Input className="h-8 text-sm" type="datetime-local" aria-label="Zeitpunkt" value={editableCaseItem.interactionDateTime} onChange={(event) => onUpdate({ interactionDateTime: event.target.value })} />
                    </div>
                  )}
                  <SimpleRichTextEditor
                    key={`${editableCaseItem.timelineEvents.length}-${activeSection}`}
                    initialContent={editableCaseItem.interactionNote}
                    onChange={(value) => onUpdate({ interactionNote: value })}
                    placeholder="Was ist passiert? Notiz, Anruf, Treffen …"
                    seamless
                    minHeight="180px"
                    maxHeight="320px"
                    scrollable
                  />
                  {editableCaseItem.interactionType === "dokument" && (
                    <DecisionFileUpload mode="creation" canUpload onFilesSelected={(files) => setInteractionFiles(files)} />
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t bg-muted/20 px-4 py-3 sm:px-5">
              <div role="group" aria-label="Art der Interaktion" className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl bg-muted/50 p-1">
                {([{ value: "sachlage", label: "Sachlage" }, ...captureChipOptions] as const).map((option) => {
                  const selected = activeSection === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (option.value === "sachlage") { setActiveSection("sachlage"); return; }
                        onUpdate({ interactionType: option.value });
                        setActiveSection(option.value);
                      }}
                      className={cn(
                        "shrink-0 rounded-xl border px-3 py-2 text-sm transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-1",
                        selected ? "border-success bg-background font-medium text-success shadow-sm" : "border-transparent bg-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {activeSection === "sachlage" ? (
                <span className="ml-auto text-xs text-muted-foreground">Wird mit „Speichern“ übernommen</span>
              ) : (
                <Button type="button" className="ml-auto h-9 rounded-lg bg-success px-5 font-semibold text-success-foreground hover:bg-success/90" onClick={() => onAddInteraction(interactionFiles)}>
                  Erfassen
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {timelineContent}

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
      </div>
    </div>
  );
}
