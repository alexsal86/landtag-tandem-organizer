import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Phone } from "lucide-react";
import { Contact } from "@/hooks/useInfiniteContacts";

interface ArchiveTabProps {
  contacts: Contact[];
}

export function ArchiveTab({ contacts }: ArchiveTabProps) {
  const archiveContacts = contacts.filter(c => c.contact_type === 'archive');

  return (
    <div className="space-y-6">
      <Card className="bg-card shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Kontakt-Archiv</CardTitle>
          <p className="text-sm text-muted-foreground">Automatisch erstellte Kontakte aus Follow-Ups unbekannter Telefonnummern, gruppiert nach Nummer.</p>
        </CardHeader>
        <CardContent>
          {archiveContacts.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Kein Archiv vorhanden</h3>
              <p className="text-muted-foreground">Follow-Ups von unbekannten Kontakten werden automatisch hier archiviert.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                archiveContacts.reduce((groups, contact) => {
                  const phone = contact.phone || 'Unbekannte Nummer';
                  if (!groups[phone]) groups[phone] = [];
                  groups[phone].push(contact);
                  return groups;
                }, {} as Record<string, Contact[]>)
              ).map(([phone, groupContacts]) => (
                <Card key={phone} className="border-l-4 border-l-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium flex items-center gap-2"><Phone className="h-4 w-4" />{phone}</h4>
                        <p className="text-sm text-muted-foreground">{groupContacts.length} Follow-Up{groupContacts.length !== 1 ? 's' : ''} archiviert</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {groupContacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            {contact.notes && <p className="text-sm text-muted-foreground truncate max-w-md">{contact.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
