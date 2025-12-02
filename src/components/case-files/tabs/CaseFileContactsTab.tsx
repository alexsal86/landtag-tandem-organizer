import { useState } from "react";
import { CaseFileContact, CONTACT_ROLES } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Users, Mail, Phone, Building2 } from "lucide-react";
import { ContactSelector } from "@/components/ContactSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CaseFileContactsTabProps {
  contacts: CaseFileContact[];
  onAdd: (contactId: string, role: string, notes?: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function CaseFileContactsTab({ contacts, onAdd, onRemove }: CaseFileContactsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [role, setRole] = useState("stakeholder");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!selectedContactId) return;
    setIsSubmitting(true);
    const success = await onAdd(selectedContactId, role, notes || undefined);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setSelectedContactId(null);
      setRole("stakeholder");
      setNotes("");
    }
  };

  const getRoleLabel = (roleValue: string) => {
    return CONTACT_ROLES.find(r => r.value === roleValue)?.label || roleValue;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Verknüpfte Kontakte
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Kontakt hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Kontakte verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={item.contact?.avatar_url || undefined} />
                    <AvatarFallback>
                      {item.contact?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{item.contact?.name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {item.contact?.organization && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {item.contact.organization}
                        </span>
                      )}
                      {item.contact?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {item.contact.email}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{getRoleLabel(item.role)}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontakt verknüpfen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Kontakt aus und definieren Sie dessen Rolle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Kontakt</Label>
              <ContactSelector
                selectedContactId={selectedContactId}
                onSelect={(contact) => setSelectedContactId(contact?.id || null)}
                placeholder="Kontakt suchen..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Rolle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notizen (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={!selectedContactId || isSubmitting}>
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
