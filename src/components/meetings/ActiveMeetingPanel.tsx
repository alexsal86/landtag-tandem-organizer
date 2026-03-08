import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Clock, StickyNote, ListTodo, Download, Maximize2, Star, MessageSquarePlus, Eye, Plus, Scale, Briefcase } from 'lucide-react';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { MultiUserAssignSelect } from './MultiUserAssignSelect';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Meeting, AgendaItem, Profile, LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, MeetingUpcomingAppointment } from './types';

interface ActiveMeetingPanelProps {
  meeting: Meeting;
  meetingItems: AgendaItem[];
  allAgendaItems: AgendaItem[];
  profiles: Profile[];
  linkedQuickNotes: LinkedQuickNote[];
  linkedTasks: LinkedTask[];
  linkedCaseItems: LinkedCaseItem[];
  relevantDecisions: RelevantDecision[];
  upcomingAppointments: MeetingUpcomingAppointment[];
  starredAppointmentIds: Set<string>;
  expandedApptNotes: Set<string>;
  onExpandApptNote: (id: string) => void;
  onSetFocusMode: () => void;
  onStopMeeting: () => void;
  onArchiveMeeting: () => void;
  onUpdateAgendaItem: (index: number, field: keyof AgendaItem, value: unknown) => void;
  onUpdateResult: (itemId: string, field: 'result_text' | 'carry_over_to_next', value: unknown) => void;
  onUpdateNoteResult: (noteId: string, result: string) => void;
  onToggleStar: (appt: MeetingUpcomingAppointment) => void;
  onToggleVisibility: (itemId: string, currentVisibility: boolean) => void;
}

export function ActiveMeetingPanel({
  meeting,
  meetingItems,
  allAgendaItems,
  profiles,
  linkedQuickNotes,
  linkedTasks,
  linkedCaseItems,
  relevantDecisions,
  upcomingAppointments,
  starredAppointmentIds,
  expandedApptNotes,
  onExpandApptNote,
  onSetFocusMode,
  onStopMeeting,
  onArchiveMeeting,
  onUpdateAgendaItem,
  onUpdateResult,
  onUpdateNoteResult,
  onToggleStar,
  onToggleVisibility,
}: ActiveMeetingPanelProps) {
  const { toast } = useToast();

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  const downloadFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const fileName = filePath.split('/').pop()?.split('_').slice(2).join('_') || 'download';
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download-Fehler", description: "Datei konnte nicht heruntergeladen werden.", variant: "destructive" });
    }
  };

  // Process items into hierarchical structure
  const allItemsSorted = [...meetingItems].sort((a, b) => a.order_index - b.order_index);
  const processedItems: Array<{ item: AgendaItem; subItems: AgendaItem[]; hiddenOptionalSubItems: AgendaItem[] }> = [];

  allItemsSorted.forEach((item) => {
    if (!item.parent_id && !item.parentLocalKey) {
      const subItems = allItemsSorted.filter(subItem => {
        if (subItem.parent_id && item.id) return subItem.parent_id === item.id;
        if (subItem.parentLocalKey && item.localKey) return subItem.parentLocalKey === item.localKey;
        return false;
      }).sort((a, b) => a.order_index - b.order_index);

      const visibleSubItems = subItems.filter(sub => sub.is_visible !== false);
      const hiddenOptionalSubItems = subItems.filter(sub => sub.is_visible === false && sub.is_optional);
      processedItems.push({ item, subItems: visibleSubItems, hiddenOptionalSubItems });
    }
  });

  const renderAppointmentNotes = (parentItem: AgendaItem) => {
    const apptResults = (() => { try { return JSON.parse(parentItem.result_text || '{}'); } catch { return {}; } })();
    return upcomingAppointments.length > 0 ? (
      upcomingAppointments.map((appt, apptIdx) => (
        <div key={appt.id} className={cn("pl-4 border-l-2 border-muted space-y-2", starredAppointmentIds.has(appt.id) && "bg-amber-50/50 dark:bg-amber-950/20")}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); onToggleStar(appt); }}>
              <Star className={cn("h-3.5 w-3.5", starredAppointmentIds.has(appt.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">{String.fromCharCode(97 + apptIdx)})</span>
            <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-sm font-medium">{appt.title}</span>
          </div>
          <p className="text-xs text-muted-foreground ml-8">
            {format(new Date(appt.start_time), "EEE dd.MM. HH:mm", { locale: de })}
            {appt.end_time && ` - ${format(new Date(appt.end_time), "HH:mm")}`}
            {appt.location && ` | ${appt.location}`}
          </p>
          {(apptResults[appt.id] || expandedApptNotes.has(appt.id)) ? (
            <div className="ml-8">
              <Textarea value={apptResults[appt.id] || ''} onChange={(e) => {
                const newResults = { ...apptResults, [appt.id]: e.target.value };
                onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
              }} placeholder="Notizen zu diesem Termin..." className="min-h-[60px] text-xs" />
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground ml-8" onClick={() => onExpandApptNote(appt.id)}>
              <MessageSquarePlus className="h-3 w-3 mr-1" /> Notiz
            </Button>
          )}
        </div>
      ))
    ) : <p className="text-sm text-muted-foreground pl-4">Keine Termine in den nächsten 2 Wochen.</p>;
  };

  const renderQuickNotes = (parentItem: AgendaItem) => (
    linkedQuickNotes.length > 0 ? linkedQuickNotes.map((note, noteIdx) => (
      <div key={note.id} className="pl-4 border-l-2 border-muted space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{String.fromCharCode(97 + noteIdx)})</span>
          <StickyNote className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-medium">{note.title || `Notiz ${noteIdx + 1}`}</span>
        </div>
        <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
        {note.user_id && (() => {
          const profile = getProfile(note.user_id);
          return profile ? (
            <div className="flex items-center gap-1.5 ml-6 mt-1">
              <Avatar className="h-5 w-5"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(profile.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-xs text-muted-foreground">{profile.display_name}</span>
            </div>
          ) : null;
        })()}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={note.meeting_result || ''} onChange={(e) => onUpdateNoteResult(note.id, e.target.value)} placeholder="Ergebnis für diese Notiz..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : <p className="text-sm text-muted-foreground pl-4">Keine Notizen vorhanden.</p>
  );

  const renderLinkedTasks = (parentItem: AgendaItem) => {
    const taskResults = (() => { try { return JSON.parse(parentItem.result_text || '{}'); } catch { return {}; } })();
    return linkedTasks.length > 0 ? linkedTasks.map((task, taskIdx) => (
      <div key={task.id} className="pl-4 border-l-2 border-muted space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{String.fromCharCode(97 + taskIdx)})</span>
          <ListTodo className="h-3.5 w-3.5 text-green-500" />
          <span className="text-sm font-medium">{task.title}</span>
        </div>
        {task.description && <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />}
        {task.user_id && (() => {
          const profile = getProfile(task.user_id);
          return profile ? (
            <div className="flex items-center gap-1.5 ml-6 mt-1">
              <Avatar className="h-5 w-5"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(profile.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-xs text-muted-foreground">{profile.display_name}</span>
            </div>
          ) : null;
        })()}
        {task.due_date && <p className="text-xs text-muted-foreground">Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}</p>}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={taskResults[task.id] || ''} onChange={(e) => {
            const newResults = { ...taskResults, [task.id]: e.target.value };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diese Aufgabe..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : <p className="text-sm text-muted-foreground pl-4">Keine Aufgaben vorhanden.</p>;
  };

  const renderDecisions = (parentItem: AgendaItem) => {
    const decisionResults = (() => { try { return JSON.parse(parentItem.result_text || '{}'); } catch { return {}; } })();
    return relevantDecisions.length > 0 ? relevantDecisions.map((decision, idx) => (
      <div key={decision.id} className="pl-4 border-l-2 border-muted space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{String.fromCharCode(97 + idx)})</span>
          <Scale className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-sm font-medium">{decision.title}</span>
        </div>
        {decision.description && <RichTextDisplay content={decision.description} className="text-sm text-muted-foreground" />}
        {decision.response_deadline && <p className="text-xs text-muted-foreground">Frist: {format(new Date(decision.response_deadline), "dd.MM.yyyy", { locale: de })}</p>}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={decisionResults[decision.id] || ''} onChange={(e) => {
            const newResults = { ...decisionResults, [decision.id]: e.target.value };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diese Entscheidung..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : <p className="text-sm text-muted-foreground pl-4">Keine Entscheidungen vorhanden.</p>;
  };

  const renderCaseItems = (parentItem: AgendaItem) => {
    const ciResults = (() => { try { return JSON.parse(parentItem.result_text || '{}'); } catch { return {}; } })();
    return linkedCaseItems.length > 0 ? linkedCaseItems.map((ci, idx) => (
      <div key={ci.id} className="pl-4 border-l-2 border-muted space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{String.fromCharCode(97 + idx)})</span>
          <Briefcase className="h-3.5 w-3.5 text-teal-500" />
          <span className="text-sm font-medium">{ci.subject || '(Kein Betreff)'}</span>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={ciResults[ci.id] || ''} onChange={(e) => {
            const newResults = { ...ciResults, [ci.id]: e.target.value };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diesen Vorgang..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : <p className="text-sm text-muted-foreground pl-4">Keine Vorgänge vorhanden.</p>;
  };

  const renderSystemContent = (item: AgendaItem, prefix?: string) => {
    switch (item.system_type) {
      case 'upcoming_appointments':
        return (
          <div className="space-y-2">
            {prefix && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Kommende Termine</span>
              </div>
            )}
            {renderAppointmentNotes(item)}
          </div>
        );
      case 'quick_notes':
        return (
          <div className="space-y-2">
            {prefix && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
                <StickyNote className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Meine Notizen</span>
              </div>
            )}
            {renderQuickNotes(item)}
          </div>
        );
      case 'tasks':
        return (
          <div className="space-y-2">
            {prefix && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
                <ListTodo className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Aufgaben</span>
              </div>
            )}
            {renderLinkedTasks(item)}
          </div>
        );
      case 'decisions':
        return (
          <div className="space-y-2">
            {prefix && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
                <Scale className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium">Entscheidungen</span>
              </div>
            )}
            {renderDecisions(item)}
          </div>
        );
      case 'case_items':
        return (
          <div className="space-y-2">
            {prefix && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
                <Briefcase className="h-4 w-4 text-teal-500" />
                <span className="text-sm font-medium">Vorgänge</span>
              </div>
            )}
            {renderCaseItems(item)}
          </div>
        );
      default:
        return null;
    }
  };

  const renderSubItem = (subItem: AgendaItem, index: number, subIndex: number) => {
    if (subItem.system_type) {
      return (
        <div className="pl-4 border-l-2 border-muted">
          {renderSystemContent(subItem, `${index + 1}.${subIndex + 1}`)}
        </div>
      );
    }

    // Regular sub-item
    return (
      <div className="pl-4 border-l-2 border-muted">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{index + 1}.{subIndex + 1}</span>
          <Input
            value={subItem.title}
            onChange={(e) => onUpdateAgendaItem(allAgendaItems.findIndex(i => i.id === subItem.id), 'title', e.target.value)}
            className="text-sm flex-1 border-none shadow-none p-0 h-auto bg-transparent"
            placeholder="Unterpunkt"
          />
          <MultiUserAssignSelect
            assignedTo={subItem.assigned_to ?? null}
            profiles={profiles}
            onChange={(userIds) => onUpdateAgendaItem(allAgendaItems.findIndex(i => i.id === subItem.id), 'assigned_to', userIds.length > 0 ? userIds : null)}
            size="sm"
          />
          {subItem.is_optional && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onToggleVisibility(subItem.id!, true)}>
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
        {subItem.description && <RichTextDisplay content={subItem.description} className="text-sm text-muted-foreground ml-8 mt-1" />}
        {subItem.carried_over_from && (
          <p className="text-xs text-muted-foreground ml-8 mt-1 italic">Übertragen von: {subItem.original_meeting_title} ({subItem.original_meeting_date})</p>
        )}
        {subItem.file_path && (
          <div className="ml-8 mt-2 flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
            <span>{subItem.file_path.split('/').pop()?.split('_').slice(2).join('_') || 'Datei'}</span>
            <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => downloadFile(subItem.file_path!)}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="space-y-2 mt-2">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
            <Textarea value={subItem.result_text || ''} onChange={(e) => onUpdateResult(subItem.id!, 'result_text', e.target.value)} placeholder="Ergebnis für diesen Unterpunkt..." className="min-h-[60px] text-xs" />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id={`carryover-sub-${subItem.id}`} checked={subItem.carry_over_to_next || false} onCheckedChange={(checked) => onUpdateResult(subItem.id!, 'carry_over_to_next', checked)} />
            <label htmlFor={`carryover-sub-${subItem.id}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Auf nächste Besprechung übertragen</label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 mb-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Aktive Besprechung: {meeting.title}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSetFocusMode}>
            <Maximize2 className="h-4 w-4 mr-2" /> Fokus-Modus
          </Button>
          <Button variant="outline" onClick={onStopMeeting}>Besprechung unterbrechen</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default">Besprechung beenden und archivieren</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Besprechung archivieren</AlertDialogTitle>
                <AlertDialogDescription>
                  Sind Sie sicher, dass Sie die Besprechung "{meeting.title}" beenden und archivieren möchten? Es werden automatisch Aufgaben für zugewiesene Punkte erstellt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onArchiveMeeting}>Archivieren</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tagesordnung</CardTitle>
          <CardDescription>
            {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
            {meeting.location && ` • ${meeting.location}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processedItems.map(({ item, subItems: sortedSubItems, hiddenOptionalSubItems }, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-medium">
                    {index + 1}
                  </div>
                  <Input
                    value={item.title}
                    onChange={(e) => onUpdateAgendaItem(allAgendaItems.findIndex(i => i.id === item.id), 'title', e.target.value)}
                    className="font-medium text-lg flex-1 border-none shadow-none p-0 h-auto bg-transparent"
                    placeholder="Agenda-Punkt Titel"
                  />
                  <div className="flex items-center gap-2">
                    <MultiUserAssignSelect
                      assignedTo={item.assigned_to ?? null}
                      profiles={profiles}
                      onChange={(userIds) => onUpdateAgendaItem(allAgendaItems.findIndex(i => i.id === item.id), 'assigned_to', userIds.length > 0 ? userIds : null)}
                      size="sm"
                    />
                  </div>
                </div>

                {item.description && (
                  <div className="mb-3 ml-12">
                    <RichTextDisplay content={item.description} className="text-muted-foreground" />
                  </div>
                )}

                {/* System content at main item level */}
                {item.system_type && (
                  <div className="ml-12 mb-4 space-y-3">
                    {renderSystemContent(item)}
                  </div>
                )}

                {/* Carried over info */}
                {item.carried_over_from && (
                  <p className="text-xs text-muted-foreground ml-12 mb-2 italic">
                    Übertragen von: {item.original_meeting_title} ({item.original_meeting_date})
                  </p>
                )}

                {/* File attachment */}
                {item.file_path && (
                  <div className="ml-12 mb-3 flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <span className="text-xs">{item.file_path.split('/').pop()?.split('_').slice(2).join('_') || 'Datei'}</span>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(item.file_path!)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Sub-items */}
                {(sortedSubItems.length > 0 || hiddenOptionalSubItems.length > 0) && (
                  <div className="ml-12 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Unterpunkte</label>
                      {hiddenOptionalSubItems.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-6 text-xs">
                              <Plus className="h-3 w-3 mr-1" /> {hiddenOptionalSubItems.length} optional
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Optionale Unterpunkte aktivieren</p>
                              {hiddenOptionalSubItems.map(subItem => (
                                <Button key={subItem.id} size="sm" variant="ghost" className="w-full justify-start text-xs h-8" onClick={() => onToggleVisibility(subItem.id!, false)}>
                                  <Eye className="h-3 w-3 mr-2" /> {subItem.title}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div className="space-y-2">
                      {sortedSubItems.map((subItem, subIndex) => (
                        <div key={subItem.id}>
                          {renderSubItem(subItem, index, subIndex)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result section - hide for system items */}
                {!item.system_type && (
                  <div className="ml-12 space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Ergebnis der Besprechung</label>
                      <Textarea value={item.result_text || ''} onChange={(e) => onUpdateResult(item.id!, 'result_text', e.target.value)} placeholder="Ergebnis, Beschlüsse oder wichtige Punkte..." className="min-h-[80px]" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id={`carryover-${item.id}`} checked={item.carry_over_to_next || false} onCheckedChange={(checked) => onUpdateResult(item.id!, 'carry_over_to_next', checked)} />
                      <label htmlFor={`carryover-${item.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Auf nächste Besprechung übertragen</label>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {meetingItems.filter(item => !item.parent_id && !item.parentLocalKey).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4" />
                <p>Keine Agenda-Punkte für diese Besprechung gefunden.</p>
              </div>
            )}

            {/* Quick Notes Section */}
            {linkedQuickNotes.length > 0 && (
              <div className="mt-8 pt-6 border-t border-dashed">
                <div className="flex items-center gap-2 mb-4">
                  <StickyNote className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-lg">Quick Notes für dieses Meeting</h3>
                  <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
                </div>
                <div className="space-y-4">
                  {linkedQuickNotes.map((note) => (
                    <Card key={note.id} className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            {note.title && <h4 className="font-medium mb-1">{note.title}</h4>}
                            <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
                            <p className="text-xs text-muted-foreground mt-2">Erstellt: {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Ergebnis / Besprechungsnotiz</label>
                            <Textarea value={note.meeting_result || ''} onChange={(e) => onUpdateNoteResult(note.id, e.target.value)} placeholder="Ergebnis aus der Besprechung eintragen..." className="min-h-[80px] bg-background" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
