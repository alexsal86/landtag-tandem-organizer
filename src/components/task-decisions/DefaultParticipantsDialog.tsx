import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultDecisionParticipants } from "@/hooks/useDefaultDecisionParticipants";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface DefaultParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export function DefaultParticipantsDialog({ open, onOpenChange }: DefaultParticipantsDialogProps) {
  const { defaultParticipants, setDefaultParticipants } = useDefaultDecisionParticipants();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(defaultParticipants);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      loadProfiles();
    }
    if (open) {
      setSelectedUsers(defaultParticipants);
    }
  }, [open]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      if (error) throw error;
      setProfiles(data || []);
      setLoaded(true);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const userOptions = useMemo(() => {
    return profiles.map(p => ({
      value: p.user_id,
      label: p.display_name || 'Unbekannter Benutzer',
    }));
  }, [profiles]);

  const handleSave = () => {
    setDefaultParticipants(selectedUsers);
    toast({
      title: "Gespeichert",
      description: selectedUsers.length > 0
        ? `${selectedUsers.length} Standard-Teilnehmer gespeichert.`
        : "Standard-Teilnehmer zurückgesetzt.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Standard-Teilnehmer
          </DialogTitle>
          <DialogDescription>
            Diese Benutzer werden bei neuen Entscheidungen automatisch vorausgewählt.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loaded ? (
            <MultiSelect
              options={userOptions}
              selected={selectedUsers}
              onChange={setSelectedUsers}
              placeholder="Benutzer auswählen..."
            />
          ) : (
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
