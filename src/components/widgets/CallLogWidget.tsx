import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, PhoneIncoming, PhoneMissed, Plus, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CallLog {
  id: string;
  contact_id?: string;
  caller_name?: string;
  caller_phone?: string;
  call_type: 'outgoing' | 'incoming' | 'missed';
  duration_minutes?: number;
  call_date: string;
  notes?: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  follow_up_completed: boolean;
  completion_notes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  created_by_name?: string;
  task_id?: string;
}

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface CallLogWidgetProps {
  className?: string;
  configuration?: {
    showFollowUps?: boolean;
    compact?: boolean;
    theme?: string;
  };
}

export const CallLogWidget: React.FC<CallLogWidgetProps> = ({ 
  className, 
  configuration = {} 
}) => {
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  
  const CALLS_PER_PAGE = 5;
  
  // Form state
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing');
  const [selectedContact, setSelectedContact] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callType, setCallType] = useState<'outgoing' | 'incoming' | 'missed'>('outgoing');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [suggestedContact, setSuggestedContact] = useState<Contact | null>(null);

  const { showFollowUps = true, compact = false } = configuration;

  useEffect(() => {
    if (user) {
      loadCallLogs();
      loadContacts();
    }
  }, [user]);

  const loadCallLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('call_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCallLogs((data || []) as CallLog[]);
    } catch (error) {
      console.error('Error loading call logs:', error);
      toast.error('Fehler beim Laden der Anrufliste');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const createCallLog = async () => {
    if (!user) return;

    try {
      // Get user profile for created_by_name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const newCallLog = {
        user_id: user.id,
        contact_id: contactMode === 'existing' ? selectedContact || undefined : undefined,
        caller_name: contactMode === 'new' ? callerName.trim() || undefined : undefined,
        caller_phone: contactMode === 'new' ? callerPhone.trim() || undefined : undefined,
        call_type: callType,
        duration_minutes: duration ? parseInt(duration) : undefined,
        call_date: new Date().toISOString(),
        notes: notes.trim() || undefined,
        follow_up_required: followUpRequired,
        follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : undefined,
        priority,
        created_by_name: profile?.display_name || undefined
      };

      const { data, error } = await supabase
        .from('call_logs')
        .insert(newCallLog)
        .select()
        .single();

      if (error) throw error;

      // Create follow-up task if required
      if (followUpRequired) {
        // First, ensure main "Call Follow-ups" task exists
        let mainTaskId: string;
        
        const { data: existingMainTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', 'Call Follow-ups')
          .eq('category', 'call_follow_up')
          .single();

        if (existingMainTask) {
          mainTaskId = existingMainTask.id;
        } else {
          // Create main task
          const { data: mainTaskData, error: mainTaskError } = await supabase
            .from('tasks')
            .insert({
              user_id: user.id,
              title: 'Call Follow-ups',
              description: 'Sammlung aller Follow-ups aus Anrufprotokollen',
              priority: 'medium',
              status: 'todo',
              category: 'call_follow_up',
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select('id')
            .single();

          if (mainTaskError || !mainTaskData) {
            console.error('Error creating main task:', mainTaskError);
            return;
          }
          mainTaskId = mainTaskData.id;
        }

        // Create subtask linked to main task
        const contactName = contactMode === 'existing' 
          ? getContactName(selectedContact) 
          : callerName || 'Unbekannter Kontakt';

        const { data: subtaskData, error: subtaskError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Follow-up: ${contactName}`,
            description: `Grund: ${notes}\nTermin: ${followUpDate ? new Date(followUpDate).toLocaleDateString('de-DE') : 'Bald'}\nHauptaufgabe: Call Follow-ups`,
            priority: priority,
            status: 'todo',
            category: 'call_follow_up',
            due_date: followUpDate ? new Date(followUpDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            call_log_id: data.id
          })
          .select('id')
          .single();

        if (subtaskError || !subtaskData) {
          console.error('Error creating subtask:', subtaskError);
        } else {
          // Task linking is handled via call_log_id in tasks table
          console.log('Subtask created successfully:', subtaskData.id);
        }
      }

      await loadCallLogs();
      resetForm();
      toast.success('Anruf protokolliert');
    } catch (error) {
      console.error('Error creating call log:', error);
      toast.error('Fehler beim Protokollieren des Anrufs');
    }
  };

  const markFollowUpComplete = async (id: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('call_logs')
        .update({ 
          follow_up_completed: true,
          completion_notes: notes || null
        })
        .eq('id', id);

      if (error) throw error;

      // Update the associated task if it exists
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('call_log_id', id);
      
      if (taskError) {
        console.error('Error updating task:', taskError);
      }

      await loadCallLogs();
      toast.success('Follow-up abgeschlossen');
    } catch (error) {
      console.error('Error marking follow-up complete:', error);
      toast.error('Fehler beim Abschließen des Follow-ups');
    }
  };

  const resetForm = () => {
    setContactMode('existing');
    setSelectedContact('');
    setCallerName('');
    setCallerPhone('');
    setCallType('outgoing');
    setDuration('');
    setNotes('');
    setFollowUpRequired(false);
    setFollowUpDate('');
    setPriority('medium');
    setSuggestedContact(null);
    setShowAddForm(false);
  };

  const getCallTypeIcon = (type: 'outgoing' | 'incoming' | 'missed') => {
    switch (type) {
      case 'outgoing': return <PhoneCall className="h-4 w-4 text-green-500" />;
      case 'incoming': return <PhoneIncoming className="h-4 w-4 text-blue-500" />;
      case 'missed': return <PhoneMissed className="h-4 w-4 text-red-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getContactName = (contactId?: string, callerName?: string) => {
    if (callerName) return callerName;
    if (!contactId) return 'Unbekannt';
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || 'Unbekannt';
  };

  const getPriorityDotColor = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    switch (priority) {
      case 'low': return 'hsl(var(--muted-foreground))';
      case 'medium': return 'hsl(45 95% 50%)'; // government-gold
      case 'high': return 'hsl(25 95% 53%)'; // orange
      case 'urgent': return 'hsl(var(--destructive))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const handleCompleteFollowUp = (callLog: CallLog) => {
    setSelectedCallLog(callLog);
    setCompletionDialogOpen(true);
  };

  const handleSubmitCompletion = async () => {
    if (!selectedCallLog) return;
    
    await markFollowUpComplete(selectedCallLog.id, completionNotes);
    setCompletionDialogOpen(false);
    setSelectedCallLog(null);
    setCompletionNotes("");
  };

  // Pagination logic
  const totalPages = Math.ceil(callLogs.length / CALLS_PER_PAGE);
  const startIndex = (currentPage - 1) * CALLS_PER_PAGE;
  const endIndex = startIndex + CALLS_PER_PAGE;
  const currentCallLogs = callLogs.slice(startIndex, endIndex);

  const checkForExistingContact = (phone: string) => {
    if (!phone.trim()) {
      setSuggestedContact(null);
      return;
    }
    
    const foundContact = contacts.find(c => c.phone && c.phone.includes(phone.replace(/\s/g, '')));
    setSuggestedContact(foundContact || null);
  };

  const saveAsNewContact = async () => {
    if (!callerName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user?.id,
          name: callerName.trim(),
          phone: callerPhone.trim() || undefined,
          contact_type: 'person',
          category: 'citizen'
        })
        .select()
        .single();

      if (error) throw error;

      setContacts(prev => [...prev, data]);
      toast.success('Kontakt gespeichert');
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Fehler beim Speichern des Kontakts');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Heute ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Gestern ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const pendingFollowUps = callLogs.filter(log => 
    log.follow_up_required && !log.follow_up_completed
  );

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call Log
            {showFollowUps && pendingFollowUps.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingFollowUps.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-auto">
        {/* Add Form */}
        {showAddForm && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            {/* Contact Mode Toggle */}
            <div className="flex gap-1 p-1 bg-background rounded-md">
              <Button
                variant={contactMode === 'existing' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setContactMode('existing')}
                className="flex-1 h-7 text-xs"
              >
                Bestehender Kontakt
              </Button>
              <Button
                variant={contactMode === 'new' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setContactMode('new')}
                className="flex-1 h-7 text-xs"
              >
                Neuer Kontakt
              </Button>
            </div>

            {/* Contact Selection */}
            {contactMode === 'existing' ? (
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kontakt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Name des Anrufers..."
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="space-y-1">
                  <Input
                    placeholder="Telefonnummer (optional)"
                    value={callerPhone}
                    onChange={(e) => {
                      setCallerPhone(e.target.value);
                      checkForExistingContact(e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                  {suggestedContact && (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border dark:bg-amber-950/20 dark:text-amber-400">
                      📞 Kontakt bereits vorhanden: {suggestedContact.name}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setContactMode('existing');
                          setSelectedContact(suggestedContact.id);
                          setCallerName('');
                          setCallerPhone('');
                          setSuggestedContact(null);
                        }}
                        className="ml-2 h-6 px-2 text-xs"
                      >
                        Verwenden
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Select value={callType} onValueChange={(value) => setCallType(value as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">Ausgehend</SelectItem>
                  <SelectItem value="incoming">Eingehend</SelectItem>
                  <SelectItem value="missed">Verpasst</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Dauer (Min)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                type="number"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={priority} onValueChange={(value) => setPriority(value as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              placeholder="Notizen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
              rows={2}
            />

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={followUpRequired}
                  onChange={(e) => setFollowUpRequired(e.target.checked)}
                  className="rounded"
                />
                Follow-up erforderlich
              </label>
              
              {followUpRequired && (
                <Input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={createCallLog} size="sm">
                Protokollieren
              </Button>
              {contactMode === 'new' && callerName.trim() && (
                <Button onClick={saveAsNewContact} variant="outline" size="sm">
                  Als Kontakt speichern
                </Button>
              )}
              <Button onClick={resetForm} variant="ghost" size="sm">
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Follow-ups Section */}
        {showFollowUps && pendingFollowUps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Ausstehende Follow-ups
            </h4>
            {pendingFollowUps.slice(0, 3).map(log => (
              <div
                key={log.id}
                className="p-2 border rounded-lg bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {getContactName(log.contact_id, log.caller_name)}
                      </span>
                      <button
                        className="w-3 h-3 rounded-full border-2 hover:scale-110 transition-transform cursor-pointer"
                        style={{ 
                          backgroundColor: getPriorityDotColor(log.priority),
                          borderColor: getPriorityDotColor(log.priority)
                        }}
                        title={`Priorität: ${log.priority}`}
                        onClick={() => handleCompleteFollowUp(log)}
                      />
                    </div>
                    {log.follow_up_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.follow_up_date)}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCompleteFollowUp(log)}
                    className="h-6 px-2 text-xs"
                  >
                    Erledigt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call Logs List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Letzte Anrufe</h4>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-6 w-6 p-0"
                >
                  ‹
                </Button>
                <span className="text-xs text-muted-foreground mx-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-6 w-6 p-0"
                >
                  ›
                </Button>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Laden...
            </div>
          ) : callLogs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Noch keine Anrufe protokolliert
            </div>
          ) : (
            currentCallLogs.map(log => (
              <div
                key={log.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {getCallTypeIcon(log.call_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {getContactName(log.contact_id, log.caller_name)}
                        </span>
                        {log.priority !== 'medium' && (
                          <Badge className={`text-xs ${getPriorityColor(log.priority)}`}>
                            {log.priority}
                          </Badge>
                        )}
                        {log.follow_up_required && !log.follow_up_completed && (
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      
                      {log.caller_phone && (
                        <div className="text-xs text-muted-foreground">
                          📞 {log.caller_phone}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        {formatDate(log.call_date)}
                        {log.duration_minutes && ` • ${log.duration_minutes} Min`}
                      </div>
                      
                      {log.notes && !compact && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Completion Dialog */}
        {completionDialogOpen && selectedCallLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal">
            <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Follow-up abschließen</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Follow-up für {getContactName(selectedCallLog.contact_id, selectedCallLog.caller_name)}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Erledigungsnotiz (optional)
                  </label>
                  <textarea
                    className="w-full p-2 border border-input rounded-md text-sm resize-none"
                    rows={3}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Was wurde zur Erledigung unternommen?"
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompletionDialogOpen(false);
                      setSelectedCallLog(null);
                      setCompletionNotes("");
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={handleSubmitCompletion}>
                    Abschließen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};