import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, ArrowRight } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email?: string;
}

interface StakeholderToDistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stakeholder: Contact;
  associatedContacts: Contact[];
}

export function StakeholderToDistributionDialog({ 
  isOpen, 
  onClose, 
  stakeholder, 
  associatedContacts 
}: StakeholderToDistributionDialogProps) {
  const [name, setName] = useState(`${stakeholder.name} - Kontakte`);
  const [description, setDescription] = useState(`Verteiler für alle Kontakte der Organisation ${stakeholder.name}`);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!user || associatedContacts.length === 0) return;

    setLoading(true);
    try {
      // Create distribution list
      const { data: distributionList, error: listError } = await supabase
        .from('distribution_lists')
        .insert({
          user_id: user.id,
          name,
          description,
          topic,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Add all associated contacts as members
      const members = associatedContacts.map(contact => ({
        distribution_list_id: distributionList.id,
        contact_id: contact.id,
      }));

      const { error: membersError } = await supabase
        .from('distribution_list_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({
        title: "Verteiler erstellt",
        description: `Verteiler "${name}" wurde mit ${associatedContacts.length} Kontakten erstellt.`,
      });

      onClose();
    } catch (error) {
      console.error('Error creating distribution list:', error);
      toast({
        title: "Fehler",
        description: "Verteiler konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Verteiler aus Stakeholder erstellen
          </DialogTitle>
          <DialogDescription>
            Erstelle einen Verteiler mit allen Kontakten von {stakeholder.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">{stakeholder.name}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{associatedContacts.length} Kontakte</span>
          </div>

          <div>
            <Label htmlFor="name">Name des Verteilers</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="topic">Thema/Zweck</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. Newsletter, Einladungen..."
            />
          </div>

          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleCreate} 
              disabled={loading || !name.trim() || associatedContacts.length === 0}
              className="flex-1"
            >
              {loading ? "Wird erstellt..." : "Verteiler erstellen"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}