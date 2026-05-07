import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STALE_TIME } from '@/lib/query-cache';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { notify } from "@/lib/notify";
export interface MapFlagType {
  id: string;
  tenant_id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  order_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  tag_filter?: string;
  description?: string | null;
}

export const useMapFlagTypes = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: flagTypes, isLoading } = useQuery({
    queryKey: ['map-flag-types', currentTenant?.id],
    staleTime: STALE_TIME.GEO,
    gcTime: STALE_TIME.GEO * 2,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('map_flag_types')
        .select('id, tenant_id, name, icon, color, is_active, order_index, created_by, created_at, updated_at, tag_filter, description')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return data as MapFlagType[];
    },
    enabled: !!currentTenant?.id,
  });

  const createFlagType = useMutation({
    mutationFn: async (newType: Omit<MapFlagType, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'tenant_id'>) => {
      if (!currentTenant?.id || !user?.id) throw new Error('Missing tenant or user');

      const { data, error } = await supabase
        .from('map_flag_types')
        .insert([{
          ...newType,
          tenant_id: currentTenant.id,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flag-types'] });
      notify.success('Flaggentyp erstellt');
    },
    onError: (error) => {
      notify.error('Fehler beim Erstellen', { 
        description: error.message
});
    },
  });

  const updateFlagType = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<MapFlagType, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'tenant_id'>> }) => {
      const { data, error } = await supabase
        .from('map_flag_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flag-types'] });
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
      notify.success('Flaggentyp aktualisiert');
    },
    onError: (error) => {
      notify.error('Fehler beim Aktualisieren', { 
        description: error.message
});
    },
  });

  const deleteFlagType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('map_flag_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flag-types'] });
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
      notify.success('Flaggentyp gelöscht');
    },
    onError: (error) => {
      notify.error('Fehler beim Löschen', { 
        description: error.message
});
    },
  });

  return {
    flagTypes: flagTypes || [],
    isLoading,
    createFlagType,
    updateFlagType,
    deleteFlagType,
  };
};
