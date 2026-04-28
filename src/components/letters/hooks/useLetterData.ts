import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contact, LetterTemplate, LetterCollaborator, Letter } from '../types';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';

type SenderInformation = Database['public']['Tables']['sender_information']['Row'];
type InformationBlock = Database['public']['Tables']['information_blocks']['Row'];
type LetterAttachment = Database['public']['Tables']['letter_attachments']['Row'];
type LetterCommentRow = Database['public']['Tables']['letter_comments']['Row'];

interface LetterComment extends Pick<LetterCommentRow, 'id' | 'content' | 'text_position' | 'text_length' | 'resolved' | 'comment_type' | 'created_at' | 'user_id'> {
  profiles?: { display_name: string } | null;
}

interface UseLetterDataOptions {
  isOpen: boolean;
  tenantId?: string;
  letterId?: string;
}

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

async function fetchContacts(tenantId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, organization, gender, last_name, business_street, business_house_number, business_postal_code, business_city, business_country')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data || [];
}

async function fetchTemplates(tenantId: string): Promise<LetterTemplate[]> {
  const { data, error } = await supabase
    .from('letter_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

async function fetchSenderInfos(tenantId: string): Promise<SenderInformation[]> {
  const { data, error } = await supabase
    .from('sender_information')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

async function fetchInformationBlocks(tenantId: string): Promise<InformationBlock[]> {
  const { data, error } = await supabase
    .from('information_blocks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

async function fetchAttachments(letterId: string): Promise<LetterAttachment[]> {
  const { data, error } = await supabase
    .from('letter_attachments')
    .select('*')
    .eq('letter_id', letterId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

async function fetchComments(letterId: string): Promise<LetterComment[]> {
  const { data, error } = await supabase
    .from('letter_comments')
    .select('id, content, text_position, text_length, resolved, comment_type, created_at, user_id')
    .eq('letter_id', letterId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as LetterComment[];
}

async function fetchCollaborators(letterId: string): Promise<LetterCollaborator[]> {
  const { data, error } = await supabase
    .from('letter_collaborators')
    .select('id, user_id, created_at')
    .eq('letter_id', letterId);
  if (error) throw error;

  if (data && data.length > 0) {
    const userIds = data.map((c: Record<string, any>) => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    return data.map((item: Record<string, any>) => ({
      ...item,
      role: 'reviewer',
      profiles: profiles?.find((p: Record<string, any>) => p.user_id === item.user_id) || { display_name: 'Unbekannt' },
    }));
  }
  return [];
}

export function useLetterData({ isOpen, tenantId, letterId }: UseLetterDataOptions) {
  const queryClient = useQueryClient();
  const [userProfiles, setUserProfiles] = useState<Record<string, { display_name: string; avatar_url?: string }>>({});

  const enabled = isOpen && !!tenantId;
  const letterEnabled = enabled && !!letterId;

  const contactsQuery = useQuery({
    queryKey: ['letter-contacts', tenantId],
    queryFn: () => fetchContacts(tenantId!),
    enabled,
    staleTime: STALE_TIME,
  });

  const templatesQuery = useQuery({
    queryKey: ['letter-templates', tenantId],
    queryFn: () => fetchTemplates(tenantId!),
    enabled,
    staleTime: STALE_TIME,
  });

  const senderInfosQuery = useQuery({
    queryKey: ['letter-sender-infos', tenantId],
    queryFn: () => fetchSenderInfos(tenantId!),
    enabled,
    staleTime: STALE_TIME,
  });

  const informationBlocksQuery = useQuery({
    queryKey: ['letter-info-blocks', tenantId],
    queryFn: () => fetchInformationBlocks(tenantId!),
    enabled,
    staleTime: STALE_TIME,
  });

  const attachmentsQuery = useQuery({
    queryKey: ['letter-attachments', letterId],
    queryFn: () => fetchAttachments(letterId!),
    enabled: letterEnabled,
    staleTime: STALE_TIME,
  });

  const commentsQuery = useQuery({
    queryKey: ['letter-comments', letterId],
    queryFn: () => fetchComments(letterId!),
    enabled: letterEnabled,
    staleTime: STALE_TIME,
  });

  const collaboratorsQuery = useQuery({
    queryKey: ['letter-collaborators', letterId],
    queryFn: () => fetchCollaborators(letterId!),
    enabled: letterEnabled,
    staleTime: STALE_TIME,
  });

  const refetchAttachments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['letter-attachments', letterId] });
  }, [queryClient, letterId]);

  const refetchComments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['letter-comments', letterId] });
  }, [queryClient, letterId]);

  const refetchCollaborators = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['letter-collaborators', letterId] });
  }, [queryClient, letterId]);

  const fetchWorkflowUserProfiles = useCallback(async (letter?: Letter) => {
    if (!letter) return;
    const userIds = [
      letter.submitted_for_review_by,
      letter.submitted_to_user,
      letter.approved_by,
      letter.sent_by,
      letter.created_by,
    ].filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return;

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      if (error) { debugConsole.error('Error fetching user profiles:', error); return; }
      const profilesMap = profiles?.reduce((acc: Record<string, any>, profile: Record<string, any>) => {
        acc[profile.user_id] = { display_name: profile.display_name || 'Unbekannter Benutzer', avatar_url: profile.avatar_url ?? undefined };
        return acc;
      }, {} as Record<string, { display_name: string; avatar_url?: string }>) || {};
      setUserProfiles(profilesMap);
    } catch (error) {
      debugConsole.error('Error fetching workflow user profiles:', error);
    }
  }, []);

  return {
    contacts: contactsQuery.data ?? [],
    templates: templatesQuery.data ?? [],
    senderInfos: senderInfosQuery.data ?? [],
    informationBlocks: informationBlocksQuery.data ?? [],
    attachments: attachmentsQuery.data ?? [],
    collaborators: collaboratorsQuery.data ?? [],
    comments: commentsQuery.data ?? [],
    userProfiles,
    fetchAttachments: refetchAttachments,
    fetchComments: refetchComments,
    fetchCollaborators: refetchCollaborators,
    fetchWorkflowUserProfiles,
  };
}
