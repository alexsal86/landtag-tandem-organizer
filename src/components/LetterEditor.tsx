import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText, Send, Download, Calendar, User, MapPin, MessageSquare, CheckCircle, Clock, ArrowRight, UserPlus, RotateCcw, Layout, Building, Info, Settings, Wifi, WifiOff, Activity, Ruler, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import EnhancedLexicalEditor from './EnhancedLexicalEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

import ReviewAssignmentDialog from './ReviewAssignmentDialog';
import LetterAttachmentManager from './letters/LetterAttachmentManager';
import { DIN5008LetterLayout } from './letters/DIN5008LetterLayout';
import { LetterEditorCanvas } from './letters/LetterEditorCanvas';
import { buildVariableMap, substituteVariables, substituteBlockLines, isLineMode } from '@/lib/letterVariables';
import type { HeaderElement } from '@/components/canvas-engine/types';
import type { BlockLine } from '@/components/letters/BlockLineEditor';

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  content_nodes?: any;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  template_id?: string;
  subject?: string;
  reference_number?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  letter_date?: string;
  status: 'draft' | 'review' | 'approved' | 'sent' | 'pending_approval' | 'revision_requested';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  show_pagination?: boolean;
  // Workflow tracking fields
  submitted_for_review_at?: string;
  submitted_for_review_by?: string;
  submitted_to_user?: string;
  approved_at?: string;
  approved_by?: string;
  sent_at?: string;
  sent_by?: string;
  workflow_locked?: boolean;
}

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean;
  is_active: boolean;
  default_sender_id?: string;
  default_info_blocks?: string[];
}

interface Contact {
  id: string;
  name: string;
  organization?: string;
  gender?: string;
  last_name?: string;
  private_street?: string;
  private_house_number?: string;
  private_postal_code?: string;
  private_city?: string;
  private_country?: string;
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
}

interface LetterCollaborator {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    display_name: string;
  };
}

interface LetterEditorProps {
  letter?: Letter;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const LetterEditor: React.FC<LetterEditorProps> = ({
  letter,
  isOpen,
  onClose,
  onSave
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [editedLetter, setEditedLetter] = useState<Partial<Letter>>({
    title: '',
    content: '',
    content_html: '',
    content_nodes: null,
    recipient_name: '',
    recipient_address: '',
    status: 'draft',
    ...letter
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<LetterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isProofreadingMode, setIsProofreadingMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });
  const [selectedTextForComment, setSelectedTextForComment] = useState('');
  const [collaborators, setCollaborators] = useState<LetterCollaborator[]>([]);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showDINPreview, setShowDINPreview] = useState(false);
  const [showBriefDetails, setShowBriefDetails] = useState(true);
  
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [informationBlocks, setInformationBlocks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<{[key: string]: {display_name: string, avatar_url?: string}}>({});
  const [previewZoom, setPreviewZoom] = useState(1.0);
  const [showPagination, setShowPagination] = useState(true);
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const [showTextSplitEditor, setShowTextSplitEditor] = useState(true);
  const [draftContent, setDraftContent] = useState('');
  const [draftContentNodes, setDraftContentNodes] = useState<any>(null);
  const [draftContentHtml, setDraftContentHtml] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isUpdatingFromRemoteRef = useRef(false);
  const latestContentRef = useRef<{content: string, contentNodes?: any}>({ content: '' });
  const pendingMentionsRef = useRef<Set<string>>(new Set());


  const openTextSplitEditor = () => {
    if (!showTextSplitEditor) {
      setDraftContent(editedLetter.content || '');
      setDraftContentNodes(editedLetter.content_nodes || null);
      setDraftContentHtml(editedLetter.content_html || null);
    }
    setShowTextSplitEditor(true);
  };

  // Initialize draft content when split editor is shown for the first time
  const draftInitializedRef = useRef(false);
  useEffect(() => {
    if (showTextSplitEditor && !draftInitializedRef.current) {
      draftInitializedRef.current = true;
      setDraftContent(editedLetter.content || '');
      setDraftContentNodes(editedLetter.content_nodes || null);
      setDraftContentHtml(editedLetter.content_html || null);
    }
  }, [showTextSplitEditor]);

  const applyDraftToPreview = useCallback(() => {
    latestContentRef.current = {
      content: draftContent?.trim() || '',
      contentNodes: draftContentNodes || null,
    };

    setEditedLetter((prev) => ({
      ...prev,
      content: draftContent?.trim() || '',
      content_nodes: draftContentNodes || null,
      content_html: draftContentHtml || undefined,
    }));
  }, [draftContent, draftContentNodes, draftContentHtml]);

  // Live-sync: automatically apply draft changes to preview
  const liveSyncTimerRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    if (!showTextSplitEditor || !draftInitializedRef.current) return;
    if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current);
    liveSyncTimerRef.current = setTimeout(() => {
      applyDraftToPreview();
    }, 300);
    return () => { if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current); };
  }, [draftContent, draftContentNodes, draftContentHtml, showTextSplitEditor, applyDraftToPreview]);

  const statusLabels: Record<string, string> = {
    draft: 'Entwurf',
    review: 'Zur Freigabe',
    pending_approval: 'Zur Freigabe',
    approved: 'Freigegeben',
    revision_requested: 'Überarbeitung',
    sent: 'Versendet'
  };

  const statusIcons: Record<string, any> = {
    draft: Edit3,
    review: Clock,
    pending_approval: Clock,
    approved: CheckCircle,
    revision_requested: RotateCcw,
    sent: Send
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow: Record<string, string> = {
      draft: 'pending_approval',
      pending_approval: 'approved',
      revision_requested: 'pending_approval',
      approved: 'sent'
    };
    return statusFlow[currentStatus];
  };

  const canTransitionStatus = (fromStatus: string, toStatus: string) => {
    const allowedTransitions: Record<string, string[]> = {
      draft: ['pending_approval'],
      review: ['approved', 'revision_requested'], // legacy
      pending_approval: ['approved', 'revision_requested'],
      revision_requested: ['pending_approval'],
      approved: ['sent'],
      sent: []
    };
    return allowedTransitions[fromStatus]?.includes(toStatus) || false;
  };

  const sentMethodLabels = {
    post: 'Post',
    email: 'E-Mail',
    both: 'Post & E-Mail'
  };

  // Determine if current user can edit
  const isCreator = user?.id === letter?.created_by;
  const isReviewer = collaborators.some(c => c.user_id === user?.id);
  const currentStatus = editedLetter.status || 'draft';
  const isInReviewByOthers = (currentStatus === 'review' || currentStatus === 'pending_approval') && !isCreator && !isReviewer;
  const canEdit = !letter || (currentStatus !== 'sent' && (
    (isCreator && (currentStatus === 'draft' || currentStatus === 'revision_requested')) ||
    (isReviewer && (currentStatus === 'review' || currentStatus === 'pending_approval'))
  ));
  
  console.log('=== LETTEREDITOR RENDER ===');
  console.log('LetterEditor props:', { letter, isOpen });
  console.log('Letter prop value:', letter);
  console.log('Is letter truthy?', !!letter);
  console.log('=== END LETTEREDITOR RENDER ===');

  useEffect(() => {
    console.log('=== LETTER PROP EFFECT TRIGGERED ===');
    console.log('Letter prop received:', letter);
    console.log('Letter exists:', !!letter);
    console.log('Letter template_id:', letter?.template_id);
    console.log('Letter sender_info_id:', letter?.sender_info_id);
    console.log('Letter information_block_ids:', letter?.information_block_ids);
    
    if (letter) {
      console.log('=== LETTER DATA RECEIVED ===');
      console.log('Letter:', letter);
      console.log('Template ID:', letter.template_id);
      console.log('Sender Info ID:', letter.sender_info_id);
      console.log('Information Block IDs:', letter.information_block_ids);
      console.log('Letter show_pagination:', letter.show_pagination);
      console.log('=== END LETTER DATA ===');
      
      // Reset and immediately re-initialize draft states from new letter
      draftInitializedRef.current = false;
      
      setEditedLetter({
        ...letter,
        content_html: letter.content_html || '',
        content_nodes: letter.content_nodes || null
      });

      // Directly initialize draft states so the editor gets content
      setDraftContent(letter.content || '');
      setDraftContentNodes(letter.content_nodes || null);
      setDraftContentHtml(letter.content_html || null);
      // Also initialize latestContentRef so save works immediately
      latestContentRef.current = {
        content: letter.content || '',
        contentNodes: letter.content_nodes || null,
      };
      // Delay enabling live-sync so Lexical's ContentPlugin can load
      // the real content before onChange overwrites the ref
      setTimeout(() => {
        draftInitializedRef.current = true;
      }, 500);
      // Set proofreading mode based on actual letter status
      setIsProofreadingMode(letter.status === 'review');
      
      // IMPORTANT: Set pagination setting from letter data
      const paginationValue = letter.show_pagination || false;
      console.log('=== PAGINATION SETTING LOADED ===');
      console.log('Letter show_pagination value:', letter.show_pagination);
      console.log('Setting showPagination to:', paginationValue);
      setShowPagination(paginationValue);
      console.log('=== PAGINATION SETTING APPLIED ===');
      
      // If it's a new letter with template data, we'll apply defaults after template loads
      if (!letter.id && letter.template_id) {
        console.log('New letter with template, will apply defaults after template loads');
      }
    } else {
      // New letter - always start fresh
      console.log('Creating new letter - no letter prop provided');
      const currentDate = new Date().toISOString().split('T')[0];
      setEditedLetter({
        title: '',
        content: '',
        content_html: '',
        content_nodes: null,
        recipient_name: '',
        recipient_address: '',
        status: 'draft',
        letter_date: currentDate
      });
      // Reset draft states for new letter
      setDraftContent('');
      setDraftContentNodes(null);
      setDraftContentHtml(null);
      // Delay enabling live-sync so Lexical's ContentPlugin can load
      // the real content before onChange overwrites the ref
      setTimeout(() => {
        draftInitializedRef.current = true;
      }, 500);
      // Reset proofreading mode and set default pagination for new letters
      setIsProofreadingMode(false);
      setShowPagination(true);
    }
  }, [letter]);

  // Separate useEffect specifically for pagination to avoid conflicts
  useEffect(() => {
    console.log('=== PAGINATION EFFECT TRIGGERED ===');
    console.log('Letter object:', letter);
    console.log('Letter show_pagination:', letter?.show_pagination);
    console.log('Type of show_pagination:', typeof letter?.show_pagination);
    
    if (letter && letter.show_pagination !== undefined) {
      console.log('=== DEDICATED PAGINATION EFFECT ===');
      console.log('Letter show_pagination value:', letter.show_pagination);
      console.log('Current showPagination state:', showPagination);
      console.log('Setting pagination to:', letter.show_pagination);
      setShowPagination(letter.show_pagination);
      console.log('=== PAGINATION EFFECT COMPLETED ===');
    }
  }, [letter?.show_pagination]);

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchContacts();
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
      if (letter?.id) {
        fetchComments();
        fetchCollaborators();
        fetchAttachments();
        fetchWorkflowUserProfiles();
      }
    }
  }, [isOpen, currentTenant, letter?.id]);

  // Effect for fetching template after sender infos and info blocks are loaded
  useEffect(() => {
    if (isOpen && currentTenant && senderInfos.length > 0 && informationBlocks.length > 0) {
      const templateId = editedLetter?.template_id || letter?.template_id;
      console.log('Template effect triggered:', { 
        templateId, 
        editedTemplateId: editedLetter?.template_id, 
        letterTemplateId: letter?.template_id,
        letterId: letter?.id 
      });
      
      // For existing letters or new letters with template_id, fetch the template
      if (templateId) {
        console.log('Fetching template:', templateId);
        fetchCurrentTemplate();
      }
    }
  }, [isOpen, currentTenant, editedLetter?.template_id, letter?.template_id, letter?.id, senderInfos.length, informationBlocks.length]);

  // Auto-save functionality - DECOUPLED from Yjs collaboration
  // Yjs = Single Source of Truth for active sessions
  // DB Auto-save = Backup/persistence only
  useEffect(() => {
    console.log('=== AUTO-SAVE EFFECT TRIGGERED ===');
    console.log('canEdit:', canEdit);
    console.log('isUpdatingFromRemoteRef.current:', isUpdatingFromRemoteRef.current);
    console.log('letter?.id:', letter?.id);
    console.log('showPagination (for auto-save):', showPagination);
    console.log('useYjsCollaboration: true (always enabled)');
    
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-save to DB for persistence (backup)
    // Yjs handles real-time sync between clients
    // DB saves every 3 seconds as backup
    saveTimeoutRef.current = setTimeout(() => {
      if (!isUpdatingFromRemoteRef.current && letter?.id) {
        console.log('=== BACKGROUND AUTO-SAVE (Yjs is primary sync) ===');
        console.log('showPagination at auto-save time:', showPagination);
        handleAutoSave();
      }
    }, 3000); // 3 seconds for DB backup (Yjs syncs immediately)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedLetter, canEdit, letter?.id, showPagination]); // WICHTIG: showPagination als Dependency hinzugefügt


  const fetchContacts = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, organization, gender, last_name, private_street, private_house_number, private_postal_code, private_city, private_country, business_street, business_house_number, business_postal_code, business_city, business_country')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchTemplates = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchCurrentTemplate = async () => {
    const templateId = editedLetter?.template_id || letter?.template_id;
    if (!templateId) {
      console.log('No template ID found');
      return;
    }

    console.log('Fetching template with ID:', templateId);
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      console.log('Fetched template:', data);
      setCurrentTemplate(data);
      
      // Apply template defaults if the letter doesn't have sender/info blocks set
      if (data) {
        console.log('Applying template defaults...');
        applyTemplateDefaults(data);
      }
    } catch (error) {
      console.error('Error fetching current template:', error);
    }
  };

  const applyTemplateDefaults = (template: LetterTemplate) => {
    console.log('Template:', template);
    console.log('Current letter state:', editedLetter);
    console.log('Available senderInfos:', senderInfos);
    console.log('Available informationBlocks:', informationBlocks);
    
    setEditedLetter(prev => {
      const updates: Partial<Letter> = {};
      
      // Apply default sender if letter doesn't have one set
      if (!prev.sender_info_id && template.default_sender_id) {
        console.log('Setting default sender:', template.default_sender_id);
        updates.sender_info_id = template.default_sender_id;
      }
      
      // Apply default info blocks if letter doesn't have any set
      if ((!prev.information_block_ids || prev.information_block_ids.length === 0) && template.default_info_blocks) {
        console.log('Setting default info blocks:', template.default_info_blocks);
        updates.information_block_ids = template.default_info_blocks;
      }
      
      // For "Leerer Brief" template, apply defaults from standard entries
      if (template.name === 'Leerer Brief' || template.id === 'blank') {
        if (!prev.sender_info_id) {
          const defaultSender = senderInfos.find(info => info.is_default);
          if (defaultSender) {
            console.log('Setting default sender for empty letter:', defaultSender.id);
            updates.sender_info_id = defaultSender.id;
          }
        }
        
        if (!prev.information_block_ids || prev.information_block_ids.length === 0) {
          const defaultBlocks = informationBlocks.filter(block => block.is_default);
          if (defaultBlocks.length > 0) {
            console.log('Setting default info blocks for empty letter:', defaultBlocks.map(b => b.id));
            updates.information_block_ids = defaultBlocks.map(block => block.id);
          }
        }
      }
      
      console.log('Updates to apply:', updates);
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  };

  const fetchSenderInfos = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error) {
      console.error('Error fetching sender infos:', error);
    }
  };

  const fetchInformationBlocks = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('information_blocks')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setInformationBlocks(data || []);
    } catch (error) {
      console.error('Error fetching information blocks:', error);
    }
  };

  const fetchWorkflowUserProfiles = async () => {
    if (!letter) return;
    
    // Collect all user IDs from workflow fields
    const userIds = [
      letter.submitted_for_review_by,
      letter.submitted_to_user,
      letter.approved_by,
      letter.sent_by,
      letter.created_by
    ].filter(Boolean);
    
    if (userIds.length === 0) return;
    
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      
      if (error) {
        console.error('Error fetching user profiles:', error);
        return;
      }
      
      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.user_id] = {
          display_name: profile.display_name || 'Unbekannter Benutzer',
          avatar_url: profile.avatar_url
        };
        return acc;
      }, {} as {[key: string]: {display_name: string, avatar_url?: string}}) || {};
      
      setUserProfiles(profilesMap);
    } catch (error) {
      console.error('Error fetching workflow user profiles:', error);
    }
  };

  const fetchAttachments = async () => {
    if (!letter?.id) return;

    try {
      const { data, error } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letter.id)
        .order('created_at');

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleTemplateChange = async (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setEditedLetter(prev => ({ 
        ...prev, 
        template_id: undefined,
        sender_info_id: '',
        information_block_ids: []
      }));
      setCurrentTemplate(null);
      broadcastContentChange('template_id', '');
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditedLetter(prev => ({ 
        ...prev, 
        template_id: templateId
      }));
      setCurrentTemplate(template);
      broadcastContentChange('template_id', templateId);
      
      // Apply template defaults
      applyTemplateDefaults(template);
    }
  };

  const fetchCollaborators = async () => {
    if (!letter?.id) return;

    try {
      const { data, error } = await supabase
        .from('letter_collaborators')
        .select('id, user_id, created_at')
        .eq('letter_id', letter.id);

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
          profiles: profiles?.find(p => p.user_id === item.user_id) || { display_name: 'Unbekannt' }
        })));
      } else {
        setCollaborators([]);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  };

  const handleReturnLetter = async () => {
    if (!letter?.id || !user) return;

    try {
      // Set status back to draft and activate proofreading mode
      setEditedLetter(prev => ({ ...prev, status: 'draft' }));
      setIsProofreadingMode(true);
      
      broadcastContentChange('status', 'draft');
      
      toast({
        title: "Brief zurückgegeben",
        description: "Der Brief wurde zur Bearbeitung zurückgegeben.",
      });
    } catch (error) {
      console.error('Error returning letter:', error);
      toast({
        title: "Fehler",
        description: "Der Brief konnte nicht zurückgegeben werden.",
        variant: "destructive",
      });
    }
  };

  const fetchComments = async () => {
    if (!letter?.id) return;

    try {
      const { data, error } = await supabase
        .from('letter_comments')
        .select(`
          id,
          content,
          text_position,
          text_length,
          resolved,
          comment_type,
          created_at,
          user_id,
          profiles:user_id (display_name)
        `)
        .eq('letter_id', letter.id)
        .order('created_at');

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (content: string) => {
    if (!letter?.id || !user) return;

    try {
      const { error } = await supabase
        .from('letter_comments')
        .insert({
          letter_id: letter.id,
          user_id: user.id,
          content,
          comment_type: 'comment'
        });

      if (error) throw error;
      
      fetchComments();
      setShowCommentDialog(false);
      setSelectedTextForComment('');
      
      toast({
        title: "Kommentar hinzugefügt",
        description: "Der Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Der Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!canTransitionStatus(editedLetter.status || 'draft', newStatus)) {
      toast({
        title: "Ungültiger Statuswechsel",
        description: "Dieser Statuswechsel ist nicht erlaubt.",
        variant: "destructive",
      });
      return;
    }

    // Prepare workflow tracking updates
    const now = new Date().toISOString();
    const workflowUpdates: any = { status: newStatus };

    // Update workflow tracking fields based on status transition
    if (newStatus === 'review' && !editedLetter.workflow_locked) {
      workflowUpdates.submitted_for_review_at = now;
      workflowUpdates.submitted_for_review_by = user?.id;
      // submitted_to_user will be set when reviewer is assigned
    }
    
    if (newStatus === 'approved' && !editedLetter.workflow_locked) {
      workflowUpdates.approved_at = now;
      workflowUpdates.approved_by = user?.id;
    }
    
    if (newStatus === 'sent') {
      console.log('Processing SENT status change...');
      if (!editedLetter.workflow_locked) {
        workflowUpdates.sent_at = now;
        workflowUpdates.sent_by = user?.id;
        console.log('Setting sent_at and sent_by');
      }
      // Lock workflow when letter is sent
      workflowUpdates.workflow_locked = true;
      workflowUpdates.sent_date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      console.log('Set workflow_locked and sent_date:', workflowUpdates.sent_date);
    }

    // Show assignment dialog when transitioning to review
    if (newStatus === 'review' && isCreator) {
      console.log('Opening assignment dialog for review status', { isCreator, newStatus });
      setShowAssignmentDialog(true);
      return;
    }

    setEditedLetter(prev => ({
      ...prev,
      ...workflowUpdates
    }));

    // Update database with workflow tracking
    if (letter?.id) {
      console.log('Updating database for letter:', letter.id);
      console.log('Update data:', workflowUpdates);
      try {
        const { error } = await supabase
          .from('letters')
          .update({
            ...workflowUpdates,
            updated_at: now
          })
          .eq('id', letter.id);

        console.log('Database update result:', error ? 'ERROR' : 'SUCCESS');
        if (error) {
          console.error('Database update error:', error);
          throw error;
        }
        
        // Trigger archiving process for sent letters AFTER successful database update
        if (newStatus === 'sent') {
          console.log('=== STARTING AUTOMATED ARCHIVE PROCESS ===');
          try {
            console.log('Using direct PDF archiving for consistent results with LetterPDFExport');
            
            // Use the standalone archiving function for consistency
            const { archiveLetter } = await import('@/utils/letterArchiving');
            const archiveResult = await archiveLetter(letter, user!.id);
            
            if (archiveResult) {
              toast({
                title: "Brief versendet und archiviert",
                description: "Brief wurde versendet und automatisch in die Dokumentenverwaltung übernommen. Eine Follow-up Aufgabe wurde erstellt.",
                variant: "default",
              });
            } else {
              toast({
                title: "Brief versendet", 
                description: "Brief wurde als versendet markiert. Archivierung wird im Hintergrund verarbeitet.",
                variant: "default",
              });
            }
          } catch (archiveError) {
            console.error('Archive process error:', archiveError);
            toast({
              title: "Archivierungsfehler", 
              description: "Der Brief wurde versendet, aber die Archivierung ist fehlgeschlagen.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error updating workflow tracking:', error);
        toast({
          title: "Fehler beim Workflow-Update",
          description: "Die Workflow-Daten konnten nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }
    
    console.log('=== STATUS CHANGE PROCESS COMPLETED ===');
    console.log('Final status:', newStatus);

    // Korrekturlesen automatisch aktivieren bei "review"
    if (newStatus === 'review') {
      setIsProofreadingMode(true);
    }
    // Korrekturlesen automatisch deaktivieren bei approved/sent
    if (newStatus === 'approved' || newStatus === 'sent') {
      setIsProofreadingMode(false);
    }
    // Korrekturlesen automatisch deaktivieren beim Zurück zu draft
    if (newStatus === 'draft') {
      setIsProofreadingMode(false);
    }

    broadcastContentChange('status', newStatus);
    
    toast({
      title: "Status geändert",
      description: `Status wurde zu "${statusLabels[newStatus as keyof typeof statusLabels]}" geändert.`,
    });
  };

  const handleProofreadingToggle = () => {
    const newProofreadingMode = !isProofreadingMode;
    setIsProofreadingMode(newProofreadingMode);
    
    // Automatischer Status-Wechsel
    if (newProofreadingMode) {
      // Korrekturlesen aktiviert → Status zu "Zur Prüfung"
      if (editedLetter.status === 'draft') {
        handleStatusTransition('review');
      }
    } else {
      // Korrekturlesen deaktiviert → Status zu "Entwurf"
      if (editedLetter.status === 'review') {
        handleStatusTransition('draft');
      }
    }
  };

  const formatContactAddress = (contact: Contact, useBusinessAddress = false) => {
    const street = useBusinessAddress ? contact.business_street : contact.private_street;
    const houseNumber = useBusinessAddress ? contact.business_house_number : contact.private_house_number;
    const postalCode = useBusinessAddress ? contact.business_postal_code : contact.private_postal_code;
    const city = useBusinessAddress ? contact.business_city : contact.private_city;
    const country = useBusinessAddress ? contact.business_country : contact.private_country;

    const addressParts = [
      contact.organization && useBusinessAddress ? contact.organization : null,
      contact.name,
      street && houseNumber ? `${street} ${houseNumber}` : (street || houseNumber),
      postalCode && city ? `${postalCode} ${city}` : (postalCode || city),
      country
    ].filter(Boolean);

    return addressParts.join('\n');
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const hasBusinessAddress = !!(contact.business_street || contact.business_postal_code || contact.business_city);
      const address = formatContactAddress(contact, hasBusinessAddress);
      
      setEditedLetter(prev => ({
        ...prev,
        contact_id: contactId,
        recipient_name: contact.name,
        recipient_address: address
      }));

      broadcastContentChange('recipient_name', contact.name);
      broadcastContentChange('recipient_address', address);
    }
  };

  const broadcastContentChange = (field: string, value: string, htmlValue?: string) => {
    // Deactivated: Yjs collaboration handles all real-time synchronization
    console.log('[LetterEditor] Supabase broadcast disabled - using Yjs for:', field);
    return;
  };

  // Removed old toolbar handlers - EnhancedLexicalEditor handles formatting internally

  const handleAutoSave = async (immediateContent?: string, immediateContentNodes?: string) => {
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;
    
    // Use immediate parameters if provided, otherwise use latest ref values, fallback to state
    const contentToSave = immediateContent !== undefined ? immediateContent : latestContentRef.current.content || editedLetter.content;
    const contentNodesToSave = immediateContentNodes !== undefined ? immediateContentNodes : latestContentRef.current.contentNodes || editedLetter.content_nodes;
    
    console.log('=== AUTO-SAVE STARTED ===');
    console.log('Current showPagination value:', showPagination);  
    console.log('Letter ID:', letter?.id);
    console.log('Content to save length:', contentToSave?.length);
    console.log('Content to save preview:', contentToSave?.substring(0, 100) + '...');
    console.log('=========================');
    
    // Validate content before saving to prevent corruption
    if (contentToSave && contentToSave.includes('{"root":{"children"') && contentToSave.split('{"root":{"children"').length > 2) {
      console.error('🚨 Detected corrupted content, aborting save');
      toast({
        title: "Inhalt beschädigt",
        description: "Der Inhalt scheint beschädigt zu sein. Bitte laden Sie die Seite neu.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    setSaving(true);
    try {
      // Don't auto-save status changes - only content and metadata
      const { error } = await supabase
        .from('letters')
        .update({
          title: editedLetter.title,
          content: contentToSave?.trim() || '',
          content_html: editedLetter.content_html,
          content_nodes: contentNodesToSave,
          recipient_name: editedLetter.recipient_name,
          recipient_address: editedLetter.recipient_address,
          contact_id: editedLetter.contact_id,
          template_id: editedLetter.template_id,
          subject: editedLetter.subject,
          reference_number: editedLetter.reference_number,
          sender_info_id: editedLetter.sender_info_id,
          information_block_ids: editedLetter.information_block_ids,
          letter_date: editedLetter.letter_date,
          show_pagination: showPagination,
          salutation_override: (editedLetter as any).salutation_override || null,
          closing_formula: (editedLetter as any).closing_formula || null,
          closing_name: (editedLetter as any).closing_name || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', letter.id);

      if (error) throw error;

      console.log('=== AUTO-SAVE SUCCESSFUL ===');
      console.log('Saved showPagination:', showPagination);
      console.log('Saved content successfully:', !!contentToSave);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error auto-saving letter:', error);
      console.log('=== AUTO-SAVE FAILED ===');
      toast({
        title: "Auto-Speichern fehlgeschlagen",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setTimeout(() => setSaving(false), 200);
    }
  };

  const handleManualSave = async (immediateContent?: string, immediateContentNodes?: string) => {
    if (!canEdit || !currentTenant || !user) return;

    // Use immediate parameters if provided, otherwise use latest ref values, fallback to state
    const contentToSave = immediateContent !== undefined ? immediateContent : (latestContentRef.current.content || editedLetter.content || '');
    const contentNodesToSave = immediateContentNodes !== undefined ? immediateContentNodes : (latestContentRef.current.contentNodes || editedLetter.content_nodes || null);

    console.log('=== MANUAL SAVE STARTED ===');
    console.log('content_nodes to save:', contentNodesToSave ? 'HAS JSON DATA' : 'NO JSON DATA');
    console.log('content_nodes length:', contentNodesToSave?.length || 0);
    console.log('Using immediate parameters:', { immediateContent: !!immediateContent, immediateContentNodes: !!immediateContentNodes });

    setSaving(true);
    try {
      if (letter?.id) {
        // Update existing letter
        const { error } = await supabase
          .from('letters')
          .update({
            title: editedLetter.title,
            content: contentToSave,
            content_html: editedLetter.content_html,
            content_nodes: contentNodesToSave,
            recipient_name: editedLetter.recipient_name,
            recipient_address: editedLetter.recipient_address,
            contact_id: editedLetter.contact_id,
            template_id: editedLetter.template_id,
            subject: editedLetter.subject,
            reference_number: editedLetter.reference_number,
            sender_info_id: editedLetter.sender_info_id,
            information_block_ids: editedLetter.information_block_ids,
            letter_date: editedLetter.letter_date,
            status: editedLetter.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', letter.id);

        if (error) throw error;
      } else {
        // Create new letter
        const { error } = await supabase
          .from('letters')
          .insert({
            tenant_id: currentTenant.id,
            created_by: user.id,
            title: editedLetter.title || 'Neuer Brief',
            content: contentToSave || '',
            content_html: editedLetter.content_html || '',
            content_nodes: contentNodesToSave,
            recipient_name: editedLetter.recipient_name,
            recipient_address: editedLetter.recipient_address,
            contact_id: editedLetter.contact_id,
            template_id: editedLetter.template_id,
            subject: editedLetter.subject,
            reference_number: editedLetter.reference_number,
            sender_info_id: editedLetter.sender_info_id,
            information_block_ids: editedLetter.information_block_ids,
            letter_date: editedLetter.letter_date,
            status: editedLetter.status || 'draft',
            show_pagination: showPagination
          });

        if (error) throw error;
      }

      console.log('=== MANUAL SAVE SUCCESSFUL ===');
      console.log('Saved content_nodes successfully:', !!contentNodesToSave);
      setLastSaved(new Date());

      // Send mention notifications
      if (pendingMentionsRef.current.size > 0 && user) {
        const mentionPromises = Array.from(pendingMentionsRef.current).map(async (mentionedUserId) => {
          if (mentionedUserId === user.id) return; // Don't notify self
          try {
            await supabase.rpc('create_notification', {
              user_id_param: mentionedUserId,
              type_name: 'document_mention',
              title_param: 'Erwähnung in Brief',
              message_param: `Sie wurden in dem Brief "${editedLetter.title || 'Unbenannt'}" erwähnt`,
              data_param: JSON.stringify({ documentId: letter?.id, documentType: 'letter' }),
              priority_param: 'medium',
            });
          } catch (e) {
            console.error('Failed to send mention notification:', e);
          }
        });
        await Promise.allSettled(mentionPromises);
        pendingMentionsRef.current.clear();
      }

      onSave();
      toast({
        title: "Brief gespeichert",
        description: "Ihre Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving letter:', error);
      console.log('=== MANUAL SAVE FAILED ===');
      toast({
        title: "Fehler beim Speichern",
        description: "Der Brief konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = !isUpdatingFromRemoteRef.current && letter && (
    editedLetter.title !== letter.title || 
    editedLetter.content !== letter.content || 
    editedLetter.recipient_name !== letter.recipient_name ||
    editedLetter.recipient_address !== letter.recipient_address ||
    editedLetter.subject !== letter.subject ||
    editedLetter.reference_number !== letter.reference_number ||
    editedLetter.sender_info_id !== letter.sender_info_id ||
    JSON.stringify(editedLetter.information_block_ids || []) !== JSON.stringify(letter.information_block_ids || []) ||
    editedLetter.letter_date !== letter.letter_date ||
    editedLetter.status !== letter.status ||
    showPagination !== (letter.show_pagination || false) // WICHTIG: Paginierung in unsaved changes berücksichtigen
  );

  // Build substituted canvas block elements from template
  const substitutedBlocks = React.useMemo(() => {
    if (!currentTemplate) return { canvasBlocks: {}, lineBlocks: {} };
    const blockContent = (currentTemplate as any)?.layout_settings?.blockContent as Record<string, any> | undefined;
    if (!blockContent) return { canvasBlocks: {}, lineBlocks: {} };

    const sender = senderInfos.find(s => s.id === editedLetter.sender_info_id);
    const contact = contacts.find(c => c.name === editedLetter.recipient_name);
    const infoBlock = informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id));

    const recipientData = contact ? {
      name: contact.name,
      street: [contact.private_street, contact.private_house_number].filter(Boolean).join(' ') || [contact.business_street, contact.business_house_number].filter(Boolean).join(' '),
      postal_code: contact.private_postal_code || contact.business_postal_code || '',
      city: contact.private_city || contact.business_city || '',
      country: contact.private_country || contact.business_country || '',
      gender: contact.gender || '',
      last_name: contact.last_name || contact.name?.split(' ').pop() || '',
    } : editedLetter.recipient_name ? {
      name: editedLetter.recipient_name,
      street: '',
      postal_code: '',
      city: '',
      country: '',
    } : null;

    const varMap = buildVariableMap(
      { subject: editedLetter.subject, letterDate: editedLetter.letter_date, referenceNumber: editedLetter.reference_number },
      sender ? { name: sender.name, organization: sender.organization, street: sender.street, house_number: sender.house_number, postal_code: sender.postal_code, city: sender.city, phone: sender.phone, email: sender.email } : null,
      recipientData,
      infoBlock ? { reference: infoBlock.block_data?.reference_pattern, handler: infoBlock.block_data?.contact_name, our_reference: '' } : null,
      attachments,
    );

    const canvasBlocks: Record<string, HeaderElement[]> = {};
    const lineBlocks: Record<string, BlockLine[]> = {};

    for (const [key, data] of Object.entries(blockContent)) {
      if (isLineMode(data)) {
        lineBlocks[key] = substituteBlockLines(data.lines, varMap);
      } else if (Array.isArray(data) && data.length > 0) {
        canvasBlocks[key] = substituteVariables(data as HeaderElement[], varMap);
      }
    }
    return { canvasBlocks, lineBlocks };
  }, [currentTemplate, editedLetter, senderInfos, contacts, informationBlocks, attachments]);

  // Compute salutation from template settings and variable map
  const computedSalutation = React.useMemo(() => {
    const salutationTemplate = (currentTemplate as any)?.layout_settings?.salutation?.template || 'Sehr geehrte Damen und Herren,';
    
    if (salutationTemplate === '{{anrede}}') {
      // Auto-generate based on recipient
      const contact = contacts.find(c => c.name === editedLetter.recipient_name);
      const recipientData = contact ? {
        name: contact.name,
        gender: contact.gender,
        last_name: contact.last_name || contact.name?.split(' ').pop(),
      } : editedLetter.recipient_name ? {
        name: editedLetter.recipient_name,
      } : null;

      const varMap = buildVariableMap(
        { subject: editedLetter.subject },
        null,
        recipientData,
        null,
        null,
      );
      return varMap['{{anrede}}'] || 'Sehr geehrte Damen und Herren,';
    }
    
    return salutationTemplate;
  }, [currentTemplate, editedLetter.recipient_name, contacts]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex-none border-b bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {letter ? 'Brief bearbeiten' : 'Neuer Brief'}
              </span>
              {activeUsers.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {activeUsers.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Badge variant="outline" className="text-xs animate-pulse">
                •••
              </Badge>
            )}
            {lastSaved && !saving && (
              <Badge variant="outline" className="text-xs opacity-60">
                ✓ {lastSaved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
            {hasUnsavedChanges && !saving && (
              <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Wird gespeichert...
              </Badge>
            )}
            
            {/* Print Preview Button - opens DIN5008 in modal */}
            <Button
              variant={showDINPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDINPreview(!showDINPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Druckvorschau
            </Button>

            <Button
              variant={showBriefDetails ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBriefDetails(!showBriefDetails)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Briefdetails
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Anlagen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[420px] p-3">
                {letter?.id ? (
                  <LetterAttachmentManager
                    letterId={letter.id}
                    attachments={attachments}
                    onAttachmentUpdate={fetchAttachments}
                    readonly={!canEdit}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Anlagen verfügbar nach dem Speichern</p>
                    <p className="text-sm">Speichern Sie den Brief zuerst, um Anlagen hinzufügen zu können.</p>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>


            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Basisinformationen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[520px] p-3 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  {/* DIN 5008 Fields */}
                  <div>
                    <Label htmlFor="subject">Betreff</Label>
                    <Input
                      id="subject"
                      value={editedLetter.subject || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, subject: value, title: value }));
                        broadcastContentChange('subject', value);
                        broadcastContentChange('title', value);
                      }}
                      disabled={!canEdit}
                      placeholder="Betreff des Briefes"
                    />
                  </div>

                  <div>
                    <Label htmlFor="salutation-override">Anrede</Label>
                    <Input
                      id="salutation-override"
                      value={(editedLetter as any).salutation_override || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, salutation_override: value } as any));
                      }}
                      disabled={!canEdit}
                      placeholder={computedSalutation}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Leer lassen für automatische Anrede</p>
                  </div>

                  <div>
                    <Label htmlFor="closing-formula">Abschlussformel</Label>
                    <Input
                      id="closing-formula"
                      value={(editedLetter as any).closing_formula || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, closing_formula: value } as any));
                      }}
                      disabled={!canEdit}
                      placeholder={(currentTemplate as any)?.layout_settings?.closing?.formula || 'Mit freundlichen Grüßen'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="closing-name">Unterschrift</Label>
                    <Input
                      id="closing-name"
                      value={(editedLetter as any).closing_name || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, closing_name: value } as any));
                      }}
                      disabled={!canEdit}
                      placeholder={(currentTemplate as any)?.layout_settings?.closing?.signatureName || 'Name'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="reference-number">Aktenzeichen</Label>
                    <Input
                      id="reference-number"
                      value={editedLetter.reference_number || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, reference_number: value }));
                        broadcastContentChange('reference_number', value);
                      }}
                      disabled={!canEdit}
                      placeholder="z.B. AZ-2024-001"
                    />
                  </div>

                  <div>
                    <Label htmlFor="letter-date">Briefdatum</Label>
                    <Input
                      id="letter-date"
                      type="date"
                      value={editedLetter.letter_date || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, letter_date: value }));
                        broadcastContentChange('letter_date', value);
                      }}
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="expected-response-date">Erwartete Antwort bis</Label>
                    <Input
                      id="expected-response-date"
                      type="date"
                      value={editedLetter.expected_response_date || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, expected_response_date: value }));
                        broadcastContentChange('expected_response_date', value);
                      }}
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="recipient-name">Empfänger</Label>
                    <Input
                      id="recipient-name"
                      value={editedLetter.recipient_name || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, recipient_name: value }));
                        broadcastContentChange('recipient_name', value);
                      }}
                      disabled={!canEdit}
                      placeholder="Name des Empfängers"
                    />
                  </div>

                  <div>
                    <Label htmlFor="recipient-address">Empfängeradresse</Label>
                    <Textarea
                      id="recipient-address"
                      value={editedLetter.recipient_address || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditedLetter(prev => ({ ...prev, recipient_address: value }));
                        broadcastContentChange('recipient_address', value);
                      }}
                      disabled={!canEdit}
                      placeholder="Adresse des Empfängers"
                      rows={3}
                    />
                  </div>

                  {(editedLetter.submitted_for_review_at || editedLetter.approved_at || editedLetter.sent_at) && (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Workflow-Historie</span>
                      </div>
                      <div className="space-y-1">
                        {editedLetter.submitted_for_review_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3" />
                            <span>Eingereicht: {new Date(editedLetter.submitted_for_review_at).toLocaleDateString('de-DE')}</span>
                            {editedLetter.submitted_for_review_by && userProfiles[editedLetter.submitted_for_review_by] && (
                              <span className="text-muted-foreground">von {userProfiles[editedLetter.submitted_for_review_by].display_name}</span>
                            )}
                          </div>
                        )}
                        {editedLetter.approved_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-3 w-3" />
                            <span>Genehmigt: {new Date(editedLetter.approved_at).toLocaleDateString('de-DE')}</span>
                            {editedLetter.approved_by && userProfiles[editedLetter.approved_by] && (
                              <span className="text-muted-foreground">von {userProfiles[editedLetter.approved_by].display_name}</span>
                            )}
                          </div>
                        )}
                        {editedLetter.sent_at && (
                          <div className="flex items-center gap-2 text-sm">
                            <Send className="h-3 w-3" />
                            <span>Versendet: {new Date(editedLetter.sent_at).toLocaleDateString('de-DE')}</span>
                            {editedLetter.sent_by && userProfiles[editedLetter.sent_by] && (
                              <span className="text-muted-foreground">von {userProfiles[editedLetter.sent_by].display_name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Layout
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[520px] p-3 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="pagination"
                      checked={showPagination}
                      onCheckedChange={(checked) => {
                        console.log('=== PAGINATION TOGGLE CLICKED ===');
                        console.log('Old value:', showPagination);
                        console.log('New value:', checked);
                        setShowPagination(checked);
                        console.log('=== PAGINATION TOGGLE APPLIED ===');

                        if (saveTimeoutRef.current) {
                          clearTimeout(saveTimeoutRef.current);
                        }
                        saveTimeoutRef.current = setTimeout(() => {
                          console.log('=== AUTO-SAVING PAGINATION CHANGE ===');
                          handleAutoSave();
                        }, 1000);
                      }}
                      disabled={!canEdit}
                    />
                    <Label htmlFor="pagination">Paginierung anzeigen</Label>
                  </div>

                  <div>
                    <Label htmlFor="sender-info">Absenderinformation</Label>
                    <Select
                      value={editedLetter.sender_info_id || 'none'}
                      onValueChange={(value) => {
                        const senderInfoId = value === 'none' ? undefined : value;
                        setEditedLetter(prev => ({ ...prev, sender_info_id: senderInfoId }));
                        broadcastContentChange('sender_info_id', senderInfoId || '');
                      }}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Absender auswählen..." />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="none">Kein Absender</SelectItem>
                        {senderInfos.map((info) => (
                          <SelectItem key={info.id} value={info.id}>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              {info.name}
                              {info.is_default && (
                                <Badge variant="secondary" className="text-xs">Standard</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="info-blocks">Informationsblöcke</Label>
                    <div className="space-y-2">
                      {informationBlocks.map((block) => (
                        <div key={block.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`block-${block.id}`}
                            checked={editedLetter.information_block_ids?.includes(block.id) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const currentIds = editedLetter.information_block_ids || [];
                              const newIds = checked
                                ? [...currentIds, block.id]
                                : currentIds.filter(id => id !== block.id);
                              setEditedLetter(prev => ({ ...prev, information_block_ids: newIds }));
                              broadcastContentChange('information_block_ids', JSON.stringify(newIds));
                            }}
                            disabled={!canEdit}
                            className="rounded border border-input"
                          />
                          <Label htmlFor={`block-${block.id}`} className="text-sm">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              {block.label}
                              {block.is_default && (
                                <Badge variant="secondary" className="text-xs">Standard</Badge>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                      {informationBlocks.length === 0 && (
                        <p className="text-sm text-muted-foreground">Keine Informationsblöcke verfügbar</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="template-select">Brief-Template</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Layout className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {currentTemplate ? currentTemplate.name : 'Kein Template ausgewählt'}
                      </span>
                    </div>
                    <Select
                      value={editedLetter.template_id || 'none'}
                      onValueChange={handleTemplateChange}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Template auswählen..." />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="none">Kein Template</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{template.name}</span>
                              {template.is_default && (
                                <Badge variant="secondary" className="ml-2 text-xs">Standard</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>


            {/* Proofreading Mode Toggle - nur bei draft/review */}
            {editedLetter.status !== 'approved' && editedLetter.status !== 'sent' && (
              <Button
                variant={isProofreadingMode ? "default" : "outline"}
                size="sm"
                onClick={handleProofreadingToggle}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Korrekturlesen
              </Button>
            )}
            
            <Button 
              onClick={() => handleManualSave(latestContentRef.current.content, latestContentRef.current.contentNodes)} 
              disabled={!canEdit || saving}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!canEdit && editedLetter.status === 'sent' && (
           <div className="bg-muted p-3 rounded-lg flex items-center gap-2 text-sm mt-3">
             <EyeOff className="h-4 w-4" />
             Dieser Brief ist versendet und kann nicht mehr bearbeitet werden.
           </div>
        )}
      </div>

      {showBriefDetails && (
        <div className="border-b bg-card/30 p-4 overflow-y-auto max-h-[45vh]">
          <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Briefdetails
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Status - Always visible at top */}
                    <div className="p-4 border rounded-lg bg-card/50">
                      <div className="flex items-center gap-2 mb-3">
                        {React.createElement(statusIcons[editedLetter.status || 'draft'], { 
                          className: "h-4 w-4 text-primary" 
                        })}
                        <Label className="text-base font-medium">Status</Label>
                        <Badge variant="secondary">
                          {statusLabels[editedLetter.status || 'draft']}
                        </Badge>
                      </div>
                      
                      {/* Status Transition Buttons */}
                      {canEdit && (
                        <div className="flex flex-col gap-2">
                          {/* Forward transition button */}
                          {getNextStatus(editedLetter.status || 'draft') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusTransition(getNextStatus(editedLetter.status || 'draft'))}
                              className="justify-start"
                            >
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Zu "{statusLabels[getNextStatus(editedLetter.status || 'draft') as keyof typeof statusLabels]}"
                            </Button>
                          )}
                          
                          {/* Zurück-Buttons für alle Status außer draft */}
                          {editedLetter.status === 'review' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusTransition('draft')}
                              className="justify-start text-muted-foreground"
                            >
                              Zurück zu Entwurf
                            </Button>
                          )}
                          
                          {editedLetter.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusTransition('review')}
                              className="justify-start text-muted-foreground"
                            >
                              Zurück zur Prüfung
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Return letter button for reviewers in review status */}
                      {editedLetter.status === 'review' && isReviewer && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleReturnLetter}
                          className="justify-start text-orange-600 hover:text-orange-700 mt-2"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Brief zurückgeben
                        </Button>
                      )}
                    </div>

                    {/* Sending Details - only show for approved/sent letters */}
                    {(editedLetter.status === 'approved' || editedLetter.status === 'sent') && (
                      <div className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Send className="h-4 w-4 text-primary" />
                          <Label className="text-base font-medium">Versand</Label>
                        </div>
                        
                        <div>
                          <Label htmlFor="sent-method">Versandart</Label>
                          <Select 
                            value={editedLetter.sent_method || ''} 
                            onValueChange={(value: 'post' | 'email' | 'both') => {
                              setEditedLetter(prev => ({ ...prev, sent_method: value }));
                              broadcastContentChange('sent_method', value);
                            }}
                            disabled={!canEdit}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Versandart wählen..." />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {Object.entries(sentMethodLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {editedLetter.status === 'sent' && (
                          <div>
                            <Label htmlFor="sent-date">Versanddatum</Label>
                            <Input
                              id="sent-date"
                              type="date"
                              value={editedLetter.sent_date || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditedLetter(prev => ({ ...prev, sent_date: value }));
                                broadcastContentChange('sent_date', value);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor - Always shows letter canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showDINPreview ? (
            /* Print Preview Modal-like view */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-none flex items-center justify-between p-3 border-b bg-muted/30">
                <h3 className="text-sm font-medium">Druckvorschau (schreibgeschützt)</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showLayoutDebug ? "default" : "outline"}
                    size="sm"
                    className="h-7"
                    onClick={() => setShowLayoutDebug(!showLayoutDebug)}
                  >
                    <Ruler className="h-3.5 w-3.5 mr-1" />
                    Layout
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}>-</Button>
                  <span className="text-xs min-w-[40px] text-center">{Math.round(previewZoom * 100)}%</span>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}>+</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(0.75)}>Reset</Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-muted/50 p-6">
                <div style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center', marginBottom: `${(previewZoom - 1) * 297}mm` }}>
                  <div className="mx-auto" style={{ width: '210mm', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
                    <DIN5008LetterLayout
                      template={currentTemplate}
                      senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
                      informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))}
                      recipientAddress={editedLetter.recipient_address ? { name: editedLetter.recipient_name, address: editedLetter.recipient_address } : null}
                      subject={editedLetter.subject}
                      letterDate={editedLetter.letter_date}
                      referenceNumber={editedLetter.reference_number}
                      content={editedLetter.content_html || editedLetter.content || ''}
                      attachments={attachments}
                      showPagination={showPagination}
                      debugMode={showLayoutDebug}
                      salutation={(editedLetter as any).salutation_override || computedSalutation}
                      layoutSettings={(() => {
                        const ls = (currentTemplate as any)?.layout_settings;
                        if (!ls) return undefined;
                        const closingFormula = (editedLetter as any).closing_formula || ls.closing?.formula;
                        const closingName = (editedLetter as any).closing_name || ls.closing?.signatureName;
                        if (closingFormula || closingName) {
                          return { ...ls, closing: { ...(ls.closing || {}), formula: closingFormula || '', signatureName: closingName || '' } };
                        }
                        return ls;
                      })()}
                      addressFieldElements={substitutedBlocks.canvasBlocks.addressField}
                      returnAddressElements={substitutedBlocks.canvasBlocks.returnAddress}
                      infoBlockElements={substitutedBlocks.canvasBlocks.infoBlock}
                      subjectElements={substitutedBlocks.canvasBlocks.subject}
                      attachmentElements={substitutedBlocks.canvasBlocks.attachments}
                      footerTextElements={substitutedBlocks.canvasBlocks.footer}
                      addressFieldLines={substitutedBlocks.lineBlocks.addressField}
                      returnAddressLines={substitutedBlocks.lineBlocks.returnAddress}
                      infoBlockLines={substitutedBlocks.lineBlocks.infoBlock}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Split mode: text editor + letter canvas preview */
            <div className="flex-1 flex overflow-hidden">
              {showTextSplitEditor && (
                <div className="w-[48%] min-w-[380px] border-r bg-background flex flex-col">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Brieftext</h3>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Live</Badge>
                    </div>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-7 px-2"
                      disabled={!canEdit || saving}
                      onClick={() => handleManualSave(latestContentRef.current.content, latestContentRef.current.contentNodes)}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Speichern
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowTextSplitEditor(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <EnhancedLexicalEditor
                      content={draftContent}
                      contentNodes={draftContentNodes}
                      onChange={(nextContent, nextNodes, nextHtml) => {
                        setDraftContent(nextContent || '');
                        setDraftContentNodes(nextNodes && nextNodes.trim() !== '' ? nextNodes : null);
                        setDraftContentHtml(nextHtml || null);
                      }}
                      placeholder="Brieftext hier eingeben..."
                      documentId={letter?.id}
                      showToolbar={canEdit}
                      editable={canEdit}
                      onMentionInsert={(userId) => pendingMentionsRef.current.add(userId)}
                      defaultFontSize="11pt"
                      isReviewMode={isReviewer && (currentStatus === 'pending_approval' || currentStatus === 'review')}
                      reviewerName={user?.id ? (userProfiles[user.id]?.display_name || user.email || '') : ''}
                      reviewerId={user?.id || ''}
                      showAcceptReject={isCreator && currentStatus === 'revision_requested'}
                    />
                  </div>
                </div>
              )}
              <div className="flex-1 flex flex-col overflow-hidden">
            <LetterEditorCanvas
              subject={editedLetter.subject}
              salutation={(editedLetter as any).salutation_override || computedSalutation}
              content={editedLetter.content || ''}
              contentNodes={editedLetter.content_nodes}
              recipientAddress={editedLetter.recipient_address ? { name: editedLetter.recipient_name, address: editedLetter.recipient_address } : null}
              letterDate={editedLetter.letter_date}
              referenceNumber={editedLetter.reference_number}
              attachments={attachments}
              showPagination={showPagination}
              template={currentTemplate}
              layoutSettings={(() => {
                const ls = (currentTemplate as any)?.layout_settings;
                if (!ls) return undefined;
                const closingFormula = (editedLetter as any).closing_formula || ls.closing?.formula;
                const closingName = (editedLetter as any).closing_name || ls.closing?.signatureName;
                if (closingFormula || closingName) {
                  return { ...ls, closing: { ...(ls.closing || {}), formula: closingFormula || '', signatureName: closingName || '' } };
                }
                return ls;
              })()}
              senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
              informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))}
              addressFieldElements={substitutedBlocks.canvasBlocks.addressField}
              returnAddressElements={substitutedBlocks.canvasBlocks.returnAddress}
              infoBlockElements={substitutedBlocks.canvasBlocks.infoBlock}
              subjectElements={substitutedBlocks.canvasBlocks.subject}
              attachmentElements={substitutedBlocks.canvasBlocks.attachments}
              footerTextElements={substitutedBlocks.canvasBlocks.footer}
              addressFieldLines={substitutedBlocks.lineBlocks.addressField}
              returnAddressLines={substitutedBlocks.lineBlocks.returnAddress}
              infoBlockLines={substitutedBlocks.lineBlocks.infoBlock}
              canEdit={canEdit}
              documentId={letter?.id}
              isReviewMode={isReviewer && (currentStatus === 'pending_approval' || currentStatus === 'review')}
              reviewerName={user?.id ? (userProfiles[user.id]?.display_name || user.email || '') : ''}
              reviewerId={user?.id || ''}
              showAcceptReject={isCreator && currentStatus === 'revision_requested'}
              onContentChange={() => {}}
              enableInlineContentEditing={false}
              onRequestContentEdit={openTextSplitEditor}
              displayContentHtml={editedLetter.content_html || undefined}
              onMentionInsert={(userId) => {
                pendingMentionsRef.current.add(userId);
              }}
              onSubjectChange={(value) => {
                setEditedLetter(prev => ({ ...prev, subject: value, title: value }));
                broadcastContentChange('subject', value);
              }}
              onSalutationChange={(value) => {
                setEditedLetter(prev => ({ ...prev, salutation_override: value } as any));
              }}
              onRecipientNameChange={(value) => {
                setEditedLetter(prev => ({ ...prev, recipient_name: value }));
                broadcastContentChange('recipient_name', value);
              }}
              onRecipientAddressChange={(value) => {
                setEditedLetter(prev => ({ ...prev, recipient_address: value }));
                broadcastContentChange('recipient_address', value);
              }}
              onRecipientContactSelect={(contact) => {
                const recipientAddress = (contact as any).formatted_address || contact.address || '';
                setEditedLetter(prev => ({
                  ...prev,
                  contact_id: contact.id,
                  recipient_name: contact.name,
                  recipient_address: recipientAddress
                }));
                broadcastContentChange('contact_id', contact.id);
                broadcastContentChange('recipient_name', contact.name);
                broadcastContentChange('recipient_address', recipientAddress);
              }}
              onSenderChange={(value) => {
                const senderInfoId = value || undefined;
                setEditedLetter(prev => ({ ...prev, sender_info_id: senderInfoId }));
                broadcastContentChange('sender_info_id', senderInfoId || '');
              }}
              onInfoBlockChange={(newIds) => {
                setEditedLetter(prev => ({ ...prev, information_block_ids: newIds }));
                broadcastContentChange('information_block_ids', JSON.stringify(newIds));
              }}
              senderInfos={senderInfos}
              informationBlocks={informationBlocks}
              selectedSenderId={editedLetter.sender_info_id}
              selectedRecipientContactId={editedLetter.contact_id}
              selectedInfoBlockIds={editedLetter.information_block_ids || []}
              templateName={currentTemplate?.name}
              zoom={previewZoom}
              onZoomChange={setPreviewZoom}
            />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Kommentar hinzufügen</h3>
            <Textarea
              value={selectedTextForComment}
              onChange={(e) => setSelectedTextForComment(e.target.value)}
              placeholder="Ihr Kommentar..."
              rows={4}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCommentDialog(false);
                  setSelectedTextForComment('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => handleAddComment(selectedTextForComment)}
                disabled={!selectedTextForComment.trim()}
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Assignment Dialog */}
      <ReviewAssignmentDialog
        isOpen={showAssignmentDialog}
        onClose={() => setShowAssignmentDialog(false)}
        letterId={letter?.id || ''}
        onReviewAssigned={async () => {
          console.log('Assignment completed, proceeding with status change');
          fetchCollaborators();
          setShowAssignmentDialog(false);
          
          // Update status and save to database atomically
          const newStatus = 'review';
          setEditedLetter(prev => ({ ...prev, status: newStatus as any }));
          setIsProofreadingMode(true);
          // Broadcasting disabled - Yjs handles synchronization
          
          setSaving(true);
          try {
            const { error } = await supabase
              .from('letters')
              .update({
                status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', letter!.id);

            if (error) throw error;
            
            toast({
              title: "Status geändert",
              description: "Brief wurde zur Prüfung weitergeleitet.",
            });
          } catch (error) {
            console.error('Error saving status:', error);
            toast({
              title: "Fehler",
              description: "Status konnte nicht gespeichert werden.",
              variant: "destructive",
            });
          } finally {
            setSaving(false);
          }
        }}
        onSkipReview={async () => {
          console.log('Skipping review, going directly to approved');
          setShowAssignmentDialog(false);
          
          // Update status and save to database atomically
          const newStatus = 'approved';
          setEditedLetter(prev => ({ ...prev, status: newStatus as any }));
          setIsProofreadingMode(false);
          // Broadcasting disabled - Yjs handles synchronization
          
          setSaving(true);
          try {
            const { error } = await supabase
              .from('letters')
              .update({
                status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', letter!.id);

            if (error) throw error;
            
            toast({
              title: "Status geändert",
              description: "Brief wurde direkt genehmigt.",
            });
          } catch (error) {
            console.error('Error saving status:', error);
            toast({
              title: "Fehler",
              description: "Status konnte nicht gespeichert werden.",
              variant: "destructive",
            });
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
};

export default LetterEditor;
