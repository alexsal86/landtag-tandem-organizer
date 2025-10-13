import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

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
}

export const useMapFlagTypes = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: flagTypes, isLoading } = useQuery({
    queryKey: ['map-flag-types', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('map_flag_types')
        .select('*')
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
        .insert({
          ...newType,
          tenant_id: currentTenant.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-flag-types'] });
      toast({ title: 'Flaggentyp erstellt' });
    },
    onError: (error) => {
      toast({ 
        title: 'Fehler beim Erstellen', 
        description: error.message,
        variant: 'destructive' 
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
      toast({ title: 'Flaggentyp aktualisiert' });
    },
    onError: (error) => {
      toast({ 
        title: 'Fehler beim Aktualisieren', 
        description: error.message,
        variant: 'destructive' 
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
      toast({ title: 'Flaggentyp gelöscht' });
    },
    onError: (error) => {
      toast({ 
        title: 'Fehler beim Löschen', 
        description: error.message,
        variant: 'destructive' 
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
