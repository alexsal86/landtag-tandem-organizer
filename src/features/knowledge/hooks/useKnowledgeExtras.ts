import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { knowledgeKey, useKnowledgeScope } from './useKnowledgeQuestions';
import type { Json } from '@/integrations/supabase/types';
import type { KnowledgeTag } from '../types';

export function useKnowledgeTags() {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'tags'], enabled: Boolean(userId && tenantId), staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('knowledge_tags').select('id,name').eq('tenant_id', tenantId!).order('name').limit(500).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data as KnowledgeTag[];
    },
  });
}
export type KnowledgeExtraRequest =
  | { name: 'knowledge_qa_set_tags'; args: { p_question: string; p_expected_revision: number; p_names: string[] } }
  | { name: 'knowledge_qa_manage_tag'; args: { p_tag: string; p_name?: string; p_merge_into?: string } };
export function useKnowledgeExtraWrite() {
  const { userId, tenantId } = useKnowledgeScope();
  const client = useQueryClient();
  return useMutation({ mutationFn: async (request: KnowledgeExtraRequest) => {
    const { error } = await supabase.rpc(request.name, request.args);
    if (error) throw new Error(error.message);
  }, onSettled: () => client.invalidateQueries({ queryKey: knowledgeKey(userId, tenantId) }) });
}
