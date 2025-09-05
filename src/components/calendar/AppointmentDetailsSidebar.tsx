import React, { useState, useEffect } from "react";
import { X, Edit, Trash2, MapPin, Clock, Users, Calendar as CalendarIcon, Save, Mail, UserPlus, Check, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEvent } from "../CalendarView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatEventDisplay } from "@/lib/timeUtils";
import { GuestManager } from "../GuestManager";

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
  const [appointmentCategories, setAppointmentCategories] = useState<Array<{ name: string; label: string; color: string }>>([]);
  const [guests, setGuests] = useState<Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    responded_at?: string;
    response_note?: string;
  }>>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [isSendingInvitations, setIsSendingInvitations] = useState(false);
  const [editData, setEditData] = useState({
    title: "",
    description: "",
    location: "",
    priority: "medium" as CalendarEvent["priority"],
    category: "meeting" as CalendarEvent["type"],
    date: "",
    startTime: "",
    endTime: ""
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data: categoriesData, error } = await supabase
        .from('appointment_categories')
        .select('name, label, color')
        .eq('is_active', true)
        .order('order_index');
      
      if (!error && categoriesData) {
        setAppointmentCategories(categoriesData);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (appointment && !appointment.id.startsWith('blocked-')) {
      fetchGuests();
    }
  }, [appointment]);

  const fetchGuests = async () => {
    if (!appointment || appointment.id.startsWith('blocked-')) return;
    
    setIsLoadingGuests(true);
    try {
      const { data: guestsData, error } = await supabase
        .from('appointment_guests')
        .select('*')
        .eq('appointment_id', appointment.id)
        .order('name');

      if (error) throw error;
      setGuests(guestsData || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    } finally {
      setIsLoadingGuests(false);
    }
  };

  const sendInvitations = async () => {
    if (!appointment || !guests.length || appointment.id.startsWith('blocked-')) return;
    
    setIsSendingInvitations(true);
    try {
      const { error } = await supabase.functions.invoke('send-appointment-invitation', {
        body: { 
          appointmentId: appointment.id,
          sendToAll: true 
        }
      });

      if (error) throw error;

      // Update last invitation sent timestamp
      await supabase
        .from('appointments')
        .update({ last_invitation_sent_at: new Date().toISOString() })
        .eq('id', appointment.id);

      toast({
        title: "Einladungen versendet",
        description: `${guests.length} Einladung(en) wurden erfolgreich versendet.`
      });

      onUpdate();
      fetchGuests();
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({
        title: "Fehler",
        description: "Die Einladungen konnten nicht versendet werden.",
        variant: "destructive"
      });
    } finally {
      setIsSendingInvitations(false);
    }
  };

  const handleEdit = () => {
    if (!appointment) return;
    
    // Calculate end time from start time and duration
    let endTime = "";
    if (appointment.endTime) {
      endTime = appointment.endTime.toTimeString().slice(0, 5);
    } else if (appointment.duration) {
      const [hours, minutes] = appointment.time.split(':').map(Number);
      const durationMinutes = parseInt(appointment.duration.replace(/\D/g, ''));
      const endTotalMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(endTotalMinutes / 60);
      const endMinutes = endTotalMinutes % 60;
      endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    }
    
    setEditData({
      title: appointment.title,
      description: "", // Add description field
      location: appointment.location || "",
      priority: appointment.priority,
      category: appointment.type, // Map type to category
      date: appointment.date.toISOString().split('T')[0],
      startTime: appointment.time,
      endTime: endTime
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!appointment || appointment.id.startsWith('blocked-')) return;
    
    try {
      // Calculate new start and end times
      const [startHours, startMinutes] = editData.startTime.split(':').map(Number);
      const [endHours, endMinutes] = editData.endTime.split(':').map(Number);
      
      const startTime = new Date(editData.date);
      startTime.setHours(startHours, startMinutes, 0, 0);
      
      const endTime = new Date(editData.date);
      endTime.setHours(endHours, endMinutes, 0, 0);

      const { error } = await supabase
        .from('appointments')
        .update({
          title: editData.title,
          description: editData.description || null,
          location: editData.location || null,
          priority: editData.priority,
          category: editData.category,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
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
    // Try to find the category in the loaded appointment categories first
    const category = appointmentCategories.find(cat => cat.name === type);
    if (category) {
      return category.label;
    }
    
    // Fallback to hardcoded labels
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

  const getGuestStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-300";
      case "declined":
        return "bg-red-100 text-red-800 border-red-300";
      case "invited":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getGuestStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Check className="h-3 w-3" />;
      case "declined":
        return <XIcon className="h-3 w-3" />;
      case "invited":
        return <Mail className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getGuestStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Zugesagt";
      case "declined":
        return "Abgesagt";
      case "invited":
        return "Eingeladen";
      default:
        return status;
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
              <div className="flex-1">
                <div className="font-medium">Datum</div>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({...editData, date: e.target.value})}
                    className="mt-1"
                  />
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{appointment.is_all_day ? "Ganztägig" : "Uhrzeit"}</div>
                {isEditing ? (
                  <div className="space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Startzeit</label>
                        <Input
                          type="time"
                          value={editData.startTime}
                          onChange={(e) => setEditData({...editData, startTime: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Endzeit</label>
                        <Input
                          type="time"
                          value={editData.endTime}
                          onChange={(e) => setEditData({...editData, endTime: e.target.value})}
                        />
                      </div>
                    </div>
                    {editData.startTime && editData.endTime && (
                      <div className="text-xs text-muted-foreground">
                        Dauer: {(() => {
                          const [startHours, startMinutes] = editData.startTime.split(':').map(Number);
                          const [endHours, endMinutes] = editData.endTime.split(':').map(Number);
                          const startTotalMinutes = startHours * 60 + startMinutes;
                          const endTotalMinutes = endHours * 60 + endMinutes;
                          const durationMinutes = endTotalMinutes - startTotalMinutes;
                          
                          if (durationMinutes <= 0) return "Ungültige Zeitspanne";
                          
                          const hours = Math.floor(durationMinutes / 60);
                          const minutes = durationMinutes % 60;
                          return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`;
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {appointment.is_all_day ? (
                      appointment.endTime ? (
                        `${appointment.date.toLocaleDateString('de-DE')} - ${appointment.endTime.toLocaleDateString('de-DE')}`
                      ) : (
                        appointment.date.toLocaleDateString('de-DE')
                      )
                    ) : (
                      formatEventDisplay(appointment)
                    )}
                  </div>
                )}
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
                  {appointment.location ? (
                    appointment.location.startsWith("Digital") ? (
                      <div className="space-y-1">
                        <div className="font-medium text-blue-600">🔗 Online-Meeting</div>
                        <div className="text-xs">{appointment.location.replace("Digital - ", "")}</div>
                      </div>
                    ) : (
                      appointment.location
                    )
                  ) : (
                    "Kein Ort angegeben"
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            </div>
            <div className="flex-1">
              <div className="font-medium">Beschreibung</div>
              {isEditing ? (
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  placeholder="Beschreibung eingeben"
                  className="mt-1 min-h-[60px]"
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {appointment.description || "Keine Beschreibung"}
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          {!appointment.id.startsWith('blocked-') && (
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <div className="w-3 h-3 bg-primary rounded"></div>
              </div>
              <div className="flex-1">
                <div className="font-medium">Kategorie</div>
                {isEditing ? (
                  <Select value={editData.category} onValueChange={(value: CalendarEvent["type"]) => setEditData({...editData, category: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {appointmentCategories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {getEventTypeLabel(appointment.type)}
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Guests Section */}
          {!appointment.id.startsWith('blocked-') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gäste ({guests.length})
                </h3>
                {guests.length > 0 && !isEditing && (
                  <Button
                    onClick={sendInvitations}
                    variant="outline"
                    size="sm"
                    disabled={isSendingInvitations}
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    {isSendingInvitations ? "Wird gesendet..." : "Einladungen senden"}
                  </Button>
                )}
              </div>

              {isEditing && (
                <div className="mt-3">
                  <GuestManager
                    guests={guests.map(g => ({ name: g.name, email: g.email }))}
                    onGuestsChange={(updatedGuests) => {
                      // We'll handle guest updates when saving the appointment
                      console.log('Guest updates:', updatedGuests);
                    }}
                  />
                </div>
              )}

              {!isEditing && (
                <>
                  {isLoadingGuests ? (
                    <div className="text-sm text-muted-foreground">Lade Gäste...</div>
                  ) : guests.length > 0 ? (
                    <div className="space-y-2">
                      {guests.map((guest) => (
                        <div key={guest.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{guest.name}</div>
                            <div className="text-sm text-muted-foreground truncate">{guest.email}</div>
                            {guest.response_note && (
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                "{guest.response_note}"
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${getGuestStatusColor(guest.status)}`}>
                              <div className="flex items-center gap-1">
                                {getGuestStatusIcon(guest.status)}
                                {getGuestStatusText(guest.status)}
                              </div>
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                      <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <div>Keine Gäste für diesen Termin</div>
                      <div className="text-xs mt-1">
                        Bearbeiten Sie den Termin, um Gäste hinzuzufügen
                      </div>
                    </div>
                  )}
                </>
              )}
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