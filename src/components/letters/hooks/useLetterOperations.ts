import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Letter, LetterTemplate } from '../types';
import { canTransitionStatus, STATUS_LABELS } from '../types';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';

type LetterAttachment = Database['public']['Tables']['letter_attachments']['Row'];

interface UseLetterOperationsOptions {
  letter?: Letter;
  editedLetter: Partial<Letter>;
  setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>>;
  canEdit: boolean;
  userId?: string;
  tenantId?: string;
  showPagination: boolean;
  latestContentRef: React.MutableRefObject<{ content: string; contentNodes?: any }>;
  isUpdatingFromRemoteRef: React.MutableRefObject<boolean>;
  pendingMentionsRef: React.MutableRefObject<Set<string>>;
  onSave: () => void;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setLastSaved: React.Dispatch<React.SetStateAction<Date | null>>;
  setIsProofreadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAssignmentDialog: React.Dispatch<React.SetStateAction<boolean>>;
  fetchComments: () => void;
  fetchCollaborators: () => void;
  senderInfos: any[];
  informationBlocks: any[];
}

export function useLetterOperations(opts: UseLetterOperationsOptions) {
  const { toast } = useToast();
  const {
    letter, editedLetter, setEditedLetter, canEdit, userId, tenantId,
    showPagination, latestContentRef, isUpdatingFromRemoteRef, pendingMentionsRef,
    onSave, setSaving, setLastSaved, setIsProofreadingMode, setShowAssignmentDialog,
    fetchComments, fetchCollaborators, senderInfos, informationBlocks,
  } = opts;

  const broadcastContentChange = useCallback((_field: string, _value: string) => {
    // Yjs handles all real-time synchronization
  }, []);

  const handleAutoSave = useCallback(async (immediateContent?: string, immediateContentNodes?: string) => {
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;

    const contentToSave = immediateContent !== undefined ? immediateContent : latestContentRef.current.content || editedLetter.content;
    const contentNodesToSave = immediateContentNodes !== undefined ? immediateContentNodes : latestContentRef.current.contentNodes || editedLetter.content_nodes;

    if (contentToSave && contentToSave.includes('{"root":{"children"') && contentToSave.split('{"root":{"children"').length > 2) {
      debugConsole.error('Detected corrupted content, aborting save');
      toast({ title: 'Inhalt beschädigt', description: 'Der Inhalt scheint beschädigt zu sein. Bitte laden Sie die Seite neu.', variant: 'destructive', duration: 5000 });
      return;
    }

    setSaving(true);
    try {
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
          salutation_override: editedLetter.salutation_override || null,
          closing_formula: editedLetter.closing_formula || null,
          closing_name: editedLetter.closing_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', letter.id);
      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      debugConsole.error('Error auto-saving letter:', error);
      toast({ title: 'Auto-Speichern fehlgeschlagen', description: 'Änderungen konnten nicht gespeichert werden.', variant: 'destructive', duration: 3000 });
    } finally {
      setTimeout(() => setSaving(false), 200);
    }
  }, [canEdit, letter?.id, editedLetter, showPagination, latestContentRef, isUpdatingFromRemoteRef, setSaving, setLastSaved, toast]);

  const handleManualSave = useCallback(async (immediateContent?: string, immediateContentNodes?: string) => {
    if (!canEdit || !tenantId || !userId) return;

    const contentToSave = immediateContent !== undefined ? immediateContent : (latestContentRef.current.content || editedLetter.content || '');
    const contentNodesToSave = immediateContentNodes !== undefined ? immediateContentNodes : (latestContentRef.current.contentNodes || editedLetter.content_nodes || null);

    setSaving(true);
    try {
      if (letter?.id) {
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
            updated_at: new Date().toISOString(),
          })
          .eq('id', letter.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('letters')
          .insert([{
            tenant_id: tenantId,
            created_by: userId,
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
            show_pagination: showPagination,
          }]);
        if (error) throw error;
      }

      setLastSaved(new Date());

      // Send mention notifications
      if (pendingMentionsRef.current.size > 0 && userId) {
        const mentionPromises = Array.from(pendingMentionsRef.current).map(async (mentionedUserId) => {
          if (mentionedUserId === userId) return;
          try {
            await supabase.rpc('create_notification', {
              user_id_param: mentionedUserId,
              type_name: 'document_mention',
              title_param: 'Erwähnung in Brief',
              message_param: `Sie wurden in dem Brief "${editedLetter.title || 'Unbenannt'}" erwähnt`,
              data_param: JSON.stringify({ documentId: letter?.id, documentType: 'letter' }),
              priority_param: 'medium',
            });
          } catch (e) { debugConsole.error('Failed to send mention notification:', e); }
        });
        await Promise.allSettled(mentionPromises);
        pendingMentionsRef.current.clear();
      }

      onSave();
      toast({ title: 'Brief gespeichert', description: 'Ihre Änderungen wurden erfolgreich gespeichert.' });
    } catch (error) {
      debugConsole.error('Error saving letter:', error);
      toast({ title: 'Fehler beim Speichern', description: 'Der Brief konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [canEdit, tenantId, userId, letter?.id, editedLetter, showPagination, latestContentRef, pendingMentionsRef, setSaving, setLastSaved, onSave, toast]);

  const handleStatusTransition = useCallback(async (newStatus: string) => {
    if (!canTransitionStatus(editedLetter.status || 'draft', newStatus)) {
      toast({ title: 'Ungültiger Statuswechsel', description: 'Dieser Statuswechsel ist nicht erlaubt.', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const workflowUpdates: Partial<Letter> = { status: newStatus as Letter['status'] };

    if (newStatus === 'pending_approval' && !editedLetter.workflow_locked) {
      workflowUpdates.submitted_for_review_at = now;
      workflowUpdates.submitted_for_review_by = userId;
    }
    if (newStatus === 'approved' && !editedLetter.workflow_locked) {
      workflowUpdates.approved_at = now;
      workflowUpdates.approved_by = userId;
    }
    if (newStatus === 'sent') {
      if (!editedLetter.workflow_locked) {
        workflowUpdates.sent_at = now;
        workflowUpdates.sent_by = userId;
      }
      workflowUpdates.workflow_locked = true;
      workflowUpdates.sent_date = new Date().toISOString().split('T')[0];
    }

    const isCreator = userId === letter?.created_by;
    if (newStatus === 'pending_approval' && isCreator) {
      setShowAssignmentDialog(true);
      return;
    }

    setEditedLetter(prev => ({ ...prev, ...workflowUpdates }));

    if (letter?.id) {
      try {
        const { error } = await supabase
          .from('letters')
          .update({ ...workflowUpdates, updated_at: now })
          .eq('id', letter.id);
        if (error) throw error;

        if (newStatus === 'sent') {
          try {
            const { archiveLetter } = await import('@/utils/letterArchiving');
            const archiveResult = await archiveLetter(letter as any, userId!);
            toast({
              title: archiveResult ? 'Brief versendet und archiviert' : 'Brief versendet',
              description: archiveResult
                ? 'Brief wurde versendet und automatisch in die Dokumentenverwaltung übernommen.'
                : 'Brief wurde als versendet markiert. Archivierung wird im Hintergrund verarbeitet.',
            });
          } catch (archiveError) {
            debugConsole.error('Archive process error:', archiveError);
            toast({ title: 'Archivierungsfehler', description: 'Der Brief wurde versendet, aber die Archivierung ist fehlgeschlagen.', variant: 'destructive' });
          }
        }
      } catch (error) {
        debugConsole.error('Error updating workflow tracking:', error);
        toast({ title: 'Fehler beim Workflow-Update', description: 'Die Workflow-Daten konnten nicht gespeichert werden.', variant: 'destructive' });
      }
    }

    if (newStatus === 'review' || newStatus === 'pending_approval') setIsProofreadingMode(true);
    if (newStatus === 'approved' || newStatus === 'sent' || newStatus === 'draft') setIsProofreadingMode(false);

    toast({ title: 'Status geändert', description: `Status wurde zu "${STATUS_LABELS[newStatus]}" geändert.` });
  }, [editedLetter, letter, userId, canEdit, setEditedLetter, setIsProofreadingMode, setShowAssignmentDialog, toast]);

  const handleAddComment = useCallback(async (content: string) => {
    if (!letter?.id || !userId) return;
    try {
      const { error } = await supabase
        .from('letter_comments')
        .insert([{ letter_id: letter.id, user_id: userId, content, comment_type: 'comment' }]);
      if (error) throw error;
      fetchComments();
      toast({ title: 'Kommentar hinzugefügt', description: 'Der Kommentar wurde erfolgreich hinzugefügt.' });
    } catch (error) {
      debugConsole.error('Error adding comment:', error);
      toast({ title: 'Fehler', description: 'Der Kommentar konnte nicht hinzugefügt werden.', variant: 'destructive' });
    }
  }, [letter?.id, userId, fetchComments, toast]);

  const handleReturnLetter = useCallback(async () => {
    if (!letter?.id || !userId) return;
    try {
      setEditedLetter(prev => ({ ...prev, status: 'draft' }));
      setIsProofreadingMode(true);
      toast({ title: 'Brief zurückgegeben', description: 'Der Brief wurde zur Bearbeitung zurückgegeben.' });
    } catch (error) {
      debugConsole.error('Error returning letter:', error);
      toast({ title: 'Fehler', description: 'Der Brief konnte nicht zurückgegeben werden.', variant: 'destructive' });
    }
  }, [letter?.id, userId, setEditedLetter, setIsProofreadingMode, toast]);

  const handleAttachmentNameChange = useCallback(async (
    attachmentId: string,
    displayName: string,
    attachments: LetterAttachment[],
    onRenameSuccess?: () => void | Promise<void>,
  ) => {
    const existingAttachment = attachments.find((a) => a.id === attachmentId);
    if (!existingAttachment) return;
    const sanitizedDisplayName = displayName.trim();
    const currentDisplayName = (existingAttachment.display_name || '').trim();
    if (sanitizedDisplayName === currentDisplayName) return;

    try {
      const { error } = await supabase
        .from('letter_attachments')
        .update({ display_name: sanitizedDisplayName || null, updated_at: new Date().toISOString() })
        .eq('id', attachmentId);
      if (error) throw error;
      await onRenameSuccess?.();
    } catch (error) {
      debugConsole.error('Error updating attachment display name:', error);
      toast({ title: 'Fehler beim Umbenennen', description: 'Der Anlagenname konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  }, [toast]);

  const applyTemplateDefaults = useCallback((template: LetterTemplate) => {
    setEditedLetter(prev => {
      const updates: Partial<Letter> = {};
      if (!prev.sender_info_id && template.default_sender_id) {
        updates.sender_info_id = template.default_sender_id;
      }
      if ((!prev.information_block_ids || prev.information_block_ids.length === 0) && template.default_info_blocks) {
        updates.information_block_ids = template.default_info_blocks;
      }
      if (template.name === 'Leerer Brief' || template.id === 'blank') {
        if (!prev.sender_info_id) {
          const defaultSender = senderInfos.find(info => info.is_default);
          if (defaultSender) updates.sender_info_id = defaultSender.id;
        }
        if (!prev.information_block_ids || prev.information_block_ids.length === 0) {
          const defaultBlocks = informationBlocks.filter(block => block.is_default);
          if (defaultBlocks.length > 0) updates.information_block_ids = defaultBlocks.map(b => b.id);
        }
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [setEditedLetter, senderInfos, informationBlocks]);

  return {
    broadcastContentChange,
    handleAutoSave,
    handleManualSave,
    handleStatusTransition,
    handleAddComment,
    handleReturnLetter,
    handleAttachmentNameChange,
    applyTemplateDefaults,
  };
}
