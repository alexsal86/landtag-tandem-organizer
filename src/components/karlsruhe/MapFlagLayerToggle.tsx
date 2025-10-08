import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useMapFlagTypes } from '@/hooks/useMapFlagTypes';
import { useMapFlags } from '@/hooks/useMapFlags';

interface MapFlagLayerToggleProps {
  visibleTypes: Set<string>;
  onToggleType: (typeId: string) => void;
}

export const MapFlagLayerToggle = ({ visibleTypes, onToggleType }: MapFlagLayerToggleProps) => {
  const { flagTypes } = useMapFlagTypes();
  const { flags } = useMapFlags();

  const getFlagCount = (typeId: string) => {
    return flags.filter(f => f.flag_type_id === typeId).length;
  };

  if (flagTypes.length === 0) {
    return (
      <Card className="p-3">
        <p className="text-sm text-muted-foreground">Keine Flaggentypen vorhanden</p>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Sichtbare Flaggen</Label>
        {flagTypes.map((type) => {
          const count = getFlagCount(type.id);
          return (
            <div key={type.id} className="flex items-center gap-2">
              <Checkbox
                id={`flag-type-${type.id}`}
                checked={visibleTypes.has(type.id)}
                onCheckedChange={() => onToggleType(type.id)}
              />
              <label
                htmlFor={`flag-type-${type.id}`}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <span className="text-lg">{type.icon}</span>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-sm flex-1">{type.name}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
