import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DayView } from "./calendar/DayView";
import { WeekView } from "./calendar/WeekView";
import { MonthView } from "./calendar/MonthView";

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  location?: string;
  attendees?: number;
  participants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  type: "meeting" | "appointment" | "deadline" | "session" | "blocked";
  priority: "low" | "medium" | "high";
}

export function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodaysAppointments();
  }, [currentDate]);

  const fetchTodaysAppointments = async () => {
    try {
      setLoading(true);
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch regular appointments
      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching appointments:', error);
        return;
      }

      // Also fetch blocked appointments from event planning dates
      const { data: eventPlanningDates } = await supabase
        .from('event_planning_dates')
        .select(`
          *,
          event_plannings (
            title,
            user_id
          )
        `)
        .gte('date_time', startOfDay.toISOString())
        .lte('date_time', endOfDay.toISOString())
        .eq('event_plannings.user_id', (await supabase.auth.getUser()).data.user?.id);

      // Combine all appointments
      const allAppointments = [...(appointmentsData || [])];

      // Add blocked appointments from event planning
      if (eventPlanningDates) {
        for (const epd of eventPlanningDates) {
          if (epd.event_plannings && !epd.appointment_id) {
            // Create virtual blocked appointment if no real appointment exists
            allAppointments.push({
              id: `blocked-${epd.id}`,
              user_id: epd.event_plannings.user_id,
              title: `Geplant: ${epd.event_plannings.title}`,
              start_time: epd.date_time,
              end_time: new Date(new Date(epd.date_time).getTime() + 2 * 60 * 60 * 1000).toISOString(),
              category: 'blocked',
              status: epd.is_confirmed ? 'confirmed' : 'planned',
              priority: 'medium',
              location: null,
              description: null,
              reminder_minutes: 15,
              meeting_id: null,
              contact_id: null,
              created_at: epd.created_at,
              updated_at: epd.created_at
            });
          }
        }
      }

      const formattedEvents: CalendarEvent[] = [];

      for (const appointment of allAppointments) {
        const startTime = new Date(appointment.start_time);
        const endTime = new Date(appointment.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10;
        
        // Fetch participants for this appointment
        const { data: appointmentContacts } = await supabase
          .from('appointment_contacts')
          .select(`
            role,
            contacts (
              id,
              name
            )
          `)
          .eq('appointment_id', appointment.id);

        const participants = appointmentContacts?.map(ac => ({
          id: ac.contacts.id,
          name: ac.contacts.name,
          role: ac.role
        })) || [];

        formattedEvents.push({
          id: appointment.id,
          title: appointment.title,
          time: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          duration: `${durationHours}h`,
          location: appointment.location || undefined,
          type: appointment.category as CalendarEvent["type"] || "meeting",
          priority: appointment.priority as CalendarEvent["priority"] || "medium",
          participants,
          attendees: participants.length
        });
      }

      setAppointments(formattedEvents);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
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

  const getPriorityIndicator = (priority: CalendarEvent["priority"]) => {
    switch (priority) {
      case "high":
        return "border-l-4 border-l-destructive";
      case "medium":
        return "border-l-4 border-l-government-gold";
      case "low":
        return "border-l-4 border-l-muted-foreground";
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
    return new Date(d.setDate(diff));
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (view) {
      case 'day':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Terminkalender</h1>
            <p className="text-muted-foreground">{formatDate(currentDate)}</p>
          </div>
          <Button 
            className="gap-2"
            onClick={() => navigate("/appointments/new")}
          >
            <Plus className="h-4 w-4" />
            Neuer Termin
          </Button>
        </div>

        {/* View Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Heute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            {["day", "week", "month"].map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? "default" : "outline"}
                size="sm"
                onClick={() => setView(viewType as typeof view)}
              >
                {viewType === "day" && "Tag"}
                {viewType === "week" && "Woche"}
                {viewType === "month" && "Monat"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar */}
        <Card className="lg:col-span-3 bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {view === "day" && "Tagesansicht"}
              {view === "week" && "Wochenansicht"}
              {view === "month" && "Monatsansicht"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Termine werden geladen...
              </div>
            ) : (
              <>
                {view === "day" && <DayView date={currentDate} events={appointments} />}
                {view === "week" && <WeekView weekStart={getWeekStart(currentDate)} events={appointments} />}
                {view === "month" && <MonthView date={currentDate} events={appointments} onDateSelect={setCurrentDate} />}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Heute</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Termine gesamt</span>
                  <span className="font-semibold">{appointments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sitzungen</span>
                  <span className="font-semibold">{appointments.filter(e => e.type === "session").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Termine</span>
                  <span className="font-semibold">{appointments.filter(e => e.type === "appointment").length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Nächste Termine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="font-medium">Morgen</div>
                  <div className="text-muted-foreground">Plenarsitzung - 09:00</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Übermorgen</div>
                  <div className="text-muted-foreground">Wahlkreistermin - 14:00</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}