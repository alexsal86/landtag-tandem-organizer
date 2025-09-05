import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ExternalLinkIcon, EditIcon, SaveIcon, XIcon, MapPinIcon, ClockIcon, UserIcon, PlusIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { supabase } from "@/integrations/supabase/client";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";
import { CalendarEvent } from "@/components/CalendarView";
import { useAuth } from "@/hooks/useAuth";

interface AppointmentPreparationOverviewTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationOverviewTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationOverviewTabProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: preparation.title,
    status: preparation.status,
    notes: preparation.notes || "",
    contact_name: (preparation.preparation_data as any)?.contact_name || "",
    contact_info: (preparation.preparation_data as any)?.contact_info || ""
  });
  const [saving, setSaving] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [showCustomContact, setShowCustomContact] = useState(false);

  // Fetch contacts and appointment details
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch contacts - using tenant_id instead of user_id
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .eq('tenant_id', preparation.tenant_id)
          .order('name');

        if (contactsError) {
          console.error('Error fetching contacts:', contactsError);
        } else {
          setContacts(contactsData || []);
        }

        // Fetch appointment details if appointment_id exists
        if (preparation.appointment_id) {
          setLoadingAppointment(true);
          const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', preparation.appointment_id)
            .maybeSingle();
            
          if (error) {
            console.error('Error fetching appointment:', error);
          } else {
            setAppointmentDetails(data);
          }
          setLoadingAppointment(false);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [user, preparation.appointment_id, preparation.tenant_id]);

  // Update editData when preparation changes
  useEffect(() => {
    setEditData({
      title: preparation.title,
      status: preparation.status,
      notes: preparation.notes || "",
      contact_name: (preparation.preparation_data as any)?.contact_name || "",
      contact_info: (preparation.preparation_data as any)?.contact_info || ""
    });
  }, [preparation]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Merge contact data into preparation_data
      const updatedPreparationData = {
        ...preparation.preparation_data,
        contact_name: editData.contact_name,
        contact_info: editData.contact_info
      };
      
      await onUpdate({
        title: editData.title,
        status: editData.status,
        notes: editData.notes,
        preparation_data: updatedPreparationData
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      title: preparation.title,
      status: preparation.status,
      notes: preparation.notes || "",
      contact_name: (preparation.preparation_data as any)?.contact_name || "",
      contact_info: (preparation.preparation_data as any)?.contact_info || ""
    });
    setSelectedContactId("");
    setShowCustomContact(false);
    setIsEditing(false);
  };

  const handleContactSelect = (contactId: string) => {
    if (contactId === "custom") {
      setShowCustomContact(true);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else if (contactId === "") {
      setShowCustomContact(false);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else {
      const selectedContact = contacts.find(c => c.id === contactId);
      if (selectedContact) {
        setShowCustomContact(false);
        setSelectedContactId(contactId);
        setEditData(prev => ({
          ...prev,
          contact_name: selectedContact.name,
          contact_info: `${selectedContact.email || ''} ${selectedContact.phone || ''}`.trim()
        }));
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Abgeschlossen</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Bearbeitung</Badge>;
      case "draft":
        return <Badge variant="outline">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenAppointment = () => {
    if (!appointmentDetails) return;
    
    // Convert appointment to CalendarEvent format
    const calendarEvent: CalendarEvent = {
      id: appointmentDetails.id,
      title: appointmentDetails.title,
      description: appointmentDetails.description,
      time: new Date(appointmentDetails.start_time).toTimeString().slice(0, 5),
      duration: appointmentDetails.end_time ? 
        `${Math.floor((new Date(appointmentDetails.end_time).getTime() - new Date(appointmentDetails.start_time).getTime()) / (1000 * 60))} Min.` : 
        "60 Min.",
      date: new Date(appointmentDetails.start_time),
      endTime: appointmentDetails.end_time ? new Date(appointmentDetails.end_time) : undefined,
      location: appointmentDetails.location,
      type: appointmentDetails.category as CalendarEvent["type"],
      priority: appointmentDetails.priority as CalendarEvent["priority"],
      is_all_day: appointmentDetails.is_all_day
    };
    
    setSelectedAppointment(calendarEvent);
    setSidebarOpen(true);
  };

  const handleSidebarUpdate = () => {
    // Refresh appointment details when sidebar updates
    if (!preparation.appointment_id) return;
    
    const fetchAppointmentDetails = async () => {
      try {
        setLoadingAppointment(true);
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', preparation.appointment_id)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching appointment:', error);
          return;
        }
        
        setAppointmentDetails(data);
      } catch (error) {
        console.error('Error fetching appointment details:', error);
      } finally {
        setLoadingAppointment(false);
      }
    };

    fetchAppointmentDetails();
  };

  return (
    <div className="space-y-6">
      {/* Combined Basic Information and Appointment Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Grundinformationen & Termindetails
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <EditIcon className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Titel</label>
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Titel der Terminplanung"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={editData.status} onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Kontakt</label>
                <Select value={selectedContactId || (showCustomContact ? "custom" : "")} onValueChange={handleContactSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kontakt auswählen oder manuell eingeben" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Kein Kontakt</SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <PlusIcon className="h-4 w-4" />
                        Manuell eingeben
                      </div>
                    </SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          {contact.name} {contact.email && `(${contact.email})`}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {showCustomContact && (
                  <div className="space-y-3 mt-3">
                    <Input
                      value={editData.contact_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, contact_name: e.target.value }))}
                      placeholder="Name des Kontakts"
                    />
                    <Input
                      value={editData.contact_info}
                      onChange={(e) => setEditData(prev => ({ ...prev, contact_info: e.target.value }))}
                      placeholder="Kontaktinformationen (E-Mail, Telefon, etc.)"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Notizen</label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Zusätzliche Notizen zur Terminplanung"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  {saving ? "Speichern..." : "Speichern"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Grundinformationen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Titel</label>
                    <p className="text-lg font-medium">{preparation.title}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      {getStatusBadge(preparation.status)}
                    </div>
                  </div>

                  {((preparation.preparation_data as any)?.contact_name || (preparation.preparation_data as any)?.contact_info) && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Kontakt</label>
                      <div className="mt-1 p-3 bg-muted/30 rounded-lg">
                        {(preparation.preparation_data as any)?.contact_name && (
                          <p className="font-medium">{(preparation.preparation_data as any).contact_name}</p>
                        )}
                        {(preparation.preparation_data as any)?.contact_info && (
                          <p className="text-sm text-muted-foreground">{(preparation.preparation_data as any).contact_info}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {preparation.notes && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Notizen</label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{preparation.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment Details Section */}
              {preparation.appointment_id && (
                <>
                  <div className="border-t pt-6">
                    <h3 className="font-medium text-lg mb-4">Termindetails</h3>
                    {loadingAppointment ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : appointmentDetails ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Datum & Zeit</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(appointmentDetails.start_time).toLocaleString('de-DE', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {appointmentDetails.end_time && (
                                  <> - {new Date(appointmentDetails.end_time).toLocaleTimeString('de-DE', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}</>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          {appointmentDetails.location && (
                            <div className="flex items-center gap-2">
                              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Ort</p>
                                <p className="text-sm text-muted-foreground">{appointmentDetails.location}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Art der Veranstaltung</p>
                              <p className="text-sm text-muted-foreground">
                                {appointmentDetails.category === 'meeting' ? 'Besprechung' :
                                 appointmentDetails.category === 'event' ? 'Veranstaltung' :
                                 appointmentDetails.category === 'deadline' ? 'Termin' :
                                 appointmentDetails.category || 'Sonstiges'}
                              </p>
                            </div>
                          </div>
                          
                          {appointmentDetails.priority && (
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 flex items-center justify-center">
                                <div className={`h-2 w-2 rounded-full ${
                                  appointmentDetails.priority === 'high' ? 'bg-red-500' :
                                  appointmentDetails.priority === 'medium' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Priorität</p>
                                <p className="text-sm text-muted-foreground">
                                  {appointmentDetails.priority === 'high' ? 'Hoch' :
                                   appointmentDetails.priority === 'medium' ? 'Mittel' :
                                   'Niedrig'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {appointmentDetails.description && (
                          <div>
                            <p className="text-sm font-medium mb-2">Beschreibung</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {appointmentDetails.description}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={handleOpenAppointment}>
                            <ExternalLinkIcon className="h-4 w-4 mr-2" />
                            Termin öffnen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Termindetails konnten nicht geladen werden.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Details Sidebar */}
      <AppointmentDetailsSidebar
        appointment={selectedAppointment}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onUpdate={handleSidebarUpdate}
      />
    </div>
  );
}