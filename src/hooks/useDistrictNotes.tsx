import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface DistrictNote {
  id: string;
  tenant_id: string;
  district_id: string;
  content: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useDistrictNotes = (districtId?: string) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: note, isLoading } = useQuery({
    queryKey: ['district-notes', districtId, currentTenant?.id],
    queryFn: async () => {
      if (!districtId || !currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('district_notes')
        .select('*')
        .eq('district_id', districtId)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as DistrictNote | null;
    },
    enabled: !!districtId && !!currentTenant?.id,
  });

  const saveNote = useMutation({
    mutationFn: async (content: string) => {
      if (!districtId || !currentTenant?.id || !user?.id) {
        throw new Error('Missing required data');
      }

      const { data, error } = await supabase
        .from('district_notes')
        .upsert({
          tenant_id: currentTenant.id,
          district_id: districtId,
          content,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,district_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district-notes', districtId] });
      toast({ title: 'Notiz gespeichert' });
    },
    onError: (error) => {
      toast({ 
        title: 'Fehler beim Speichern', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    note,
    isLoading,
    saveNote,
  };
};

// Get all notes for all districts
export const useAllDistrictNotes = () => {
  const { currentTenant } = useTenant();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['all-district-notes', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return {};
      
      const { data, error } = await supabase
        .from('district_notes')
        .select('district_id, content')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const notesByDistrict: Record<string, string> = {};
      data?.forEach(note => {
        if (note.content) {
          notesByDistrict[note.district_id] = note.content;
        }
      });
      return notesByDistrict;
    },
    enabled: !!currentTenant?.id,
  });

  return { notesByDistrict: notes || {}, isLoading };
};
