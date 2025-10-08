import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DecisionEditDialogProps {
  decisionId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export const DecisionEditDialog = ({ decisionId, isOpen, onClose, onUpdated }: DecisionEditDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibleToAll, setVisibleToAll] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && decisionId) {
      loadDecisionData();
      loadProfiles();
    }
  }, [isOpen, decisionId]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadDecisionData = async () => {
    try {
      const { data: decision, error: decisionError } = await supabase
        .from('task_decisions')
        .select('title, description, visible_to_all')
        .eq('id', decisionId)
        .single();

      if (decisionError) throw decisionError;

      setTitle(decision.title || "");
      setDescription(decision.description || "");
      setVisibleToAll(decision.visible_to_all || false);

      const { data: participants, error: participantsError } = await supabase
        .from('task_decision_participants')
        .select('user_id')
        .eq('decision_id', decisionId);

      if (participantsError) throw participantsError;

      setSelectedUsers(participants.map(p => p.user_id));
    } catch (error) {
      console.error('Error loading decision data:', error);
      toast({
        title: "Fehler",
        description: "Entscheidungsdaten konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Benutzer aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update decision
      const { error: updateError } = await supabase
        .from('task_decisions')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          visible_to_all: visibleToAll,
        })
        .eq('id', decisionId);

      if (updateError) throw updateError;

      // Get current participants
      const { data: currentParticipants, error: currentError } = await supabase
        .from('task_decision_participants')
        .select('user_id')
        .eq('decision_id', decisionId);

      if (currentError) throw currentError;

      const currentUserIds = currentParticipants.map(p => p.user_id);

      // Delete removed participants
      const toDelete = currentUserIds.filter(id => !selectedUsers.includes(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('task_decision_participants')
          .delete()
          .eq('decision_id', decisionId)
          .in('user_id', toDelete);

        if (deleteError) throw deleteError;
      }

      // Add new participants
      const toAdd = selectedUsers.filter(id => !currentUserIds.includes(id));
      if (toAdd.length > 0) {
        const newParticipants = toAdd.map(userId => ({
          decision_id: decisionId,
          user_id: userId,
        }));

        const { error: insertError } = await supabase
          .from('task_decision_participants')
          .insert(newParticipants);

        if (insertError) throw insertError;

        // Send notifications to new participants
        for (const userId of toAdd) {
          await supabase.rpc('create_notification', {
            user_id_param: userId,
            type_name: 'task_decision_request',
            title_param: 'Neue Entscheidungsanfrage',
            message_param: `Sie wurden zu einer Entscheidung hinzugefügt: "${title.trim()}"`,
            data_param: {
              decision_id: decisionId,
              decision_title: title.trim()
            },
            priority_param: 'medium'
          });
        }
      }

      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde aktualisiert.",
      });

      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const userOptions = useMemo(() => {
    if (!Array.isArray(profiles)) return [];
    return profiles.map(profile => ({
      value: profile.user_id,
      label: profile.display_name || 'Unbekannter Benutzer',
    }));
  }, [profiles]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Entscheidung bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Titel</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze Beschreibung der Entscheidung"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Beschreibung (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Zusätzliche Details zur Entscheidung"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visible-to-all"
                checked={visibleToAll}
                onCheckedChange={(checked) => setVisibleToAll(checked === true)}
              />
              <label htmlFor="visible-to-all" className="text-sm font-medium flex items-center">
                <Globe className="h-4 w-4 mr-1" />
                Öffentlich (für alle Büromitarbeiter sichtbar)
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Öffentliche Entscheidungen sind für alle Büromitarbeiter sichtbar. Die ausgewählten Benutzer können abstimmen.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Benutzer auswählen (mindestens einer erforderlich)</label>
            <MultiSelect
              options={userOptions}
              selected={selectedUsers}
              onChange={setSelectedUsers}
              placeholder="Benutzer auswählen"
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={isLoading}
            >
              {isLoading ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};