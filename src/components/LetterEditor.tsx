import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText, Send, Download, Calendar, User, MapPin, MessageSquare, CheckCircle, Clock, ArrowRight, UserPlus, RotateCcw, Layout, Building, Info, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import FloatingTextToolbar from './FloatingTextToolbar';
import ReviewAssignmentDialog from './ReviewAssignmentDialog';
import LetterAttachmentManager from './letters/LetterAttachmentManager';
import { DIN5008LetterLayout } from './letters/DIN5008LetterLayout';
import { ContactSelector } from './ContactSelector';

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
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
  const [selectedText, setSelectedText] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
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
  const [showPagination, setShowPagination] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const channelRef = useRef<any>(null);
  const broadcastTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);

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
      console.log('=== END LETTER DATA ===');
      
      setEditedLetter({
        ...letter,
        content_html: letter.content_html || ''
      });
      // Set proofreading mode based on actual letter status
      setIsProofreadingMode(letter.status === 'review');
      
      // If it's a new letter with template data, we'll apply defaults after template loads
      if (!letter.id && letter.template_id) {
        console.log('New letter with template, will apply defaults after template loads');
      }
    } else {
      // New letter - always start fresh
      console.log('Creating new letter - no letter prop provided');
      setEditedLetter({
        title: '',
        content: '',
        content_html: '',
        recipient_name: '',
        recipient_address: '',
        status: 'draft'
      });
      // Reset proofreading mode for new letters
      setIsProofreadingMode(false);
    }
  }, [letter]);

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

  // Auto-save functionality with improved performance
  useEffect(() => {
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (!isUpdatingFromRemoteRef.current && letter?.id) {
        handleAutoSave();
      }
    }, 3000); // Increased from 1000ms to 3000ms for better performance

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedLetter, canEdit, letter?.id]);

  // Real-time collaboration setup
  useEffect(() => {
    if (!isOpen || !user || !letter?.id) return;

    const channel = supabase.channel(`letter-${letter.id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state).map(key => {
          const presence = (state[key][0] as any);
          return presence?.user_id;
        }).filter(u => u && u !== user.id);
        
        setActiveUsers(users);
      })
      .on('broadcast', { event: 'content_change' }, (payload) => {
        const { user_id, field, value, content_html } = payload.payload;
        if (user_id !== user.id) {
          isUpdatingFromRemoteRef.current = true;
          
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          
          setEditedLetter(prev => ({
            ...prev,
            [field]: value,
            ...(content_html && field === 'content' ? { content_html } : {})
          }));
          
          setTimeout(() => {
            isUpdatingFromRemoteRef.current = false;
          }, 500);
          
          toast({
            title: "Live-Update",
            description: `Ein anderer Benutzer bearbeitet gerade...`,
            duration: 1500,
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();
          
          await channel.track({
            user_id: user.id,
            user_name: profile?.display_name || 'Unbekannt',
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
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
            // Use the same PDF generation as LetterPDFExport for 1:1 identical PDFs
            const { generateLetterPDF } = await import('@/utils/letterPDFGenerator');
            
            console.log('Generating PDF for archiving...');
            const pdfResult = await generateLetterPDF(letter);
            
            if (pdfResult) {
              const { blob: pdfBlob, filename } = pdfResult;
              console.log('PDF generated successfully:', filename);
              
              // Upload PDF to storage
              const filePath = `archived_letters/${filename}`;
              const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, pdfBlob, {
                  contentType: 'application/pdf',
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw uploadError;
              }
              console.log('PDF uploaded to storage:', filePath);

              // Create document record in database
              const { data: documentData, error: dbError } = await supabase
                .from('documents')
                .insert({
                  user_id: user?.id,
                  tenant_id: currentTenant?.id,
                  title: `Archivierter Brief: ${letter.title}`,
                  description: `Automatisch archiviert am ${new Date().toLocaleDateString('de-DE')}`,
                  file_name: filename,
                  file_path: filePath,
                  file_size: pdfBlob.size,
                  file_type: 'application/pdf',
                  category: 'correspondence',
                  status: 'archived',
                  document_type: 'archived_letter',
                  source_letter_id: letter.id,
                  archived_attachments: []
                })
                .select()
                .single();

              if (dbError) {
                console.error('Document creation error:', dbError);
                throw dbError;
              }
              
              console.log('Document record created:', documentData?.id);
              
              toast({
                title: "Brief versendet und archiviert",
                description: `Der Brief wurde automatisch als PDF archiviert: ${filename}`,
              });
            } else {
              console.error('PDF generation failed');
              toast({
                title: "Archivierungsfehler",
                description: "PDF konnte nicht generiert werden.",
                variant: "destructive",
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
    if (!channelRef.current || !user) return;
    
    if (broadcastTimeoutRef.current) {
      clearTimeout(broadcastTimeoutRef.current);
    }
    
    broadcastTimeoutRef.current = setTimeout(() => {
      const payload: any = {
        type: 'content_change',
        field,
        value,
        user_id: user.id,
        user_name: user.user_metadata?.display_name || 'Unbekannt',
        timestamp: new Date().toISOString()
      };

      if (htmlValue && field === 'content') {
        payload.content_html = htmlValue;
      }
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'content_change',
        payload
      });
    }, 1000); // Increased from 500ms to 1000ms for better performance
  };

  const handleSelectionChange = (formats: string[] = []) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || "";
    
    setSelectedText(selectedText);
    setActiveFormats(formats);
    setShowToolbar(selectedText.length > 0);
  };

  const handleFormatText = (format: string) => {
    if (!selectedText || !richTextEditorRef.current) return;
    
    richTextEditorRef.current.formatSelection(format);
    setShowToolbar(false);
    setSelectedText('');
  };

  const handleAutoSave = async () => {
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;
    
    setSaving(true);
    try {
      // Don't auto-save status changes - only content and metadata
      const { error } = await supabase
        .from('letters')
        .update({
          title: editedLetter.title,
          content: editedLetter.content,
          content_html: editedLetter.content_html,
          recipient_name: editedLetter.recipient_name,
          recipient_address: editedLetter.recipient_address,
          contact_id: editedLetter.contact_id,
          template_id: editedLetter.template_id,
          subject: editedLetter.subject,
          reference_number: editedLetter.reference_number,
          sender_info_id: editedLetter.sender_info_id,
          information_block_ids: editedLetter.information_block_ids,
          letter_date: editedLetter.letter_date,
          // Removed status from auto-save to prevent conflicts
          updated_at: new Date().toISOString()
        })
        .eq('id', letter.id);

      if (error) throw error;

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error auto-saving letter:', error);
    } finally {
      setTimeout(() => setSaving(false), 200);
    }
  };

  const handleManualSave = async () => {
    if (!canEdit || !currentTenant || !user) return;

    setSaving(true);
    try {
      if (letter?.id) {
        // Update existing letter
        const { error } = await supabase
          .from('letters')
          .update({
            title: editedLetter.title,
            content: editedLetter.content,
            content_html: editedLetter.content_html,
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
            content: editedLetter.content || '',
            content_html: editedLetter.content_html || '',
            recipient_name: editedLetter.recipient_name,
            recipient_address: editedLetter.recipient_address,
            contact_id: editedLetter.contact_id,
            template_id: editedLetter.template_id,
            subject: editedLetter.subject,
            reference_number: editedLetter.reference_number,
            sender_info_id: editedLetter.sender_info_id,
            information_block_ids: editedLetter.information_block_ids,
            letter_date: editedLetter.letter_date,
            status: editedLetter.status || 'draft'
          });

        if (error) throw error;
      }

      setLastSaved(new Date());
      onSave();
      toast({
        title: "Brief gespeichert",
        description: "Ihre Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving letter:', error);
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
    editedLetter.status !== letter.status
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
              DIN 5008 Vorschau
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
              onClick={handleManualSave} 
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
            <CardContent className="space-y-4">
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

              <Separator />

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

              <Separator />

              {/* DIN 5008 Fields */}
              <div>
                <Label htmlFor="subject">Betreff</Label>
                <Input
                  id="subject"
                  value={editedLetter.subject || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditedLetter(prev => ({ ...prev, subject: value }));
                    broadcastContentChange('subject', value);
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

              <div className="flex items-center space-x-2">
                <Switch
                  id="pagination"
                  checked={showPagination}
                  onCheckedChange={setShowPagination}
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

              <Separator />

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

              <Separator />

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <div className="flex items-center gap-2 mb-2">
                  {React.createElement(statusIcons[editedLetter.status || 'draft'], { 
                    className: "h-4 w-4 text-primary" 
                  })}
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
                    className="justify-start text-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Brief zurückgeben
                  </Button>
                )}
                
                {/* Zurück-Button für sent Status (immer sichtbar) */}
                {editedLetter.status === 'sent' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusTransition('approved')}
                    className="justify-start text-muted-foreground"
                  >
                    Zurück zu Genehmigt
                  </Button>
                )}
                
                {/* Show assigned reviewers in review status */}
                {editedLetter.status === 'review' && collaborators.length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Zugewiesene Prüfer:</p>
                    <div className="space-y-1">
                      {collaborators.map((collab) => (
                        <div key={collab.id} className="text-sm flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {collab.profiles.display_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sending Details - only show for approved/sent letters */}
              {(editedLetter.status === 'approved' || editedLetter.status === 'sent') && (
                <>
                  <Separator />
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Workflow Tracking Section */}
          {letter?.id && (editedLetter.submitted_for_review_at || editedLetter.approved_at || editedLetter.sent_at) && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Workflow-Verlauf
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editedLetter.submitted_for_review_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="font-medium">Zur Prüfung weitergeleitet</div>
                      <div className="text-muted-foreground">
                        {new Date(editedLetter.submitted_for_review_at).toLocaleString('de-DE')}
                        {editedLetter.submitted_for_review_by && (
                          <span> • von {userProfiles[editedLetter.submitted_for_review_by]?.display_name || 'Unbekannter Benutzer'}</span>
                        )}
                        {editedLetter.submitted_to_user && (
                          <span> • an {userProfiles[editedLetter.submitted_to_user]?.display_name || 'Unbekannter Benutzer'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {editedLetter.approved_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="font-medium">Genehmigt</div>
                      <div className="text-muted-foreground">
                        {new Date(editedLetter.approved_at).toLocaleString('de-DE')}
                        {editedLetter.approved_by && (
                          <span> • von {userProfiles[editedLetter.approved_by]?.display_name || 'Unbekannter Benutzer'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {editedLetter.sent_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="font-medium">Als versendet markiert</div>
                      <div className="text-muted-foreground">
                        {new Date(editedLetter.sent_at).toLocaleString('de-DE')}
                        {editedLetter.sent_by && (
                          <span> • von {userProfiles[editedLetter.sent_by]?.display_name || 'Unbekannter Benutzer'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {editedLetter.workflow_locked && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Workflow gesperrt</span>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">
                      Die Workflow-Daten sind fest eingestellt und können nicht mehr geändert werden.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Proofreading Comments Section - nur bei draft/review */}
          {isProofreadingMode && editedLetter.status !== 'approved' && editedLetter.status !== 'sent' && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Kommentare
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Kommentare. Wählen Sie Text im Brief aus und klicken Sie auf "Kommentar hinzufügen".
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">
                          {comment.profiles?.display_name || 'Unbekannt'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                      {comment.resolved && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Erledigt
                        </Badge>
                      )}
                    </div>
                  ))
                )}
                
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCommentDialog(true)}
                    className="w-full"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Kommentar hinzufügen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

              {/* Attachment Manager */}
              {letter?.id && (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Anlagen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LetterAttachmentManager
                      letterId={letter.id}
                      attachments={attachments}
                      onAttachmentUpdate={fetchAttachments}
                      readonly={!canEdit}
                    />
                  </CardContent>
                </Card>
              )}
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
                    content={editedLetter.content_html || editedLetter.content || ''}
                    attachments={attachments}
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
                    setEditedLetter(prev => ({ ...prev, title: value }));
                    broadcastContentChange('title', value);
                  }}
                  disabled={!canEdit}
                  className="text-2xl font-bold border-none px-0 focus-visible:ring-0 bg-transparent"
                  placeholder="Briefbetreff"
                />
              </div>

              {/* Rich Text Editor */}
              <div className="relative">
                <RichTextEditor
                  ref={richTextEditorRef}
                  value={editedLetter.content || ''}
                  onChange={(content, contentHtml) => {
                    setEditedLetter(prev => ({ 
                      ...prev, 
                      content, 
                      content_html: contentHtml || '' 
                    }));
                    broadcastContentChange('content', content, contentHtml);
                  }}
                  onSelectionChange={handleSelectionChange}
                  placeholder="Hier können Sie Ihren Brief verfassen..."
                  disabled={!canEdit}
                />
                
                {/* Floating toolbar temporarily disabled for type compatibility */}
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
          broadcastContentChange('status', newStatus);
          
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
          broadcastContentChange('status', newStatus);
          
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