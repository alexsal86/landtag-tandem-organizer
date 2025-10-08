import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Users, Mail, Phone, Building } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Contact {
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
}

interface DuplicateMatch {
  contact: Contact;
  score: number;
  reasons: string[];
}

interface ContactImportDuplicateDialogProps {
  open: boolean;
  newContact: Contact;
  duplicates: DuplicateMatch[];
  onSkip: () => void;
  onOverwrite: (contactId: string) => void;
  onMerge: (contactId: string) => void;
  onImportAnyway: () => void;
  onApplyToAll: (action: 'skip' | 'overwrite' | 'import') => void;
}

export function ContactImportDuplicateDialog({
  open,
  newContact,
  duplicates,
  onSkip,
  onOverwrite,
  onMerge,
  onImportAnyway,
  onApplyToAll,
}: ContactImportDuplicateDialogProps) {
  const topDuplicate = duplicates[0];

  const getMatchColor = (score: number) => {
    if (score >= 0.9) return "bg-red-100 text-red-800 border-red-200";
    if (score >= 0.7) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Mögliches Duplikat gefunden
          </DialogTitle>
          <DialogDescription>
            Der folgende Kontakt existiert möglicherweise bereits. Wie möchten Sie fortfahren?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Neuer Kontakt */}
          <div>
            <h3 className="font-semibold text-sm mb-2 text-primary">Neuer Kontakt:</h3>
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{newContact.name}</span>
                  </div>
                  {newContact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{newContact.email}</span>
                    </div>
                  )}
                  {newContact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{newContact.phone}</span>
                    </div>
                  )}
                  {newContact.organization && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{newContact.organization}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Existierende Duplikate */}
          <div>
            <h3 className="font-semibold text-sm mb-2 text-destructive">
              Existierende Kontakte ({duplicates.length}):
            </h3>
            <div className="space-y-2">
              {duplicates.slice(0, 3).map((dup, index) => (
                <Card key={index} className="border-l-4 border-orange-500">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{dup.contact.name}</span>
                        </div>
                        <Badge variant="outline" className={getMatchColor(dup.score)}>
                          {Math.round(dup.score * 100)}% Übereinstimmung
                        </Badge>
                      </div>
                      {dup.contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{dup.contact.email}</span>
                        </div>
                      )}
                      {dup.contact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{dup.contact.phone}</span>
                        </div>
                      )}
                      {dup.contact.organization && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{dup.contact.organization}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dup.reasons.map((reason, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {duplicates.length > 3 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... und {duplicates.length - 3} weitere mögliche Duplikate
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onSkip}>
                Überspringen
              </Button>
              <Button variant="default" onClick={onImportAnyway}>
                Trotzdem importieren
              </Button>
            </div>
            
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground mb-2">Aktion auf alle anwenden:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplyToAll('skip')}
                  className="text-xs"
                >
                  Alle überspringen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplyToAll('import')}
                  className="text-xs"
                >
                  Alle importieren
                </Button>
              </div>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
