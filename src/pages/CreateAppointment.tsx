import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addHours, addMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, ArrowLeft, Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { AppointmentPollCreator } from "@/components/poll/AppointmentPollCreator";
import { AppointmentFileUpload } from "@/components/appointments/AppointmentFileUpload";
import { ContactSelector } from "@/components/ContactSelector";
import { GuestManager } from "@/components/GuestManager";
import { RecurrenceSelector } from "@/components/ui/recurrence-selector";
import { useDistrictDetection } from "@/hooks/useDistrictDetection";
import sunflowerIcon from "@/assets/sunflower.svg";

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

const formatDateTimeForInput = (date: Date) => {
  return format(date, "yyyy-MM-dd'T'HH:mm");
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

const CreateAppointment = () => {
  const navigate = useNavigate();
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

    fetchData();
  }, [user, form]);

  // Helper function to generate RRULE string
  const generateRRULE = (recurrence: typeof recurrenceData) => {
    if (!recurrence.enabled) return null;
    
    const frequency = recurrence.frequency.toUpperCase();
    let rrule = `FREQ=${frequency}`;
    
    if (recurrence.interval && recurrence.interval > 1) {
      rrule += `;INTERVAL=${recurrence.interval}`;
    }
    
    if (recurrence.frequency === "weekly" && recurrence.weekdays && recurrence.weekdays.length > 0) {
      const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const selectedDays = recurrence.weekdays.map(day => weekdays[day]).join(",");
      rrule += `;BYDAY=${selectedDays}`;
    }
    
    if (recurrence.endDate) {
      const endDate = new Date(recurrence.endDate);
      const formattedEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rrule += `;UNTIL=${formattedEndDate}`;
    }
    
    return rrule;
  };

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
          invitation_token: crypto.randomUUID() + '-' + Date.now(), // Generate unique token
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

      navigate("/");
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
      // If end_date not set, set it to start_date
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
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Neuen Termin erstellen</h1>
            <p className="text-muted-foreground">Erstellen Sie einen neuen Terminkalendereintrag</p>
          </div>
        </div>

        {showPollCreator ? (
          <AppointmentPollCreator onClose={() => setShowPollCreator(false)} />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Termindetails
                  </CardTitle>
                  <CardDescription>
                    Geben Sie alle relevanten Informationen für Ihren Termin ein
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowPollCreator(true)}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Terminabstimmung
                </Button>
              </div>
            </CardHeader>
          <CardContent>
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
                            placeholder="Zusätzliche Details zum Termin" 
                            className="resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date and Time Section */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">Datum & Zeit</h3>
                    </div>
                    
                    {/* All-day toggle */}
                    <FormField
                      control={form.control}
                      name="is_all_day"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={handleAllDayChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            Ganztägige Veranstaltung
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {/* Date and time fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Startdatum *</FormLabel>
                            <FormControl>
                              <Input 
                                type="date"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {!isAllDay && (
                        <>
                          <FormField
                            control={form.control}
                            name="start_time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Startzeit *</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="time"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e.target.value);
                                      handleStartTimeChange(e.target.value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="end_time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Endzeit *</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="time"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {isAllDay && (
                        <FormField
                          control={form.control}
                          name="end_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Enddatum</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Ort
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-3">
                              <Select
                                onValueChange={(value) => {
                                  if (value === "digital") {
                                    field.onChange("Digital");
                                  } else if (value === "custom") {
                                    field.onChange("");
                                  } else {
                                    // Find the selected location from the list
                                    const selectedLocation = appointmentLocations.find(loc => loc.id === value);
                                    if (selectedLocation) {
                                      field.onChange(selectedLocation.name + (selectedLocation.address ? ` - ${selectedLocation.address}` : ''));
                                    } else {
                                      field.onChange(value);
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Veranstaltungsort auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="custom">Benutzerdefiniert eingeben</SelectItem>
                                  <SelectItem value="digital">Digital</SelectItem>
                                  {appointmentLocations.map((location) => (
                                    <SelectItem key={location.id} value={location.id}>
                                      {location.name}{location.address && ` - ${location.address}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {field.value === "Digital" && (
                                <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                                  <Input
                                    placeholder="Meeting-Link (z.B. Zoom, Teams)"
                                    onChange={(e) => {
                                      const digitalInfo = `Digital - ${e.target.value}`;
                                      field.onChange(digitalInfo);
                                    }}
                                  />
                                  <Input
                                    placeholder="Meeting-ID oder Zugangsdetails"
                                    onChange={(e) => {
                                      const currentValue = field.value || "Digital";
                                      const parts = currentValue.split(" - ");
                                      const link = parts[1] || "";
                                      field.onChange(`Digital - ${link} - ${e.target.value}`);
                                    }}
                                  />
                                </div>
                              )}
                              
                               {field.value !== "Digital" && !appointmentLocations.find(loc => field.value?.includes(loc.name)) && (
                                <Input 
                                  placeholder="Genaue Adresse oder Raum"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    field.onChange(e.target.value);
                                    // Trigger district detection after user stops typing
                                    const timeoutId = setTimeout(() => {
                                      handleLocationDetection(e.target.value);
                                    }, 1000);
                                    return () => clearTimeout(timeoutId);
                                  }}
                                  onBlur={() => {
                                    if (field.value) {
                                      handleLocationDetection(field.value);
                                    }
                                  }}
                                />
                              )}
                             </div>
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />

                     {/* District Detection Results */}
                     {(districtLoading || districtResult || districtError) && (
                       <div className="space-y-3">
                         {districtLoading && (
                           <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                             <div className="animate-pulse h-4 w-4 bg-primary/20 rounded-full"></div>
                             <span className="text-sm text-muted-foreground">Wahlkreis wird ermittelt...</span>
                           </div>
                         )}

                         {districtError && (
                           <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                             <p className="text-sm text-destructive">
                               Wahlkreis konnte nicht ermittelt werden: {districtError}
                             </p>
                           </div>
                         )}

                         {districtResult && (
                           <div className="space-y-3">
                             {districtResult.district && (
                               <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                                 <div className="flex items-start gap-3">
                                   <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                                     <MapPin className="h-3 w-3 text-primary" />
                                   </div>
                                   <div className="flex-1">
                                     <h4 className="font-medium text-primary">Wahlkreis ermittelt</h4>
                                     <p className="text-sm text-primary/80 mt-1">
                                       <strong>{districtResult.district.district_name}</strong> (Wahlkreis {districtResult.district.district_number})
                                     </p>
                                   </div>
                                 </div>
                               </div>
                             )}

                             {districtResult.partyAssociation && (
                               <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                                 <div className="flex items-start gap-3">
                                   <div className="flex-shrink-0">
                                     <img src={sunflowerIcon} alt="Kreisverband" className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                     <h4 className="font-medium text-green-800">Zuständiger Kreisverband</h4>
                                     <div className="mt-2 space-y-1 text-sm text-green-700">
                                       <p><strong>{districtResult.partyAssociation.name}</strong></p>
                                       {districtResult.partyAssociation.contact_person && (
                                         <p>Ansprechpartner: {districtResult.partyAssociation.contact_person}</p>
                                       )}
                                       {districtResult.partyAssociation.phone && (
                                         <p>Telefon: {districtResult.partyAssociation.phone}</p>
                                       )}
                                       {districtResult.partyAssociation.email && (
                                         <p>E-Mail: {districtResult.partyAssociation.email}</p>
                                       )}
                                       {districtResult.partyAssociation.website && (
                                         <p>
                                           Website: <a 
                                             href={districtResult.partyAssociation.website} 
                                             target="_blank" 
                                             rel="noopener noreferrer"
                                             className="text-green-600 hover:text-green-500 underline"
                                           >
                                             {districtResult.partyAssociation.website}
                                           </a>
                                         </p>
                                       )}
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             )}

                             {districtResult.district && !districtResult.partyAssociation && (
                               <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                 <p className="text-sm text-amber-800">
                                   Für diesen Wahlkreis ist noch kein Grüner Kreisverband in der Datenbank hinterlegt.
                                 </p>
                               </div>
                             )}

                             {!districtResult.district && (
                               <div className="p-3 bg-muted border border-border rounded-md">
                                 <p className="text-sm text-muted-foreground">
                                   Der Ort konnte keinem Wahlkreis zugeordnet werden.
                                 </p>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     )}

                  {/* Participants Section - moved here between location and category */}
                  <div className="md:col-span-2">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <h3 className="text-lg font-semibold">Teilnehmer</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <ContactSelector
                          onSelect={addContact}
                          placeholder="Kontakt aus Favoriten oder Liste auswählen..."
                          clearAfterSelect={true}
                        />

                        {selectedContacts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedContacts.map((contact) => (
                              <Badge key={contact.id} variant="secondary" className="gap-1">
                                {contact.name}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-transparent"
                                  onClick={() => removeContact(contact.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Kategorie auswählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {appointmentCategories.map((category) => (
                              <SelectItem key={category.name} value={category.name}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Advanced Options Toggle */}
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="text-primary hover:text-primary/80"
                  >
                    {showAdvancedOptions ? "Weitere Details ausblenden" : "Weitere Details anzeigen"}
                  </Button>
                </div>

                {/* Advanced Options - Collapsible */}
                {showAdvancedOptions && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priorität</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Priorität auswählen" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(priorityLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Status auswählen" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {appointmentStatuses.map((status) => (
                                <SelectItem key={status.name} value={status.name}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reminder_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Erinnerung (Minuten vorher)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              placeholder="15" 
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Separator />

                 <div className="space-y-4">
                   <div className="flex items-center gap-2">
                     <Users className="h-5 w-5" />
                     <h3 className="text-lg font-semibold">Externe Gäste</h3>
                   </div>
                    <GuestManager
                      guests={appointmentGuests}
                      onGuestsChange={setAppointmentGuests}
                    />
                 </div>

                 <div className="space-y-4">
                   <div className="flex items-center gap-2">
                     <Clock className="h-5 w-5" />
                     <h3 className="text-lg font-semibold">Dokumente</h3>
                   </div>
                   <AppointmentFileUpload 
                     onFilesChange={setUploadedFiles}
                   />
                 </div>

                <div className="flex justify-end gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={loading} className="gap-2">
                    <Save className="h-4 w-4" />
                    {loading ? "Speichern..." : "Termin speichern"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};

export default CreateAppointment;