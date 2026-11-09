import { AppointmentPreparationOverview } from "./AppointmentPreparationOverview";
import { EventPlanningOverview } from "./EventPlanningOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { useEventPlanningData } from "./useEventPlanningData";

type EventPlanningDataReturn = ReturnType<typeof useEventPlanningData>;

export function EventPlanningListView(data: EventPlanningDataReturn) {
  const {
    isCreateDialogOpen, setIsCreateDialogOpen,
    newPlanningTitle, setNewPlanningTitle,
    newPlanningIsPrivate, setNewPlanningIsPrivate,
    selectedTemplateId, setSelectedTemplateId,
    planningTemplates,
    createPlanning,
  } = data;

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
          <div className="flex flex-wrap items-center gap-3">
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

          <AppointmentPreparationOverview {...data} />
        </div>
      </div>
    </div>
  );
}
