import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDocumentContacts } from "@/hooks/useDocumentContacts";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useStakeholderPreload } from "@/hooks/useStakeholderPreload";
import { UserPlus, X, Building2, User, Mail, Phone, Edit } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DocumentContactManagerProps {
  documentId: string;
  compact?: boolean;
}

export function DocumentContactManager({ documentId, compact = false }: DocumentContactManagerProps) {
  const { toast } = useToast();
  const { documentContacts, addDocumentContact, removeDocumentContact, updateDocumentContact } = useDocumentContacts(documentId);
  const { personContacts } = useAllPersonContacts();
  const { stakeholders } = useStakeholderPreload();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("related");
  const [notes, setNotes] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

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
      setShowAddDialog(false);
      setSelectedContactId("");
      setRelationshipType("related");
      setNotes("");
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveContact = async (documentContactId: string) => {
    try {
      await removeDocumentContact(documentContactId);
      toast({
        title: "Kontakt entfernt",
        description: "Die Verknüpfung wurde erfolgreich entfernt.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, string> = {
      recipient: "Empfänger",
      cc: "In Kopie",
      mentioned: "Erwähnt",
      stakeholder: "Stakeholder",
      related: "Verbunden",
    };
    return labels[type] || type;
  };

  const getRelationshipColor = (type: string) => {
    const colors: Record<string, string> = {
      recipient: "bg-primary/10 text-primary border-primary/20",
      cc: "bg-secondary/10 text-secondary-foreground border-secondary/20",
      mentioned: "bg-muted text-muted-foreground border-border",
      stakeholder: "bg-accent/10 text-accent-foreground border-accent/20",
      related: "bg-muted text-muted-foreground border-border",
    };
    return colors[type] || "bg-muted text-muted-foreground border-border";
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {documentContacts.map((dc) => (
          <Badge key={dc.id} variant="outline" className={getRelationshipColor(dc.relationship_type)}>
            {dc.contact?.contact_type === 'organization' ? (
              <Building2 className="h-3 w-3 mr-1" />
            ) : (
              <User className="h-3 w-3 mr-1" />
            )}
            {dc.contact?.name}
            <button
              onClick={() => handleRemoveContact(dc.id)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Kontakt hinzufügen
            </Button>
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
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Verknüpfte Kontakte & Stakeholder</span>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Hinzufügen
              </Button>
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
        </CardTitle>
        <CardDescription>
          Personen und Organisationen, die mit diesem Dokument verbunden sind
        </CardDescription>
      </CardHeader>
      <CardContent>
        {documentContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Kontakte verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {documentContacts.map((dc) => (
              <div
                key={dc.id}
                className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={dc.contact?.avatar_url} />
                    <AvatarFallback>
                      {dc.contact?.contact_type === 'organization' ? (
                        <Building2 className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{dc.contact?.name}</p>
                      <Badge variant="outline" className={getRelationshipColor(dc.relationship_type)}>
                        {getRelationshipLabel(dc.relationship_type)}
                      </Badge>
                    </div>
                    {dc.contact?.organization && (
                      <p className="text-sm text-muted-foreground truncate">
                        {dc.contact.organization}
                      </p>
                    )}
                    {dc.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {dc.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {dc.contact?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {dc.contact.email}
                        </span>
                      )}
                      {dc.contact?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {dc.contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveContact(dc.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
