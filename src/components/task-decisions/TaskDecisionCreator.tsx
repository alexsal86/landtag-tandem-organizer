import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskDecisionCreatorProps {
  taskId: string;
  onDecisionCreated: () => void;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export const TaskDecisionCreator = ({ taskId, onDecisionCreated }: TaskDecisionCreatorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

  const handleSubmit = async () => {
    if (!title.trim() || selectedUsers.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein und wählen Sie mindestens einen Benutzer aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create the decision
      const { data: decision, error: decisionError } = await supabase
        .from('task_decisions')
        .insert({
          task_id: taskId,
          title: title.trim(),
          description: description.trim() || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Add participants
      const participants = selectedUsers.map(userId => ({
        decision_id: decision.id,
        user_id: userId,
      }));

      const { error: participantsError } = await supabase
        .from('task_decision_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      toast({
        title: "Erfolgreich",
        description: "Entscheidungsanfrage wurde erstellt.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedUsers([]);
      setIsOpen(false);
      onDecisionCreated();
    } catch (error) {
      console.error('Error creating decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidungsanfrage konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const userOptions = profiles.map(profile => ({
    value: profile.user_id,
    label: profile.display_name || 'Unbekannter Benutzer',
  }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadProfiles}
          className="text-destructive hover:text-destructive/80"
        >
          <Vote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Entscheidung anfordern</DialogTitle>
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
          <div>
            <label className="text-sm font-medium">Benutzer auswählen</label>
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
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Erstelle..." : "Erstellen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};