import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAnnotationMembers(tenantId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['annotation-mention-users', tenantId], enabled: enabled && !!tenantId, staleTime: 60_000,
    queryFn: async () => {
      const members = await supabase.rpc('document_annotation_mention_members', { _tenant: tenantId! });
      if (members.error?.code === 'PGRST202') {
        const profiles = await supabase.from('profiles').select('user_id, display_name').eq('tenant_id', tenantId!).order('display_name');
        if (profiles.error) throw profiles.error;
        return profiles.data ?? [];
      }
      if (members.error) throw members.error;
      return (members.data ?? []).sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '', 'de'));
    },
  });
}
