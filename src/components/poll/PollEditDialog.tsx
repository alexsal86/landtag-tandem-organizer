import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Edit, Save } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    setTitle(currentTitle);
    setDescription(currentDescription || '');
    setDeadline(currentDeadline ? new Date(currentDeadline) : undefined);
  }, [currentTitle, currentDescription, currentDeadline]);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Track changes
      const changes = [];
      if (title !== currentTitle) changes.push(`Titel geändert von "${currentTitle}" zu "${title}"`);
      if (description !== currentDescription) changes.push(`Beschreibung ${currentDescription ? 'geändert' : 'hinzugefügt'}`);
      if (deadline?.toISOString() !== currentDeadline) {
        changes.push(`Frist ${deadline ? `geändert zu ${format(deadline, 'dd.MM.yyyy', { locale: de })}` : 'entfernt'}`);
      }

      if (changes.length === 0) {
        toast({
          title: "Keine Änderungen",
          description: "Es wurden keine Änderungen vorgenommen.",
        });
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
      <DialogContent className="sm:max-w-lg">
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