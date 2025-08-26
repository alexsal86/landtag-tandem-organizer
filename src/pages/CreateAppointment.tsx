import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
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

const appointmentSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  start_time: z.string().min(1, "Startzeit ist erforderlich"),
  end_time: z.string().min(1, "Endzeit ist erforderlich"),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1, "Kategorie ist erforderlich"),
  status: z.string().min(1, "Status ist erforderlich"),
  reminder_minutes: z.number().min(0),
  is_all_day: z.boolean().default(false),
}).refine((data) => {
  if (data.is_all_day) {
    // For all-day events, only check dates
    const startDate = new Date(data.start_time);
    const endDate = new Date(data.end_time);
    return endDate >= startDate;
  } else {
    // For regular events, check full datetime
    const startTime = new Date(data.start_time);
    const endTime = new Date(data.end_time);
    return endTime > startTime;
  }
}, {
  message: "Endzeit muss nach der Startzeit liegen",
  path: ["end_time"],
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

const CreateAppointment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [appointmentCategories, setAppointmentCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentLocations, setAppointmentLocations] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      location: "",
      priority: "medium",
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
        { data: contactsData, error: contactsError },
        { data: categoriesData, error: categoriesError },
        { data: statusesData, error: statusesError },
        { data: locationsData, error: locationsError }
      ] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('appointment_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_statuses').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_locations').select('id, name, address').eq('is_active', true).order('order_index')
      ]);
      
      if (contactsError) console.error('Error fetching contacts:', contactsError);
      if (categoriesError) console.error('Error fetching categories:', categoriesError);
      if (statusesError) console.error('Error fetching statuses:', statusesError);
      if (locationsError) console.error('Error fetching locations:', locationsError);
      
      setContacts(contactsData || []);
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

  const onSubmit = async (values: AppointmentFormValues) => {
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
      let startTime = values.start_time;
      let endTime = values.end_time;
      
      // For all-day events, set proper times
      if (values.is_all_day) {
        startTime = values.start_time + "T00:00:00";
        endTime = values.end_time + "T23:59:59";
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
      // Convert datetime-local to date format
      const currentStartTime = form.getValues("start_time");
      const currentEndTime = form.getValues("end_time");
      
      if (currentStartTime) {
        const startDate = currentStartTime.split("T")[0];
        form.setValue("start_time", startDate);
      }
      
      if (currentEndTime) {
        const endDate = currentEndTime.split("T")[0];
        form.setValue("end_time", endDate);
      } else if (currentStartTime) {
        // Set end date to same as start date if not set
        const startDate = currentStartTime.split("T")[0];
        form.setValue("end_time", startDate);
      }
    } else {
      // Convert date back to datetime-local format
      const currentStartTime = form.getValues("start_time");
      const currentEndTime = form.getValues("end_time");
      
      if (currentStartTime && !currentStartTime.includes("T")) {
        form.setValue("start_time", currentStartTime + "T09:00");
      }
      
      if (currentEndTime && !currentEndTime.includes("T")) {
        form.setValue("end_time", currentEndTime + "T10:00");
      }
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

                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Startzeit *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type={isAllDay ? "date" : "datetime-local"}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_all_day"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0 md:col-span-2">
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

                  <FormField
                    control={form.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {isAllDay ? "Enddatum *" : "Endzeit *"}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type={isAllDay ? "date" : "datetime-local"}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                                  onChange={field.onChange}
                                />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                    <Clock className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Dokumente</h3>
                  </div>
                  <AppointmentFileUpload 
                    onFilesChange={setUploadedFiles}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Teilnehmer</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <Select onValueChange={(value) => {
                      const contact = contacts.find(c => c.id === value);
                      if (contact) addContact(contact);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kontakt hinzufügen" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts
                          .filter(contact => !selectedContacts.find(c => c.id === contact.id))
                          .map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name} {contact.email && `(${contact.email})`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

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