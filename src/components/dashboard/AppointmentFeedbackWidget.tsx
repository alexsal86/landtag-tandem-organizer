import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { useAppointmentCategories } from '@/hooks/useAppointmentCategories';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  CheckCircle2, 
  FileText, 
  Paperclip, 
  CheckSquare, 
  SkipForward, 
  HelpCircle,
  Clock,
  MapPin,
  Loader2
} from 'lucide-react';

import { AppointmentFeedbackSettings } from './AppointmentFeedbackSettings';

interface AppointmentFeedbackWidgetProps {
  widgetSize?: string;
  isEditMode?: boolean;
}

export const AppointmentFeedbackWidget = ({ 
  widgetSize = '2x2',
  isEditMode = false 
}: AppointmentFeedbackWidgetProps) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { appointments, settings, updateFeedback, refetch } = useAppointmentFeedback();
  const { data: categories } = useAppointmentCategories();
  
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('appointment-feedback-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_feedback',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  // Badge-Logik für Reminder
  const shouldShowReminder = useMemo(() => {
    if (!settings?.reminder_start_time) return false;

    const now = new Date();
    const currentTime = format(now, 'HH:mm:ss');

    // Zeige Badge nur ab konfigurierter Zeit
    if (currentTime < settings.reminder_start_time) return false;

    // Zeige Badge nur wenn pending Feedbacks vorhanden
    const hasPending = appointments?.some(a => 
      a.feedback?.feedback_status === 'pending' && !a.feedback?.reminder_dismissed
    );

    return hasPending;
  }, [settings, appointments]);

  // Anzahl der offenen Feedbacks
  const pendingFeedbackCount = useMemo(() => {
    return appointments?.filter(a => 
      a.feedback?.feedback_status === 'pending'
    ).length || 0;
  }, [appointments]);

  // Sortierte Termine nach Priorität - nur pending anzeigen
  const sortedAppointments = useMemo(() => {
    if (!appointments) return [];
    
    return [...appointments]
      .filter(apt => {
        // Zeige nur Termine mit Feedback
        if (!apt.feedback) return false;
        
        // Nur pending Feedbacks anzeigen
        return apt.feedback.feedback_status === 'pending';
      })
      .sort((a, b) => {
        const priorityA = a.feedback?.priority_score || 0;
        const priorityB = b.feedback?.priority_score || 0;
        return priorityB - priorityA;
      });
  }, [appointments]);

  const handleMarkCompleted = async (feedbackId: string) => {
    updateFeedback({
      feedbackId,
      updates: { 
        feedback_status: 'completed',
        completed_at: new Date().toISOString()
      }
    });
  };

  const handleSkip = async (feedbackId: string) => {
    updateFeedback({
      feedbackId,
      updates: { feedback_status: 'skipped' }
    });
  };

  const handleSaveNote = async (feedbackId: string) => {
    if (!noteText.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie eine Notiz ein.',
        variant: 'destructive'
      });
      return;
    }

    updateFeedback({
      feedbackId,
      updates: { 
        notes: noteText,
        feedback_status: 'completed',
        completed_at: new Date().toISOString()
      }
    });

    setNoteText('');
    setSelectedAppointment(null);
    
    toast({
      title: 'Notiz gespeichert',
      description: 'Die Notiz wurde erfolgreich gespeichert.'
    });
  };

  const handleFileUpload = async (appointmentId: string, feedbackId: string, file: File) => {
    if (!user?.id || !currentTenant?.id) return;

    setIsUploading(true);

    try {
      const filePath = `${currentTenant.id}/${appointmentId}/${Date.now()}_${file.name}`;

      // Upload zu Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Dokument-Metadaten für spätere Referenz speichern
      // Falls appointment_documents Tabelle vorhanden ist, können wir hier einfügen
      // Für jetzt speichern wir nur den Feedback-Status
      console.log('Document uploaded:', filePath);

      // Feedback aktualisieren
      updateFeedback({
        feedbackId,
        updates: { 
          has_documents: true,
          feedback_status: 'completed',
          completed_at: new Date().toISOString()
        }
      });

      toast({
        title: 'Dokument hochgeladen',
        description: `${file.name} wurde erfolgreich hochgeladen.`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload fehlgeschlagen',
        description: 'Das Dokument konnte nicht hochgeladen werden.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateTask = async (appointmentId: string, feedbackId: string, appointment: any) => {
    if (!taskTitle.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie einen Aufgabentitel ein.',
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id || !currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: taskTitle,
          description: `Follow-up zu Termin: ${appointment.title}`,
          category: 'follow-up',
          user_id: user.id,
          tenant_id: currentTenant.id,
          assigned_to: user.id,
          due_date: taskDueDate || null,
          status: 'todo',
          priority: 'medium'
        });

      if (error) throw error;

      // Feedback aktualisieren
      updateFeedback({
        feedbackId,
        updates: { 
          has_tasks: true,
          feedback_status: 'completed',
          completed_at: new Date().toISOString()
        }
      });

      setTaskTitle('');
      setTaskDueDate('');
      setSelectedAppointment(null);

      toast({
        title: 'Aufgabe erstellt',
        description: 'Die Follow-up Aufgabe wurde erstellt.'
      });
    } catch (error) {
      console.error('Task creation error:', error);
      toast({
        title: 'Fehler',
        description: 'Die Aufgabe konnte nicht erstellt werden.',
        variant: 'destructive'
      });
    }
  };

  const getCategoryColor = (categoryName?: string) => {
    if (!categoryName) return '#3b82f6';
    const category = categories?.find(c => c.name === categoryName);
    return category?.color || '#3b82f6';
  };

  const getCategoryLabel = (categoryName?: string) => {
    if (!categoryName) return 'Externer Termin';
    const category = categories?.find(c => c.name === categoryName);
    return category?.label || categoryName;
  };

  if (sortedAppointments.length === 0) {
    // Prüfe ob es completed-Termine gibt (die schon länger als 24h her sind)
    const hasRecentlyCompleted = appointments?.some(apt => 
      apt.feedback?.feedback_status === 'completed' &&
      apt.feedback.completed_at &&
      (Date.now() - new Date(apt.feedback.completed_at).getTime()) < 24 * 60 * 60 * 1000
    );

    const allAreCompleted = appointments?.every(apt => 
      apt.feedback?.feedback_status === 'completed' || apt.feedback?.feedback_status === 'skipped'
    );

    return (
      <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="relative">
            <CheckCircle2 className="w-5 h-5" />
            {pendingFeedbackCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] rounded-full"
              >
                {pendingFeedbackCount}
              </Badge>
            )}
          </div>
          Termin-Feedback
          <div className="ml-auto">
            <AppointmentFeedbackSettings />
          </div>
        </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
            {allAreCompleted && appointments && appointments.length > 0 ? (
              <>
                <p className="text-sm font-medium text-foreground">Alle Feedbacks erledigt! 🎉</p>
                <p className="text-xs mt-1">Erledigte Termine werden 24h angezeigt</p>
              </>
            ) : (
              <>
                <p className="text-sm">Keine offenen Termine für Feedback</p>
                <p className="text-xs mt-1">Neue Termine erscheinen hier automatisch</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col relative">
      {shouldShowReminder && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-destructive rounded-full flex items-center justify-center animate-pulse shadow-lg">
          <HelpCircle className="w-4 h-4 text-destructive-foreground" />
        </div>
      )}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Termin-Feedback
          <div className="ml-auto">
            <AppointmentFeedbackSettings />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-3">
            {sortedAppointments.map((appointment) => {
              const feedback = appointment.feedback;
              if (!feedback) return null;

              const isCompleted = feedback.feedback_status === 'completed';

              return (
                <div 
                  key={appointment.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isCompleted 
                      ? 'bg-muted/30 border-muted' 
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate mb-1">
                        {appointment.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(appointment.start_time), 'HH:mm', { locale: de })} - 
                        {format(new Date(appointment.end_time), 'HH:mm', { locale: de })}
                        {appointment.location && (
                          <>
                            <MapPin className="w-3 h-3 ml-1" />
                            <span className="truncate">{appointment.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {appointment.event_type === 'external_event' ? (
                      <Badge variant="outline" className="text-xs shrink-0">
                        📅 Externer Kalender
                      </Badge>
                    ) : (
                      <Badge 
                        variant="secondary" 
                        className="text-xs shrink-0"
                        style={{ 
                          backgroundColor: `${getCategoryColor(appointment.category)}20`,
                          color: getCategoryColor(appointment.category)
                        }}
                      >
                        {getCategoryLabel(appointment.category)}
                      </Badge>
                    )}
                  </div>

                  {isCompleted ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Feedback abgeschlossen</span>
                      {feedback.notes && (
                        <span className="ml-2 text-xs">• Notiz vorhanden</span>
                      )}
                      {feedback.has_documents && (
                        <span className="ml-2 text-xs">• Dokumente vorhanden</span>
                      )}
                      {feedback.has_tasks && (
                        <span className="ml-2 text-xs">• Aufgabe erstellt</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkCompleted(feedback.id)}
                        className="h-8"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Erledigt
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8">
                            <FileText className="w-4 h-4 mr-1" />
                            Notiz
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Notiz zu "{appointment.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Was möchten Sie festhalten?"
                              rows={5}
                            />
                            <Button 
                              onClick={() => handleSaveNote(feedback.id)}
                              className="w-full"
                            >
                              Speichern
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(appointment.id, feedback.id, file);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-8"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4 mr-1" />
                        )}
                        Upload
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8">
                            <CheckSquare className="w-4 h-4 mr-1" />
                            Task
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Aufgabe zu "{appointment.title}"</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="task-title">Aufgabe</Label>
                              <Input
                                id="task-title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder="Aufgabentitel eingeben..."
                              />
                            </div>
                            <div>
                              <Label htmlFor="task-due">Fällig am</Label>
                              <Input
                                id="task-due"
                                type="date"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                              />
                            </div>
                            <Button 
                              onClick={() => handleCreateTask(appointment.id, feedback.id, appointment)}
                              className="w-full"
                            >
                              Aufgabe erstellen
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSkip(feedback.id)}
                        className="h-8 ml-auto"
                      >
                        <SkipForward className="w-4 h-4 mr-1" />
                        Überspringen
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
