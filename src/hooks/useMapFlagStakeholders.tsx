import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface StakeholderContact {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  category: string | null;
  avatar_url: string | null;
  business_description: string | null;
  website: string | null;
}

export const useMapFlagStakeholders = (flagTags?: string[]) => {
  const { currentTenant } = useTenant();

  const { data: stakeholders, isLoading } = useQuery({
    queryKey: ['map-flag-stakeholders', currentTenant?.id, flagTags],
    queryFn: async () => {
      if (!currentTenant?.id || !flagTags || flagTags.length === 0) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, organization, email, phone, tags, category, avatar_url, business_description, website')
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'organization')
        .not('tags', 'is', null);

      if (error) throw error;

      // Filter stakeholders that have at least one matching tag
      const filtered = (data || []).filter(contact => {
        if (!contact.tags || contact.tags.length === 0) return false;
        return contact.tags.some(tag => flagTags.includes(tag));
      });

      return filtered as StakeholderContact[];
    },
    enabled: !!currentTenant?.id && !!flagTags && flagTags.length > 0,
  });

  return {
    stakeholders: stakeholders || [],
    isLoading,
  };
};
