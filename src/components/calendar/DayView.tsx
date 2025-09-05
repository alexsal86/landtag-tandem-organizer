import React, { useEffect, useRef, useState } from "react";
import { CalendarEvent } from "../CalendarView";
import { formatEventDisplay, isMultiDayEvent, getEventDays } from "@/lib/timeUtils";
import { FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { NewItemIndicator } from "../NewItemIndicator";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onAppointmentClick?: (appointment: CalendarEvent) => void;
  onPreparationClick?: (appointment: CalendarEvent) => void;
}

export function DayView({ date, events, onAppointmentClick, onPreparationClick }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [guestCounts, setGuestCounts] = useState<Record<string, { total: number; confirmed: number; declined: number }>>({});
  const { isItemNew } = useNewItemIndicators('calendar');
  
  // Separate all-day and timed events
  const allDayEvents = events.filter(event => event.is_all_day);
  const timedEvents = events.filter(event => !event.is_all_day);
  
  useEffect(() => {
    // Scroll to 9 AM on mount
    if (scrollContainerRef.current) {
      const hour9Element = document.getElementById('hour-9');
      if (hour9Element) {
        hour9Element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [date]);

  useEffect(() => {
    // Fetch document counts and guest counts for all events
    const fetchCounts = async () => {
      const appointmentIds = events.map(event => event.id).filter(id => !id.startsWith('blocked-'));
      if (appointmentIds.length === 0) return;

      try {
        // Fetch document counts
        const { data: docData } = await supabase
          .from('appointment_documents')
          .select('appointment_id')
          .in('appointment_id', appointmentIds);

        const docCounts: Record<string, number> = {};
        docData?.forEach(doc => {
          docCounts[doc.appointment_id] = (docCounts[doc.appointment_id] || 0) + 1;
        });
        setDocumentCounts(docCounts);

        // Fetch guest counts
        const { data: guestData } = await supabase
          .from('appointment_guests')
          .select('appointment_id, status')
          .in('appointment_id', appointmentIds);

        const guestCountsTemp: Record<string, { total: number; confirmed: number; declined: number }> = {};
        guestData?.forEach(guest => {
          if (!guestCountsTemp[guest.appointment_id]) {
            guestCountsTemp[guest.appointment_id] = { total: 0, confirmed: 0, declined: 0 };
          }
          guestCountsTemp[guest.appointment_id].total++;
          if (guest.status === 'confirmed') {
            guestCountsTemp[guest.appointment_id].confirmed++;
          } else if (guest.status === 'declined') {
            guestCountsTemp[guest.appointment_id].declined++;
          }
        });
        setGuestCounts(guestCountsTemp);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();
  }, [events]);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  
  const getEventsForHour = (hour: number) => {
    return timedEvents.filter(event => {
      const eventDate = event.date.toDateString();
      const viewDate = date.toDateString();
      
      // If it's not the same date, check if it's a multi-day event
      if (eventDate !== viewDate) {
        // Check if this day is within the event's span
        if (event.endTime) {
          const eventStart = new Date(event.date);
          const eventEnd = new Date(event.endTime);
          const currentDay = new Date(date);
          
          // Set times to beginning/end of day for comparison
          eventStart.setHours(0, 0, 0, 0);
          eventEnd.setHours(23, 59, 59, 999);
          currentDay.setHours(12, 0, 0, 0); // Middle of day
          
          if (currentDay >= eventStart && currentDay <= eventEnd) {
            // This is a continuation of a multi-day event
            // Show it starting from hour 0 if event started on previous day
            return hour === 0;
          }
        }
        return false;
      }
      
      // Same day - check if event starts at this hour or spans through it
      const [startHours] = event.time.split(':').map(Number);
      
      if (event.endTime) {
        // Use actual end time
        const eventStart = new Date(event.date);
        eventStart.setHours(startHours);
        const eventEnd = new Date(event.endTime);
        
        const hourStart = new Date(date);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(date);
        hourEnd.setHours(hour + 1, 0, 0, 0);
        
        // Event overlaps with this hour slot
        return eventStart < hourEnd && eventEnd > hourStart;
      } else {
        // Fallback to duration calculation
        const [startMinutes] = event.time.split(':').map((_, i) => i === 1 ? Number(_) : 0);
        const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
        const eventEndHour = Math.floor((startHours * 60 + startMinutes + durationMinutes) / 60);
        
        return hour >= startHours && hour < eventEndHour;
      }
    });
  };

  // Helper function to check if two events overlap
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const getEventTimes = (event: CalendarEvent) => {
      const [hours, minutes] = event.time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
      const endMinutes = startMinutes + durationMinutes;
      return { start: startMinutes, end: endMinutes };
    };

    const times1 = getEventTimes(event1);
    const times2 = getEventTimes(event2);

    return times1.start < times2.end && times2.start < times1.end;
  };

  // Helper function to get layout for overlapping events
  const getEventLayout = (hourEvents: CalendarEvent[]) => {
    const layout: Array<{ event: CalendarEvent; column: number; totalColumns: number }> = [];
    const groups: CalendarEvent[][] = [];

    // Group overlapping events
    hourEvents.forEach(event => {
      let addedToGroup = false;
      
      for (const group of groups) {
        if (group.some(groupEvent => eventsOverlap(event, groupEvent))) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([event]);
      }
    });

    // Create layout information
    groups.forEach(group => {
      const totalColumns = group.length;
      group.forEach((event, index) => {
        layout.push({
          event,
          column: index,
          totalColumns
        });
      });
    });

    return layout;
  };

  const getEventTypeColor = (event: CalendarEvent) => {
    // Always use white text when we have a custom category color
    if (event.category_color) {
      return `text-white`;
    }
    
    // Fallback to hardcoded colors for built-in types without category colors
    switch (event.type) {
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
      case "veranstaltung":
        return "bg-purple-600 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border bg-muted/10">
          <div className="grid grid-cols-[80px,1fr]">
            <div className="p-2 text-sm font-medium text-muted-foreground bg-muted/30">
              Ganztägig
            </div>
            <div className="p-1 space-y-1">
              {allDayEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity group relative ${getEventTypeColor(event)}`}
                  style={{ 
                    backgroundColor: event.category_color || undefined,
                    marginBottom: '4px'
                  }}
                  onClick={() => onAppointmentClick?.(event)}
                >
                  <NewItemIndicator 
                    isVisible={isItemNew(event.id, event.date)} 
                    size="sm" 
                    className="top-0 right-0"
                  />
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate">
                            {event.title}
                          </div>
                          <div className="flex items-center space-x-1">
                            {documentCounts[event.id] > 0 && (
                              <div className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span className="text-xs">{documentCounts[event.id]}</span>
                              </div>
                            )}
                            {guestCounts[event.id] && guestCounts[event.id].total > 0 && (
                              <div className="flex items-center space-x-1" title={`${guestCounts[event.id].confirmed} zugesagt, ${guestCounts[event.id].declined} abgesagt, ${guestCounts[event.id].total - guestCounts[event.id].confirmed - guestCounts[event.id].declined} ausstehend`}>
                                <Users className="h-3 w-3" />
                                <span className="text-xs">{guestCounts[event.id].total}</span>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreparationClick?.(event);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded text-xs"
                              title="Vorbereitung erstellen/bearbeiten"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                  {event.location && (
                    <div className="opacity-70 truncate text-xs">{event.location}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Time grid */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef} style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="grid grid-cols-[80px,1fr] border border-border">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div 
                className="h-[60px] p-2 text-sm text-muted-foreground border-b border-border bg-muted/30 sticky left-0 z-10 flex items-center"
                id={hour === 9 ? 'hour-9' : undefined}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              
               {/* Event slot */}
               <div className="h-[60px] p-1 border-b border-border relative">
                 {(() => {
                   const hourEvents = getEventsForHour(hour);
                   const eventLayout = getEventLayout(hourEvents);
                   
                    return eventLayout.map(({ event, column, totalColumns }) => {
                      const widthPercentage = 100 / totalColumns;
                      const leftOffset = (widthPercentage * column);
                      
                       // Calculate event height and positioning based on duration
                       let eventHeight = 58;
                       let topOffset = 0;
                       let isEventStart = false;
                       let isEventContinuation = false;
                       
                       const eventDate = event.date.toDateString();
                       const viewDate = date.toDateString();
                       const [startHour, startMinutes] = event.time.split(':').map(Number);
                       
                       if (eventDate === viewDate) {
                         // Event starts on this day
                         isEventStart = hour === startHour;
                         
                         if (hour === startHour) {
                           // Calculate precise positioning and height
                           topOffset = (startMinutes / 60) * 60; // Minutes within the hour as pixels
                           
                           if (event.endTime) {
                             // Use actual end time for precise calculation
                             const eventStart = new Date(event.date);
                             const eventEnd = new Date(event.endTime);
                             const durationMs = eventEnd.getTime() - eventStart.getTime();
                             const durationMinutes = durationMs / (1000 * 60);
                             eventHeight = Math.max(durationMinutes, 15); // 1px per minute, minimum 15px
                           } else {
                             // Fallback to duration string
                             const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                             eventHeight = Math.max(durationMinutes, 15);
                           }
                         } else {
                           // Not the starting hour, don't render (covered by starting hour)
                           return null;
                         }
                       } else {
                         // Event continuation from previous day
                         isEventContinuation = true;
                         if (event.endTime && hour === 0) {
                           // Show continuation from start of day
                           const eventEnd = new Date(event.endTime);
                           if (eventEnd.toDateString() === date.toDateString()) {
                             // Event ends today
                             const endHour = eventEnd.getHours();
                             const endMinutes = eventEnd.getMinutes();
                             const totalMinutesToEnd = endHour * 60 + endMinutes;
                             eventHeight = Math.max(totalMinutesToEnd, 15);
                           } else {
                             // Event continues past today - full day
                             eventHeight = 24 * 60;
                           }
                         } else if (hour > 0) {
                           // Don't render continuation in other hours
                           return null;
                         }
                       }

                         return (
                           <div
                            key={`${event.id}-${hour}`}
                            className={`absolute p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity group relative ${getEventTypeColor(event)} ${isEventContinuation ? 'border-l-4 border-l-yellow-400' : ''}`}
                             style={{ 
                               width: `${widthPercentage - 2}%`, // Reduced width to create spacing
                               left: `${leftOffset + 1}%`, // Add left margin for spacing
                               height: `${eventHeight}px`,
                              top: `${topOffset}px`,
                              marginBottom: '2px',
                              marginLeft: `${column * 4}px`, // Additional left indent for overlapping events
                              backgroundColor: event.category_color || undefined,
                              zIndex: isEventStart || isEventContinuation ? 2 : 1
                            }}
                            onClick={() => onAppointmentClick?.(event)}
                           >
                            <NewItemIndicator 
                              isVisible={isItemNew(event.id, event.date)} 
                              size="sm" 
                              className="top-0 right-0"
                            />
                             <div className="flex items-center justify-between">
                               <div className="font-medium truncate">
                                 {isEventContinuation ? `→ ${event.title}` : event.title}
                               </div>
                                <div className="flex items-center space-x-1">
                                  {documentCounts[event.id] > 0 && (
                                    <div className="flex items-center space-x-1">
                                      <FileText className="h-3 w-3" />
                                      <span className="text-xs">{documentCounts[event.id]}</span>
                                    </div>
                                  )}
                                  {guestCounts[event.id] && guestCounts[event.id].total > 0 && (
                                    <div className="flex items-center space-x-1" title={`${guestCounts[event.id].confirmed} zugesagt, ${guestCounts[event.id].declined} abgesagt, ${guestCounts[event.id].total - guestCounts[event.id].confirmed - guestCounts[event.id].declined} ausstehend`}>
                                      <Users className="h-3 w-3" />
                                      <span className="text-xs">{guestCounts[event.id].total}</span>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPreparationClick?.(event);
                                    }}
                                   className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded text-xs"
                                   title="Vorbereitung erstellen/bearbeiten"
                                 >
                                   📋
                                 </button>
                               </div>
                             </div>
                            <div className="opacity-80 text-xs">
                              {isEventContinuation 
                                ? `→ ${formatEventDisplay(event)}`
                                : formatEventDisplay(event)
                              }
                            </div>
                           {event.location && (
                             <div className="opacity-70 truncate text-xs">{event.location}</div>
                           )}
                         </div>
                      );
                    }).filter(Boolean); // Remove null entries
                 })()}
               </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}