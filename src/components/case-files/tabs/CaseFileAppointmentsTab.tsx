import { useState, useEffect } from "react";
import { CaseFileAppointment } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CaseFileAppointmentsTabProps {
  appointments: CaseFileAppointment[];
  onAdd: (appointmentId: string, notes?: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function CaseFileAppointmentsTab({ appointments, onAdd, onRemove }: CaseFileAppointmentsTabProps) {
  const { currentTenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableAppointments, setAvailableAppointments] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (dialogOpen && currentTenant) {
      loadAppointments();
    }
  }, [dialogOpen, currentTenant]);

  const loadAppointments = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('appointments')
      .select('id, title, start_time, end_time, location, status')
      .eq('tenant_id', currentTenant.id)
      .order('start_time', { ascending: false })
      .limit(100);
    setAvailableAppointments(data || []);
  };

  const handleAdd = async () => {
    if (!selectedAppointmentId) return;
    setIsSubmitting(true);
    const success = await onAdd(selectedAppointmentId, notes || undefined);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setSelectedAppointmentId(null);
      setNotes("");
    }
  };

  const filteredAppointments = availableAppointments.filter(apt =>
    apt.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedAppointmentIds = appointments.map(a => a.appointment_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Verknüpfte Termine
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Termin hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Termine verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{item.appointment?.title}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {item.appointment?.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.appointment.start_time), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </span>
                      )}
                      {item.appointment?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.appointment.location}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Termin verknüpfen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Termin aus, der mit dieser FallAkte verknüpft werden soll.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Termin suchen</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredAppointments
                    .filter(apt => !linkedAppointmentIds.includes(apt.id))
                    .map((apt) => (
                      <div
                        key={apt.id}
                        className={`p-2 rounded cursor-pointer hover:bg-muted ${selectedAppointmentId === apt.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedAppointmentId(apt.id)}
                      >
                        <div className="font-medium text-sm">{apt.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm', { locale: de })}
                          {apt.location && ` · ${apt.location}`}
                        </div>
                      </div>
                    ))}
                  {filteredAppointments.filter(apt => !linkedAppointmentIds.includes(apt.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine verfügbaren Termine gefunden
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="grid gap-2">
              <Label>Notizen (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={!selectedAppointmentId || isSubmitting}>
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
