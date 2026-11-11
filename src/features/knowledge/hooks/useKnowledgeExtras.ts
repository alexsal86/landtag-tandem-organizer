import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { knowledgeKey, useKnowledgeScope } from './useKnowledgeQuestions';
import type { Json } from '@/integrations/supabase/types';
import type { KnowledgeTag, KnowledgeSource, KnowledgeSourceKind } from '../types';

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
  | { name: 'knowledge_qa_manage_tag'; args: { p_tag: string; p_name?: string; p_merge_into?: string } }
  | { name: 'knowledge_qa_add_source'; args: { p_question: string; p_expected_revision: number; p_kind: KnowledgeSourceKind; p_title?: string; p_url?: string; p_document?: string; p_case?: string; p_as_of?: string } }
  | { name: 'knowledge_qa_remove_source'; args: { p_source: string; p_expected_revision: number } };
export function useKnowledgeExtraWrite() {
  const { userId, tenantId } = useKnowledgeScope();
  const client = useQueryClient();
  return useMutation({ mutationFn: async (request: KnowledgeExtraRequest) => {
    const { error } = await supabase.rpc(request.name, request.args);
    if (error) throw new Error(error.message);
  }, onSettled: () => client.invalidateQueries({ queryKey: knowledgeKey(userId, tenantId) }) });
}

export function useKnowledgeSources(questionId: string, enabled = true) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({ queryKey: [...knowledgeKey(userId,tenantId), 'sources', questionId], enabled: Boolean(enabled && userId && tenantId && questionId),
    queryFn: async ({ signal }) => {
      const { data,error } = await supabase.from('knowledge_question_sources').select('id,question_id,kind,title,url,document_id,case_id,as_of,created_by,created_at').eq('tenant_id',tenantId!).eq('question_id',questionId).order('created_at').order('id').limit(10).abortSignal(signal);
      if(error) throw new Error(error.message);
      return data as KnowledgeSource[];
    },
  });
}
export function useKnowledgeReferencePicker(kind: KnowledgeSourceKind, search: string) {
  const { userId, tenantId } = useKnowledgeScope();
  const [term,setTerm] = useState(search);
  useEffect(() => { const timer=setTimeout(() => setTerm(search),300); return () => clearTimeout(timer); },[search]);
  return useQuery({ queryKey: [...knowledgeKey(userId,tenantId),'reference-picker',kind,term], enabled: Boolean(userId && tenantId && (kind==='document' || kind==='case')),
    queryFn: async ({ signal }) => {
      const literal=term.replace(/[\\%_]/g, character => `\\${character}`);
      const {data,error} = await supabase.from(kind==='document' ? 'documents' : 'case_files').select('id,title').eq('tenant_id',tenantId!).ilike('title',`%${literal}%`).order('title').order('id').limit(20).abortSignal(signal);
      if(error) throw new Error(error.message);
      return data;
    },
  });
}
