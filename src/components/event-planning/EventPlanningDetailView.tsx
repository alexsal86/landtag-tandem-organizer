import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Plus, Calendar as CalendarIcon, Trash2, Check, X, Upload, Clock, Edit2, FileText, Download, Archive, Eye, CheckCircle, Info, Mail, Phone, Ellipsis, AlertCircle } from "lucide-react";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistSection } from "./ChecklistSection";
import { ChecklistItemEmailDialog } from "./ChecklistItemEmailDialog";
import { PlanningDefaultCollaboratorsDialog } from "./PlanningDefaultCollaboratorsDialog";
import { EventRSVPManager } from "../events/EventRSVPManager";
import { PlanningTimelineSection } from "./PlanningTimelineSection";
import type { useEventPlanningData } from "./useEventPlanningData";

type EventPlanningDataReturn = ReturnType<typeof useEventPlanningData>;
type ChecklistItemRefMap = Record<string, RefObject<HTMLDivElement | null>>;

export function EventPlanningDetailView(data: EventPlanningDataReturn) {
  const [copiedSpeakerContact, setCopiedSpeakerContact] = useState<string | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState({ accepted: 0, tentative: 0, declined: 0, invited: 0 });
  const [hoveredChecklistItemId, setHoveredChecklistItemId] = useState<string | null>(null);
  const checklistItemRefs = useRef<ChecklistItemRefMap>({});
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerChecklistItemRef = (itemId: string, element: HTMLDivElement | null) => {
    if (!checklistItemRefs.current[itemId]) {
      checklistItemRefs.current[itemId] = { current: null };
    }

    checklistItemRefs.current[itemId].current = element;
  };

  const {
    user, selectedPlanning, setSelectedPlanning,
    planningDates, checklistItems, collaborators, allProfiles,
    contacts, speakers,
    isCollaboratorDialogOpen, setIsCollaboratorDialogOpen,
    isDateDialogOpen, setIsDateDialogOpen,
    isContactDialogOpen, setIsContactDialogOpen,
    isSpeakerDialogOpen, setIsSpeakerDialogOpen,
    isDigitalDialogOpen, setIsDigitalDialogOpen,
    newContact, setNewContact,
    newSpeaker, setNewSpeaker,
    editingContact, setEditingContact,
    editingSpeaker, setEditingSpeaker,
    availableContacts,
    isEditContactDialogOpen, setIsEditContactDialogOpen,
    isEditSpeakerDialogOpen, setIsEditSpeakerDialogOpen,
    digitalEvent, setDigitalEvent,
    editingTitle, setEditingTitle,
    tempTitle, setTempTitle,
    selectedDate, setSelectedDate,
    selectedTime, setSelectedTime,
    newChecklistItem, setNewChecklistItem, newChecklistItemType, setNewChecklistItemType,
    uploading, generalDocuments,
    itemEmailActions, itemSocialPlannerActions, emailDialogOpen, setEmailDialogOpen,
    selectedEmailItemId, setSelectedEmailItemId,
    editingComment, setEditingComment,
    itemSubtasks, itemComments, itemDocuments,
    showItemSubtasks, setShowItemSubtasks,
    showItemComments, setShowItemComments,
    showItemDocuments, setShowItemDocuments,
    completingSubtask, setCompletingSubtask,
    completionResult, setCompletionResult,
    isManageCollaboratorsOpen, setIsManageCollaboratorsOpen,
    showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog,
    updatePlanningField, deletePlanning,
    addPlanningDate, confirmDate, updateConfirmedDate,
    toggleChecklistItem, updateChecklistItemTitle, updateChecklistItemColor, addChecklistItem, deleteChecklistItem,
    addCollaborator, updateCollaboratorPermission, removeCollaborator,
    addContact, removeContact, editContact,
    addSpeaker, removeSpeaker, editSpeaker,
    fillFromContact, fillFromProfile, fillSpeakerFromContact,
    updateDigitalEventSettings, removeDigitalEventSettings,
    handleGeneralFileUpload, downloadGeneralDocument, deleteGeneralDocument,
    onDragEnd, addItemSubtask, addItemCommentForItem,
    handleItemFileUpload, deleteItemDocument, downloadItemDocument,
    deleteItemComment, handleSubtaskComplete, updateItemComment,
    loadItemSubtasks, loadAllItemCounts,
    archivePlanning, togglePlanningCompleted,
    toggleSubItem, updateSubItemTitle, removeSubItem,
    fetchPlanningDetails, fetchEmailActions,
    timelineAssignments, upsertTimelineAssignment: saveTimelineAssignment, removeTimelineAssignment: deleteTimelineAssignment,
  } = data;

  if (!selectedPlanning) return null;

  const planningCollaborators = collaborators.filter(
    (collab) => collab.event_planning_id === selectedPlanning.id,
  );
  const uniquePlanningCollaborators = Array.from(
    new Map(planningCollaborators.map((collab) => [collab.user_id, collab])).values(),
  );
  const availableProfilesToAdd = allProfiles.filter(
    (profile) =>
      profile.user_id !== selectedPlanning.user_id &&
      !uniquePlanningCollaborators.some((collab) => collab.user_id === profile.user_id),
  );

  const handleCopySpeakerContact = async (value: string, speakerId: string, field: "email" | "phone") => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedSpeakerContact(`${speakerId}-${field}`);

      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopiedSpeakerContact(null);
      }, 1800);
    } catch {
      setCopiedSpeakerContact(null);
    }
  };

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const loadRsvpCounts = async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("status")
        .eq("event_planning_id", selectedPlanning.id);

      if (error) {
        return;
      }

      const counts = { accepted: 0, tentative: 0, declined: 0, invited: 0 };
      (data || []).forEach((entry) => {
        if (entry.status === "accepted") counts.accepted += 1;
        else if (entry.status === "tentative") counts.tentative += 1;
        else if (entry.status === "declined") counts.declined += 1;
        else counts.invited += 1;
      });
      setRsvpCounts(counts);
    };

    void loadRsvpCounts();
  }, [selectedPlanning.id]);


  const handleUpsertTimelineAssignment = (item: { id: string; title: string }, dueDate: string) => {
    const parsedDate = new Date(dueDate);
    if (Number.isNaN(parsedDate.getTime())) {
      window.alert("Ungültiges Datum. Bitte Format YYYY-MM-DD nutzen.");
      return false;
    }

    const normalizedDate = format(parsedDate, "yyyy-MM-dd");
    void saveTimelineAssignment(item.id, normalizedDate);

    return true;
  };

  const handleSetTimelineDueDate = (item: { id: string; title: string }, dueDate: string) => {
    if (!dueDate) {
      handleRemoveTimelineAssignment(item.id);
      return;
    }

    handleUpsertTimelineAssignment(item, dueDate);
  };

  const handleDropChecklistItemOnTimeline = (item: { id: string; title: string }) => {
    const existing = timelineAssignments.find((assignment) => assignment.checklist_item_id === item.id);
    const defaultDate = existing?.due_date ? existing.due_date.slice(0, 10) : format(new Date(), "yyyy-MM-dd");
    const dueDateInput = window.prompt(`Frist für "${item.title}" (YYYY-MM-DD):`, defaultDate);

    if (!dueDateInput) {
      return;
    }

    handleUpsertTimelineAssignment(item, dueDateInput);
  };

  const handleRemoveTimelineAssignment = (checklistItemId: string) => {
    void deleteTimelineAssignment(checklistItemId);
  };

  const timelineDueDates = useMemo(() => {
    return Object.fromEntries(timelineAssignments.map((assignment) => [assignment.checklist_item_id, assignment.due_date]));
  }, [timelineAssignments]);

  const handleAddPhaseItem = async (title: string) => {
    if (!selectedPlanning) return;
    const maxOrder = Math.max(...checklistItems.map(item => item.order_index), -1);
    const itemId = crypto.randomUUID();
    await supabase
      .from("event_planning_checklist_items")
      .insert([{ id: itemId, event_planning_id: selectedPlanning.id, title, order_index: maxOrder + 1, type: "phase_start", is_completed: false, color: "#65a30d" }]);
    fetchPlanningDetails(selectedPlanning.id);
  };

  const handlePlanningDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    if (result.destination.droppableId === "planning-timeline") {
      const draggedItem = checklistItems.find((item) => item.id === result.draggableId);
      if (draggedItem) {
        handleDropChecklistItemOnTimeline({ id: draggedItem.id, title: draggedItem.title });
      }
      return;
    }

    if (result.destination.droppableId === "checklist") {
      onDragEnd(result);
    }
  };

  const sectionTitleClassName = "text-xl font-semibold tracking-tight text-foreground";
  const fieldLabelClassName = "text-sm font-semibold text-foreground";
  const confirmedPlanningDate = planningDates.find((date) => date.is_confirmed)?.date_time ?? selectedPlanning.confirmed_date ?? null;
  const headerDateLabel = confirmedPlanningDate
    ? format(new Date(confirmedPlanningDate), "dd.MM.yyyy", { locale: de })
    : "Termin offen";
  const headerTimeLabel = confirmedPlanningDate
    ? `${format(new Date(confirmedPlanningDate), "HH:mm", { locale: de })} Uhr`
    : "Uhrzeit offen";
  const participantStats = [
    { label: "Zugesagt", count: rsvpCounts.accepted, icon: CheckCircle, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Vorbehalt", count: rsvpCounts.tentative, icon: AlertCircle, tone: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Abgesagt", count: rsvpCounts.declined, icon: X, tone: "bg-rose-50 text-rose-700 border-rose-200" },
    { label: "Ausstehend", count: rsvpCounts.invited, icon: Clock, tone: "bg-slate-50 text-slate-700 border-slate-200" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
            <div className="flex items-start gap-4 xl:min-w-0">
              <Button variant="ghost" onClick={() => setSelectedPlanning(null)}>← Zurück</Button>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-foreground">{selectedPlanning.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {headerDateLabel}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {headerTimeLabel}
                  </span>
                </div>
              </div>
            </div>

            <TooltipProvider>
              <div className="flex flex-wrap gap-2 xl:flex-1 xl:justify-center xl:self-center">
                {participantStats.map(({ label, count, icon: Icon, tone }) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex h-12 w-12 cursor-default flex-col items-center justify-center rounded-full border text-center shadow-sm",
                          tone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-sm font-semibold leading-none">{count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {/* Collaborator avatars */}
            {uniquePlanningCollaborators.length > 0 && (
              <Dialog open={isManageCollaboratorsOpen} onOpenChange={setIsManageCollaboratorsOpen}>
                <DialogTrigger asChild>
                  <div className="flex -space-x-2 cursor-pointer" title="Klicken zum Verwalten der Freigaben">
                    {uniquePlanningCollaborators.slice(0, 5).map((collab) => (
                      <div key={collab.id} className="relative">
                        <Avatar className={cn("h-8 w-8 border-2 hover:z-10 transition-transform hover:scale-110", collab.can_edit ? "border-primary ring-2 ring-primary/20" : "border-muted-foreground/30 opacity-60")}>
                          <AvatarImage src={collab.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className={collab.can_edit ? "bg-primary/10" : "bg-muted"}>{collab.profiles?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        {!collab.can_edit && <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5"><Eye className="h-3 w-3 text-muted-foreground" /></div>}
                      </div>
                    ))}
                    {uniquePlanningCollaborators.length > 5 && <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback>+{uniquePlanningCollaborators.length - 5}</AvatarFallback></Avatar>}
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Freigaben verwalten</DialogTitle>
                    <DialogDescription>Berechtigungen ändern oder Mitarbeiter entfernen.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {uniquePlanningCollaborators.map((collab) => (
                      <div key={collab.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8"><AvatarImage src={collab.profiles?.avatar_url ?? undefined} /><AvatarFallback>{collab.profiles?.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                          <span className="font-medium">{collab.profiles?.display_name || 'Unbenannt'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={collab.can_edit ? "edit" : "view"} onValueChange={(value) => updateCollaboratorPermission(collab.id, value === "edit")}>
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view"><div className="flex items-center gap-2"><Eye className="h-4 w-4" />Nur ansehen</div></SelectItem>
                              <SelectItem value="edit"><div className="flex items-center gap-2"><Edit2 className="h-4 w-4" />Bearbeiten</div></SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" onClick={() => removeCollaborator(collab.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                    {uniquePlanningCollaborators.length === 0 && <p className="text-center text-muted-foreground py-4">Noch keine Mitarbeiter freigegeben.</p>}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Add collaborator */}
            <Dialog open={isCollaboratorDialogOpen} onOpenChange={setIsCollaboratorDialogOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Mitarbeiter</Button></DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Mitarbeiter hinzufügen</DialogTitle><DialogDescription>Wählen Sie Mitarbeiter aus der Liste aus.</DialogDescription></DialogHeader>
                <div className="space-y-2">
                  {uniquePlanningCollaborators.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Bereits freigegeben:</p>
                      {uniquePlanningCollaborators.map((collab) => (
                        <div key={collab.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6"><AvatarImage src={collab.profiles?.avatar_url ?? undefined} /><AvatarFallback>{collab.profiles?.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                            <span>{collab.profiles?.display_name || 'Unbenannt'}</span>
                          </div>
                          <Badge variant={collab.can_edit ? "default" : "secondary"}>{collab.can_edit ? "Bearbeiten" : "Nur ansehen"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableProfilesToAdd.length > 0 && <p className="text-sm font-medium text-muted-foreground mb-2">Hinzufügen:</p>}
                  {availableProfilesToAdd.map((profile) => (
                    <div key={profile.user_id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarImage src={profile.avatar_url ?? undefined} /><AvatarFallback>{profile.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                        <span>{profile.display_name || 'Unbenannt'}</span>
                      </div>
                      <div className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => addCollaborator(profile.user_id, false)}>Nur ansehen</Button>
                        <Button size="sm" onClick={() => addCollaborator(profile.user_id, true)}>Bearbeiten</Button>
                      </div>
                    </div>
                  ))}
                  {availableProfilesToAdd.length === 0 && uniquePlanningCollaborators.length === 0 && <p className="text-center text-muted-foreground py-4">Keine Mitarbeiter verfügbar.</p>}
                </div>
              </DialogContent>
            </Dialog>

            {(selectedPlanning.user_id === user?.id || uniquePlanningCollaborators.some(c => c.user_id === user?.id && c.can_edit)) && (
              <Button variant={selectedPlanning.is_completed ? "default" : "outline"} className={cn(selectedPlanning.is_completed && "bg-green-600 hover:bg-green-700")} onClick={() => togglePlanningCompleted(selectedPlanning.id, !selectedPlanning.is_completed)}>
                <CheckCircle className="mr-2 h-4 w-4" />{selectedPlanning.is_completed ? "Erledigt" : "Als erledigt markieren"}
              </Button>
            )}
            {selectedPlanning.user_id === user?.id && (
              <AlertDialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Weitere Aktionen">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => archivePlanning(selectedPlanning.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archivieren
                    </DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(event) => event.preventDefault()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Löschen
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Planung löschen</AlertDialogTitle><AlertDialogDescription>Möchten Sie diese Planung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => deletePlanning(selectedPlanning!.id)}>Löschen</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
          <div className="space-y-6 lg:min-w-0">
            {/* Grunddaten */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className={sectionTitleClassName}>Grunddaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className={fieldLabelClassName}>Titel der Veranstaltung</Label>
                  <Input
                    id="title"
                    value={editingTitle ? tempTitle : selectedPlanning.title}
                    onChange={(e) => editingTitle && setTempTitle(e.target.value)}
                    onFocus={() => {
                      if (!editingTitle) {
                        setTempTitle(selectedPlanning.title);
                        setEditingTitle(true);
                      }
                    }}
                    onBlur={() => {
                      if (editingTitle) {
                        updatePlanningField("title", tempTitle);
                        setEditingTitle(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updatePlanningField("title", tempTitle);
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") {
                        setTempTitle(selectedPlanning.title);
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className={fieldLabelClassName}>Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={selectedPlanning.description || ""}
                    onChange={(e) => {
                      updatePlanningField("description", e.target.value);
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                    placeholder="Beschreibung der Veranstaltung..."
                    className="min-h-[96px] resize-none overflow-hidden"
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="background" className={fieldLabelClassName}>Hintergründe</Label>
                    <Textarea
                      id="background"
                      value={selectedPlanning.background_info || ""}
                      onChange={(e) => {
                        updatePlanningField("background_info", e.target.value);
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                      placeholder="Hintergrundinformationen..."
                      className="min-h-[96px] resize-none overflow-hidden"
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className={fieldLabelClassName}>Veranstaltungsort</Label>
                    <Input id="location" value={selectedPlanning.location || ""} onChange={(e) => updatePlanningField("location", e.target.value)} placeholder="Veranstaltungsort..." />
                    {!selectedPlanning.is_digital && (
                      <Button variant="outline" size="sm" onClick={() => { setDigitalEvent({ platform: selectedPlanning.digital_platform || "", link: selectedPlanning.digital_link || "", access_info: selectedPlanning.digital_access_info || "" }); setIsDigitalDialogOpen(true); }} className="mt-2"><Plus className="w-4 h-4 mr-2" />Digital</Button>
                    )}
                    {selectedPlanning.is_digital && (
                      <div className="mt-2 rounded-md bg-muted p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Digital: {selectedPlanning.digital_platform}</p>
                            {selectedPlanning.digital_link && <p className="text-xs text-muted-foreground">{selectedPlanning.digital_link}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setDigitalEvent({ platform: selectedPlanning.digital_platform || "", link: selectedPlanning.digital_link || "", access_info: selectedPlanning.digital_access_info || "" }); setIsDigitalDialogOpen(true); }}><Edit2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={removeDigitalEventSettings}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RSVP Manager */}
            <div id="rsvp-manager" className="scroll-mt-24">
              <EventRSVPManager eventPlanningId={selectedPlanning.id} eventTitle={selectedPlanning.title} />
            </div>
          </div>

          <div className="space-y-6 lg:min-w-0">
            {/* Termine */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className={cn(sectionTitleClassName, "flex items-center justify-between gap-3")}>
                  <span>Termine</span>
                  {!planningDates.some(d => d.is_confirmed) && (
                    <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Termin hinzufügen</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Neuen Termin hinzufügen</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Datum</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="pointer-events-auto" /></PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2"><Label htmlFor="time">Uhrzeit</Label><TimePickerCombobox value={selectedTime} onChange={setSelectedTime} /></div>
                        </div>
                        <DialogFooter><Button onClick={addPlanningDate}>Hinzufügen</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {planningDates.map((date) => (
                    <div key={date.id}>
                      {date.is_confirmed ? (
                        <div className="flex flex-col gap-3 rounded-md border border-primary bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Clock className="h-4 w-4" />
                            <input
                              type="datetime-local"
                              value={new Date(date.date_time).toISOString().slice(0, 16)}
                              onChange={(e) => updateConfirmedDate(date.id, new Date(e.target.value).toISOString())}
                              className="min-w-0 max-w-full rounded-md border border-primary/30 bg-background/80 px-3 py-2 text-sm font-medium outline-none"
                            />
                            <Badge variant="default">Bestätigt</Badge>
                          </div>
                          <Button variant="ghost" size="sm"><Edit2 className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center space-x-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span className="break-words">{format(new Date(date.date_time), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                          </div>
                          <Button size="sm" onClick={() => confirmDate(date.id)}><Check className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {planningDates.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">Noch keine Termine hinzugefügt</p>}
                </div>
              </CardContent>
            </Card>

            {/* Ansprechperson */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className={cn(sectionTitleClassName, "flex items-center justify-between gap-3")}>
                  <span>Ansprechperson</span>
                  <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Ansprechperson</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Ansprechperson hinzufügen</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Aus vorhandenen Kontakten</Label>
                          <Select onValueChange={(v) => { if (v !== "none") fillFromContact(v); }}><SelectTrigger><SelectValue placeholder="Kontakt auswählen..." /></SelectTrigger><SelectContent><SelectItem value="none">Manuell eingeben</SelectItem>{availableContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div>
                          <Label>Aus Team-Mitgliedern</Label>
                          <Select onValueChange={(v) => { if (v !== "none") fillFromProfile(v); }}><SelectTrigger><SelectValue placeholder="Team-Mitglied auswählen..." /></SelectTrigger><SelectContent><SelectItem value="none">Manuell eingeben</SelectItem>{allProfiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || 'Unbenannt'}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <Separator />
                        <div><Label>Name</Label><Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Name" /></div>
                        <div><Label>E-Mail</Label><Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="email@beispiel.de" /></div>
                        <div><Label>Telefon</Label><Input type="tel" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="+49 123 456789" /></div>
                      </div>
                      <DialogFooter><Button onClick={addContact}>Hinzufügen</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between rounded-md border p-3">
                        <div><p className="font-medium">{contact.name}</p><div className="text-sm text-muted-foreground">{contact.email && <p>📧 {contact.email}</p>}{contact.phone && <p>📞 {contact.phone}</p>}</div></div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingContact(contact); setIsEditContactDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => removeContact(contact.id)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<p className="text-sm text-muted-foreground">Noch keine Ansprechpersonen hinzugefügt</p>)}
              </CardContent>
              <Dialog open={isEditContactDialogOpen} onOpenChange={setIsEditContactDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Ansprechperson bearbeiten</DialogTitle></DialogHeader>
                  {editingContact && (
                    <div className="space-y-4">
                      <div><Label>Name</Label><Input value={editingContact.name} onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })} /></div>
                      <div><Label>E-Mail</Label><Input type="email" value={editingContact.email || ""} onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })} /></div>
                      <div><Label>Telefon</Label><Input type="tel" value={editingContact.phone || ""} onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })} /></div>
                    </div>
                  )}
                  <DialogFooter><Button variant="outline" onClick={() => setIsEditContactDialogOpen(false)}>Abbrechen</Button><Button onClick={editContact}>Speichern</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>

            {/* Referenten */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className={cn(sectionTitleClassName, "flex items-center justify-between gap-3")}>
                  <span>Referenten</span>
                  <Dialog open={isSpeakerDialogOpen} onOpenChange={setIsSpeakerDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Referent</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Referent hinzufügen</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>Aus Kontakten</Label><Select onValueChange={(v) => { if (v !== "none") fillSpeakerFromContact(v); }}><SelectTrigger><SelectValue placeholder="Kontakt auswählen..." /></SelectTrigger><SelectContent><SelectItem value="none">Manuell eingeben</SelectItem>{availableContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                        <Separator />
                        <div><Label>Name</Label><Input value={newSpeaker.name} onChange={(e) => setNewSpeaker({ ...newSpeaker, name: e.target.value })} placeholder="Name" /></div>
                        <div><Label>Thema</Label><Input value={newSpeaker.topic} onChange={(e) => setNewSpeaker({ ...newSpeaker, topic: e.target.value })} placeholder="Vortragsthema" /></div>
                        <div><Label>E-Mail</Label><Input type="email" value={newSpeaker.email} onChange={(e) => setNewSpeaker({ ...newSpeaker, email: e.target.value })} placeholder="email@beispiel.de" /></div>
                        <div><Label>Telefon</Label><Input type="tel" value={newSpeaker.phone} onChange={(e) => setNewSpeaker({ ...newSpeaker, phone: e.target.value })} placeholder="+49 123 456789" /></div>
                        <div><Label>Biografie</Label><Textarea value={newSpeaker.bio} onChange={(e) => setNewSpeaker({ ...newSpeaker, bio: e.target.value })} placeholder="Kurze Biografie" /></div>
                      </div>
                      <DialogFooter><Button onClick={addSpeaker}>Hinzufügen</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {speakers.length > 0 ? (
                  <div className="space-y-3">
                    {speakers.map((speaker, index) => (
                      <div key={speaker.id} className="group flex items-start justify-between rounded-md bg-muted/10 p-3">
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-foreground">Referent {index + 1}</p>
                          <p className="font-medium text-foreground">{speaker.name}</p>

                          {speaker.bio && (
                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Info className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{speaker.bio}</span>
                            </p>
                          )}

                          {speaker.topic && (
                            <p className="text-sm font-medium text-foreground">
                              Thema: {speaker.topic}
                            </p>
                          )}

                          {(speaker.email || speaker.phone) && (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-muted-foreground">
                              {speaker.email && (
                                <button type="button" onClick={() => handleCopySpeakerContact(speaker.email!, speaker.id, "email")} className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60" title="E-Mail-Adresse kopieren">
                                  <Mail className="h-4 w-4" />
                                  <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-200 group-hover:max-w-[280px] group-hover:opacity-100 hover:max-w-[280px] hover:opacity-100">{speaker.email}</span>
                                  {copiedSpeakerContact === `${speaker.id}-email` && (
                                    <span className="text-xs font-medium text-green-600">Kopiert</span>
                                  )}
                                </button>
                              )}
                              {speaker.phone && (
                                <button type="button" onClick={() => handleCopySpeakerContact(speaker.phone!, speaker.id, "phone")} className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60" title="Telefonnummer kopieren">
                                  <Phone className="h-4 w-4" />
                                  <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-200 group-hover:max-w-[280px] group-hover:opacity-100 hover:max-w-[280px] hover:opacity-100">{speaker.phone}</span>
                                  {copiedSpeakerContact === `${speaker.id}-phone` && (
                                    <span className="text-xs font-medium text-green-600">Kopiert</span>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingSpeaker(speaker); setIsEditSpeakerDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => removeSpeaker(speaker.id)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<p className="text-sm text-muted-foreground">Noch keine Referenten hinzugefügt</p>)}
              </CardContent>
              <Dialog open={isEditSpeakerDialogOpen} onOpenChange={setIsEditSpeakerDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Referent bearbeiten</DialogTitle></DialogHeader>
                  {editingSpeaker && (
                    <div className="space-y-4">
                      <div><Label>Name</Label><Input value={editingSpeaker.name} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })} /></div>
                      <div><Label>Thema</Label><Input value={editingSpeaker.topic || ""} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, topic: e.target.value })} /></div>
                      <div><Label>E-Mail</Label><Input type="email" value={editingSpeaker.email || ""} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, email: e.target.value })} /></div>
                      <div><Label>Telefon</Label><Input type="tel" value={editingSpeaker.phone || ""} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, phone: e.target.value })} /></div>
                      <div><Label>Biografie</Label><Textarea value={editingSpeaker.bio || ""} onChange={(e) => setEditingSpeaker({ ...editingSpeaker, bio: e.target.value })} /></div>
                    </div>
                  )}
                  <DialogFooter><Button variant="outline" onClick={() => setIsEditSpeakerDialogOpen(false)}>Abbrechen</Button><Button onClick={editSpeaker}>Speichern</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>

            {/* Dokumente */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className={cn(sectionTitleClassName, "flex items-center justify-between gap-3")}>
                  <span>Dokumente</span>
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('general-file-upload')?.click()} disabled={uploading}><Upload className="mr-2 h-4 w-4" />Hochladen</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input id="general-file-upload" type="file" multiple className="hidden" onChange={(e) => handleGeneralFileUpload(e.target.files)} />
                <div className="space-y-2">
                  {generalDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                      <div className="flex items-center space-x-2"><FileText className="h-4 w-4" /><span className="text-sm">{doc.file_name}</span>{doc.file_size && <span className="text-xs text-muted-foreground">({(doc.file_size / 1024).toFixed(1)} KB)</span>}</div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => downloadGeneralDocument(doc)}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteGeneralDocument(doc.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {generalDocuments.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Noch keine allgemeinen Dokumente hochgeladen</p>}
                </div>
              </CardContent>
            </Card>
          </div>
          <DragDropContext onDragEnd={handlePlanningDragEnd}>
            <div className="lg:col-span-2 grid gap-6 lg:grid-cols-2">
              {/* Checkliste */}
              <ChecklistSection
                checklistItems={checklistItems}
                newChecklistItem={newChecklistItem}
                setNewChecklistItem={setNewChecklistItem}
                newChecklistItemType={newChecklistItemType}
                setNewChecklistItemType={setNewChecklistItemType}
                toggleChecklistItem={toggleChecklistItem}
                updateChecklistItemTitle={updateChecklistItemTitle}
                updateChecklistItemColor={updateChecklistItemColor}
                addChecklistItem={addChecklistItem}
                deleteChecklistItem={deleteChecklistItem}
                itemSubtasks={itemSubtasks}
                itemComments={itemComments}
                itemDocuments={itemDocuments}
                showItemSubtasks={showItemSubtasks}
                setShowItemSubtasks={setShowItemSubtasks}
                showItemComments={showItemComments}
                setShowItemComments={setShowItemComments}
                showItemDocuments={showItemDocuments}
                setShowItemDocuments={setShowItemDocuments}
                allProfiles={allProfiles}
                user={user}
                uploading={uploading}
                itemEmailActions={itemEmailActions}
                itemSocialPlannerActions={itemSocialPlannerActions}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
                addItemSubtask={addItemSubtask}
                addItemCommentForItem={addItemCommentForItem}
                handleItemFileUpload={handleItemFileUpload}
                deleteItemDocument={deleteItemDocument}
                downloadItemDocument={downloadItemDocument}
                deleteItemComment={deleteItemComment}
                updateItemComment={updateItemComment}
                setCompletingSubtask={setCompletingSubtask}
                setCompletionResult={setCompletionResult}
                loadItemSubtasks={loadItemSubtasks}
                loadAllItemCounts={loadAllItemCounts}
                setEmailDialogOpen={setEmailDialogOpen}
                setSelectedEmailItemId={setSelectedEmailItemId}
                toggleSubItem={toggleSubItem}
                updateSubItemTitle={updateSubItemTitle}
                removeSubItem={removeSubItem}
                timelineDueDates={timelineDueDates}
                onSetTimelineDueDate={handleSetTimelineDueDate}
                registerChecklistItemRef={registerChecklistItemRef}
                hoveredChecklistItemId={hoveredChecklistItemId}
                onHoverItem={setHoveredChecklistItemId}
                onUnhoverItem={() => setHoveredChecklistItemId(null)}
                addPhaseItem={handleAddPhaseItem}
              />

              <PlanningTimelineSection
                planningCreatedAt={selectedPlanning.created_at}
                planningDates={planningDates}
                checklistItems={checklistItems}
                assignments={timelineAssignments}
                onRemoveAssignment={handleRemoveTimelineAssignment}
                checklistItemRefs={checklistItemRefs.current}
                highlightedChecklistItemId={hoveredChecklistItemId}
              />
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Result Dialog for Subtasks */}
      <Dialog open={!!completingSubtask} onOpenChange={() => setCompletingSubtask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unteraufgabe abschließen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Wie wurde die Unteraufgabe gelöst?</Label><Textarea placeholder="Beschreiben Sie, wie die Unteraufgabe erledigt wurde..." value={completionResult} onChange={(e) => setCompletionResult(e.target.value)} className="mt-2" rows={4} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCompletingSubtask(null); setCompletionResult(''); }}>Abbrechen</Button>
              <Button onClick={() => {
                if (completingSubtask) {
                  const parentItemId = Object.keys(itemSubtasks).find(itemId => itemSubtasks[itemId].some(subtask => subtask.id === completingSubtask));
                  if (parentItemId) { handleSubtaskComplete(completingSubtask, true, completionResult, parentItemId); setCompletingSubtask(null); setCompletionResult(''); }
                }
              }} disabled={!completionResult.trim()}>Als erledigt markieren</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Digital Event Dialog */}
      <Dialog open={isDigitalDialogOpen} onOpenChange={setIsDigitalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Digitale Veranstaltung einrichten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Plattform</Label><Input value={digitalEvent.platform} onChange={(e) => setDigitalEvent({ ...digitalEvent, platform: e.target.value })} placeholder="z.B. Zoom, Microsoft Teams" /></div>
            <div><Label>Meeting-Link</Label><Input value={digitalEvent.link} onChange={(e) => setDigitalEvent({ ...digitalEvent, link: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Einwahldaten</Label><Textarea value={digitalEvent.access_info} onChange={(e) => setDigitalEvent({ ...digitalEvent, access_info: e.target.value })} placeholder="Meeting-ID, Passwort etc." /></div>
          </div>
          <DialogFooter><Button onClick={updateDigitalEventSettings}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      {selectedEmailItemId && (
        <ChecklistItemEmailDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} checklistItemId={selectedEmailItemId}
          checklistItemTitle={checklistItems.find((item) => item.id === selectedEmailItemId)?.title || ""}
          onSaved={() => { if (selectedPlanning) fetchEmailActions(selectedPlanning.id); }} />
      )}

      {/* Default Collaborators Dialog */}
      <PlanningDefaultCollaboratorsDialog open={showDefaultCollaboratorsDialog} onOpenChange={setShowDefaultCollaboratorsDialog} />
    </div>
  );
}
