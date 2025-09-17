import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus } from 'lucide-react';

interface PartyAssociation {
  id: string;
  name: string;
  party_name: string;
  administrative_boundaries: string[] | null;
}

interface ElectionDistrict {
  id: string;
  district_name: string;
  district_number: number;
}

export const PartyDistrictMappingManager = () => {
  const [partyAssociations, setPartyAssociations] = useState<PartyAssociation[]>([]);
  const [electionDistricts, setElectionDistricts] = useState<ElectionDistrict[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [partyResponse, districtResponse] = await Promise.all([
      supabase.from('party_associations').select('id, name, party_name, administrative_boundaries'),
      supabase.from('election_districts').select('id, district_name, district_number').order('district_number')
    ]);

    if (partyResponse.data) {
      setPartyAssociations(partyResponse.data.map(party => ({
        ...party,
        administrative_boundaries: Array.isArray(party.administrative_boundaries) 
          ? party.administrative_boundaries as string[] 
          : []
      })));
    }
    if (districtResponse.data) setElectionDistricts(districtResponse.data);
  };

  const addDistrictMapping = async () => {
    if (!selectedPartyId || !selectedDistrictId) {
      toast.error('Bitte Kreisverband und Wahlkreis auswählen');
      return;
    }

    setLoading(true);
    const party = partyAssociations.find(p => p.id === selectedPartyId);
    if (!party) return;

    const updatedBoundaries = [...(party.administrative_boundaries || []), selectedDistrictId];
    
    const { error } = await supabase
      .from('party_associations')
      .update({ administrative_boundaries: updatedBoundaries })
      .eq('id', selectedPartyId);

    if (error) {
      toast.error('Fehler beim Zuordnen des Wahlkreises');
      console.error(error);
    } else {
      toast.success('Wahlkreis erfolgreich zugeordnet');
      await fetchData();
      setSelectedDistrictId('');
    }
    setLoading(false);
  };

  const removeDistrictMapping = async (partyId: string, districtId: string) => {
    setLoading(true);
    const party = partyAssociations.find(p => p.id === partyId);
    if (!party) return;

    const updatedBoundaries = (party.administrative_boundaries || []).filter(id => id !== districtId);
    
    const { error } = await supabase
      .from('party_associations')
      .update({ administrative_boundaries: updatedBoundaries })
      .eq('id', partyId);

    if (error) {
      toast.error('Fehler beim Entfernen der Zuordnung');
      console.error(error);
    } else {
      toast.success('Zuordnung erfolgreich entfernt');
      await fetchData();
    }
    setLoading(false);
  };

  const getDistrictName = (districtId: string) => {
    const district = electionDistricts.find(d => d.id === districtId);
    return district ? `${district.district_name} (${district.district_number})` : districtId;
  };

  const getAvailableDistricts = () => {
    const assignedDistricts = partyAssociations
      .flatMap(p => p.administrative_boundaries || []);
    return electionDistricts.filter(d => !assignedDistricts.includes(d.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kreisverband-Wahlkreis Zuordnungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new mapping */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium">Neue Zuordnung hinzufügen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Kreisverband auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {partyAssociations.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDistrictId} onValueChange={setSelectedDistrictId}>
              <SelectTrigger>
                <SelectValue placeholder="Wahlkreis auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {getAvailableDistricts().map((district) => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.district_name} ({district.district_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={addDistrictMapping} 
              disabled={loading || !selectedPartyId || !selectedDistrictId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Hinzufügen
            </Button>
          </div>
        </div>

        {/* Current mappings */}
        <div className="space-y-4">
          <h3 className="font-medium">Aktuelle Zuordnungen</h3>
          {partyAssociations.map((party) => (
            <div key={party.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium">{party.name}</h4>
                  <p className="text-sm text-muted-foreground">{party.party_name}</p>
                </div>
              </div>
              
              {party.administrative_boundaries && party.administrative_boundaries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {party.administrative_boundaries.map((districtId) => (
                    <Badge key={districtId} variant="secondary" className="flex items-center gap-2">
                      {getDistrictName(districtId)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => removeDistrictMapping(party.id, districtId)}
                        disabled={loading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Wahlkreise zugeordnet</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};