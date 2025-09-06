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

interface EventWithPosition extends CalendarEvent {
  startTimeInMinutes: number;
  durationInMinutes: number;
}

export function DayView({ date, events, onAppointmentClick, onPreparationClick }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [guestCounts, setGuestCounts] = useState<Record<string, { total: number; confirmed: number; declined: number }>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
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
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

  // Helper to get current time position
  const getCurrentTimePosition = () => {
    if (date.toDateString() !== new Date().toDateString()) return null;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return hours * 60 + minutes; // Total minutes from midnight
  };

  // Helper to check if event is in the past
  const isPastEvent = (event: CalendarEvent) => {
    const eventStart = new Date(event.date);
    const [hours, minutes] = event.time.split(':').map(Number);
    eventStart.setHours(hours, minutes);
    
    if (event.endTime) {
      const eventEnd = new Date(event.endTime);
      return eventEnd < currentTime;
    } else {
      const durationMinutes = parseInt(event.duration.replace(/\D/g, ''));
      const eventEnd = new Date(eventStart.getTime() + durationMinutes * 60 * 1000);
      return eventEnd < currentTime;
    }
  };

  // Get events with positioning data for absolute positioning
  const getEventsForDisplay = (): EventWithPosition[] => {
    return timedEvents.map(event => {
      const [startHour, startMinutes] = event.time.split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMinutes;
      
      let durationInMinutes = 60; // Default 1 hour
      if (event.endTime) {
        const eventStart = new Date(event.date);
        const eventEnd = new Date(event.endTime);
        durationInMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
      } else if (event.duration) {
        durationInMinutes = parseInt(event.duration.replace(/\D/g, ''));
      }

      return {
        ...event,
        startTimeInMinutes,
        durationInMinutes
      };
    });
  };

  // Helper function to check if two events overlap
  const eventsOverlap = (event1: EventWithPosition, event2: EventWithPosition): boolean => {
    const start1 = event1.startTimeInMinutes;
    const end1 = event1.startTimeInMinutes + event1.durationInMinutes;
    const start2 = event2.startTimeInMinutes;
    const end2 = event2.startTimeInMinutes + event2.durationInMinutes;

    return start1 < end2 && start2 < end1;
  };

  // Helper function to get layout for overlapping events
  const getEventLayout = (events: EventWithPosition[]) => {
    const layout: Array<{ event: EventWithPosition; column: number; totalColumns: number }> = [];
    const groups: EventWithPosition[][] = [];

    // Group overlapping events
    events.forEach(event => {
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
        <div className="relative">
          {/* Current time indicator */}
          {(() => {
            const currentTimePos = getCurrentTimePosition();
            if (currentTimePos !== null) {
              return (
                <div
                  className="absolute left-0 right-0 z-50 pointer-events-none"
                  style={{ top: `${60 + currentTimePos}px` }}
                >
                  <div className="flex items-center">
                    <div className="w-[80px] bg-red-500 h-0.5"></div>
                    <div className="flex-1 bg-red-500 h-0.5"></div>
                  </div>
                  <div 
                    className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"
                  ></div>
                </div>
              );
            }
            return null;
          })()}

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
                <div className="h-[60px] border-b border-border relative"></div>
              </React.Fragment>
            ))}
          </div>

          {/* Absolutely positioned events */}
          <div className="absolute top-0 left-[80px] right-0 pointer-events-none">
            {(() => {
              const eventsForDisplay = getEventsForDisplay();
              const eventLayout = getEventLayout(eventsForDisplay);
              
              return eventLayout.map(({ event, column, totalColumns }) => {
                const widthPercentage = 100 / totalColumns;
                const leftOffset = (widthPercentage * column);
                const topPosition = 60 + event.startTimeInMinutes; // 60px offset for first hour
                const height = event.durationInMinutes;
                const isPast = isPastEvent(event);
                
                return (
                  <div
                    key={event.id}
                    className={`absolute p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity group relative pointer-events-auto ${getEventTypeColor(event)} ${isPast ? 'opacity-50' : ''}`}
                    style={{ 
                      width: `${widthPercentage - 1}%`,
                      left: `${leftOffset + 0.5}%`,
                      height: `${Math.max(height, 20)}px`,
                      top: `${topPosition}px`,
                      backgroundColor: event.category_color || undefined,
                      zIndex: 10
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
                    <div className="opacity-70 text-xs">
                      {formatEventDisplay(event)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}