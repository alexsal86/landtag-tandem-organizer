import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText, Send, Download, Calendar, User, MapPin, MessageSquare, CheckCircle, Clock, ArrowRight, UserPlus, RotateCcw, Layout, Building, Info, PanelLeft, PanelLeftClose, Mail, Settings, Wifi, WifiOff } from 'lucide-react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { sanitizeContent, parseContentSafely } from '@/utils/contentValidation';
import ReviewAssignmentDialog from './ReviewAssignmentDialog';
import LetterAttachmentManager from './letters/LetterAttachmentManager';
import { DIN5008LetterLayout } from './letters/DIN5008LetterLayout';
import { ContactSelector } from './ContactSelector';

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
  status: 'draft' | 'review' | 'approved' | 'sent';
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
  const [collaborationStatus, setCollaborationStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isProofreadingMode, setIsProofreadingMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });
  const [selectedTextForComment, setSelectedTextForComment] = useState('');
  const [collaborators, setCollaborators] = useState<LetterCollaborator[]>([]);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showDINPreview, setShowDINPreview] = useState(false);
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [informationBlocks, setInformationBlocks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<{[key: string]: {display_name: string, avatar_url?: string}}>({});
  const [previewZoom, setPreviewZoom] = useState(1.0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPagination, setShowPagination] = useState(true);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const latestContentRef = useRef<{content: string, contentNodes?: any}>({ content: '' });

  const statusLabels = {
    draft: 'Entwurf',
    review: 'Zur Prüfung',
    approved: 'Genehmigt',
    sent: 'Versendet'
  };

  const statusIcons = {
    draft: Edit3,
    review: Clock,
    approved: CheckCircle,
    sent: Send
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = {
      draft: 'review',
      review: 'approved',
      approved: 'sent'
    };
    return statusFlow[currentStatus as keyof typeof statusFlow];
  };

  const canTransitionStatus = (fromStatus: string, toStatus: string) => {
    const allowedTransitions = {
      draft: ['review'],
      review: ['draft', 'approved'],
      approved: ['review', 'sent'],
      sent: ['approved']
    };
    return allowedTransitions[fromStatus as keyof typeof allowedTransitions]?.includes(toStatus) || false;
  };

  const sentMethodLabels = {
    post: 'Post',
    email: 'E-Mail',
    both: 'Post & E-Mail'
  };

  // Determine if current user can edit
  const isCreator = user?.id === letter?.created_by;
  const isReviewer = collaborators.some(c => c.user_id === user?.id);
  const isInReviewByOthers = editedLetter.status === 'review' && !isCreator && !isReviewer;
  const canEdit = !letter || editedLetter.status !== 'sent' && (
    isCreator && editedLetter.status !== 'review' ||
    isReviewer && editedLetter.status === 'review'
  );
  
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
      
      setEditedLetter({
        ...letter,
        content_html: letter.content_html || '',
        content_nodes: letter.content_nodes || null
      });
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

  // Real-time collaboration status (now handled by Yjs)
  useEffect(() => {
    if (!isOpen || !user || !letter?.id) return;

    // Set collaboration as connected since Yjs handles real-time sync
    setCollaborationStatus('connected');
    
    // Clear active users since Yjs awareness will handle this
    setActiveUsers([]);
    
    console.log('[LetterEditor] Yjs collaboration mode - Supabase Realtime disabled');

    return () => {
      setCollaborationStatus('disconnected');
    };
  }, [isOpen, user, letter?.id]);

  const fetchContacts = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, organization, private_street, private_house_number, private_postal_code, private_city, private_country, business_street, business_house_number, business_postal_code, business_city, business_country')
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
    const contentToSave = immediateContent !== undefined ? immediateContent : latestContentRef.current.content;
    const contentNodesToSave = immediateContentNodes !== undefined ? immediateContentNodes : latestContentRef.current.contentNodes;

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
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
              {letter?.id && (
                <Badge 
                  variant={collaborationStatus === 'connected' ? 'default' : 'outline'} 
                  className="text-xs"
                >
                  {collaborationStatus === 'connected' ? (
                    <><Wifi className="h-3 w-3 mr-1" />Online</>
                  ) : (
                    <><WifiOff className="h-3 w-3 mr-1" />Offline</>
                  )}
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
            
            {/* DIN 5008 Preview Toggle */}
            <Button
              variant={showDINPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDINPreview(!showDINPreview)}
            >
              <Layout className="h-4 w-4 mr-2" />
              Vorschau Brief
            </Button>

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

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Briefdetails Sidebar */}
        <Collapsible 
          open={!sidebarCollapsed} 
          onOpenChange={(open) => setSidebarCollapsed(!open)}
          className="border-r bg-card/30"
        >
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-200 flex flex-col h-full`}>
            {/* Toggle Button */}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="self-end m-2 p-2 flex-shrink-0"
                title={sidebarCollapsed ? "Briefdetails öffnen" : "Briefdetails schließen"}
              >
                {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="flex-1 min-h-0">
              <div className="h-full overflow-y-auto p-4 space-y-4">
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

                     {/* Accordion Groups */}
                    <Accordion type="multiple" defaultValue={["adressat"]} className="w-full">
                      {/* 1. Adressat */}
                      <AccordionItem value="adressat">
                        <AccordionTrigger className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>Adressat</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {/* Enhanced Contact Selection */}
                          <div>
                            <Label>Aus Kontakten wählen</Label>
                            <ContactSelector
                              onSelect={(contact) => {
                                setEditedLetter(prev => ({
                                  ...prev,
                                  contact_id: contact.id,
                                  recipient_name: contact.name,
                                  recipient_address: (contact as any).formatted_address || contact.address || ''
                                }));
                                broadcastContentChange('contact_id', contact.id);
                                broadcastContentChange('recipient_name', contact.name);
                                broadcastContentChange('recipient_address', (contact as any).formatted_address || contact.address || '');
                              }}
                              selectedContactId={editedLetter.contact_id}
                              placeholder="Kontakt aus Adressbuch wählen..."
                            />
                          </div>

                          {/* Manual Recipient Entry */}
                          <div>
                            <Label htmlFor="recipient-name">Name</Label>
                            <Input
                              id="recipient-name"
                              value={editedLetter.recipient_name || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditedLetter(prev => ({ ...prev, recipient_name: value }));
                                broadcastContentChange('recipient_name', value);
                              }}
                              disabled={!canEdit}
                              placeholder="Empfängername"
                            />
                          </div>

                          <div>
                            <Label htmlFor="recipient-address">Adresse</Label>
                            <Textarea
                              id="recipient-address"
                              value={editedLetter.recipient_address || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditedLetter(prev => ({ ...prev, recipient_address: value }));
                                broadcastContentChange('recipient_address', value);
                              }}
                              disabled={!canEdit}
                              placeholder="Straße, Hausnummer&#10;PLZ Ort&#10;Land"
                              rows={4}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* 2. Basisinformationen */}
                      <AccordionItem value="basisinformationen">
                        <AccordionTrigger className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Basisinformationen</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
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
                              value={editedLetter.letter_date ? new Date(editedLetter.letter_date).toISOString().split('T')[0] : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditedLetter(prev => ({ ...prev, letter_date: value }));
                                broadcastContentChange('letter_date', value);
                              }}
                              disabled={!canEdit}
                            />
                          </div>

                          {/* Workflow-Historie - nur anzeigen wenn Letter existiert und Workflow-Daten vorhanden sind */}
                          {letter?.id && (editedLetter.submitted_for_review_at || editedLetter.approved_at || editedLetter.sent_at) && (
                            <div>
                              <Label>Workflow-Historie</Label>
                              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                                {editedLetter.submitted_for_review_at && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-3 w-3" />
                                    <span>Zur Prüfung: {new Date(editedLetter.submitted_for_review_at).toLocaleDateString('de-DE')}</span>
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
                        </AccordionContent>
                      </AccordionItem>

                      {/* 3. Layout */}
                      <AccordionItem value="layout">
                        <AccordionTrigger className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          <span>Layout</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {/* Pagination Toggle */}
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
                                
                                // Trigger autosave when pagination changes
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

                          {/* Sender Information Selection */}
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

                          {/* Information Blocks Selection */}
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

                          {/* Template Selection */}
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
                        </AccordionContent>
                      </AccordionItem>

                      {/* 4. Anlagen */}
                      <AccordionItem value="anlagen">
                        <AccordionTrigger className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Anlagen</span>
                        </AccordionTrigger>
                        <AccordionContent>
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
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

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

                {/* ... keep existing code (workflow tracking, proofreading comments) */}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Main Editor */}
        <div className="flex-1 p-6 overflow-auto">
          {showDINPreview ? (
            /* Enhanced DIN 5008 Preview with Zoom Controls */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">DIN 5008 Vorschau</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}
                  >
                    -
                  </Button>
                  <span className="text-sm px-2 min-w-[60px] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}
                  >
                    +
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewZoom(1.0)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-white overflow-auto">
                <div style={{ 
                  transform: `scale(${previewZoom})`, 
                  transformOrigin: 'top left',
                  width: `${100 / previewZoom}%`
                }}>
                  <DIN5008LetterLayout
                    template={currentTemplate}
                    senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
                    informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))}
                    recipientAddress={editedLetter.recipient_address ? {
                      name: editedLetter.recipient_name,
                      address: editedLetter.recipient_address
                    } : null}
                    subject={editedLetter.subject}
                    letterDate={editedLetter.letter_date}
                    referenceNumber={editedLetter.reference_number}
                    content={editedLetter.content || ''}
                    attachments={attachments}
                    showPagination={showPagination}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Regular Editor */
            <div className="max-w-full space-y-6">
              {/* Title */}
              <div>
                <Input
                  value={editedLetter.title || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditedLetter(prev => ({ ...prev, title: value, subject: value }));
                    // Broadcasting disabled - Yjs handles synchronization
                  }}
                  disabled={!canEdit}
                  className="text-2xl font-bold border-none px-0 focus-visible:ring-0 bg-transparent"
                  placeholder="Briefbetreff"
                />
              </div>

              {/* Enhanced Lexical Editor with Collaboration */}
              <div className="relative">
                <EnhancedLexicalEditor
                  content={editedLetter.content || ''}
                  contentNodes={editedLetter.content_nodes}
                   onChange={(content, contentNodes) => {
                     if (isUpdatingFromRemoteRef.current || !canEdit) return;
                     
                     console.log('📝 [LetterEditor] Content changed:', { 
                       plainTextLength: content?.length, 
                       hasJsonContent: !!contentNodes,
                       jsonLength: contentNodes?.length,
                       contentPreview: content?.slice(0, 50),
                       jsonPreview: contentNodes?.slice(0, 100) || 'null'
                     });
                     
                     // Validate content before processing to prevent corruption
                     if (content && content.includes('{"root":{"children"') && content.split('{"root":{"children"').length > 2) {
                       console.error('🚨 Rejected corrupted content in onChange handler');
                       return;
                     }
                     
                     const processedContentNodes = contentNodes && contentNodes.trim() !== '' ? contentNodes : null;
                     
                     // Update the ref with latest content for immediate access
                     latestContentRef.current = {
                       content: content?.trim() || '',
                       contentNodes: processedContentNodes
                     };
                     
                     setEditedLetter(prev => ({
                       ...prev,
                       content: content?.trim() || '',
                       content_nodes: processedContentNodes
                     }));
                     
                      // NOTE: Content synchronization is handled by Yjs in real-time
                      // Auto-save to DB happens in background (every 3s) as backup
                      // No need for immediate DB save here - Yjs is the primary sync mechanism
                   }}
                  placeholder="Hier können Sie Ihren Brief verfassen..."
                  documentId={letter?.id}
                  enableCollaboration={!!letter?.id}
                  useYjsCollaboration={true}
                  showToolbar={true}
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