import React, { useState } from 'react';
import { useElectionDistricts } from '@/hooks/useElectionDistricts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DistrictSupportAssignment {
  id: string;
  district_id: string;
  supporting_representative_id: string;
  priority: number;
  notes?: string;
  election_districts: {
    district_name: string;
    district_number: number;
  };
  election_representatives: {
    name: string;
    party: string;
  };
}

interface Representative {
  id: string;
  name: string;
  party: string;
  mandate_type: string;
}

export const DistrictSupportManager = () => {
  const { districts } = useElectionDistricts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedRepresentative, setSelectedRepresentative] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Fetch existing support assignments
  const { data: supportAssignments, isLoading } = useQuery({
    queryKey: ['district_support_assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('district_support_assignments')
        .select(`
          *,
          election_districts(district_name, district_number),
          election_representatives(name, party)
        `)
        .eq('is_active', true)
        .order('election_districts(district_number)');
      
      if (error) throw error;
      return data as DistrictSupportAssignment[];
    }
  });

  // Fetch representatives (Green party only for support assignments)
  const { data: representatives } = useQuery({
    queryKey: ['green_representatives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('election_representatives')
        .select('id, name, party, mandate_type')
        .ilike('party', '%grün%');
      
      if (error) throw error;
      return data as Representative[];
    }
  });

  // Add support assignment mutation
  const addSupportMutation = useMutation({
    mutationFn: async ({ districtId, representativeId, notes }: { 
      districtId: string; 
      representativeId: string; 
      notes: string; 
    }) => {
      const { data, error } = await supabase
        .from('district_support_assignments')
        .insert({
          district_id: districtId,
          supporting_representative_id: representativeId,
          notes: notes || null,
          priority: 1
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district_support_assignments'] });
      toast({
        title: "Betreuungswahlkreis hinzugefügt",
        description: "Die Zuordnung wurde erfolgreich erstellt."
      });
      setIsAddDialogOpen(false);
      setSelectedDistrict('');
      setSelectedRepresentative('');
      setNotes('');
    },
    onError: (error) => {
      console.error('Error adding support assignment:', error);
      toast({
        title: "Fehler",
        description: "Die Zuordnung konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  });

  // Delete support assignment mutation
  const deleteSupportMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('district_support_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district_support_assignments'] });
      toast({
        title: "Betreuungswahlkreis entfernt",
        description: "Die Zuordnung wurde erfolgreich entfernt."
      });
    },
    onError: (error) => {
      console.error('Error removing support assignment:', error);
      toast({
        title: "Fehler",
        description: "Die Zuordnung konnte nicht entfernt werden.",
        variant: "destructive"
      });
    }
  });

  const handleAddSupport = () => {
    if (!selectedDistrict || !selectedRepresentative) {
      toast({
        title: "Unvollständige Eingabe",
        description: "Bitte wählen Sie sowohl einen Wahlkreis als auch einen Abgeordneten aus.",
        variant: "destructive"
      });
      return;
    }

    addSupportMutation.mutate({
      districtId: selectedDistrict,
      representativeId: selectedRepresentative,
      notes
    });
  };

  if (isLoading) {
    return <div>Lade Betreuungswahlkreise...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Betreuungswahlkreise verwalten</CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Betreuung hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Betreuungswahlkreis hinzufügen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Wahlkreis</label>
                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wahlkreis auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.district_number} - {district.district_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Betreuender Abgeordneter</label>
                <Select value={selectedRepresentative} onValueChange={setSelectedRepresentative}>
                  <SelectTrigger>
                    <SelectValue placeholder="Abgeordneten auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {representatives?.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.name} ({rep.party})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Notizen (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Zusätzliche Informationen zur Betreuung..."
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddSupport} disabled={addSupportMutation.isPending}>
                  {addSupportMutation.isPending ? 'Speichern...' : 'Speichern'}
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {supportAssignments && supportAssignments.length > 0 ? (
            supportAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">
                    {assignment.election_districts.district_number} - {assignment.election_districts.district_name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Betreut von: {assignment.election_representatives.name} ({assignment.election_representatives.party})
                  </p>
                  {assignment.notes && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {assignment.notes}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteSupportMutation.mutate(assignment.id)}
                  disabled={deleteSupportMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Noch keine Betreuungswahlkreise konfiguriert.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};