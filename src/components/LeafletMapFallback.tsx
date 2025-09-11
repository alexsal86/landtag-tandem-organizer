import React from 'react';
import { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LeafletMapFallbackProps {
  districts: ElectionDistrict[];
  onDistrictClick: (district: ElectionDistrict) => void;
  selectedDistrict?: ElectionDistrict;
}

const getPartyColor = (party?: string): string => {
  switch (party?.toLowerCase()) {
    case 'fdp': return '#FFD700';
    case 'grüne': return '#4CAF50'; 
    case 'cdu': return '#0066CC';
    case 'spd': return '#E3000F';
    case 'afd': return '#00A0E6';
    case 'die linke': return '#BE3075';
    default: return '#9E9E9E';
  }
};

const LeafletMapFallback: React.FC<LeafletMapFallbackProps> = ({ 
  districts, 
  onDistrictClick, 
  selectedDistrict 
}) => {
  return (
    <div className="relative w-full h-[400px] bg-card rounded-lg overflow-hidden border border-border">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Wahlkreise Karlsruhe (Listenansicht)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
          {districts.map((district) => {
            const partyColor = getPartyColor(district.representative_party);
            const isSelected = selectedDistrict?.id === district.id;
            
            return (
              <div
                key={district.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-primary bg-accent' : 'hover:bg-accent/50'
                }`}
                onClick={() => onDistrictClick(district)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Badge 
                    variant="secondary" 
                    style={{ backgroundColor: partyColor, color: '#fff' }}
                    className="text-xs"
                  >
                    {district.district_number}
                  </Badge>
                  <h3 className="font-semibold text-sm">{district.district_name}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{district.representative_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {district.representative_party}
                    </Badge>
                  </div>
                  {district.population && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{district.population.toLocaleString()} Einwohner</span>
                    </div>
                  )}
                  {district.area_km2 && (
                    <div className="flex items-center gap-1">
                      <Square className="h-3 w-3" />
                      <span>ca. {district.area_km2} km²</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeafletMapFallback;