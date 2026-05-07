import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STALE_TIME } from '@/lib/query-cache';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { notify } from "@/lib/notify";
export interface MapFlag {
  id: string;
  tenant_id: string;
  flag_type_id: string;
  title: string;
  description: string | null;
  coordinates: { lat: number; lng: number };
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  tags: string[];
}

export const useMapFlags = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['map-flags', currentTenant?.id],
    staleTime: STALE_TIME.GEO,
    gcTime: STALE_TIME.GEO * 2,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('map_flags')
        .select('id, tenant_id, flag_type_id, title, description, coordinates, created_by, created_at, updated_at, metadata, tags')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MapFlag[];
    },
    enabled: !!currentTenant?.id,
  });

  const createFlag = useMutation({
    mutationFn: async (newFlag: Omit<MapFlag, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'tenant_id'>) => {
      if (!currentTenant?.id || !user?.id) throw new Error('Missing tenant or user');

      const { data, error } = await supabase
        .from('map_flags')
        .insert([{
          ...newFlag,
          tenant_id: currentTenant.id,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
      notify.success('Flagge gesetzt');
    },
    onError: (error) => {
      notify.error('Fehler beim Setzen der Flagge', { 
        description: error.message
});
    },
  });

  const updateFlag = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MapFlag> }) => {
      const { data, error } = await supabase
        .from('map_flags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
      notify.success('Flagge aktualisiert');
    },
    onError: (error) => {
      notify.error('Fehler beim Aktualisieren', { 
        description: error.message
});
    },
  });

  const deleteFlag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('map_flags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
      notify.success('Flagge gelöscht');
    },
    onError: (error) => {
      notify.error('Fehler beim Löschen', { 
        description: error.message
});
    },
  });

  return {
    flags: flags || [],
    isLoading,
    createFlag,
    updateFlag,
    deleteFlag,
  };
};
