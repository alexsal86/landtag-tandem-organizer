import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  X, Keyboard, ChevronDown, ChevronUp, CheckCircle, 
  ArrowUp, ArrowDown, CornerDownRight, StickyNote,
  Maximize2, Users, Archive, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { FocusModeUpcomingAppointments, FocusModeUpcomingAppointmentsHandle } from './FocusModeUpcomingAppointments';
import { SystemAgendaItem } from './SystemAgendaItem';

interface AgendaItem {
  id?: string;
  title: string;
  description?: string;
  assigned_to?: string[] | null;
  notes?: string | null;
  is_completed: boolean;
  result_text?: string | null;
  carry_over_to_next?: boolean;
  order_index: number;
  parent_id?: string | null;
  parentLocalKey?: string;
  system_type?: string | null;
}

interface Meeting {
  id?: string;
  title: string;
  meeting_date: string | Date;
  meeting_time?: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface FocusModeViewProps {
  meeting: Meeting;
  agendaItems: AgendaItem[];
  profiles: Profile[];
  linkedQuickNotes?: any[];
  onClose: () => void;
  onUpdateItem: (index: number, field: keyof AgendaItem, value: any) => void;
  onUpdateResult: (itemId: string, field: 'result_text' | 'carry_over_to_next', value: any) => void;
  onArchive: () => void;
}

// Helper function to format time without seconds
const formatMeetingTime = (time: string | undefined) => {
  if (!time) return null;
  return time.substring(0, 5);
};

export function FocusModeView({
  meeting,
  agendaItems,
  profiles,
  linkedQuickNotes = [],
  onClose,
  onUpdateItem,
  onUpdateResult,
  onArchive
}: FocusModeViewProps) {
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [focusedAppointmentIndex, setFocusedAppointmentIndex] = useState(-1);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const upcomingApptsRef = useRef<FocusModeUpcomingAppointmentsHandle>(null);
  // Ref to track when dialog just closed to prevent Enter from marking items
  const justClosedDialogRef = useRef(false);

  // Filter to only show main items (not sub-items) for navigation
  const mainItems = agendaItems.filter(item => !item.parent_id && !item.parentLocalKey);
  const completedCount = mainItems.filter(item => item.is_completed).length;
  const totalCount = mainItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get current focused item
  const currentItem = mainItems[focusedItemIndex];
  const currentItemGlobalIndex = agendaItems.findIndex(item => item.id === currentItem?.id);

  // Get sub-items for current focused item
  const subItems = agendaItems.filter(item => 
    item.parent_id === currentItem?.id || item.parentLocalKey === currentItem?.id
  );

  // Handle dialog close with protection against subsequent Enter key
  const handleAssignDialogClose = (open: boolean) => {
    if (!open) {
      justClosedDialogRef.current = true;
      setTimeout(() => { justClosedDialogRef.current = false; }, 150);
    }
    setShowAssignDialog(open);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If assignment dialog is open OR just closed, block keyboard events
      if (showAssignDialog || justClosedDialogRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowAssignDialog(false);
        }
        // Ignore all other keys when dialog is open or just closed
        return;
      }
      
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          // If we're in appointment navigation mode, move within appointments
          if (currentItem?.system_type === 'upcoming_appointments' && focusedAppointmentIndex >= 0) {
            setFocusedAppointmentIndex(prev => Math.min(prev + 1, appointmentsCount - 1));
          } else {
            setFocusedItemIndex(prev => Math.min(prev + 1, mainItems.length - 1));
          }
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          // If we're in appointment navigation mode, move within appointments
          if (currentItem?.system_type === 'upcoming_appointments' && focusedAppointmentIndex >= 0) {
            setFocusedAppointmentIndex(prev => Math.max(prev - 1, 0));
          } else {
            setFocusedItemIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case 'n':
          e.preventDefault();
          // Next appointment within system item
          if (currentItem?.system_type === 'upcoming_appointments') {
            if (focusedAppointmentIndex < 0) {
              setFocusedAppointmentIndex(0);
            } else {
              setFocusedAppointmentIndex(prev => Math.min(prev + 1, appointmentsCount - 1));
            }
          }
          break;
        case 'p':
          e.preventDefault();
          // Previous appointment within system item
          if (currentItem?.system_type === 'upcoming_appointments' && focusedAppointmentIndex >= 0) {
            setFocusedAppointmentIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case 's':
          e.preventDefault();
          // Toggle star for focused appointment
          if (currentItem?.system_type === 'upcoming_appointments' && focusedAppointmentIndex >= 0) {
            upcomingApptsRef.current?.toggleStarAtIndex(focusedAppointmentIndex);
          }
          break;
        case 'PageDown':
        case 'd':
          e.preventDefault();
          // Scroll within the current item (for long items) - use container ref
          mainContainerRef.current?.scrollBy({ top: 200, behavior: 'smooth' });
          break;
        case 'PageUp':
        case 'u':
          e.preventDefault();
          // Scroll within the current item (for long items) - use container ref
          mainContainerRef.current?.scrollBy({ top: -200, behavior: 'smooth' });
          break;
        case 'a':
          e.preventDefault();
          // Open assignment dialog
          setShowAssignDialog(true);
          break;
        case 'Enter':
          e.preventDefault();
          if (currentItem?.id && currentItemGlobalIndex !== -1) {
            const isNowCompleted = !currentItem.is_completed;
            onUpdateItem(currentItemGlobalIndex, 'is_completed', isNowCompleted);
            
            // If marking as completed, navigate to next or show archive dialog
            if (isNowCompleted) {
              // Check if all items will be completed after this update
              const allCompletedAfter = mainItems.every((item, idx) => 
                idx === focusedItemIndex ? true : item.is_completed
              );
              
              if (allCompletedAfter) {
                // All items completed - show archive dialog
                setShowArchiveConfirm(true);
              } else {
                // Navigate to next item
                setFocusedItemIndex(prev => Math.min(prev + 1, mainItems.length - 1));
              }
            }
          }
          break;
        case ' ':
        case 'r':
          e.preventDefault();
          // Focus the result textarea
          const textarea = document.querySelector(`#result-input-${currentItem?.id}`) as HTMLTextAreaElement;
          if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          break;
        case 'c':
          e.preventDefault();
          if (currentItem?.id) {
            onUpdateResult(currentItem.id, 'carry_over_to_next', !currentItem.carry_over_to_next);
          }
          break;
        case 'Escape':
          e.preventDefault();
          // If in appointment navigation mode, exit it first
          if (focusedAppointmentIndex >= 0) {
            setFocusedAppointmentIndex(-1);
          } else {
            onClose();
          }
          break;
        case '?':
          e.preventDefault();
          setShowLegend(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedItemIndex, mainItems.length, currentItem, currentItemGlobalIndex, onUpdateItem, onUpdateResult, onClose, showAssignDialog, focusedAppointmentIndex, appointmentsCount]);

  // Auto-scroll to focused item - scroll to start so long items show their beginning
  useEffect(() => {
    if (itemRefs.current[focusedItemIndex]) {
      itemRefs.current[focusedItemIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [focusedItemIndex]);

  const getDisplayName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.display_name || 'Unbekannt';
  };

  const formatMeetingDate = () => {
    const date = new Date(meeting.meeting_date);
    const dateStr = format(date, "EEEE, d. MMMM yyyy", { locale: de });
    if (meeting.meeting_time) {
      return `${dateStr} um ${formatMeetingTime(meeting.meeting_time)} Uhr`;
    }
    return dateStr;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b bg-card shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="text-sm text-muted-foreground">{formatMeetingDate()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowLegend(true)}>
              <Keyboard className="h-4 w-4 mr-2" />
              Tastenkürzel
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Beenden
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-muted/30 py-3">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-4">
            <Progress value={progressPercent} className="flex-1 h-2" />
            <span className="text-sm font-medium whitespace-nowrap">
              {completedCount} von {totalCount} Punkten besprochen
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main ref={mainContainerRef} className="flex-1 overflow-auto py-8">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          {mainItems.map((item, index) => {
            const itemSubItems = agendaItems.filter(sub => 
              sub.parent_id === item.id || sub.parentLocalKey === item.id
            );
            const isFocused = index === focusedItemIndex;
            const globalIndex = agendaItems.findIndex(i => i.id === item.id);

            return (
              <div
                key={item.id || index}
                ref={el => itemRefs.current[index] = el}
                className={cn(
                  "p-6 rounded-xl border transition-all duration-300",
                  isFocused && "ring-2 ring-primary bg-primary/5 scale-[1.01] shadow-lg",
                  item.is_completed && "bg-muted/50",
                  !isFocused && !item.is_completed && "bg-card hover:bg-muted/30"
                )}
                onClick={() => setFocusedItemIndex(index)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <Checkbox
                    checked={item.is_completed}
                    onCheckedChange={(checked) => {
                      if (globalIndex !== -1) {
                        onUpdateItem(globalIndex, 'is_completed', checked);
                      }
                    }}
                    className="mt-1.5 h-5 w-5"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-lg font-semibold",
                        item.is_completed && "line-through text-muted-foreground"
                      )}>
                        {index + 1}. {item.title}
                      </span>
                      {item.is_completed && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Besprochen
                        </Badge>
                      )}
                      {item.carry_over_to_next && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                          Übertragen
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    {item.description && (
                      <p className="text-muted-foreground mt-2">{item.description}</p>
                    )}

                    {/* Notes */}
                    {item.notes && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg border-l-2 border-primary/30">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                          <StickyNote className="h-3 w-3" />
                          Notizen
                        </div>
                        <p className="text-sm">{item.notes}</p>
                      </div>
                    )}

                    {/* System content: Upcoming Appointments */}
                    {item.system_type === 'upcoming_appointments' && (
                      <div className="mt-4">
                        <FocusModeUpcomingAppointments 
                          ref={upcomingApptsRef}
                          meetingDate={meeting.meeting_date}
                          meetingId={meeting.id}
                          focusedIndex={isFocused ? focusedAppointmentIndex : -1}
                          onAppointmentsLoaded={setAppointmentsCount}
                        />
                      </div>
                    )}

                    {/* System content: Quick Notes */}
                    {item.system_type === 'quick_notes' && linkedQuickNotes.length > 0 && (
                      <div className="mt-4">
                        <SystemAgendaItem 
                          systemType="quick_notes"
                          linkedQuickNotes={linkedQuickNotes}
                          isEmbedded={true}
                        />
                      </div>
                    )}

                    {/* Assigned users */}
                    {item.assigned_to && item.assigned_to.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {item.assigned_to.map(getDisplayName).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Sub-items */}
                    {itemSubItems.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Unterpunkte:</div>
                        {itemSubItems.map((sub, subIndex) => (
                          <div 
                            key={sub.id || subIndex}
                            className={cn(
                              "pl-4 border-l-2",
                              sub.system_type === 'upcoming_appointments' 
                                ? "border-l-blue-500" 
                                : sub.system_type === 'quick_notes'
                                  ? "border-l-amber-500"
                                  : "border-muted"
                            )}
                          >
                            {/* Render system sub-items differently */}
                            {sub.system_type === 'upcoming_appointments' ? (
                              <FocusModeUpcomingAppointments 
                                meetingDate={meeting.meeting_date}
                                meetingId={meeting.id}
                                focusedIndex={-1}
                              />
                            ) : sub.system_type === 'quick_notes' ? (
                              <SystemAgendaItem 
                                systemType="quick_notes"
                                linkedQuickNotes={linkedQuickNotes}
                                isEmbedded={true}
                              />
                            ) : (
                              <>
                                <div className="flex items-start gap-2">
                                  <CornerDownRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                  <div className="flex-1">
                                    <span className={cn(
                                      "text-sm",
                                      sub.is_completed && "line-through text-muted-foreground"
                                    )}>
                                      {sub.title}
                                    </span>
                                    {sub.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{sub.description}</p>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Result input (expanded for focused item) */}
                    {isFocused && (
                      <div className="mt-4 pt-4 border-t">
                        <label className="text-sm font-medium block mb-2">Ergebnis / Notizen</label>
                        <Textarea
                          id={`result-input-${item.id}`}
                          value={item.result_text || ''}
                          onChange={(e) => {
                            if (item.id) {
                              onUpdateResult(item.id, 'result_text', e.target.value);
                            }
                          }}
                          placeholder="Was wurde besprochen? Was sind die nächsten Schritte?"
                          className="min-h-[100px]"
                        />
                        <div className="flex items-center gap-2 mt-3">
                          <Checkbox
                            id={`carryover-${item.id}`}
                            checked={item.carry_over_to_next || false}
                            onCheckedChange={(checked) => {
                              if (item.id) {
                                onUpdateResult(item.id, 'carry_over_to_next', checked);
                              }
                            }}
                          />
                          <label htmlFor={`carryover-${item.id}`} className="text-sm cursor-pointer">
                            Auf nächste Besprechung übertragen
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Navigation hint footer */}
      <footer className="border-t bg-card py-3">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↑</kbd>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↓</kbd>
            <span>Navigation</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Enter</kbd>
            <span>Abhaken</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Space</kbd>
            <span>Ergebnis</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd>
            <span>Alle Kürzel</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
            <span>Beenden</span>
          </div>
        </div>
      </footer>

      {/* Keyboard shortcuts legend */}
      <Dialog open={showLegend} onOpenChange={setShowLegend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Tastenkürzel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">↓</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">j</kbd>
                </div>
                <span className="text-sm">Nächster Punkt</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">↑</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">k</kbd>
                </div>
                <span className="text-sm">Vorheriger Punkt</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">PgDn</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">d</kbd>
                </div>
                <span className="text-sm">Im Punkt nach unten</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">PgUp</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">u</kbd>
                </div>
                <span className="text-sm">Im Punkt nach oben</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Enter</kbd>
                <span className="text-sm">Als besprochen markieren</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Space</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">r</kbd>
                </div>
                <span className="text-sm">Ergebnis eingeben</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">c</kbd>
                <span className="text-sm">Übertragen toggle</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">a</kbd>
                <span className="text-sm">Punkt zuweisen</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">?</kbd>
                <span className="text-sm">Diese Hilfe anzeigen</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Esc</kbd>
                <span className="text-sm">Fokus-Modus beenden</span>
              </div>
            </div>
            
            {/* Star navigation section */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Bei "Kommende Termine"</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">n</kbd>
                  <span className="text-sm">Nächster Termin</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">p</kbd>
                  <span className="text-sm">Vorheriger Termin</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 col-span-2">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">s</kbd>
                  <span className="text-sm">Stern setzen/entfernen</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Alle Punkte besprochen!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben alle Tagesordnungspunkte als besprochen markiert. 
              Möchten Sie die Besprechung jetzt beenden und archivieren?
              Es werden automatisch Aufgaben für zugewiesene Punkte erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowArchiveConfirm(false);
              onArchive();
            }}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Punkt zuweisen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wählen Sie ein Teammitglied für: <strong>{currentItem?.title}</strong>
            </p>
            <Select
              value={currentItem?.assigned_to?.[0] || ''}
              onValueChange={(value) => {
                if (currentItem?.id && currentItemGlobalIndex !== -1) {
                  onUpdateItem(currentItemGlobalIndex, 'assigned_to', value ? [value] : null);
                }
                setShowAssignDialog(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Teammitglied auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.display_name || 'Unbekannt'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentItem?.assigned_to && currentItem.assigned_to.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (currentItem?.id && currentItemGlobalIndex !== -1) {
                    onUpdateItem(currentItemGlobalIndex, 'assigned_to', null);
                  }
                  setShowAssignDialog(false);
                }}
              >
                Zuweisung entfernen
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
