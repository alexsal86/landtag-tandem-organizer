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
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const appointmentSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  start_time: z.string().min(1, "Startzeit ist erforderlich"),
  end_time: z.string().min(1, "Endzeit ist erforderlich"),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.enum(["meeting", "appointment", "event", "task", "other"]),
  status: z.enum(["planned", "confirmed", "cancelled", "completed"]),
  reminder_minutes: z.number().min(0),
}).refine((data) => {
  const start = new Date(data.start_time);
  const end = new Date(data.end_time);
  return end > start;
}, {
  message: "Endzeit muss nach der Startzeit liegen",
  path: ["end_time"],
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

const CreateAppointment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [appointmentCategories, setAppointmentCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<Array<{ name: string; label: string }>>([]);

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
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const [
        { data: contactsData, error: contactsError },
        { data: categoriesData, error: categoriesError },
        { data: statusesData, error: statusesError }
      ] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('appointment_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_statuses').select('name, label').eq('is_active', true).order('order_index')
      ]);
      
      if (contactsError) console.error('Error fetching contacts:', contactsError);
      if (categoriesError) console.error('Error fetching categories:', categoriesError);
      if (statusesError) console.error('Error fetching statuses:', statusesError);
      
      setContacts(contactsData || []);
      setAppointmentCategories(categoriesData || []);
      setAppointmentStatuses(statusesData || []);

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

    setLoading(true);
    try {
      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          title: values.title,
          description: values.description,
          start_time: new Date(values.start_time).toISOString(),
          end_time: new Date(values.end_time).toISOString(),
          location: values.location,
          priority: values.priority,
          category: values.category,
          status: values.status,
          reminder_minutes: values.reminder_minutes,
          user_id: user.id,
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

  const priorityLabels = {
    low: "Niedrig",
    medium: "Mittel", 
    high: "Hoch",
    urgent: "Dringend"
  };

  const categoryLabels = {
    meeting: "Besprechung",
    appointment: "Termin",
    event: "Veranstaltung",
    task: "Aufgabe",
    other: "Sonstiges"
  };

  const statusLabels = {
    planned: "Geplant",
    confirmed: "Bestätigt",
    cancelled: "Abgesagt",
    completed: "Abgeschlossen"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Termindetails
            </CardTitle>
            <CardDescription>
              Geben Sie alle relevanten Informationen für Ihren Termin ein
            </CardDescription>
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
                            type="datetime-local" 
                            {...field} 
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
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Endzeit *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local" 
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
                      <FormItem className="md:col-span-2">
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Ort
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Veranstaltungsort" {...field} />
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
      </div>
    </div>
  );
};

export default CreateAppointment;