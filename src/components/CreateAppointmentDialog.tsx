import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addHours, addMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { AppointmentPollCreator } from "@/components/poll/AppointmentPollCreator";
import { AppointmentFileUpload } from "@/components/appointments/AppointmentFileUpload";
import { ContactSelector } from "@/components/ContactSelector";
import { GuestManager } from "@/components/GuestManager";
import { RecurrenceSelector } from "@/components/ui/recurrence-selector";
import { useDistrictDetection } from "@/hooks/useDistrictDetection";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Tag } from "lucide-react";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { saveAppointmentTopics } from "@/hooks/useAppointmentTopics";

// Helper functions for intelligent date/time defaults
const getDefaultStartTime = () => {
  const now = new Date();
  // Round to next quarter hour
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  const roundedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes);
  
  // If we're past the hour, add an hour
  if (roundedMinutes >= 60) {
    roundedTime.setHours(roundedTime.getHours() + 1);
    roundedTime.setMinutes(0);
  }
  
  return roundedTime;
};

const getDefaultEndTime = (startTime: Date) => {
  return addHours(startTime, 1);
};

const formatDateForInput = (date: Date) => {
  return format(date, 'yyyy-MM-dd');
};

const formatTimeForInput = (date: Date) => {
  return format(date, 'HH:mm');
};

const appointmentSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  start_date: z.string().min(1, "Startdatum ist erforderlich"),
  start_time: z.string().optional(),
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1, "Kategorie ist erforderlich"),
  status: z.string().min(1, "Status ist erforderlich"),
  reminder_minutes: z.number().min(0),
  is_all_day: z.boolean().default(false),
}).refine((data) => {
  if (data.is_all_day) {
    // For all-day events, only check dates
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date || data.start_date);
    return endDate >= startDate;
  } else {
    // For regular events, check full datetime
    const startDateTime = new Date(`${data.start_date}T${data.start_time || '00:00'}`);
    const endDateTime = new Date(`${data.end_date || data.start_date}T${data.end_time || '00:00'}`);
    return endDateTime > startDateTime;
  }
}, {
  message: "Endzeit muss nach der Startzeit liegen",
  path: ["end_time"],
});

type AppointmentFormValues = z.infer<typeof appointmentSchema> & {
  is_all_day: boolean;
};

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateAppointmentDialog = ({ open, onOpenChange }: CreateAppointmentDialogProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [appointmentCategories, setAppointmentCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentLocations, setAppointmentLocations] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [appointmentGuests, setAppointmentGuests] = useState<Array<{name: string, email: string}>>([]);
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState({
    enabled: false,
    frequency: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
    interval: 1,
    weekdays: [] as number[],
    endDate: undefined as string | undefined,
  });
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // District detection
  const { detectDistrict, loading: districtLoading, result: districtResult, error: districtError, clearResult } = useDistrictDetection();

  const form = useForm({
    resolver: zodResolver(appointmentSchema) as any,
    mode: "onSubmit" as const,
    defaultValues: {
      title: "",
      description: "",
      start_date: formatDateForInput(getDefaultStartTime()),
      start_time: formatTimeForInput(getDefaultStartTime()),
      end_date: formatDateForInput(getDefaultStartTime()),
      end_time: formatTimeForInput(getDefaultEndTime(getDefaultStartTime())),
      location: "",
      priority: "medium" as const,
      category: "meeting",
      status: "planned",
      reminder_minutes: 15,
      is_all_day: false,
    },
  });

  // Handle URL parameters for pre-filled date/time
  useEffect(() => {
    if (open) {
      const urlParams = new URLSearchParams(location.search);
      const startParam = urlParams.get('start');
      const endParam = urlParams.get('end');
      
      if (startParam) {
        const startDate = new Date(startParam);
        form.setValue('start_date', formatDateForInput(startDate));
        form.setValue('start_time', formatTimeForInput(startDate));
      }
      
      if (endParam) {
        const endDate = new Date(endParam);
        form.setValue('end_date', formatDateForInput(endDate));
        form.setValue('end_time', formatTimeForInput(endDate));
      }
    }
  }, [open, location.search, form]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const [
        { data: categoriesData, error: categoriesError },
        { data: statusesData, error: statusesError },
        { data: locationsData, error: locationsError }
      ] = await Promise.all([
        supabase.from('appointment_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_statuses').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_locations').select('id, name, address').eq('is_active', true).order('order_index')
      ]);
      
      if (categoriesError) console.error('Error fetching categories:', categoriesError);
      if (statusesError) console.error('Error fetching statuses:', statusesError);
      if (locationsError) console.error('Error fetching locations:', locationsError);
      setAppointmentCategories(categoriesData || []);
      setAppointmentStatuses(statusesData || []);
      setAppointmentLocations(locationsData || []);

      // Set default values if data is available
      if (categoriesData && categoriesData.length > 0) {
        form.setValue('category', categoriesData[0].name as any);
      }
      if (statusesData && statusesData.length > 0) {
        form.setValue('status', statusesData[0].name as any);
      }
    };

    if (open) {
      fetchData();
    }
  }, [user, form, open]);

  // Function to handle location detection
  const handleLocationDetection = async (location: string) => {
    if (!location || location === "Digital" || location.trim() === "") {
      clearResult();
      return;
    }

    console.log('Triggering district detection for:', location);
    await detectDistrict(location);
  };

  const onSubmit = async (values: any) => {
    if (!user) return;

    if (!currentTenant) {
      toast({
        title: "Fehler",
        description: "Kein Tenant ausgewählt. Bitte wählen Sie einen Tenant aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let startTime: string;
      let endTime: string;
      
      // Build datetime strings from separate date/time fields
      if (values.is_all_day) {
        startTime = values.start_date + "T00:00:00";
        endTime = (values.end_date || values.start_date) + "T23:59:59";
      } else {
        startTime = values.start_date + "T" + (values.start_time || "09:00") + ":00";
        endTime = (values.end_date || values.start_date) + "T" + (values.end_time || "10:00") + ":00";
      }

      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          title: values.title,
          description: values.description,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          location: values.location,
          priority: values.priority,
          category: values.category,
          status: values.status,
          reminder_minutes: values.reminder_minutes,
          user_id: user.id,
          tenant_id: currentTenant.id,
          is_all_day: values.is_all_day,
          has_external_guests: appointmentGuests.length > 0,
        })
        .select()
        .single();

      if (appointmentError) {
        console.error('Appointment error:', appointmentError);
        throw appointmentError;
      }

      // Save topics for the appointment
      if (selectedTopicIds.length > 0 && appointment) {
        await saveAppointmentTopics(appointment.id, selectedTopicIds);
      }

      // Link selected contacts to appointment
      if (selectedContacts.length > 0 && appointment) {
        const contactLinks = selectedContacts.map(contact => ({
          appointment_id: appointment.id,
          contact_id: contact.id,
          role: 'participant',
        }));

        const { error: contactError } = await supabase
          .from('appointment_contacts')
          .insert(contactLinks);

        if (contactError) throw contactError;
      }

      // Add external guests to appointment
      if (appointmentGuests.length > 0 && appointment) {
        const guestEntries = appointmentGuests.map(guest => ({
          appointment_id: appointment.id,
          tenant_id: currentTenant.id,
          name: guest.name,
          email: guest.email,
          status: 'invited' as const,
          invitation_token: crypto.randomUUID() + '-' + Date.now(),
        }));

        const { error: guestsError } = await supabase
          .from('appointment_guests')
          .insert(guestEntries);

        if (guestsError) throw guestsError;

        // Automatically send invitations to all guests
        try {
          const { error: invitationError } = await supabase.functions.invoke('send-appointment-invitation', {
            body: { 
              appointmentId: appointment.id,
              sendToAll: true 
            }
          });

          if (invitationError) {
            console.error('Error sending invitations:', invitationError);
            toast({
              title: "Warnung",
              description: "Termin wurde erstellt, aber Einladungen konnten nicht versendet werden.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Einladungen versendet",
              description: `Einladungen wurden an ${appointmentGuests.length} Gäste versendet.`
            });
          }
        } catch (error) {
          console.error('Error sending invitations:', error);
          toast({
            title: "Warnung", 
            description: "Termin wurde erstellt, aber Einladungen konnten nicht versendet werden.",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Termin erstellt",
        description: "Der Termin wurde erfolgreich gespeichert.",
      });

      // Close dialog and navigate to calendar
      onOpenChange(false);
      navigate("/calendar");
    } catch (error: any) {
      toast({
        title: "Fehler beim Erstellen",
        description: error.message || "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addContact = (contact: any) => {
    if (!selectedContacts.find(c => c.id === contact.id)) {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const removeContact = (contactId: string) => {
    setSelectedContacts(selectedContacts.filter(c => c.id !== contactId));
  };

  const handleAllDayChange = (checked: boolean) => {
    setIsAllDay(checked);
    form.setValue("is_all_day", checked);
    
    if (checked) {
      // For all-day events, use date fields only
      const currentStartDate = form.getValues("start_date");
      const currentEndDate = form.getValues("end_date");
      
      if (!currentEndDate && currentStartDate) {
        form.setValue("end_date", currentStartDate);
      }
    } else {
      // For timed events, ensure we have time values
      const currentStartTime = form.getValues("start_time");
      const currentEndTime = form.getValues("end_time");
      
      if (!currentStartTime) {
        form.setValue("start_time", formatTimeForInput(getDefaultStartTime()));
      }
      if (!currentEndTime) {
        const startTime = currentStartTime ? new Date(`2000-01-01T${currentStartTime}`) : getDefaultStartTime();
        form.setValue("end_time", formatTimeForInput(addHours(startTime, 1)));
      }
    }
  };

  const handleStartTimeChange = (timeValue: string) => {
    form.setValue("start_time", timeValue);
    
    // Auto-calculate end time (1 hour later)
    if (!isAllDay && timeValue) {
      const startDateTime = new Date(`2000-01-01T${timeValue}`);
      const endDateTime = addHours(startDateTime, 1);
      form.setValue("end_time", formatTimeForInput(endDateTime));
    }
  };

  const priorityLabels = {
    low: "Niedrig",
    medium: "Mittel", 
    high: "Hoch",
    urgent: "Dringend"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Neuen Termin erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Terminkalendereintrag
          </DialogDescription>
        </DialogHeader>

        {showPollCreator ? (
          <AppointmentPollCreator onClose={() => setShowPollCreator(false)} />
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowPollCreator(true)}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Terminabstimmung
              </Button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Titel *</FormLabel>
                        <FormControl>
                          <Input placeholder="Titel des Termins" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Beschreibung</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Beschreibung des Termins"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* All-day checkbox */}
                  <FormField
                    control={form.control}
                    name="is_all_day"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => handleAllDayChange(checked as boolean)}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Ganztägig</FormLabel>
                          <FormDescription>
                            Termin als ganztägiges Ereignis markieren
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Date and time fields */}
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Startdatum *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isAllDay && (
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Startzeit</FormLabel>
                          <FormControl>
                            <TimePickerCombobox
                              value={field.value}
                              onChange={(value) => {
                                field.onChange(value);
                                handleStartTimeChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enddatum</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isAllDay && (
                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endzeit</FormLabel>
                          <FormControl>
                            <TimePickerCombobox
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Location field */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Ort</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleLocationDetection(value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ort auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Digital">Digital</SelectItem>
                              {appointmentLocations.map(location => (
                                <SelectItem key={location.id} value={location.name}>
                                  {location.name}
                                  {location.address && (
                                    <span className="text-muted-foreground ml-2">
                                      - {location.address}
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category and Status */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie *</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Kategorie wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {appointmentCategories.map(category => (
                                <SelectItem key={category.name} value={category.name}>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Status wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {appointmentStatuses.map(status => (
                                <SelectItem key={status.name} value={status.name}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Priority */}
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priorität</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(priorityLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reminder */}
                  <FormField
                    control={form.control}
                    name="reminder_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Erinnerung (Minuten)</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Keine Erinnerung</SelectItem>
                              <SelectItem value="5">5 Minuten</SelectItem>
                              <SelectItem value="15">15 Minuten</SelectItem>
                              <SelectItem value="30">30 Minuten</SelectItem>
                              <SelectItem value="60">1 Stunde</SelectItem>
                              <SelectItem value="1440">1 Tag</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Advanced options */}
                <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                      Erweiterte Optionen
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 mt-6">
                    {/* Contact selection */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Teilnehmer</h3>
                      <ContactSelector onSelect={addContact} />
                      
                      {selectedContacts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Ausgewählte Kontakte:</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedContacts.map(contact => (
                              <Badge key={contact.id} variant="secondary" className="gap-2">
                                {contact.first_name} {contact.last_name}
                                <X 
                                  className="h-3 w-3 cursor-pointer" 
                                  onClick={() => removeContact(contact.id)}
                                />
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Guest management */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Externe Gäste</h3>
                      <GuestManager
                        guests={appointmentGuests}
                        onGuestsChange={setAppointmentGuests}
                      />
                    </div>

                    {/* File uploads */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Dateien</h3>
                      <AppointmentFileUpload
                        onFilesChange={setUploadedFiles}
                        appointmentId={null}
                      />
                    </div>

                    {/* Topic selection */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Themen
                      </h3>
                      <TopicSelector
                        selectedTopicIds={selectedTopicIds}
                        onTopicsChange={setSelectedTopicIds}
                        placeholder="Themen zuweisen..."
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Submit buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => onOpenChange(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Erstelle...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Termin erstellen
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};