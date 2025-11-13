import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDocumentContacts } from "@/hooks/useDocumentContacts";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useStakeholderPreload } from "@/hooks/useStakeholderPreload";
import { UserPlus } from "lucide-react";

interface DocumentContactAddDialogProps {
  documentId: string;
  trigger?: ReactNode;
  onContactAdded?: () => void;
}

export function DocumentContactAddDialog({ documentId, trigger, onContactAdded }: DocumentContactAddDialogProps) {
  const { toast } = useToast();
  const { addDocumentContact } = useDocumentContacts(documentId);
  const { personContacts } = useAllPersonContacts();
  const { stakeholders } = useStakeholderPreload();
  
  const [showDialog, setShowDialog] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("related");
  const [notes, setNotes] = useState("");

  const allContacts = [...personContacts, ...stakeholders];

  const handleAddContact = async () => {
    if (!selectedContactId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Kontakt aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      await addDocumentContact(selectedContactId, relationshipType, notes || undefined);
      toast({
        title: "Kontakt hinzugefügt",
        description: "Der Kontakt wurde erfolgreich mit dem Dokument verknüpft.",
      });
      setShowDialog(false);
      setSelectedContactId("");
      setRelationshipType("related");
      setNotes("");
      onContactAdded?.();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <UserPlus className="h-4 w-4 mr-2" />
      Kontakt hinzufügen
    </Button>
  );

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kontakt verknüpfen</DialogTitle>
          <DialogDescription>
            Verknüpfen Sie dieses Dokument mit Kontakten oder Stakeholdern.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="contact">Kontakt / Stakeholder</Label>
            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Kontakt auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {allContacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.contact_type === 'organization' ? '🏢 ' : '👤 '}
                    {contact.name}
                    {contact.organization && ` (${contact.organization})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="relationship">Beziehungstyp</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recipient">Empfänger</SelectItem>
                <SelectItem value="cc">In Kopie</SelectItem>
                <SelectItem value="mentioned">Erwähnt</SelectItem>
                <SelectItem value="stakeholder">Stakeholder</SelectItem>
                <SelectItem value="related">Verbunden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen zur Verknüpfung..."
              rows={3}
            />
          </div>
          <Button onClick={handleAddContact} className="w-full">
            Kontakt hinzufügen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
