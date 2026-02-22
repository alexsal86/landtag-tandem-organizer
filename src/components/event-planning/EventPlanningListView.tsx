import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserBadge } from "@/components/ui/user-badge";
import { getHashedColor } from "@/utils/userColors";
import { NewItemIndicator } from "../NewItemIndicator";
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Archive, Grid, List, Users, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PlanningDefaultCollaboratorsDialog } from "./PlanningDefaultCollaboratorsDialog";
import { EventPlanningTable } from "./EventPlanningTable";
import { AppointmentPreparationTable } from "./AppointmentPreparationTable";
import type { useEventPlanningData } from "./useEventPlanningData";

type EventPlanningDataReturn = ReturnType<typeof useEventPlanningData>;

export function EventPlanningListView(data: EventPlanningDataReturn) {
  const {
    user, plannings, collaborators, allProfiles,
    isCreateDialogOpen, setIsCreateDialogOpen,
    newPlanningTitle, setNewPlanningTitle,
    newPlanningIsPrivate, setNewPlanningIsPrivate,
    selectedTemplateId, setSelectedTemplateId,
    planningTemplates,
    eventPlanningView, appointmentPreparationView,
    showPlanningArchive, setShowPlanningArchive,
    archivedPlannings, showArchived, setShowArchived,
    appointmentPreparations, archivedPreparations,
    showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog,
    isItemNew, setSelectedPlanning,
    saveViewPreferences, fetchArchivedPlannings,
    archivePlanning, togglePlanningCompleted, restorePlanning,
    archivePreparation, handlePreparationClick, createPlanning,
  } = data;

  const { isHighlighted, highlightRef } = useNotificationHighlight();

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setShowDefaultCollaboratorsDialog(true)}>
              <Users className="h-4 w-4 mr-2" />Standard-Mitarbeiter
            </Button>
            <Dialog open={showPlanningArchive} onOpenChange={(open) => { setShowPlanningArchive(open); if (open) fetchArchivedPlannings().catch(err => console.error('Failed to fetch archived plannings:', err)); }}>
              <DialogTrigger asChild>
                <Button variant={showPlanningArchive ? "default" : "outline"} size="sm"><Archive className="h-4 w-4 mr-2" />Archiv</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Archivierte Veranstaltungsplanungen</DialogTitle>
                  <DialogDescription>Hier finden Sie alle archivierten Planungen. Sie können diese wiederherstellen.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {archivedPlannings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Archive className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground text-sm">Keine archivierten Planungen vorhanden.</p>
                    </div>
                  ) : (
                    archivedPlannings.map((planning) => (
                      <div key={planning.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{planning.title}</h4>
                          {planning.description && <p className="text-sm text-muted-foreground line-clamp-1">{planning.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Erstellt: {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => restorePlanning(planning.id)}>Wiederherstellen</Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <div className="flex items-center border rounded-lg p-1">
              <Button variant={eventPlanningView === 'card' ? 'default' : 'ghost'} size="sm" onClick={() => saveViewPreferences('event', 'card')} className="h-8 px-2"><Grid className="h-4 w-4" /></Button>
              <Button variant={eventPlanningView === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => saveViewPreferences('event', 'table')} className="h-8 px-2"><List className="h-4 w-4" /></Button>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Neue Planung</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Neue Veranstaltungsplanung</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label htmlFor="title">Titel</Label><Input id="title" value={newPlanningTitle} onChange={(e) => setNewPlanningTitle(e.target.value)} placeholder="Veranstaltungstitel eingeben..." /></div>
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Template auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Template</SelectItem>
                        {planningTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="private" checked={newPlanningIsPrivate} onCheckedChange={setNewPlanningIsPrivate} />
                    <Label htmlFor="private">Nur für mich sichtbar</Label>
                  </div>
                </div>
                <DialogFooter><Button onClick={createPlanning}>Erstellen</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {eventPlanningView === 'card' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plannings.map((planning) => {
              const planningCollaborators = collaborators.filter(c => c.event_planning_id === planning.id);
              const creatorProfile = allProfiles.find(p => p.user_id === planning.user_id);
              
              return (
                <Card key={planning.id} ref={highlightRef(planning.id)} className={cn("cursor-pointer hover:shadow-lg transition-shadow flex flex-col relative", (planning as any).is_completed && "opacity-60", isHighlighted(planning.id) && "notification-highlight")} onClick={() => setSelectedPlanning(planning)}>
                  <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} />
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className={cn("truncate cursor-pointer", (planning as any).is_completed && "line-through text-muted-foreground")}>{planning.title}</span>
                      <div className="flex items-center gap-1">
                        {(planning.user_id === user?.id || collaborators.some(c => c.event_planning_id === planning.id && c.user_id === user?.id && c.can_edit)) && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn("h-7 w-7", (planning as any).is_completed && "text-green-600")}
                              onClick={(e) => { e.stopPropagation(); togglePlanningCompleted(planning.id, !(planning as any).is_completed); }}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger><TooltipContent>{(planning as any).is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}</TooltipContent></Tooltip></TooltipProvider>
                        )}
                        {planning.user_id === user?.id && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); archivePlanning(planning.id); }}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger><TooltipContent>Archivieren</TooltipContent></Tooltip></TooltipProvider>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {planning.description && <p className="text-sm text-muted-foreground line-clamp-2">{planning.description}</p>}
                    {planning.location && <div className="flex items-center text-sm text-muted-foreground"><MapPin className="mr-2 h-3 w-3" />{planning.location}</div>}
                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      {planning.confirmed_date ? (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20"><CheckCircle className="h-4 w-4 text-emerald-500" /></div>
                      ) : (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20"><Clock className="h-4 w-4 text-amber-500" /></div>
                      )}
                    </TooltipTrigger><TooltipContent>{planning.confirmed_date ? "Bestätigt" : "In Planung"}</TooltipContent></Tooltip></TooltipProvider>
                  </CardContent>
                  <div className="px-6 pb-4 pt-2 border-t mt-auto">
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex flex-col text-xs text-muted-foreground">
                        {planning.confirmed_date ? (
                          <>
                            <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(planning.confirmed_date), "dd.MM.yyyy", { locale: de })}</span>
                            {planning.confirmed_date.includes('T') && !planning.confirmed_date.endsWith('T00:00:00') && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(planning.confirmed_date), "HH:mm", { locale: de })} Uhr</span>
                            )}
                          </>
                        ) : (<span className="italic">Termin offen</span>)}
                      </div>
                      {planningCollaborators.length > 0 && (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-muted-foreground">Mitarbeit</span>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {planningCollaborators.slice(0, 3).map((collab) => {
                              const profile = allProfiles.find(p => p.user_id === collab.user_id);
                              const color = (profile as any)?.badge_color || getHashedColor(collab.user_id);
                              return (
                                <TooltipProvider key={collab.id}><Tooltip><TooltipTrigger asChild>
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full text-white", color)}>{(profile?.display_name || "?")[0]}</span>
                                </TooltipTrigger><TooltipContent>{profile?.display_name || "Unbekannt"}</TooltipContent></Tooltip></TooltipProvider>
                              );
                            })}
                            {planningCollaborators.length > 3 && <span className="text-xs text-muted-foreground">+{planningCollaborators.length - 3}</span>}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground mb-0.5">Verantwortlich</span>
                        <UserBadge userId={planning.user_id} displayName={creatorProfile?.display_name || null} badgeColor={(creatorProfile as any)?.badge_color} size="sm" />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EventPlanningTable
            plannings={plannings} allProfiles={allProfiles} collaborators={collaborators}
            user={user} isItemNew={isItemNew} setSelectedPlanning={setSelectedPlanning}
            togglePlanningCompleted={togglePlanningCompleted} archivePlanning={archivePlanning}
          />
        )}

        <div className="flex items-center my-8">
          <Separator className="flex-1" />
          <div className="px-4 text-muted-foreground text-sm font-medium">Terminplanungen</div>
          <Separator className="flex-1" />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Terminplanungen</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-lg p-1">
                <Button variant={appointmentPreparationView === 'card' ? 'default' : 'ghost'} size="sm" onClick={() => saveViewPreferences('appointment', 'card')} className="h-8 px-2"><Grid className="h-4 w-4" /></Button>
                <Button variant={appointmentPreparationView === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => saveViewPreferences('appointment', 'table')} className="h-8 px-2"><List className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={showArchived ? "outline" : "default"} onClick={() => setShowArchived(false)}>Aktive ({appointmentPreparations.length})</Button>
                <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(true)}><Archive className="mr-2 h-4 w-4" />Archiv ({archivedPreparations.length})</Button>
              </div>
            </div>
          </div>

          {!showArchived && (
            appointmentPreparationView === 'card' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {appointmentPreparations.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">Keine aktiven Terminplanungen vorhanden</div>
                ) : (
                  appointmentPreparations.map((preparation) => (
                    <Card key={preparation.id} className="cursor-pointer hover:shadow-md transition-shadow relative" onClick={() => handlePreparationClick(preparation)}>
                      <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} />
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate cursor-pointer" onClick={() => handlePreparationClick(preparation)}>{preparation.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={preparation.status === 'completed' ? 'default' : preparation.status === 'in_progress' ? 'secondary' : 'outline'}>
                              {preparation.status === 'completed' ? 'Abgeschlossen' : preparation.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
                            </Badge>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); archivePreparation(preparation.id); }}>
                                <Archive className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Archivieren</TooltipContent></Tooltip></TooltipProvider>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3" onClick={() => handlePreparationClick(preparation)}>
                        {preparation.notes && <p className="text-sm text-muted-foreground line-clamp-2">{preparation.notes}</p>}
                        <p className="text-sm text-muted-foreground">Erstellt am {format(new Date(preparation.created_at), "dd.MM.yyyy", { locale: de })}</p>
                        {preparation.updated_at !== preparation.created_at && <p className="text-xs text-muted-foreground">Zuletzt bearbeitet am {format(new Date(preparation.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              appointmentPreparations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Keine aktiven Terminplanungen vorhanden</div>
              ) : (
                <AppointmentPreparationTable preparations={appointmentPreparations} isItemNew={isItemNew} handlePreparationClick={handlePreparationClick} archivePreparation={archivePreparation} />
              )
            )
          )}

          {showArchived && (
            appointmentPreparationView === 'card' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedPreparations.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">Keine archivierten Terminplanungen vorhanden</div>
                ) : (
                  archivedPreparations.map((preparation) => (
                    <Card key={preparation.id} className="cursor-pointer opacity-75 hover:opacity-100 hover:shadow-md transition-all" onClick={() => handlePreparationClick(preparation)}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate">{preparation.title}</span>
                          <Badge variant="secondary">Archiviert</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {preparation.notes && <p className="text-sm text-muted-foreground line-clamp-2">{preparation.notes}</p>}
                        <p className="text-sm text-muted-foreground">Erstellt am {format(new Date(preparation.created_at), "dd.MM.yyyy", { locale: de })}</p>
                        {preparation.archived_at && <p className="text-xs text-muted-foreground">Archiviert am {format(new Date(preparation.archived_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              archivedPreparations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Keine archivierten Terminplanungen vorhanden</div>
              ) : (
                <AppointmentPreparationTable preparations={archivedPreparations} isArchived isItemNew={isItemNew} handlePreparationClick={handlePreparationClick} archivePreparation={archivePreparation} />
              )
            )
          )}
        </div>
      </div>

      <PlanningDefaultCollaboratorsDialog open={showDefaultCollaboratorsDialog} onOpenChange={setShowDefaultCollaboratorsDialog} />
    </div>
  );
}
