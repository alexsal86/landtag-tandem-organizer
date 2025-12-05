import { useState, useEffect } from "react";
import { CaseFileLetter } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CaseFileLettersTabProps {
  letters: CaseFileLetter[];
  onAdd: (letterId: string, notes?: string, title?: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function CaseFileLettersTab({ letters, onAdd, onRemove }: CaseFileLettersTabProps) {
  const { currentTenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableLetters, setAvailableLetters] = useState<any[]>([]);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (dialogOpen && currentTenant) {
      loadLetters();
    }
  }, [dialogOpen, currentTenant]);

  const loadLetters = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('letters')
      .select('id, title, subject, status, created_at')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setAvailableLetters(data || []);
  };

  const handleAdd = async () => {
    if (!selectedLetterId) return;
    setIsSubmitting(true);
    const selectedLetter = availableLetters.find(l => l.id === selectedLetterId);
    const success = await onAdd(selectedLetterId, notes || undefined, selectedLetter?.title);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setSelectedLetterId(null);
      setNotes("");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
      case 'review': return 'In Prüfung';
      case 'approved': return 'Freigegeben';
      case 'sent': return 'Versendet';
      case 'archived': return 'Archiviert';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500';
      case 'approved': return 'bg-blue-500';
      case 'review': return 'bg-yellow-500';
      case 'draft': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredLetters = availableLetters.filter(letter =>
    letter.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    letter.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedLetterIds = letters.map(l => l.letter_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Verknüpfte Briefe
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Brief hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {letters.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Briefe verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {letters.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{item.letter?.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.letter?.subject}
                      {item.letter?.created_at && (
                        <> · {format(new Date(item.letter.created_at), 'dd.MM.yyyy', { locale: de })}</>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-white", getStatusColor(item.letter?.status || ''))}>
                    {getStatusLabel(item.letter?.status || '')}
                  </Badge>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Brief verknüpfen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Brief aus, der mit dieser FallAkte verknüpft werden soll.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Brief suchen</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredLetters
                    .filter(letter => !linkedLetterIds.includes(letter.id))
                    .map((letter) => (
                      <div
                        key={letter.id}
                        className={`p-2 rounded cursor-pointer hover:bg-muted ${selectedLetterId === letter.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedLetterId(letter.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{letter.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getStatusLabel(letter.status)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {letter.subject && <>{letter.subject} · </>}
                          {format(new Date(letter.created_at), 'dd.MM.yyyy', { locale: de })}
                        </div>
                      </div>
                    ))}
                  {filteredLetters.filter(letter => !linkedLetterIds.includes(letter.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine verfügbaren Briefe gefunden
                    </p>
                  )}
                </div>
              </ScrollArea>
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
            <Button onClick={handleAdd} disabled={!selectedLetterId || isSubmitting}>
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
