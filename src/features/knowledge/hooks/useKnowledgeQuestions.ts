import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useTenantProfiles } from '@/hooks/useTenantProfiles';
import type { Database } from '@/integrations/supabase/types';
import type { KnowledgeView, KnowledgeSummary, KnowledgeCard, KnowledgeQuestion, KnowledgePage } from '../types';

export const knowledgeKey = (userId?: string, tenantId?: string) => ['knowledge-qa', userId, tenantId] as const;
export function useKnowledgeScope() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  return { userId: user?.id, tenantId: currentTenant?.id };
}
export function useKnowledgePeople() {
  const profiles = useTenantProfiles();
  const { userId, tenantId } = useKnowledgeScope();
  const members = useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'active-members'], enabled: Boolean(userId && tenantId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('user_tenant_memberships').select('user_id')
        .eq('tenant_id', tenantId!).eq('is_active', true).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  return { ...profiles, error: profiles.error || members.error,
    assignable: profiles.data.filter(profile => members.data?.some(member => member.user_id === profile.user_id)) };
}
export function useKnowledgeQuestions(query: string, view: KnowledgeView, questionId: string | null) {
  const { userId, tenantId } = useKnowledgeScope();
  const client = useQueryClient();
  const detail = useKnowledgeQuestion(questionId);
  useEffect(() => {
    if (!tenantId || !userId) return;
    const channel = supabase.channel(`knowledge-${userId}-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_questions', filter: `tenant_id=eq.${tenantId}` },
        () => { void client.invalidateQueries({ queryKey: knowledgeKey(userId, tenantId) }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [client, tenantId, userId]);
  const [debounced, setDebounced] = useState(query);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(timer); }, [query]);
  const search = useInfiniteQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'search', debounced, view, questionId],
    enabled: Boolean(userId && tenantId && !questionId),
    initialPageParam: null as import('@/integrations/supabase/types').Json | null,
    getNextPageParam: (last: KnowledgePage) => last.next_cursor ?? undefined,
    staleTime: 60_000, refetchOnWindowFocus: true, retry: 1,
    queryFn: async ({ signal, pageParam }) => {
      const { data, error } = await supabase.rpc('knowledge_qa_list', {
        p_tenant: tenantId!, p_query: debounced, p_view: view, p_limit: 20, p_cursor: pageParam ?? undefined,
      }).abortSignal(signal);
      if (error) throw new Error(error.message);
      return { items: (data?.[0]?.items ?? []) as unknown as KnowledgeSummary[], total_count: data?.[0]?.total_count ?? 0, next_cursor: data?.[0]?.next_cursor ?? null };
    },
  });
  return {
    ...search,
    ...(questionId ? { isPending: detail.isPending, isError: detail.isError, refetch: detail.refetch } : {}),
    data: questionId ? (detail.data ? [{ ...detail.data, answer_excerpt: detail.data.answer_text.slice(0, 200) }] : []) : search.data?.pages.flatMap(page => page.items),
    totalCount: questionId ? (detail.data ? 1 : 0) : search.data?.pages[0]?.total_count ?? 0,
    debouncing: !questionId && debounced !== query,
  };
}
type WriteName = 'knowledge_qa_create_question' | 'knowledge_qa_save_answer' | 'knowledge_qa_review' | 'knowledge_qa_set_assignee' | 'knowledge_qa_finish_attachment';
type WriteRequest = { [Name in WriteName]: { name: Name; args: Database['public']['Functions'][Name]['Args'] } }[WriteName];
export function useKnowledgeWrite() {
  const client = useQueryClient();
  const { userId, tenantId } = useKnowledgeScope();
  return useMutation({
    mutationFn: async (request: WriteRequest) => {
      if (!userId || !tenantId) throw new Error('Bitte anmelden und ein Büro wählen.');
      const { data, error } = await supabase.rpc(request.name, request.args).single<KnowledgeQuestion>();
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => client.invalidateQueries({ queryKey: knowledgeKey(userId, tenantId) }),
  });
}
export function useKnowledgeAttachments(questionId: string) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'attachments', questionId], enabled: Boolean(userId && tenantId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('knowledge_question_attachments').select('id,tenant_id,question_id,storage_path,file_name,file_type,file_size,uploaded_by,created_at,state')
        .eq('tenant_id', tenantId!).eq('question_id', questionId).eq('state', 'ready').order('created_at').abortSignal(signal);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
export function useKnowledgeHistory(questionId: string, enabled: boolean) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'history', questionId], enabled: Boolean(enabled && userId && tenantId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('knowledge_question_events').select('id,tenant_id,question_id,revision,event_type,actor_id,created_at,snapshot')
        .eq('tenant_id', tenantId!).eq('question_id', questionId).order('revision', { ascending: false }).limit(100).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useKnowledgeQuestion(id: string | null) {
  const { userId, tenantId } = useKnowledgeScope();
  return useQuery({
    queryKey: [...knowledgeKey(userId, tenantId), 'detail', id],
    enabled: Boolean(id && userId && tenantId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('knowledge_question_cards').select('*')
        .eq('tenant_id', tenantId!).eq('id', id!).abortSignal(signal).maybeSingle();
      if (error) throw new Error(error.message);
      return data as KnowledgeCard | null;
    },
  });
}
