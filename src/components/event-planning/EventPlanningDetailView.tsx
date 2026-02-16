import { useEffect, useRef, useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Plus, Calendar as CalendarIcon, Trash2, Check, X, Upload, Clock, Edit2, FileText, Download, Archive, Eye, CheckCircle, Info, Mail, Phone } from "lucide-react";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChecklistSection } from "./ChecklistSection";
import { ChecklistItemEmailDialog } from "./ChecklistItemEmailDialog";
import { PlanningDefaultCollaboratorsDialog } from "./PlanningDefaultCollaboratorsDialog";
import { EventRSVPManager } from "../events/EventRSVPManager";
import type { useEventPlanningData } from "./useEventPlanningData";

type EventPlanningDataReturn = ReturnType<typeof useEventPlanningData>;

export function EventPlanningDetailView(data: EventPlanningDataReturn) {
  const [copiedSpeakerContact, setCopiedSpeakerContact] = useState<string | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    newChecklistItem, setNewChecklistItem,
    uploading, generalDocuments,
    itemEmailActions, emailDialogOpen, setEmailDialogOpen,
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
    toggleChecklistItem, updateChecklistItemTitle, addChecklistItem, deleteChecklistItem,
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

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setSelectedPlanning(null)}>← Zurück</Button>
            <h1 className="text-3xl font-bold text-foreground">Veranstaltungsplanung</h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Collaborator avatars */}
            {uniquePlanningCollaborators.length > 0 && (
              <Dialog open={isManageCollaboratorsOpen} onOpenChange={setIsManageCollaboratorsOpen}>
                <DialogTrigger asChild>
                  <div className="flex -space-x-2 cursor-pointer" title="Klicken zum Verwalten der Freigaben">
                    {uniquePlanningCollaborators.slice(0, 5).map((collab) => (
                      <div key={collab.id} className="relative">
                        <Avatar className={cn("h-8 w-8 border-2 hover:z-10 transition-transform hover:scale-110", collab.can_edit ? "border-primary ring-2 ring-primary/20" : "border-muted-foreground/30 opacity-60")}>
                          <AvatarImage src={collab.profiles?.avatar_url} />
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
                          <Avatar className="h-8 w-8"><AvatarImage src={collab.profiles?.avatar_url} /><AvatarFallback>{collab.profiles?.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
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
                            <Avatar className="h-6 w-6"><AvatarImage src={collab.profiles?.avatar_url} /><AvatarFallback>{collab.profiles?.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
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
                        <Avatar className="h-6 w-6"><AvatarImage src={profile.avatar_url} /><AvatarFallback>{profile.display_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
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
              <Button variant={(selectedPlanning as any).is_completed ? "default" : "outline"} className={cn((selectedPlanning as any).is_completed && "bg-green-600 hover:bg-green-700")} onClick={() => togglePlanningCompleted(selectedPlanning.id, !(selectedPlanning as any).is_completed)}>
                <CheckCircle className="mr-2 h-4 w-4" />{(selectedPlanning as any).is_completed ? "Erledigt" : "Als erledigt markieren"}
              </Button>
            )}
            {selectedPlanning.user_id === user?.id && <Button variant="outline" onClick={() => archivePlanning(selectedPlanning.id)}><Archive className="mr-2 h-4 w-4" />Archivieren</Button>}
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Löschen</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Planung löschen</AlertDialogTitle><AlertDialogDescription>Möchten Sie diese Planung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => deletePlanning(selectedPlanning!.id)}>Löschen</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grunddaten */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader><CardTitle>Grunddaten</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titel der Veranstaltung</Label>
                <div className="flex items-center space-x-2">
                  {editingTitle ? (
                    <Input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={() => { updatePlanningField("title", tempTitle); setEditingTitle(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { updatePlanningField("title", tempTitle); setEditingTitle(false); } if (e.key === "Escape") { setTempTitle(selectedPlanning.title); setEditingTitle(false); } }} className="flex-1" autoFocus />
                  ) : (
                    <Input value={selectedPlanning.title} onClick={() => { setTempTitle(selectedPlanning.title); setEditingTitle(true); }} readOnly className="flex-1 cursor-pointer" />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setTempTitle(selectedPlanning.title); setEditingTitle(true); }}><Edit2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea id="description" value={selectedPlanning.description || ""} onChange={(e) => { updatePlanningField("description", e.target.value); const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }} placeholder="Beschreibung der Veranstaltung..." className="min-h-[80px] resize-none overflow-hidden" ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
              </div>
              <div>
                <Label htmlFor="location">Ort</Label>
                <Input id="location" value={selectedPlanning.location || ""} onChange={(e) => updatePlanningField("location", e.target.value)} placeholder="Veranstaltungsort..." />
                {!selectedPlanning.is_digital && (
                  <Button variant="outline" size="sm" onClick={() => { setDigitalEvent({ platform: selectedPlanning.digital_platform || "", link: selectedPlanning.digital_link || "", access_info: selectedPlanning.digital_access_info || "" }); setIsDigitalDialogOpen(true); }} className="mt-2"><Plus className="w-4 h-4 mr-2" />Digital</Button>
                )}
                {selectedPlanning.is_digital && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
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
              <div>
                <Label htmlFor="background">Hintergründe</Label>
                <Textarea id="background" value={selectedPlanning.background_info || ""} onChange={(e) => { updatePlanningField("background_info", e.target.value); const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }} placeholder="Hintergrundinformationen..." className="min-h-[80px] resize-none overflow-hidden" ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
              </div>

              <Separator className="my-4" />

              {/* Termine */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Termine</Label>
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
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
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
                </div>
                <div className="space-y-2">
                  {planningDates.map((date) => (
                    <div key={date.id}>
                      {date.is_confirmed ? (
                        <div className="flex items-center justify-between p-3 rounded-md border bg-primary/10 border-primary">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <input type="datetime-local" value={new Date(date.date_time).toISOString().slice(0, 16)} onChange={(e) => updateConfirmedDate(date.id, new Date(e.target.value).toISOString())} className="bg-transparent border-none outline-none font-medium" />
                            <Badge variant="default">Bestätigt</Badge>
                          </div>
                          <Button variant="ghost" size="sm"><Edit2 className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-md border">
                          <div className="flex items-center space-x-2"><Clock className="h-4 w-4" /><span>{format(new Date(date.date_time), "dd.MM.yyyy HH:mm", { locale: de })}</span></div>
                          <Button size="sm" onClick={() => confirmDate(date.id)}><Check className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {planningDates.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Noch keine Termine hinzugefügt</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Ansprechpersonen */}
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Ansprechpersonen
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
                      <div key={contact.id} className="flex items-center justify-between p-2 rounded-md border">
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
                <CardTitle className="flex items-center justify-between">
                  Referenten
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
                                <button
                                  type="button"
                                  onClick={() => handleCopySpeakerContact(speaker.email!, speaker.id, "email")}
                                  className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60"
                                  title="E-Mail-Adresse kopieren"
                                >
                                  <Mail className="h-4 w-4" />
                                  <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-200 group-hover:max-w-[280px] group-hover:opacity-100 hover:max-w-[280px] hover:opacity-100">
                                    {speaker.email}
                                  </span>
                                  {copiedSpeakerContact === `${speaker.id}-email` && (
                                    <span className="text-xs font-medium text-green-600">Kopiert</span>
                                  )}
                                </button>
                              )}
                              {speaker.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySpeakerContact(speaker.phone!, speaker.id, "phone")}
                                  className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60"
                                  title="Telefonnummer kopieren"
                                >
                                  <Phone className="h-4 w-4" />
                                  <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-200 group-hover:max-w-[280px] group-hover:opacity-100 hover:max-w-[280px] hover:opacity-100">
                                    {speaker.phone}
                                  </span>
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
                <CardTitle className="flex items-center justify-between">
                  Dokumente
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('general-file-upload')?.click()} disabled={uploading}><Upload className="mr-2 h-4 w-4" />Hochladen</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input id="general-file-upload" type="file" multiple className="hidden" onChange={(e) => handleGeneralFileUpload(e.target.files)} />
                <div className="space-y-2">
                  {generalDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2"><FileText className="h-4 w-4" /><span className="text-sm">{doc.file_name}</span>{doc.file_size && <span className="text-xs text-muted-foreground">({(doc.file_size / 1024).toFixed(1)} KB)</span>}</div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => downloadGeneralDocument(doc)}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteGeneralDocument(doc.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {generalDocuments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Noch keine allgemeinen Dokumente hochgeladen</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RSVP Manager - NEU */}
          <div className="lg:col-span-2">
            <EventRSVPManager eventPlanningId={selectedPlanning.id} eventTitle={selectedPlanning.title} />
          </div>

          {/* Checkliste */}
          <ChecklistSection
            checklistItems={checklistItems}
            newChecklistItem={newChecklistItem}
            setNewChecklistItem={setNewChecklistItem}
            onDragEnd={onDragEnd}
            toggleChecklistItem={toggleChecklistItem}
            updateChecklistItemTitle={updateChecklistItemTitle}
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
          />
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
