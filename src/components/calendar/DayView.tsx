import React, { useEffect, useRef } from "react";
import { CalendarEvent } from "../CalendarView";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onAppointmentClick?: (appointment: CalendarEvent) => void;
}

export function DayView({ date, events, onAppointmentClick }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to 9 AM on mount
    if (scrollContainerRef.current) {
      const hour9Element = document.getElementById('hour-9');
      if (hour9Element) {
        hour9Element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [date]);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  
  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
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
    // If the event has a category color from the database, use it
    if (event.category_color) {
      return `text-white`;
    }
    
    // Fallback to hardcoded colors for built-in types
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
      {/* Time grid */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef} style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="grid grid-cols-[80px,1fr] border border-border">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div 
                className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/30 sticky left-0 z-10"
                id={hour === 9 ? 'hour-9' : undefined}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              
               {/* Event slot */}
               <div className="min-h-[60px] p-1 border-b border-border relative">
                 {(() => {
                   const hourEvents = getEventsForHour(hour);
                   const eventLayout = getEventLayout(hourEvents);
                   
                    return eventLayout.map(({ event, column, totalColumns }) => {
                      const widthPercentage = 100 / totalColumns;
                      const leftOffset = (widthPercentage * column);
                      
                      // Calculate event height based on duration
                      let eventHeight = 58; // Default single hour height
                      let isEventStart = false;
                      let isEventContinuation = false;
                      
                      const eventDate = event.date.toDateString();
                      const viewDate = date.toDateString();
                      const [startHour] = event.time.split(':').map(Number);
                      
                      if (eventDate === viewDate) {
                        // Event starts on this day
                        isEventStart = hour === startHour;
                        
                        if (event.endTime) {
                          // Calculate actual height based on end time
                          const eventStart = new Date(event.date);
                          const eventEnd = new Date(event.endTime);
                          const hourStart = new Date(date);
                          hourStart.setHours(hour, 0, 0, 0);
                          
                          if (eventEnd.toDateString() === date.toDateString()) {
                            // Event ends on same day
                            const endHour = eventEnd.getHours();
                            const endMinutes = eventEnd.getMinutes();
                            
                            if (hour === startHour) {
                              // This is the starting hour
                              const hoursSpanned = endHour - hour + (endMinutes > 0 ? 1 : 0);
                              eventHeight = Math.max(hoursSpanned * 60 - 2, 58);
                            } else if (hour > startHour && hour < endHour) {
                              // This is a middle hour - don't render, it's covered by the start hour
                              return null;
                            } else if (hour === endHour && endMinutes > 0) {
                              // This is the end hour with partial time - don't render, covered by start
                              return null;
                            }
                          } else {
                            // Multi-day event - extends to end of day
                            if (hour === startHour) {
                              const hoursToEndOfDay = 24 - hour;
                              eventHeight = hoursToEndOfDay * 60 - 2;
                            } else if (hour > startHour) {
                              // Don't render - covered by start hour
                              return null;
                            }
                          }
                        } else {
                          // Fallback to duration calculation
                          const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                          if (hour === startHour) {
                            eventHeight = Math.max(durationMinutes, 58);
                          } else {
                            return null; // Don't render for other hours
                          }
                        }
                      } else {
                        // Event continuation from previous day
                        isEventContinuation = true;
                        if (event.endTime) {
                          const eventEnd = new Date(event.endTime);
                          if (eventEnd.toDateString() === date.toDateString()) {
                            // Event ends today
                            const endHour = eventEnd.getHours();
                            const endMinutes = eventEnd.getMinutes();
                            
                            if (hour === 0) {
                              // Show from start of day until end
                              const hoursSpanned = endHour + (endMinutes > 0 ? 1 : 0);
                              eventHeight = Math.max(hoursSpanned * 60 - 2, 58);
                            } else if (hour > 0 && hour < endHour) {
                              // Don't render - covered by hour 0
                              return null;
                            } else if (hour === endHour && endMinutes > 0) {
                              // Don't render - covered by hour 0
                              return null;
                            }
                          } else {
                            // Event continues past today
                            if (hour === 0) {
                              eventHeight = 24 * 60 - 2; // Full day
                            } else {
                              return null; // Don't render - covered by hour 0
                            }
                          }
                        }
                      }
                      
                        // Calculate precise positioning within the hour
                        let topOffset = 0;
                        let preciseHeight = eventHeight;
                        
                        if (eventDate === viewDate && hour === startHour) {
                          // Calculate exact position within the hour
                          const [startHours, startMinutes] = event.time.split(':').map(Number);
                          topOffset = (startMinutes / 60) * 60; // Convert minutes to pixels (60px per hour)
                          
                          if (event.endTime) {
                            const eventStart = new Date(event.date);
                            const eventEnd = new Date(event.endTime);
                            const durationMs = eventEnd.getTime() - eventStart.getTime();
                            const durationHours = durationMs / (1000 * 60 * 60);
                            preciseHeight = Math.max(durationHours * 60, 20); // Minimum 20px height
                          }
                        }

                        return (
                          <div
                           key={`${event.id}-${hour}`}
                           className={`absolute p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event)} ${isEventContinuation ? 'border-l-4 border-l-yellow-400' : ''}`}
                           style={{ 
                             width: `${widthPercentage - 1}%`,
                             left: `${leftOffset}%`,
                             height: `${preciseHeight}px`,
                             top: `${topOffset}px`,
                             marginBottom: '2px',
                             backgroundColor: event.category_color || undefined,
                             zIndex: isEventStart || isEventContinuation ? 2 : 1
                           }}
                           onClick={() => onAppointmentClick?.(event)}
                         >
                          <div className="font-medium truncate">
                            {isEventContinuation ? `→ ${event.title}` : event.title}
                          </div>
                          <div className="opacity-80 text-xs">
                            {(() => {
                              if (event.endTime) {
                                // Use actual end time from database
                                const startTimeStr = event.time;
                                const endTimeStr = event.endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                const startDate = event.date.toDateString();
                                const endDate = event.endTime.toDateString();
                                
                                if (startDate === endDate) {
                                  // Same day - show exact duration
                                  const durationMs = event.endTime.getTime() - event.date.getTime();
                                  const durationMinutes = Math.round(durationMs / (1000 * 60));
                                  const hours = Math.floor(durationMinutes / 60);
                                  const mins = durationMinutes % 60;
                                  const durationStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
                                  
                                  return `${startTimeStr} - ${endTimeStr} (${durationStr})`;
                                } else {
                                  // Multi-day event
                                  const endDateStr = event.endTime.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                  return isEventContinuation 
                                    ? `bis ${endDateStr} ${endTimeStr}`
                                    : `${startTimeStr} - ${endDateStr} ${endTimeStr}`;
                                }
                              } else {
                                // Fallback to duration calculation
                                const [hours, minutes] = event.time.split(':').map(Number);
                                const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
                                const endTotalMinutes = hours * 60 + minutes + durationMinutes;
                                const endHours = Math.floor(endTotalMinutes / 60);
                                const endMinutes = endTotalMinutes % 60;
                                const durationHours = Math.floor(durationMinutes / 60);
                                const durationMins = durationMinutes % 60;
                                const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}min` : `${durationMins}min`;
                                
                                return `${event.time} - ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')} (${durationStr})`;
                              }
                            })()}
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