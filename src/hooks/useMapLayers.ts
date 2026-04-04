import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface MapLayer {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  group_name: string;
  source_type: 'geojson_file' | 'geojson_url' | 'database';
  source_path: string | null;
  source_table: string | null;
  stroke_color: string;
  fill_color: string;
  fill_opacity: number;
  stroke_width: number;
  stroke_dash_array: string | null;
  icon: string | null;
  visible_by_default: boolean;
  sort_order: number;
  is_active: boolean;
  label_property: string | null;
  created_at: string;
  updated_at: string;
}

export type MapLayerInsert = Omit<MapLayer, 'id' | 'created_at' | 'updated_at'>;
export type MapLayerUpdate = Partial<MapLayerInsert> & { id: string };

export function useMapLayers() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const queryKey = ['map-layers', currentTenant?.id];

  const { data: layers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('map_layers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('group_name')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as MapLayer[];
    },
    enabled: !!currentTenant?.id,
  });

  const activeLayers = layers.filter(l => l.is_active);

  const createLayer = useMutation({
    mutationFn: async (layer: MapLayerInsert) => {
      const { error } = await supabase.from('map_layers').insert(layer);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Layer erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen des Layers'),
  });

  const updateLayer = useMutation({
    mutationFn: async ({ id, ...updates }: MapLayerUpdate) => {
      const { error } = await supabase.from('map_layers').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Layer aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteLayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('map_layers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Layer gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  return { layers, activeLayers, isLoading, createLayer, updateLayer, deleteLayer };
}
