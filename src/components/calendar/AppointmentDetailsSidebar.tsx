import React, { useState } from "react";
import { X, Edit, Trash2, MapPin, Clock, Users, Calendar as CalendarIcon, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEvent } from "../CalendarView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AppointmentDetailsSidebarProps {
  appointment: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AppointmentDetailsSidebar({ 
  appointment, 
  open, 
  onClose,
  onUpdate 
}: AppointmentDetailsSidebarProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: "",
    location: "",
    priority: "medium" as CalendarEvent["priority"]
  });

  const handleEdit = () => {
    if (!appointment) return;
    setEditData({
      title: appointment.title,
      location: appointment.location || "",
      priority: appointment.priority
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!appointment || appointment.id.startsWith('blocked-')) return;
    
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          title: editData.title,
          location: editData.location || null,
          priority: editData.priority
        })
        .eq('id', appointment.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Termin aktualisiert",
        description: "Die Änderungen wurden erfolgreich gespeichert."
      });
      
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        title: "Fehler",
        description: "Der Termin konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!appointment || isDeleting) return;
    
    setIsDeleting(true);
    try {
      // Don't delete blocked appointments (they come from event planning)
      if (appointment.id.startsWith('blocked-')) {
        toast({
          title: "Warnung",
          description: "Geplante Termine können nicht direkt gelöscht werden.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Termin gelöscht",
        description: "Der Termin wurde erfolgreich gelöscht."
      });
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        title: "Fehler",
        description: "Der Termin konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getEventTypeColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "session":
        return "bg-primary text-primary-foreground";
      case "meeting":
        return "bg-government-blue text-white";
      case "appointment":
        return "bg-secondary text-secondary-foreground";
      case "deadline":
        return "bg-destructive text-destructive-foreground";
      case "blocked":
        return "bg-orange-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getEventTypeLabel = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "session":
        return "Sitzung";
      case "meeting":
        return "Besprechung";
      case "appointment":
        return "Termin";
      case "deadline":
        return "Frist";
      case "blocked":
        return "Geplant";
      default:
        return "Unbekannt";
    }
  };

  const getPriorityLabel = (priority: CalendarEvent["priority"]) => {
    switch (priority) {
      case "high":
        return "Hoch";
      case "medium":
        return "Mittel";
      case "low":
        return "Niedrig";
      default:
        return "Unbekannt";
    }
  };

  const getPriorityColor = (priority: CalendarEvent["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-yellow-500 text-yellow-50";
      case "low":
        return "bg-green-500 text-green-50";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!appointment) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">Termindetails</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Title and Type */}
          <div>
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  placeholder="Titel"
                  className="text-xl font-semibold"
                />
                <Select value={editData.priority} onValueChange={(value: CalendarEvent["priority"]) => setEditData({...editData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold mb-2">{appointment.title}</h2>
                <div className="flex gap-2">
                  <Badge className={getEventTypeColor(appointment.type)}>
                    {getEventTypeLabel(appointment.type)}
                  </Badge>
                  <Badge className={getPriorityColor(appointment.priority)}>
                    Priorität: {getPriorityLabel(appointment.priority)}
                  </Badge>
                </div>
              </>
            )}
          </div>

          {/* Time Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {appointment.date.toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {appointment.date.toDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {(() => {
                    const [hours, minutes] = appointment.time.split(':').map(Number);
                    const durationMinutes = parseInt(appointment.duration.replace(/\D/g, ''));
                    const endHours = Math.floor((hours * 60 + minutes + durationMinutes) / 60);
                    const endMinutes = (hours * 60 + minutes + durationMinutes) % 60;
                    
                    return `${appointment.time} - ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
                  })()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Dauer: {appointment.duration}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Ort</div>
              {isEditing ? (
                <Input
                  value={editData.location}
                  onChange={(e) => setEditData({...editData, location: e.target.value})}
                  placeholder="Ort eingeben"
                  className="mt-1"
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {appointment.location || "Kein Ort angegeben"}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          {appointment.participants && appointment.participants.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="font-medium mb-2">
                  Teilnehmer ({appointment.participants.length})
                </div>
                <div className="space-y-2">
                  {appointment.participants.map((participant) => (
                    <div 
                      key={participant.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <span className="text-sm">{participant.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {participant.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {isEditing ? (
              <>
                <Button 
                  className="flex-1 gap-2"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4" />
                  Speichern
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Abbrechen
                </Button>
              </>
            ) : (
              <>
                <Button 
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={handleEdit}
                  disabled={appointment.id.startsWith('blocked-')}
                >
                  <Edit className="h-4 w-4" />
                  Bearbeiten
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || appointment.id.startsWith('blocked-')}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Lösche..." : "Löschen"}
                </Button>
              </>
            )}
          </div>

          {appointment.id.startsWith('blocked-') && (
            <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-md">
              Dies ist ein geplanter Termin aus der Terminplanung. 
              Bearbeitung und Löschung sind nur über die Terminplanung möglich.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}