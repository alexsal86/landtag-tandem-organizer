import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Contact, LetterTemplate, LetterCollaborator, Letter } from '../types';
import { debugConsole } from '@/utils/debugConsole';

interface UseLetterDataOptions {
  isOpen: boolean;
  tenantId?: string;
  letterId?: string;
}

export function useLetterData({ isOpen, tenantId, letterId }: UseLetterDataOptions) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [informationBlocks, setInformationBlocks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<LetterCollaborator[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { display_name: string; avatar_url?: string }>>({});

  const fetchContacts = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, organization, gender, last_name, private_street, private_house_number, private_postal_code, private_city, private_country, business_street, business_house_number, business_postal_code, business_city, business_country')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      debugConsole.error('Error fetching contacts:', error);
    }
  }, [tenantId]);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      debugConsole.error('Error fetching templates:', error);
    }
  }, [tenantId]);

  const fetchSenderInfos = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error) {
      debugConsole.error('Error fetching sender infos:', error);
    }
  }, [tenantId]);

  const fetchInformationBlocks = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('information_blocks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      setInformationBlocks(data || []);
    } catch (error) {
      debugConsole.error('Error fetching information blocks:', error);
    }
  }, [tenantId]);

  const fetchAttachments = useCallback(async () => {
    if (!letterId) return;
    try {
      const { data, error } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letterId)
        .order('created_at');
      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      debugConsole.error('Error fetching attachments:', error);
    }
  }, [letterId]);

  const fetchComments = useCallback(async () => {
    if (!letterId) return;
    try {
      const { data, error } = await supabase
        .from('letter_comments')
        .select(`id, content, text_position, text_length, resolved, comment_type, created_at, user_id, profiles:user_id (display_name)`)
        .eq('letter_id', letterId)
        .order('created_at');
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      debugConsole.error('Error fetching comments:', error);
    }
  }, [letterId]);

  const fetchCollaborators = useCallback(async () => {
    if (!letterId) return;
    try {
      const { data, error } = await supabase
        .from('letter_collaborators')
        .select('id, user_id, created_at')
        .eq('letter_id', letterId);
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        setCollaborators(data.map(item => ({
          ...item,
          role: 'reviewer',
          profiles: profiles?.find(p => p.user_id === item.user_id) || { display_name: 'Unbekannt' },
        })));
      } else {
        setCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  }, [letterId]);

  const fetchWorkflowUserProfiles = useCallback(async (letter?: Letter) => {
    if (!letter) return;
    const userIds = [
      letter.submitted_for_review_by,
      letter.submitted_to_user,
      letter.approved_by,
      letter.sent_by,
      letter.created_by,
    ].filter(Boolean);
    if (userIds.length === 0) return;

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      if (error) { console.error('Error fetching user profiles:', error); return; }
      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.user_id] = { display_name: profile.display_name || 'Unbekannter Benutzer', avatar_url: profile.avatar_url };
        return acc;
      }, {} as Record<string, { display_name: string; avatar_url?: string }>) || {};
      setUserProfiles(profilesMap);
    } catch (error) {
      console.error('Error fetching workflow user profiles:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isOpen && tenantId) {
      fetchContacts();
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
      if (letterId) {
        fetchComments();
        fetchCollaborators();
        fetchAttachments();
      }
    }
  }, [isOpen, tenantId, letterId, fetchContacts, fetchTemplates, fetchSenderInfos, fetchInformationBlocks, fetchComments, fetchCollaborators, fetchAttachments]);

  return {
    contacts,
    templates,
    senderInfos,
    informationBlocks,
    attachments,
    collaborators,
    comments,
    userProfiles,
    fetchAttachments,
    fetchComments,
    fetchCollaborators,
    fetchWorkflowUserProfiles,
  };
}
