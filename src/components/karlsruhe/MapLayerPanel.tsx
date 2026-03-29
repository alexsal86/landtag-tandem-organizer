import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Layers } from 'lucide-react';
import { MapLayer } from '@/hooks/useMapLayers';

interface MapLayerPanelProps {
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

export const MapLayerPanel = ({ layers, visibleLayerIds, onToggleLayer }: MapLayerPanelProps) => {
  const grouped = useMemo(() => {
    const groups: Record<string, MapLayer[]> = {};
    for (const layer of layers) {
      const group = layer.group_name || 'Allgemein';
      if (!groups[group]) groups[group] = [];
      groups[group].push(layer);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [layers]);

  if (layers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Daten-Layer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Layer konfiguriert. Layer können in der Administration hinzugefügt werden.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Daten-Layer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {grouped.map(([groupName, groupLayers]) => (
          <Collapsible key={groupName} defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1 hover:bg-accent/50 rounded px-1 -mx-1">
              <ChevronRight className="h-3.5 w-3.5 transition-transform [&[data-state=open]]:rotate-90" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                ({groupLayers.filter(l => visibleLayerIds.has(l.id)).length}/{groupLayers.length})
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-5 pt-1">
              {groupLayers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-sm border border-border flex-shrink-0"
                      style={{
                        backgroundColor: layer.fill_color,
                        borderColor: layer.stroke_color,
                        opacity: visibleLayerIds.has(layer.id) ? 1 : 0.4,
                      }}
                    />
                    <Label
                      htmlFor={`layer-${layer.id}`}
                      className="text-sm cursor-pointer truncate"
                      title={layer.description || layer.name}
                    >
                      {layer.name}
                    </Label>
                  </div>
                  <Switch
                    id={`layer-${layer.id}`}
                    checked={visibleLayerIds.has(layer.id)}
                    onCheckedChange={() => onToggleLayer(layer.id)}
                    className="flex-shrink-0"
                  />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
};
