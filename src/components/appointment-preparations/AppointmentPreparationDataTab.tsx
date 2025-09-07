import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, ClockIcon, MapPinIcon, UsersIcon, PlusIcon, EditIcon, SaveIcon, XIcon, ExternalLinkIcon, FileTextIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon, MessageSquareIcon, SettingsIcon, CheckCircleIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { debounce } from "@/utils/debounce";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  category?: string;
  priority?: string;
  status?: string;
  meeting_link?: string;
  meeting_details?: string;
}

// Extended interface with contact fields that might not be in the base interface
interface ExtendedAppointmentPreparation extends AppointmentPreparation {
  contact_name?: string;
  contact_info?: string;
  contact_id?: string;
}

interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationDataTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationDataTabProps) {
  const extendedPreparation = preparation as ExtendedAppointmentPreparation;
  
  const [editData, setEditData] = useState({
    ...preparation.preparation_data,
    contact_name: (extendedPreparation.contact_name || ""),
    contact_info: (extendedPreparation.contact_info || ""),
    notes: (preparation.notes || "")
  });
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    people: false,
    materials: false,
    communication: false,
    framework: false
  });

  // Overview functionality state
  const [isEditing, setIsEditing] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showCustomContact, setShowCustomContact] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<CalendarEvent | null>(null);
  const [showAppointmentSidebar, setShowAppointmentSidebar] = useState(false);
  const { currentTenant } = useTenant();

  // Fetch appointment details and contacts
  useEffect(() => {
    if (preparation.appointment_id) {
      fetchAppointmentDetails();
      fetchContacts();
      
      // Initialize contact selection from preparation data
      if (extendedPreparation.contact_name && extendedPreparation.contact_info) {
        setShowCustomContact(true);
      } else if (extendedPreparation.contact_id) {
        setSelectedContactId(extendedPreparation.contact_id);
      }
    }
  }, [preparation.appointment_id, currentTenant]);

  // Sync editData with preparation changes
  useEffect(() => {
    setEditData({
      ...preparation.preparation_data,
      // Get contact info from preparation_data
      contact_name: preparation.preparation_data.contact_name || "",
      contact_info: preparation.preparation_data.contact_info || "",
      notes: preparation.notes || ""
    });
    
    // Initialize contact selection from preparation_data
    if (preparation.preparation_data.contact_name && preparation.preparation_data.contact_info) {
      setShowCustomContact(true);
    } else if (preparation.preparation_data.contact_id) {
      setSelectedContactId(preparation.preparation_data.contact_id);
    }
  }, [preparation]);

  const fetchAppointmentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', preparation.appointment_id)
        .single();

      if (error) throw error;

      if (data) {
        setAppointmentDetails({
          id: data.id,
          title: data.title,
          start: data.start_time,
          end: data.end_time,
          description: data.description,
          location: data.location,
          category: data.category,
          priority: data.priority,
          status: data.status,
          meeting_link: data.meeting_link,
          meeting_details: data.meeting_details
        });
      }
    } catch (error) {
      console.error("Error fetching appointment details:", error);
    }
  };

  const fetchContacts = async () => {
    if (!currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, organization, role')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Store all data including contact info in preparation_data
      const updatedPreparationData = {
        ...editData,
        // Move contact fields into preparation_data
        contact_name: showCustomContact ? editData.contact_name : (selectedContactId ? contacts.find(c => c.id === selectedContactId)?.name : null),
        contact_info: showCustomContact ? editData.contact_info : (selectedContactId ? `${contacts.find(c => c.id === selectedContactId)?.email || ""}${contacts.find(c => c.id === selectedContactId)?.phone ? ` | ${contacts.find(c => c.id === selectedContactId)?.phone}` : ""}`.trim().replace(/^\|/, '').trim() : null),
        contact_id: showCustomContact ? null : selectedContactId || null
      };

      const updates: Partial<AppointmentPreparation> = {
        preparation_data: updatedPreparationData,
        notes: editData.notes || "",
      };

      await onUpdate(updates);
      setIsEditing(false);
      
      toast({
        title: "Gespeichert",
        description: "Terminvorbereitung wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error("Error saving preparation:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Terminvorbereitung.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      ...preparation.preparation_data,
      contact_name: preparation.preparation_data.contact_name || "",
      contact_info: preparation.preparation_data.contact_info || "",
      notes: preparation.notes || ""
    });
    setIsEditing(false);
    setShowCustomContact(!!(preparation.preparation_data.contact_name && preparation.preparation_data.contact_info));
    setSelectedContactId(preparation.preparation_data.contact_id || "");
  };

  const handleContactSelect = (contactId: string) => {
    if (contactId === "custom") {
      setShowCustomContact(true);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else if (contactId === "none") {
      setShowCustomContact(false);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else {
      setShowCustomContact(false);
      setSelectedContactId(contactId);
      const selectedContact = contacts.find(c => c.id === contactId);
      if (selectedContact) {
        setEditData(prev => ({
          ...prev,
          contact_name: selectedContact.name,
          contact_info: `${selectedContact.email || ""}${selectedContact.phone ? ` | ${selectedContact.phone}` : ""}`.trim().replace(/^\|/, '').trim()
        }));
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "secondary",
      in_progress: "default",
      completed: "default"
    } as const;
    
    const statusLabels = {
      draft: "Entwurf",
      in_progress: "In Bearbeitung", 
      completed: "Abgeschlossen"
    } as const;
    
    return (
      <Badge variant={statusColors[status as keyof typeof statusColors] || "secondary"}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const handleOpenAppointment = () => {
    if (appointmentDetails) {
      setShowAppointmentSidebar(true);
    }
  };

  const handleSidebarUpdate = (updatedAppointment: CalendarEvent) => {
    setAppointmentDetails(updatedAppointment);
    fetchAppointmentDetails(); // Refresh the data
  };

  const debouncedSave = useCallback(
    debounce(async (data: any) => {
      try {
        setSaving(true);
        await onUpdate({ preparation_data: data });
        toast({
          title: "Gespeichert",
          description: "Änderungen wurden automatisch gespeichert.",
        });
      } catch (error) {
        console.error("Error saving preparation data:", error);
        toast({
          title: "Fehler",
          description: "Fehler beim Speichern der Änderungen.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    }, 500),
    [onUpdate]
  );

  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...editData, [field]: value };
    setEditData(newData);
    debouncedSave(newData);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fieldSections = {
    basics: {
      title: "Grundlagen",
      icon: FileTextIcon,
      fields: [
        { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?", multiline: true },
        { key: "key_topics", label: "Hauptthemen", placeholder: "Wichtigste Gesprächsthemen" },
        { key: "talking_points", label: "Gesprächspunkte", placeholder: "Konkrete Punkte für das Gespräch", multiline: true },
      ]
    },
    people: {
      title: "Personen",
      icon: UsersIcon,
      fields: [
        { key: "audience", label: "Zielgruppe", placeholder: "An wen richtet sich der Termin?" },
        { key: "contact_person", label: "Ansprechpartner", placeholder: "Hauptansprechpartner vor Ort" },
      ]
    },
    materials: {
      title: "Materialien & Unterlagen",
      icon: FolderIcon,
      fields: [
        { key: "materials_needed", label: "Benötigte Materialien", placeholder: "Welche Materialien werden benötigt?" },
        { key: "facts_figures", label: "Fakten & Zahlen", placeholder: "Wichtige Daten und Statistiken", multiline: true },
        { key: "position_statements", label: "Positionspapiere", placeholder: "Offizielle Positionen und Standpunkte", multiline: true },
      ]
    },
    communication: {
      title: "Kommunikation",
      icon: MessageSquareIcon,
      fields: [
        { key: "questions_answers", label: "Fragen & Antworten", placeholder: "Mögliche Fragen und vorbereitete Antworten", multiline: true },
      ]
    },
    framework: {
      title: "Rahmenbedingungen",
      icon: SettingsIcon,
      fields: [
        { key: "technology_setup", label: "Technik-Setup", placeholder: "Technische Voraussetzungen" },
        { key: "dress_code", label: "Kleiderordnung", placeholder: "Angemessene Kleidung für den Anlass", type: "select" },
        { key: "event_type", label: "Veranstaltungstyp", placeholder: "Art der Veranstaltung" },
      ]
    }
  };

  const dressCodeOptions = [
    { value: "casual", label: "Casual" },
    { value: "business_casual", label: "Business Casual" },
    { value: "business_formal", label: "Business Formal" },
    { value: "festlich", label: "Festlich" },
    { value: "uniform", label: "Uniformpflicht" },
    { value: "custom", label: "Benutzerdefiniert" }
  ];

  const getFilledFieldsCount = (sectionKey: string) => {
    const section = fieldSections[sectionKey as keyof typeof fieldSections];
    const filledCount = section.fields.filter(field => editData[field.key]?.trim()).length;
    return `${filledCount}/${section.fields.length}`;
  };

  return (
    <div className="space-y-4">
      {/* Preparation Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileTextIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">
                  Vorbereitung: {appointmentDetails?.title || "Termin"}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(preparation.status)}
                  {saving && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
                      Speichert...
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <XIcon className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <EditIcon className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Appointment Details Section */}
          {appointmentDetails && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Termindetails
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Datum:</span>
                  <span>
                    {format(new Date(appointmentDetails.start), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Zeit:</span>
                  <span>
                    {format(new Date(appointmentDetails.start), 'HH:mm', { locale: de })} - {format(new Date(appointmentDetails.end), 'HH:mm', { locale: de })}
                  </span>
                </div>
                
                {appointmentDetails.location && (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Ort:</span>
                    <span>{appointmentDetails.location}</span>
                  </div>
                )}
                
                {appointmentDetails.description && (
                  <div className="flex items-start gap-2 md:col-span-2">
                    <FileTextIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Beschreibung:</span>
                      <p className="text-muted-foreground mt-1">{appointmentDetails.description}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAppointment}
                className="flex items-center gap-2"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                Termindetails öffnen
              </Button>
            </div>
          )}

          <Separator />

          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Kontaktinformationen
            </h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Kontakt</label>
                  <Select 
                    value={selectedContactId || (showCustomContact ? "custom" : "none")} 
                    onValueChange={handleContactSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kontakt auswählen oder manuell eingeben" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Kontakt</SelectItem>
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <PlusIcon className="h-4 w-4" />
                          Kontakt manuell eingeben
                        </div>
                      </SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          <div>
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {contact.organization && `${contact.organization} • `}
                              {contact.role}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showCustomContact && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Kontaktname</label>
                      <Input
                        value={editData.contact_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, contact_name: e.target.value }))}
                        placeholder="Name des Kontakts"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Kontaktinformationen</label>
                      <Textarea
                        value={editData.contact_info}
                        onChange={(e) => setEditData(prev => ({ ...prev, contact_info: e.target.value }))}
                        placeholder="E-Mail, Telefon, weitere Informationen..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {preparation.preparation_data.contact_name ? (
                  <div className="space-y-2">
                    <div className="font-medium">{preparation.preparation_data.contact_name}</div>
                    {preparation.preparation_data.contact_info && (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {preparation.preparation_data.contact_info}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Kein Kontakt zugeordnet
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Notizen</h3>
            
            {isEditing ? (
              <Textarea
                value={editData.notes}
                onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Allgemeine Notizen zur Terminvorbereitung..."
                rows={4}
              />
            ) : (
              <div>
                {preparation.notes ? (
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {preparation.notes}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Keine Notizen vorhanden
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Preparation Data Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(fieldSections).map(([sectionKey, section]) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[sectionKey as keyof typeof expandedSections];
            const filledCount = getFilledFieldsCount(sectionKey);
            
            return (
              <Collapsible
                key={sectionKey}
                open={isExpanded}
                onOpenChange={() => toggleSection(sectionKey as keyof typeof expandedSections)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <SectionIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">{section.title}</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {filledCount}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-sm font-medium">{field.label}</label>
                        
                        {field.type === "select" ? (
                          <div className="space-y-2">
                            <Select
                              value={editData[field.key] || ""}
                              onValueChange={(value) => handleFieldChange(field.key, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {dressCodeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {editData[field.key] === "custom" && (
                              <Input
                                value={editData[`${field.key}_custom`] || ""}
                                onChange={(e) => handleFieldChange(`${field.key}_custom`, e.target.value)}
                                placeholder="Benutzerdefinierte Kleiderordnung eingeben..."
                              />
                            )}
                          </div>
                        ) : field.multiline ? (
                          <Textarea
                            value={editData[field.key] || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="resize-none"
                          />
                        ) : (
                          <Input
                            value={editData[field.key] || ""}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                        
                        {editData[field.key] && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircleIcon className="h-3 w-3" />
                            Ausgefüllt
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          
          {Object.values(fieldSections).every(section => 
            section.fields.every(field => !editData[field.key])
          ) && (
            <div className="text-center py-8 text-muted-foreground">
              <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Vorbereitungsdaten vorhanden.</p>
              <p className="text-sm">Klappen Sie die Bereiche auf, um Daten hinzuzufügen.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Details Sidebar */}
      {appointmentDetails && (
        <AppointmentDetailsSidebar
          appointment={{
            ...appointmentDetails,
            time: format(new Date(appointmentDetails.start), 'HH:mm', { locale: de }),
            duration: Math.round((new Date(appointmentDetails.end).getTime() - new Date(appointmentDetails.start).getTime()) / (1000 * 60)).toString(),
            date: new Date(appointmentDetails.start),
            type: (appointmentDetails.category || 'meeting') as 'deadline' | 'birthday' | 'vacation' | 'meeting' | 'appointment' | 'session' | 'blocked' | 'veranstaltung' | 'vacation_request',
            priority: (appointmentDetails.priority as 'high' | 'low' | 'medium') || 'medium',
            category: { color: '#3b82f6' }
          }}
          open={showAppointmentSidebar}
          onClose={() => setShowAppointmentSidebar(false)}
          onUpdate={() => fetchAppointmentDetails()}
        />
      )}
    </div>
  );
}