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
import { ProperReactBigCalendar } from "./calendar/ProperReactBigCalendar";
import { AppointmentDetailsSidebar } from "./calendar/AppointmentDetailsSidebar";
import AppointmentPreparationSidebar from "./AppointmentPreparationSidebar";
import { PollListView } from "./poll/PollListView";
import { useTenant } from "@/hooks/useTenant";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { useFeatureFlag, FeatureFlagToggle } from "@/hooks/useFeatureFlag";
import { useToast } from "@/hooks/use-toast";
import { rrulestr } from "rrule";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  time: string;
  duration: string;
  date: Date;
  endTime?: Date;
  location?: string;
  attendees?: number;
  participants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  type: "meeting" | "appointment" | "deadline" | "session" | "blocked" | "veranstaltung" | "vacation" | "vacation_request" | "birthday";
  priority: "low" | "medium" | "high";
  category_color?: string;
  is_all_day?: boolean;
  allDay?: boolean; // Add allDay for RBC compatibility
  category?: { // Add category object for RBC
    color: string;
  };
  // Optional metadata properties
  _isExternal?: boolean;
  _isRecurring?: boolean;
  _originalId?: string;
}

export function CalendarView() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { isItemNew, clearAllIndicators } = useNewItemIndicators('calendar');
  const { flags } = useFeatureFlag();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "agenda" | "polls">("day");
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preparationSidebarOpen, setPreparationSidebarOpen] = useState(false);
  const [selectedAppointmentForPreparation, setSelectedAppointmentForPreparation] = useState<CalendarEvent | null>(null);

  // Type guard to check if view is a calendar view
  const isCalendarView = (v: string): v is "day" | "week" | "month" | "agenda" => {
    return v === "day" || v === "week" || v === "month" || v === "agenda";
  };

  useEffect(() => {
    if (view === 'week') {
      fetchWeekAppointments();
    } else if (view === 'month') {
      fetchMonthAppointments();
    } else {
      fetchTodaysAppointments();
    }
  }, [currentDate, view, currentTenant]);

  const fetchMonthAppointments = async () => {
    if (!currentTenant) {
      console.log('⚠️ Tenant not ready, postponing month fetch');
      return;
    }
    
    try {
      setLoading(true);
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      console.log('🔍 MONTH VIEW DEBUGGING - Fetching appointments for month:', monthStart.toISOString(), 'to', monthEnd.toISOString());
      console.log('🔍 Current date for month view:', currentDate.toISOString());
      console.log('🔍 Month calculation:', { 
        year: currentDate.getFullYear(), 
        month: currentDate.getMonth(), 
        monthName: monthStart.toLocaleDateString('de-DE', { month: 'long' })
      });

      // Fetch regular appointments that overlap with the month
      const { data: regularAppointments, error: regularError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .or(`and(start_time.lte.${monthEnd.toISOString()},end_time.gte.${monthStart.toISOString()}),and(start_time.gte.${monthStart.toISOString()},start_time.lte.${monthEnd.toISOString()})`)
        .is('recurrence_rule', null)
        .order('start_time', { ascending: true });

      // Fetch ALL recurring appointments (regardless of their original date)
      const { data: recurringAppointments, error: recurringError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .not('recurrence_rule', 'is', null)
        .order('start_time', { ascending: true });

      if (regularError || recurringError) {
        console.error('Error fetching appointments:', regularError || recurringError);
        return;
      }

      // Combine regular and recurring appointments
      let appointmentsData = [
        ...(regularAppointments || []),
        ...(recurringAppointments || [])
      ];

      console.log('📊 MONTH VIEW - Found appointments for month:', appointmentsData?.length || 0);
      appointmentsData?.forEach(apt => {
        console.log('  -', apt.title, 'from', apt.start_time, 'to', apt.end_time, 'all_day:', apt.is_all_day);
      });
      
      // If no appointments found, create a test appointment for current month
      if (!appointmentsData || appointmentsData.length === 0) {
        console.log('⚠️ MONTH VIEW - No appointments found, creating test appointment');
        const testDate = new Date();
        testDate.setHours(14, 0, 0, 0); // 2 PM today
        const testEndDate = new Date(testDate);
        testEndDate.setHours(15, 0, 0, 0); // 3 PM today
        
        appointmentsData = [{
          id: 'test-appointment-' + Date.now(),
          title: 'Test Termin (Debug)',
          description: 'Dies ist ein Test-Termin zum Debuggen der Monatsansicht',
          start_time: testDate.toISOString(),
          end_time: testEndDate.toISOString(),
          category: 'appointment',
          priority: 'medium',
          location: '',
          status: 'confirmed',
          is_all_day: false,
          meeting_id: '',
          contact_id: '',
          poll_id: '',
          reminder_minutes: 15,
          recurrence_rule: '',
          recurrence_end_date: ''
        }];
        console.log('✅ MONTH VIEW - Created test appointment:', appointmentsData[0]);
      }

      await processAppointments(appointmentsData || [], monthStart, monthEnd);
    } catch (error) {
      console.error('Error fetching month appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekAppointments = async () => {
    if (!currentTenant) {
      console.log('⚠️ Tenant not ready, postponing week fetch');
      return;
    }
    
    try {
      setLoading(true);
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      console.log('🔍 Fetching appointments for week:', weekStart.toISOString(), 'to', weekEnd.toISOString());
      
      // Fetch regular appointments that overlap with the week
      const { data: regularAppointments, error: regularError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .or(`and(start_time.lte.${weekEnd.toISOString()},end_time.gte.${weekStart.toISOString()}),and(start_time.gte.${weekStart.toISOString()},start_time.lte.${weekEnd.toISOString()})`)
        .is('recurrence_rule', null)
        .order('start_time', { ascending: true });

      // Fetch ALL recurring appointments (regardless of their original date)
      const { data: recurringAppointments, error: recurringError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .not('recurrence_rule', 'is', null)
        .order('start_time', { ascending: true });

      if (regularError || recurringError) {
        console.error('Error fetching appointments:', regularError || recurringError);
        return;
      }

      // Combine regular and recurring appointments
      const appointmentsData = [
        ...(regularAppointments || []),
        ...(recurringAppointments || [])
      ];

      console.log('📊 Found appointments:', appointmentsData?.length || 0);
      appointmentsData?.forEach(apt => {
        console.log('  -', apt.title, 'from', apt.start_time, 'to', apt.end_time, 'all_day:', apt.is_all_day);
      });

      await processAppointments(appointmentsData || [], weekStart, weekEnd);
    } catch (error) {
      console.error('Error fetching week appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaysAppointments = async () => {
    if (!currentTenant) {
      console.log('⚠️ Tenant not ready, postponing day fetch');
      return;
    }
    
    try {
      setLoading(true);
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('🔍 Fetching appointments for day:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

      // Fetch regular appointments that overlap with this day
      const { data: regularAppointments, error: regularError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .or(`and(start_time.lte.${endOfDay.toISOString()},end_time.gte.${startOfDay.toISOString()}),and(start_time.gte.${startOfDay.toISOString()},start_time.lte.${endOfDay.toISOString()})`)
        .is('recurrence_rule', null)
        .order('start_time', { ascending: true });

      // Fetch ALL recurring appointments (regardless of their original date)
      const { data: recurringAppointments, error: recurringError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          category,
          priority,
          location,
          status,
          is_all_day,
          meeting_id,
          contact_id,
          poll_id,
          reminder_minutes,
          recurrence_rule,
          recurrence_end_date
        `)
        .not('recurrence_rule', 'is', null)
        .order('start_time', { ascending: true });

      if (regularError || recurringError) {
        console.error('Error fetching appointments:', regularError || recurringError);
        return;
      }

      // Combine regular and recurring appointments
      const appointmentsData = [
        ...(regularAppointments || []),
        ...(recurringAppointments || [])
      ];

      console.log('📊 Found appointments for day:', appointmentsData?.length || 0);
      appointmentsData?.forEach(apt => {
        console.log('  -', apt.title, 'from', apt.start_time, 'to', apt.end_time, 'all_day:', apt.is_all_day);
      });

      await processAppointments(appointmentsData || [], startOfDay, endOfDay);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to expand birthday events up to age 99
  const expandBirthdayEvents = async (event: any, startDate: Date, endDate: Date) => {
    // Only handle birthday events or events with birthday category
    if (event.category !== 'birthday' || !event.start_time || !event.contact_id) {
      return [event];
    }

    try {
      console.log('🎂 Expanding birthday event:', event.title);
      
      // Load contact data to get the real birth year
      const { data: contact } = await supabase
        .from('contacts')
        .select('birthday')
        .eq('id', event.contact_id)
        .single();

      if (!contact?.birthday) {
        console.warn('🎂 No birthday found for contact:', event.contact_id);
        return [event];
      }

      const originalDate = new Date(event.start_time);
      const currentYear = new Date().getFullYear();
      const realBirthYear = new Date(contact.birthday).getFullYear();
      
      // Calculate maximum age (99 years)
      const maxYear = realBirthYear + 99;
      
      // Find relevant years within the display range
      const displayStartYear = startDate.getFullYear();
      const displayEndYear = endDate.getFullYear();
      
      const startYear = displayStartYear;
      const endYear = Math.min(displayEndYear, maxYear);
      
      console.log('🎂 Birthday expansion range:', { 
        realBirthYear, 
        startYear, 
        endYear, 
        maxYear,
        displayRange: `${displayStartYear}-${displayEndYear}`
      });
      
      const birthdayInstances = [];
      
      // Generate birthday instances for each year in range
      for (let year = startYear; year <= endYear; year++) {
        // Skip the year that's already in the database to avoid duplicates
        if (year === originalDate.getFullYear()) continue;
        
        const birthdayDate = new Date(originalDate);
        birthdayDate.setFullYear(year);
        
        // Generate birthday instance for this year (no date range restriction)
        // Set proper times for all-day birthday event
        const birthdayStart = new Date(birthdayDate);
        birthdayStart.setHours(0, 0, 0, 0);
        
        const birthdayEnd = new Date(birthdayDate);
        birthdayEnd.setHours(23, 59, 59, 999);
        
        const age = year - realBirthYear;
        
        birthdayInstances.push({
          ...event,
          id: `${event.id}-birthday-${year}`,
          title: `${event.title} (${age}. Geburtstag)`,
          start_time: birthdayStart.toISOString(),
          end_time: birthdayEnd.toISOString(),
          is_all_day: true,
          _isBirthdayInstance: true,
          _originalId: event.id,
          _age: age
        });
      }
      
      console.log('🎂 Generated', birthdayInstances.length, 'birthday instances for', event.title);
      
      // Return original event plus all birthday instances
      return [event, ...birthdayInstances];
      
    } catch (error) {
      console.error('❌ Error expanding birthday event', event.title, ':', error);
      return [event];
    }
  };

  // Function to expand recurring events using RRULE
  const expandRecurringEvent = (event: any, startDate: Date, endDate: Date) => {
    if (!event.recurrence_rule) return [event];
    
    try {
      console.log('🔄 Expanding recurring event:', event.title, 'with rule:', event.recurrence_rule);
      
      // Parse the RRULE string
      const rule = rrulestr(event.recurrence_rule, {
        dtstart: new Date(event.start_time)
      });
      
      // For better coverage of yearly events like birthdays, expand search range slightly
      const expandedStartDate = new Date(startDate);
      const expandedEndDate = new Date(endDate);
      
      // For yearly events, ensure we catch birthdays by expanding the range
      if (event.recurrence_rule.includes('FREQ=YEARLY') || event.category === 'birthday') {
        expandedStartDate.setFullYear(expandedStartDate.getFullYear() - 1);
        expandedEndDate.setFullYear(expandedEndDate.getFullYear() + 2);
        console.log('🎂 Expanded date range for yearly event:', {
          original: `${startDate.toISOString()} - ${endDate.toISOString()}`,
          expanded: `${expandedStartDate.toISOString()} - ${expandedEndDate.toISOString()}`
        });
      }
      
      // Generate occurrences within the expanded date range
      const allOccurrences = rule.between(expandedStartDate, expandedEndDate, true);
      
      // Filter occurrences to only include those in the actual requested range
      const occurrences = allOccurrences.filter(occurrence => 
        occurrence >= startDate && occurrence <= endDate
      );
      
      console.log('📊 Generated', occurrences.length, 'occurrences for', event.title, 
                  'from', allOccurrences.length, 'total occurrences');
      
      return occurrences.map((occurrence, index) => {
        const originalStart = new Date(event.start_time);
        const originalEnd = new Date(event.end_time);
        
        // For all-day events like birthdays, preserve the time structure
        const newStart = new Date(occurrence);
        let newEnd: Date;
        
        if (event.is_all_day || event.category === 'birthday') {
          // For all-day events, set proper start time (usually midnight) and end time
          newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds());
          newEnd = new Date(newStart);
          
          // Calculate duration or use original end time structure
          if (originalEnd.getTime() - originalStart.getTime() === 24 * 60 * 60 * 1000) {
            // If original was exactly 24 hours, maintain that
            newEnd.setDate(newEnd.getDate() + 1);
            newEnd.setHours(0, 0, 0, 0);
          } else {
            // Otherwise use the original duration
            const duration = originalEnd.getTime() - originalStart.getTime();
            newEnd = new Date(newStart.getTime() + duration);
          }
        } else {
          // For timed events, use original duration
          const duration = originalEnd.getTime() - originalStart.getTime();
          newEnd = new Date(newStart.getTime() + duration);
        }
        
        return {
          ...event,
          id: `${event.id}-recurrence-${index}`,
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
          // Mark as recurring instance
          _isRecurring: true,
          _originalId: event.id
        };
      });
    } catch (error) {
      console.error('❌ Error parsing RRULE for event', event.title, ':', error);
      return [event]; // Return original event if RRULE parsing fails
    }
  };

  // Helper function to detect external all-day events
  const isExternalAllDayEvent = (startTime: Date, endTime: Date): boolean => {
    // Check if it's a typical all-day event pattern from external calendars
    // Start time is at 00:00:00 and end time is at 00:00:00 of next day
    const startHours = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const startSeconds = startTime.getSeconds();
    
    const endHours = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    const endSeconds = endTime.getSeconds();
    
    const isStartMidnight = startHours === 0 && startMinutes === 0 && startSeconds === 0;
    const isEndMidnight = endHours === 0 && endMinutes === 0 && endSeconds === 0;
    
    // Check if end date is exactly one day after start date
    const dayDifference = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
    const isNextDay = dayDifference === 1;
    
    const isAllDay = isStartMidnight && isEndMidnight && isNextDay;
    
    if (isAllDay) {
      console.log('🎯 Detected external all-day event pattern:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isStartMidnight,
        isEndMidnight,
        isNextDay,
        dayDifference
      });
    }
    
    return isAllDay;
  };

  const processAppointments = async (appointmentsData: any[], startDate: Date, endDate: Date) => {
    try {
      console.log('🔍 Processing appointments for date range:', startDate.toISOString(), 'to', endDate.toISOString());
      console.log('📊 Raw appointments data:', appointmentsData);
      console.log('🏢 Current tenant status:', currentTenant ? currentTenant.name : 'NOT AVAILABLE');
      
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

      // Process regular appointments with RRULE expansion
      console.log('📅 Processing', appointmentsData.length, 'regular appointments');
      
      // Expand recurring appointments and birthdays
      const expandedAppointments: any[] = [];
      for (const appointment of appointmentsData) {
        // Handle birthdays with special logic
        if (appointment.category === 'birthday') {
          const birthdayEvents = await expandBirthdayEvents(appointment, startDate, endDate);
          expandedAppointments.push(...birthdayEvents);
        } else {
          // Handle other recurring events with RRULE
          const expandedEvents = expandRecurringEvent(appointment, startDate, endDate);
          expandedAppointments.push(...expandedEvents);
        }
      }
      
      console.log('📊 Expanded', appointmentsData.length, 'appointments to', expandedAppointments.length, 'occurrences');
      
      for (const appointment of expandedAppointments) {
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
          time: appointment.is_all_day ? "Ganztägig" : startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          duration: appointment.is_all_day ? "Ganztägig" : `${durationHours}h`,
          date: startTime, // Add the actual date
          endTime: endTime, // Add actual end time from database
          location: appointment.location || undefined,
          type: appointment.category as CalendarEvent["type"] || "meeting",
          priority: appointment.priority as CalendarEvent["priority"] || "medium",
          participants,
          attendees: participants.length,
          category_color: categoryColor,
          is_all_day: appointment.is_all_day || false
        });
      }

      console.log('📋 Internal events processed:', formattedEvents.length);
      
      // Process external calendar events (from all tenant calendars)
      if (!currentTenant) {
        console.warn('⚠️ No tenant available, skipping external events');
        console.log('📊 Setting appointments (internal only):', formattedEvents.length, 'events');
        setAppointments(formattedEvents);
        return;
      }
      
      console.log('🔍 Fetching external events for date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        tenantId: currentTenant.id
      });
        
        // Use overlap logic like regular appointments to catch multi-day events
        const { data: externalEvents, error: externalError } = await supabase
          .from('external_events')
          .select(`
            *,
            external_calendars!inner (
              name,
              color,
              calendar_type,
              user_id,
              tenant_id
            )
          `)
          .or(`and(start_time.lte.${endDate.toISOString()},end_time.gte.${startDate.toISOString()}),and(start_time.gte.${startDate.toISOString()},start_time.lte.${endDate.toISOString()})`)
          .eq('external_calendars.tenant_id', currentTenant.id)
          .order('start_time', { ascending: true });

        console.log('📊 External events query result:', {
          query: 'overlap-based query for multi-day events',
          found: externalEvents?.length || 0,
          error: externalError,
          dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          tenantId: currentTenant.id
        });

        if (externalError) {
          console.error('❌ External events query error:', externalError);
        }

        // Process external events with RRULE expansion
        if (externalEvents && externalEvents.length > 0) {
          console.log('📅 Processing', externalEvents.length, 'external events from', externalEvents[0]?.external_calendars?.name);
          
          // Expand recurring events
          const expandedExternalEvents: any[] = [];
          for (const externalEvent of externalEvents) {
            const expandedEvents = expandRecurringEvent(externalEvent, startDate, endDate);
            expandedExternalEvents.push(...expandedEvents);
          }
          
          console.log('📊 Expanded', externalEvents.length, 'external events to', expandedExternalEvents.length, 'occurrences');
          
          // Log sample of expanded events for debugging
          const sampleEvents = expandedExternalEvents.slice(0, 3);
          console.log('📊 Sample expanded external events:', sampleEvents.map(e => ({
            title: e.title,
            startTime: e.start_time,
            endTime: e.end_time,
            calendar: e.external_calendars?.name,
            isRecurring: e._isRecurring || false,
            originalId: e._originalId
          })));

          for (const externalEvent of expandedExternalEvents) {
            const startTime = new Date(externalEvent.start_time);
            let endTime = new Date(externalEvent.end_time);
            
            // Detect all-day events (including multi-day)
            const isExternalAllDay = externalEvent.all_day || isExternalAllDayEvent(startTime, endTime);
            
            if (isExternalAllDay) {
              // For ALL external all-day events (single-day and multi-day):
              // External calendars set end time to midnight of the day AFTER the event should end
              // So we need to subtract 1 day and set to 23:59:59 to get the correct end
              const correctedEndTime = new Date(endTime);
              correctedEndTime.setDate(correctedEndTime.getDate() - 1);
              correctedEndTime.setHours(23, 59, 59, 999);
              
              console.log('🔧 Normalized external all-day event:', externalEvent.title, 'from', externalEvent.end_time, 'to', correctedEndTime.toISOString());
              endTime = correctedEndTime;
            }
            
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);

            formattedEvents.push({
              id: `external-${externalEvent.id}`,
              title: `📅 ${externalEvent.title}`,
              description: externalEvent.description || undefined,
              time: isExternalAllDay ? "Ganztägig" : startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              duration: isExternalAllDay ? 'Ganztägig' : `${durationHours}h`,
              date: startTime,
              endTime: endTime,
              location: externalEvent.location || undefined,
              type: "appointment",
              priority: "medium",
              participants: [],
              attendees: 0,
              category_color: externalEvent.external_calendars?.color || '#6b7280',
              is_all_day: isExternalAllDay,
              // Mark as external for adapter
              _isExternal: true
            });
          }
      } else {
        console.log('⚠️ No external events found');
      }

      console.log('📊 Total events before event planning:', formattedEvents.length);

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
              endTime: endTime, // Add the missing endTime property
              type: eventType as CalendarEvent["type"],
              priority: "medium",
              participants,
              attendees: participants.length,
              category_color: categoryColor,
              is_all_day: false // Event planning dates are usually timed
            });
          }
        }
      }

      // Summary logging
      const eventTypeCounts = formattedEvents.reduce((acc, event) => {
        const eventType = event.id.startsWith('external-') ? 'external' : 
                         event.id.startsWith('blocked-') ? 'blocked_planning' : 'regular';
        acc[eventType] = (acc[eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('📈 Event processing summary:', {
        totalEvents: formattedEvents.length,
        breakdown: eventTypeCounts,
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        view: view
      });
      
      console.log('📊 Sample formatted events:', formattedEvents.slice(0, 2).map(event => ({
        id: event.id,
        title: event.title,
        date: event.date,
        endTime: event.endTime,
        type: event.type,
        is_all_day: event.is_all_day,
        dateType: typeof event.date,
        endTimeType: typeof event.endTime,
        dateIsDate: event.date instanceof Date,
        endTimeIsDate: event.endTime instanceof Date
      })));

      setAppointments(formattedEvents);
      console.log('✅ APPOINTMENTS STATE UPDATED:', {
        count: formattedEvents.length,
        events: formattedEvents.map(e => ({
          id: e.id,
          title: e.title,
          date: e.date?.toISOString?.() || e.date,
          endTime: e.endTime?.toISOString?.() || e.endTime,
          type: e.type
        })),
        view: view
      });
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
      case "vacation":
        return "bg-green-500 text-white";
      case "vacation_request":
        return "bg-yellow-500 text-black";
      case "veranstaltung":
        return "bg-purple-600 text-white";
      case "birthday":
        return "bg-pink-500 text-white";
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

  const handlePreparationClick = (appointment: CalendarEvent) => {
    setSelectedAppointmentForPreparation(appointment);
    setPreparationSidebarOpen(true);
  };

  const handlePreparationSidebarClose = () => {
    setPreparationSidebarOpen(false);
    setSelectedAppointmentForPreparation(null);
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

  const handleEventDrop = async (event: CalendarEvent, start: Date, end: Date) => {
    if (!event.id || event.id.startsWith('blocked-')) return;
    
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString()
        })
        .eq('id', event.id);

      if (error) throw error;
      
      handleAppointmentUpdate();
      toast({
        title: "Termin verschoben",
        description: `${event.title} wurde erfolgreich verschoben.`,
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        title: "Fehler",
        description: "Der Termin konnte nicht verschoben werden.",
        variant: "destructive",
      });
    }
  };

  const handleEventResize = async (event: CalendarEvent, start: Date, end: Date) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          end_time: end.toISOString()
        })
        .eq('id', event.id);

      if (error) throw error;
      
      handleAppointmentUpdate();
      toast({
        title: "Termin angepasst",
        description: "Die Terminlänge wurde erfolgreich angepasst.",
      });
    } catch (error) {
      console.error('Error resizing appointment:', error);
      toast({
        title: "Fehler",
        description: "Der Termin konnte nicht angepasst werden.",
        variant: "destructive",
      });
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
              onClick={() => navigate("/calendar?action=create-appointment")}
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
            {["day", "week", "month", "agenda"].map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? "default" : "outline"}
                size="sm"
                onClick={() => setView(viewType as typeof view)}
              >
                {viewType === "day" && "Tag"}
                {viewType === "week" && "Woche"}
                {viewType === "month" && "Monat"}
                {viewType === "agenda" && "Agenda"}
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
              {view === "agenda" && "Agenda"}
              {view === "polls" && "Terminabstimmungen"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[600px]">
            {view === "polls" ? (
              <PollListView />
            ) : loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Termine werden geladen...
              </div>
            ) : (
              <>
                {(() => {
                  // Handle polls view separately since it doesn't need calendar rendering
                  if (!isCalendarView(view)) {
                    return null; // polls view is handled above
                  }
                  
                   // Now TypeScript knows view is a calendar view type
                   const rbcView = view;
                   return (
                     <ProperReactBigCalendar
                       events={appointments}
                       view={rbcView}
                       date={currentDate}
                       onNavigate={setCurrentDate}
                       onView={(newView) => setView(newView as typeof view)}
                       onEventSelect={handleAppointmentClick}
                       onEventDrop={handleEventDrop}
                       onEventResize={handleEventResize}
                        onSelectSlot={(slotInfo) => {
                          // Navigate to appointment creation with pre-filled date/time and show dialog
                          const startDate = slotInfo.start.toISOString();
                          const endDate = slotInfo.end.toISOString();
                          navigate(`/calendar?action=create-appointment&start=${startDate}&end=${endDate}`);
                        }}
                     />
                   );
                })()}
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

      {/* Appointment Preparation Sidebar */}
      <AppointmentPreparationSidebar
        appointmentId={selectedAppointmentForPreparation?.id || null}
        appointmentTitle={selectedAppointmentForPreparation?.title}
        appointmentDate={selectedAppointmentForPreparation?.date.toISOString()}
        isOpen={preparationSidebarOpen}
        onClose={handlePreparationSidebarClose}
      />
    </div>
  );
}