import React, { useState, useEffect, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DayView } from "./calendar/DayView";
import { WeekView } from "./calendar/WeekView";
import { MonthView } from "./calendar/MonthView";
import { AppointmentDetailsSidebar } from "./calendar/AppointmentDetailsSidebar";
import { PollListView } from "./poll/PollListView";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string; // Add description field
  time: string;
  duration: string;
  date: Date; // Add date field for proper filtering
  endTime?: Date; // Add actual end time from database
  location?: string;
  attendees?: number;
  participants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  type: "meeting" | "appointment" | "deadline" | "session" | "blocked" | "veranstaltung";
  priority: "low" | "medium" | "high";
  category_color?: string;
}

export function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "polls">("day");
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (view === 'week') {
      fetchWeekAppointments();
    } else {
      fetchTodaysAppointments();
    }
  }, [currentDate, view]);

  const fetchWeekAppointments = async () => {
    try {
      setLoading(true);
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Fetch regular appointments for the entire week
      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching appointments:', error);
        return;
      }

      await processAppointments(appointmentsData || [], weekStart, weekEnd);
    } catch (error) {
      console.error('Error fetching week appointments:', error);
    } finally {
      setLoading(false);
    }
  };

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

      await processAppointments(appointmentsData || [], startOfDay, endOfDay);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAppointments = async (appointmentsData: any[], startDate: Date, endDate: Date) => {
    try {
      console.log('🔍 Processing appointments for date range:', startDate.toISOString(), 'to', endDate.toISOString());
      
      // Fetch appointment categories to get colors
      const { data: categoriesData } = await supabase
        .from('appointment_categories')
        .select('name, color');

      // Create a map of category name to color
      const categoryColors = new Map();
      if (categoriesData) {
        categoriesData.forEach((cat: any) => {
          categoryColors.set(cat.name, cat.color);
        });
      }

      const formattedEvents: CalendarEvent[] = [];

      // Process regular appointments
      console.log('📅 Processing', appointmentsData.length, 'regular appointments');
      for (const appointment of appointmentsData) {
        const startTime = new Date(appointment.start_time);
        const endTime = new Date(appointment.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);

        // Fetch participants for this appointment
        const { data: contactsData } = await supabase
          .from('appointment_contacts')
          .select(`
            role,
            contacts (
              id,
              name
            )
          `)
          .eq('appointment_id', appointment.id);

        const participants = contactsData?.map((contact: any) => ({
          id: contact.contacts?.id || '',
          name: contact.contacts?.name || 'Unknown',
          role: contact.role || 'participant'
        })) || [];

        // Get the color for this category
        const categoryColor = categoryColors.get(appointment.category);

        formattedEvents.push({
          id: appointment.id,
          title: appointment.title,
          description: appointment.description || undefined,
          time: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          duration: `${durationHours}h`,
          date: startTime, // Add the actual date
          endTime: endTime, // Add actual end time from database
          location: appointment.location || undefined,
          type: appointment.category as CalendarEvent["type"] || "meeting",
          priority: appointment.priority as CalendarEvent["priority"] || "medium",
          participants,
          attendees: participants.length,
          category_color: categoryColor
        });
      }

      // Process external calendar events
      console.log('🔍 Fetching external events for date range...');
      const { data: externalEvents, error: externalError } = await supabase
        .from('external_events')
        .select(`
          *,
          external_calendars (
            name,
            color,
            calendar_type,
            user_id
          )
        `)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      console.log('📊 External events query result:', {
        data: externalEvents,
        error: externalError,
        count: externalEvents?.length || 0
      });

      // Process external events
      if (externalEvents && externalEvents.length > 0) {
        console.log('📅 Processing', externalEvents.length, 'external events');
        for (const externalEvent of externalEvents) {
          const startTime = new Date(externalEvent.start_time);
          const endTime = new Date(externalEvent.end_time);
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);

          formattedEvents.push({
            id: `external-${externalEvent.id}`,
            title: `📅 ${externalEvent.title}`,
            description: externalEvent.description || undefined,
            time: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            duration: externalEvent.all_day ? 'Ganztägig' : `${durationHours}h`,
            date: startTime,
            endTime: endTime,
            location: externalEvent.location || undefined,
            type: "appointment",
            priority: "medium",
            participants: [],
            attendees: 0,
            category_color: externalEvent.external_calendars?.color || '#6b7280'
          });
        }
      } else {
        console.log('⚠️ No external events found');
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      // Process blocked times from event planning
      const { data: eventPlanningData } = await supabase
        .from('event_planning_dates')
        .select(`
          *,
          event_plannings (
            title,
            user_id
          )
        `)
        .gte('date_time', startDate.toISOString())
        .lte('date_time', endDate.toISOString())
        .eq('event_plannings.user_id', currentUserId);

      if (eventPlanningData) {
        for (const eventDate of eventPlanningData) {
          if (eventDate.event_plannings) {
            const startTime = new Date(eventDate.date_time);
            const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
            
            // Try to fetch participants for the blocked event but handle gracefully if it fails
            let participants: any[] = [];
            try {
              const { data: contactsData } = await supabase
                .from('appointment_contacts')
                .select(`
                  role,
                  contacts (
                    id,
                    name
                  )
                `)
                .eq('appointment_id', `blocked-${eventDate.id}`);
              
              participants = contactsData?.map((contact: any) => ({
                id: contact.contacts?.id || '',
                name: contact.contacts?.name || 'Unknown',
                role: contact.role || 'participant'
              })) || [];
            } catch (error) {
              // Silently handle the error, participants will remain empty
              console.log('Could not fetch participants for blocked event');
            }

            // Determine title and type based on confirmation status
            const isConfirmed = eventDate.is_confirmed;
            const title = isConfirmed 
              ? eventDate.event_plannings.title 
              : `Planung: ${eventDate.event_plannings.title}`;
            const eventType = isConfirmed ? "veranstaltung" : "blocked";
            const categoryColor = isConfirmed 
              ? categoryColors.get('veranstaltung') || '#9333ea' 
              : categoryColors.get('blocked') || '#f97316';

            formattedEvents.push({
              id: `blocked-${eventDate.id}`,
              title: title,
              time: startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              duration: "2.0h",
              date: startTime,
              type: eventType as CalendarEvent["type"],
              priority: "medium",
              participants,
              attendees: participants.length,
              category_color: categoryColor
            });
          }
        }
      }

      setAppointments(formattedEvents);
    } catch (error) {
      console.error('Error processing appointments:', error);
      setAppointments([]);
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
    
    // Use startTransition for smoother updates
    startTransition(() => {
      setCurrentDate(newDate);
    });
  };

  const handleAppointmentClick = (appointment: CalendarEvent) => {
    setSelectedAppointment(appointment);
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSelectedAppointment(null);
  };

  const handleAppointmentUpdate = () => {
    // Refresh appointments after update/delete
    if (view === 'week') {
      fetchWeekAppointments();
    } else {
      fetchTodaysAppointments();
    }
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
          <div className="flex gap-2">
            <Button 
              className="gap-2"
              onClick={() => navigate("/appointments/new")}
            >
              <Plus className="h-4 w-4" />
              Neuer Termin
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setView("polls")}
            >
              Abstimmungen
            </Button>
          </div>
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
      <div className="w-full">
        {/* Main Calendar */}
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {view === "day" && "Tagesansicht"}
              {view === "week" && "Wochenansicht"}
              {view === "month" && "Monatsansicht"}
              {view === "polls" && "Terminabstimmungen"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view === "polls" ? (
              <PollListView />
            ) : loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Termine werden geladen...
              </div>
            ) : (
              <>
                {view === "day" && <DayView date={currentDate} events={appointments} onAppointmentClick={handleAppointmentClick} />}
                {view === "week" && <WeekView weekStart={getWeekStart(currentDate)} events={appointments} onAppointmentClick={handleAppointmentClick} />}
                {view === "month" && <MonthView date={currentDate} events={appointments} onDateSelect={setCurrentDate} />}
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Appointment Details Sidebar */}
      <AppointmentDetailsSidebar
        appointment={selectedAppointment}
        open={sidebarOpen}
        onClose={handleSidebarClose}
        onUpdate={handleAppointmentUpdate}
      />
    </div>
  );
}