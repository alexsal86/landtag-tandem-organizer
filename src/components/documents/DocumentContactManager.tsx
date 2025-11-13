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
import { X, Building2, User, Mail, Phone, Edit } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DocumentContactAddDialog } from "./DocumentContactAddDialog";

interface DocumentContactManagerProps {
  documentId: string;
  compact?: boolean;
}

export function DocumentContactManager({ documentId, compact = false }: DocumentContactManagerProps) {
  const { toast } = useToast();
  const { documentContacts, removeDocumentContact, updateDocumentContact } = useDocumentContacts(documentId);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

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
        {documentContacts.length === 0 && (
          <span className="text-sm text-muted-foreground">Keine Kontakte verknüpft</span>
        )}
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
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Verknüpfte Kontakte & Stakeholder</span>
          <DocumentContactAddDialog documentId={documentId} />
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
