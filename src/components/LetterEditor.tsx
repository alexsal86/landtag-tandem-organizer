import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText, Send, Download, Calendar, User, MapPin, MessageSquare, CheckCircle, Clock, ArrowRight, UserPlus, RotateCcw } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import FloatingTextToolbar from './FloatingTextToolbar';
import ReviewAssignmentDialog from './ReviewAssignmentDialog';

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  status: 'draft' | 'review' | 'approved' | 'sent';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
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
    if (letter) {
      setEditedLetter({
        ...letter,
        content_html: letter.content_html || ''
      });
    } else {
      // New letter
      setEditedLetter({
        title: '',
        content: '',
        content_html: '',
        recipient_name: '',
        recipient_address: '',
        status: 'draft'
      });
    }
  }, [letter]);

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchContacts();
      if (letter?.id) {
        fetchComments();
        fetchCollaborators();
      }
    }
  }, [isOpen, currentTenant, letter?.id]);

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

    // Show assignment dialog when transitioning to review
    if (newStatus === 'review' && isCreator) {
      console.log('Opening assignment dialog for review status', { isCreator, newStatus });
      setShowAssignmentDialog(true);
      return;
    }

    setEditedLetter(prev => ({
      ...prev,
      status: newStatus as any,
      ...(newStatus === 'sent' ? { sent_date: new Date().toISOString() } : {})
    }));

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
      const { error } = await supabase
        .from('letters')
        .update({
          title: editedLetter.title,
          content: editedLetter.content,
          content_html: editedLetter.content_html,
          recipient_name: editedLetter.recipient_name,
          recipient_address: editedLetter.recipient_address,
          contact_id: editedLetter.contact_id,
          status: editedLetter.status,
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
        {/* Recipient Info Sidebar */}
        <div className="w-80 border-r bg-card/30 p-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Empfänger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact Selection */}
              <div>
                <Label htmlFor="contact-select">Aus Kontakten wählen</Label>
                <Select onValueChange={handleContactSelect} disabled={!canEdit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kontakt auswählen..." />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} {contact.organization ? `(${contact.organization})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>

        {/* Main Editor */}
        <div className="flex-1 p-6 overflow-auto">
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
        onReviewAssigned={() => {
          console.log('Assignment completed, proceeding with status change');
          fetchCollaborators();
          setShowAssignmentDialog(false);
          setEditedLetter(prev => ({ ...prev, status: 'review' as any }));
          setIsProofreadingMode(true);
          broadcastContentChange('status', 'review');
          toast({
            title: "Status geändert",
            description: "Brief wurde zur Prüfung weitergeleitet.",
          });
        }}
        onSkipReview={() => {
          console.log('Skipping review, going directly to approved');
          setShowAssignmentDialog(false);
          setEditedLetter(prev => ({ ...prev, status: 'approved' as any }));
          setIsProofreadingMode(false);
          broadcastContentChange('status', 'approved');
          toast({
            title: "Status geändert",
            description: "Brief wurde direkt genehmigt.",
          });
        }}
      />
    </div>
  );
};

export default LetterEditor;