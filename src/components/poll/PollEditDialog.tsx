import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Edit, Save, Plus, X, Users, Mail, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContactSelector } from '@/components/ContactSelector';

interface PollParticipant {
  id: string;
  name: string;
  email: string;
  is_external: boolean;
  isNew?: boolean;
}

interface PollEditDialogProps {
  pollId: string;
  currentTitle: string;
  currentDescription?: string;
  currentDeadline?: string;
  onUpdate: () => void;
}

export const PollEditDialog = ({ 
  pollId, 
  currentTitle, 
  currentDescription, 
  currentDeadline, 
  onUpdate 
}: PollEditDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setSaving] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || '');
  const [deadline, setDeadline] = useState<Date | undefined>(
    currentDeadline ? new Date(currentDeadline) : undefined
  );
  
  // Participant management
  const [participants, setParticipants] = useState<PollParticipant[]>([]);
  const [removedParticipantIds, setRemovedParticipantIds] = useState<string[]>([]);
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  useEffect(() => {
    setTitle(currentTitle);
    setDescription(currentDescription || '');
    setDeadline(currentDeadline ? new Date(currentDeadline) : undefined);
  }, [currentTitle, currentDescription, currentDeadline]);

  useEffect(() => {
    if (open) {
      loadParticipants();
    }
  }, [open, pollId]);

  const loadParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const { data, error } = await supabase
        .from('poll_participants')
        .select('id, name, email, is_external')
        .eq('poll_id', pollId);
      
      if (error) throw error;
      setParticipants((data || []).map(p => ({ ...p, isNew: false })));
      setRemovedParticipantIds([]);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const addParticipantFromContact = (contact: any) => {
    if (!contact.email) {
      toast({ title: "Keine E-Mail", description: "Kontakt hat keine E-Mail-Adresse.", variant: "destructive" });
      return;
    }
    if (participants.find(p => p.email === contact.email && !removedParticipantIds.includes(p.id))) {
      toast({ title: "Bereits vorhanden", description: "Dieser Teilnehmer ist bereits hinzugefügt.", variant: "destructive" });
      return;
    }
    setParticipants(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: contact.name,
      email: contact.email,
      is_external: false,
      isNew: true
    }]);
  };

  const addExternalParticipant = () => {
    if (!newParticipantEmail) return;
    if (participants.find(p => p.email === newParticipantEmail && !removedParticipantIds.includes(p.id))) {
      toast({ title: "Bereits vorhanden", description: "Dieser Teilnehmer ist bereits hinzugefügt.", variant: "destructive" });
      return;
    }
    setParticipants(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: newParticipantEmail.split('@')[0],
      email: newParticipantEmail,
      is_external: true,
      isNew: true
    }]);
    setNewParticipantEmail('');
  };

  const removeParticipant = (participantId: string) => {
    if (participantId.startsWith('new-')) {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } else {
      setRemovedParticipantIds(prev => [...prev, participantId]);
    }
  };

  const activeParticipants = participants.filter(p => !removedParticipantIds.includes(p.id));

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const changes = [];
      if (title !== currentTitle) changes.push(`Titel geändert von "${currentTitle}" zu "${title}"`);
      if (description !== currentDescription) changes.push(`Beschreibung ${currentDescription ? 'geändert' : 'hinzugefügt'}`);
      if (deadline?.toISOString() !== currentDeadline) {
        changes.push(`Frist ${deadline ? `geändert zu ${format(deadline, 'dd.MM.yyyy', { locale: de })}` : 'entfernt'}`);
      }

      // Handle participant changes
      const newParticipants = participants.filter(p => p.isNew);
      if (removedParticipantIds.length > 0) changes.push(`${removedParticipantIds.length} Teilnehmer entfernt`);
      if (newParticipants.length > 0) changes.push(`${newParticipants.length} Teilnehmer hinzugefügt`);

      if (changes.length === 0) {
        toast({ title: "Keine Änderungen", description: "Es wurden keine Änderungen vorgenommen." });
        setOpen(false);
        return;
      }

      // Get current version
      const { data: currentPoll } = await supabase
        .from('appointment_polls')
        .select('current_version')
        .eq('id', pollId)
        .single();

      const newVersion = (currentPoll?.current_version || 1) + 1;

      // Create version entry
      await supabase
        .from('poll_versions')
        .insert({
          poll_id: pollId,
          version_number: newVersion,
          title: currentTitle,
          description: currentDescription,
          deadline: currentDeadline,
          changes_summary: changes.join('; '),
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      // Update poll
      const { error } = await supabase
        .from('appointment_polls')
        .update({
          title,
          description,
          deadline: deadline?.toISOString(),
          current_version: newVersion
        })
        .eq('id', pollId);

      if (error) throw error;

      // Remove participants
      if (removedParticipantIds.length > 0) {
        // Delete responses first
        await supabase
          .from('poll_responses')
          .delete()
          .eq('poll_id', pollId)
          .in('participant_id', removedParticipantIds);
        
        await supabase
          .from('poll_participants')
          .delete()
          .in('id', removedParticipantIds);
      }

      // Add new participants
      if (newParticipants.length > 0) {
        const participantData = [];
        for (const p of newParticipants) {
          if (p.is_external) {
            const { data: tokenData } = await supabase.rpc('generate_participant_token');
            participantData.push({
              poll_id: pollId,
              email: p.email,
              name: p.name,
              is_external: true,
              token: tokenData
            });
          } else {
            participantData.push({
              poll_id: pollId,
              email: p.email,
              name: p.name,
              is_external: false,
              token: null
            });
          }
        }
        
        const { error: insertError } = await supabase
          .from('poll_participants')
          .insert(participantData);
        
        if (insertError) throw insertError;
      }

      // Send update notifications
      await supabase.functions.invoke('send-poll-notifications', {
        body: {
          pollId,
          notificationType: 'poll_updated',
          changes: changes.join('; ')
        }
      });

      toast({
        title: "Abstimmung aktualisiert",
        description: "Die Änderungen wurden gespeichert und Teilnehmer benachrichtigt.",
      });

      setOpen(false);
      onUpdate();

    } catch (error) {
      console.error('Error updating poll:', error);
      toast({
        title: "Fehler",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Abstimmung bearbeiten">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terminabstimmung bearbeiten</DialogTitle>
          <DialogDescription>
            Änderungen werden an alle Teilnehmer gesendet.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-title">Titel</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Besprechung Projekt XY"
            />
          </div>
          
          <div>
            <Label htmlFor="edit-description">Beschreibung</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Zusätzliche Informationen..."
              rows={3}
            />
          </div>

          <div>
            <Label>Antwortfrist</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'dd. MMMM yyyy', { locale: de }) : 'Keine Frist'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Participants Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-medium">Teilnehmer verwalten</Label>
            
            {loadingParticipants ? (
              <div className="text-sm text-muted-foreground animate-pulse">Lädt Teilnehmer...</div>
            ) : (
              <>
                {/* Current participants */}
                {activeParticipants.length > 0 && (
                  <div className="space-y-2">
                    {activeParticipants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.is_external ? <Mail className="h-3 w-3 flex-shrink-0" /> : <Users className="h-3 w-3 flex-shrink-0" />}
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{p.email}</span>
                          {p.isNew && <Badge variant="outline" className="text-xs">Neu</Badge>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipant(p.id)}
                          className="h-7 w-7 p-0 flex-shrink-0"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add from contacts */}
                <div>
                  <Label className="text-sm">Kontakt hinzufügen</Label>
                  <ContactSelector
                    onSelect={addParticipantFromContact}
                    placeholder="Kontakt auswählen..."
                    clearAfterSelect={true}
                  />
                </div>

                {/* Add external */}
                <div>
                  <Label className="text-sm">Externe E-Mail hinzufügen</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={newParticipantEmail}
                      onChange={(e) => setNewParticipantEmail(e.target.value)}
                      placeholder="externe@email.de"
                      onKeyPress={(e) => e.key === 'Enter' && addExternalParticipant()}
                    />
                    <Button onClick={addExternalParticipant} size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
