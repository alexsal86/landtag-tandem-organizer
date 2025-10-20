import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ContactSelector } from "../ContactSelector";

interface FundingFormData {
  title: string;
  description?: string;
  total_amount?: number;
  start_date?: string;
  end_date?: string;
  status: string;
  funding_source?: string;
  category?: string;
}

interface Participant {
  contact_id: string;
  allocated_amount?: number;
  role?: string;
}

interface FundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContactId?: string;
}

export function FundingDialog({ open, onOpenChange, initialContactId }: FundingDialogProps) {
  const { register, handleSubmit, reset, watch, setValue } = useForm<FundingFormData>({
    defaultValues: {
      status: 'planned',
    }
  });
  const [participants, setParticipants] = useState<Participant[]>(
    initialContactId ? [{ contact_id: initialContactId }] : []
  );
  const [loading, setLoading] = useState(false);
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const onSubmit = async (data: FundingFormData) => {
    if (!currentTenant || !user) return;
    if (participants.length === 0) {
      toast.error("Bitte mindestens einen Teilnehmer hinzufügen");
      return;
    }

    setLoading(true);
    try {
      // Create funding
      const { data: funding, error: fundingError } = await supabase
        .from('fundings')
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          title: data.title,
          description: data.description,
          total_amount: data.total_amount,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
          funding_source: data.funding_source,
          category: data.category,
        })
        .select()
        .single();

      if (fundingError) throw fundingError;

      // Add participants
      const participantInserts = participants.map(p => ({
        funding_id: funding.id,
        contact_id: p.contact_id,
        allocated_amount: p.allocated_amount,
        role: p.role,
      }));

      const { error: participantsError } = await supabase
        .from('funding_participants')
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      toast.success("Förderung erfolgreich erstellt");
      queryClient.invalidateQueries({ queryKey: ['contact-fundings'] });
      reset();
      setParticipants(initialContactId ? [{ contact_id: initialContactId }] : []);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating funding:', error);
      toast.error("Fehler beim Erstellen der Förderung");
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = (contact: { id: string }) => {
    if (!participants.find(p => p.contact_id === contact.id)) {
      setParticipants([...participants, { contact_id: contact.id }]);
    }
  };

  const removeParticipant = (contactId: string) => {
    setParticipants(participants.filter(p => p.contact_id !== contactId));
  };

  const updateParticipant = (contactId: string, field: keyof Participant, value: any) => {
    setParticipants(participants.map(p => 
      p.contact_id === contactId ? { ...p, [field]: value } : p
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Förderung erstellen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Titel *</Label>
            <Input id="title" {...register('title', { required: true })} />
          </div>

          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea id="description" {...register('description')} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total_amount">Gesamtbetrag (€)</Label>
              <Input 
                id="total_amount" 
                type="number" 
                step="0.01"
                {...register('total_amount', { valueAsNumber: true })} 
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={watch('status')} 
                onValueChange={(value) => setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Geplant</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="cancelled">Abgebrochen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Startdatum</Label>
              <Input id="start_date" type="date" {...register('start_date')} />
            </div>
            <div>
              <Label htmlFor="end_date">Enddatum</Label>
              <Input id="end_date" type="date" {...register('end_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="funding_source">Förderquelle</Label>
              <Input 
                id="funding_source" 
                placeholder="z.B. EU-Förderung"
                {...register('funding_source')} 
              />
            </div>
            <div>
              <Label htmlFor="category">Kategorie</Label>
              <Input 
                id="category" 
                placeholder="z.B. Infrastruktur"
                {...register('category')} 
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Teilnehmer</Label>
            <ContactSelector
              onSelect={addParticipant}
              placeholder="Stakeholder/Kontakt hinzufügen..."
              clearAfterSelect
            />
            
            {participants.length > 0 && (
              <div className="space-y-2 mt-2">
                {participants.map((participant) => (
                  <div key={participant.contact_id} className="flex gap-2 items-start p-2 border rounded">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Anteil (€)"
                        type="number"
                        step="0.01"
                        value={participant.allocated_amount || ''}
                        onChange={(e) => updateParticipant(
                          participant.contact_id, 
                          'allocated_amount', 
                          parseFloat(e.target.value) || undefined
                        )}
                      />
                      <Input
                        placeholder="Rolle"
                        value={participant.role || ''}
                        onChange={(e) => updateParticipant(
                          participant.contact_id, 
                          'role', 
                          e.target.value
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParticipant(participant.contact_id)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Speichern..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
