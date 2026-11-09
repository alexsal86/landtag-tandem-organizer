import { PlanningViewToggle } from "./PlanningViewToggle";
import { EventPlanningOverview } from "./EventPlanningOverview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { debugConsole } from '@/utils/debugConsole';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NewItemIndicator } from "@/components/notifications/NewItemIndicator";
import { Plus, Archive, Users } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PlanningDefaultCollaboratorsDialog } from "./PlanningDefaultCollaboratorsDialog";
import { AppointmentPreparationTable } from "./AppointmentPreparationTable";
import type { useEventPlanningData } from "./useEventPlanningData";

type EventPlanningDataReturn = ReturnType<typeof useEventPlanningData>;

export function EventPlanningListView(data: EventPlanningDataReturn) {
  const {
    isCreateDialogOpen, setIsCreateDialogOpen,
    newPlanningTitle, setNewPlanningTitle,
    newPlanningIsPrivate, setNewPlanningIsPrivate,
    selectedTemplateId, setSelectedTemplateId,
    planningTemplates,
    appointmentPreparationView,
    showPlanningArchive, setShowPlanningArchive,
    archivedPlannings, showArchived, setShowArchived,
    appointmentPreparations, archivedPreparations,
    showDefaultCollaboratorsDialog, setShowDefaultCollaboratorsDialog,
    isItemNew,
    saveViewPreferences, fetchArchivedPlannings,
    restorePlanning,
    archivePreparation, handlePreparationClick, createPlanning,
  } = data;

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowDefaultCollaboratorsDialog(true)}>
              <Users className="h-4 w-4 mr-2" />Standard-Mitarbeiter
            </Button>
            <Dialog open={showPlanningArchive} onOpenChange={(open) => { setShowPlanningArchive(open); if (open) fetchArchivedPlannings().catch(err => debugConsole.error('Failed to fetch archived plannings:', err)); }}>
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

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <EventPlanningOverview {...data} />

          <section className="space-y-4 xl:min-w-0">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Terminplanungen</h2>
              <div className="flex flex-wrap items-center justify-end gap-4">
                <PlanningViewToggle value={appointmentPreparationView} onChange={view => saveViewPreferences("appointment", view)} label="Terminplanungsansicht" />
                <div className="flex items-center gap-2">
                  <Button variant={showArchived ? "outline" : "default"} onClick={() => setShowArchived(false)}>Aktive ({appointmentPreparations.length})</Button>
                  <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(true)}><Archive className="mr-2 h-4 w-4" />Archiv ({archivedPreparations.length})</Button>
                </div>
              </div>
            </div>

            {!showArchived && (
              appointmentPreparationView === 'card' ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {appointmentPreparations.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">Keine aktiven Terminplanungen vorhanden</div>
                  ) : (
                    appointmentPreparations.map((preparation) => (
                      <Card key={preparation.id} className="relative cursor-pointer transition-[background-color,box-shadow,border-color] hover:border-palette-green hover:bg-palette-green/5 hover:ring-1 hover:ring-inset hover:ring-palette-green focus-within:border-palette-green focus-within:ring-1 focus-within:ring-inset focus-within:ring-palette-green" onClick={() => handlePreparationClick(preparation)}>
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
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {archivedPreparations.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">Keine archivierten Terminplanungen vorhanden</div>
                  ) : (
                    archivedPreparations.map((preparation) => (
                      <Card key={preparation.id} className="cursor-pointer opacity-75 transition-[background-color,box-shadow,border-color,opacity] hover:opacity-100 hover:border-palette-green hover:bg-palette-green/5 hover:ring-1 hover:ring-inset hover:ring-palette-green focus-within:border-palette-green focus-within:ring-1 focus-within:ring-inset focus-within:ring-palette-green" onClick={() => handlePreparationClick(preparation)}>
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
          </section>
        </div>
      </div>

      <PlanningDefaultCollaboratorsDialog open={showDefaultCollaboratorsDialog} onOpenChange={setShowDefaultCollaboratorsDialog} />
    </div>
  );
}
