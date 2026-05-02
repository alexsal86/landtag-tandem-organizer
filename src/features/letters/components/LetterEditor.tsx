import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Save, X, Users, UserPlus, Eye, EyeOff, AlertTriangle, Edit3, FileText, MessageSquare, Ruler, Paperclip, Settings, Layout, Building, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EnhancedLexicalEditor from '@/components/lexical/EnhancedLexicalEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

import ReviewAssignmentDialog from '@/components/admin/ReviewAssignmentDialog';
import UserAssignmentDialog from '@/components/admin/UserAssignmentDialog';
import { DIN5008LetterLayout } from '@/components/letters/DIN5008LetterLayout';
import { LetterEditorCanvas } from '@/components/letters/LetterEditorCanvas';
import { LetterEditorToolbar } from '@/components/letters/LetterEditorToolbar';
import { buildVariableMap, substituteVariables, substituteBlockLines, isLineMode } from '@/lib/letterVariables';
import type { HeaderElement } from '@/components/canvas-engine/types';
import type { BlockLine } from '@/components/letters/BlockLineEditor';

import { useLetterData } from '@/components/letters/hooks/useLetterData';
import { useLetterOperations } from '@/components/letters/hooks/useLetterOperations';
import { debugConsole } from '@/utils/debugConsole';
import LetterBriefDetails from '@/components/letters/LetterBriefDetails';
import LetterCommentDialog from '@/components/letters/LetterCommentDialog';
import {
  type Letter, type LetterTemplate, type Contact,
  type LetterContentNodes,
  DEFAULT_LETTER_FONT_STACK, STATUS_LABELS, extractFontFamilyFromContentNodes,
  formatContactAddress, getNextStatus,
} from '@/components/letters/types';
import type { LetterLayoutSettings } from '@/types/letterLayout';

interface LetterEditorProps {
  letter?: Letter;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const LetterEditor: React.FC<LetterEditorProps> = ({ letter, isOpen, onClose, onSave }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [editedLetter, setEditedLetter] = useState<Partial<Letter>>({
    title: '', content: '', content_html: '', content_nodes: null,
    recipient_name: '', recipient_address: '', status: 'draft', ...letter,
  });

  const [currentTemplate, setCurrentTemplate] = useState<LetterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isProofreadingMode, setIsProofreadingMode] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showDINPreview, setShowDINPreview] = useState(false);
  const [showBriefDetails, setShowBriefDetails] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1.0);
  const [showPagination, setShowPagination] = useState(true);
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const [showTextSplitEditor, setShowTextSplitEditor] = useState(true);
  const [draftContent, setDraftContent] = useState('');
  const [draftContentNodes, setDraftContentNodes] = useState<LetterContentNodes>(null);
  const [draftContentHtml, setDraftContentHtml] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isUpdatingFromRemoteRef = useRef(false);
  const latestContentRef = useRef<{ content: string; contentNodes?: LetterContentNodes }>({ content: '' });
  const pendingMentionsRef = useRef<Set<string>>(new Set());
  const draftInitializedRef = useRef(false);
  const liveSyncTimerRef = useRef<NodeJS.Timeout>(null);

  const {
    contacts, templates, senderInfos, informationBlocks, attachments,
    collaborators, comments, userProfiles,
    fetchAttachments, fetchComments, fetchCollaborators, fetchWorkflowUserProfiles,
  } = useLetterData({ isOpen, tenantId: currentTenant?.id, letterId: letter?.id });

  const [showWriterDialog, setShowWriterDialog] = useState(false);

  const isCreator = user?.id === letter?.created_by;
  const isReviewer = collaborators.some(c => c.user_id === user?.id);
  const isWriter = collaborators.some(c => c.user_id === user?.id && c.role === 'writer');
  const currentStatus = editedLetter.status || 'draft';
  const canEdit = !letter || (currentStatus !== 'sent' && (
    (isCreator && (currentStatus === 'draft' || currentStatus === 'revision_requested' || currentStatus === 'approved')) ||
    (isWriter && currentStatus === 'draft') ||
    (isReviewer && (currentStatus === 'review' || currentStatus === 'pending_approval' || currentStatus === 'approved'))
  ));

  const ops = useLetterOperations({
    letter, editedLetter, setEditedLetter, canEdit,
    userId: user?.id, tenantId: currentTenant?.id,
    showPagination, latestContentRef, isUpdatingFromRemoteRef, pendingMentionsRef,
    onSave, setSaving, setLastSaved, setIsProofreadingMode, setShowAssignmentDialog,
    fetchComments, fetchCollaborators, senderInfos, informationBlocks,
  });
  const {
    handleAutoSave,
    handleManualSave,
    handleStatusTransition,
    handleReturnLetter,
    handleAddComment,
    handleAttachmentNameChange,
    broadcastContentChange,
    applyTemplateDefaults,
  } = ops;

  // Initialize draft content
  useEffect(() => {
    if (showTextSplitEditor && !draftInitializedRef.current) {
      draftInitializedRef.current = true;
      setDraftContent(editedLetter.content || '');
      setDraftContentNodes(editedLetter.content_nodes || null);
      setDraftContentHtml(editedLetter.content_html || null);
    }
  }, [showTextSplitEditor]);

  const applyDraftToPreview = useCallback(() => {
    latestContentRef.current = { content: draftContent?.trim() || '', contentNodes: draftContentNodes || null };
    setEditedLetter(prev => ({ ...prev, content: draftContent?.trim() || '', content_nodes: draftContentNodes || null, content_html: draftContentHtml || undefined }));
  }, [draftContent, draftContentNodes, draftContentHtml]);

  useEffect(() => {
    if (!showTextSplitEditor || !draftInitializedRef.current) return;
    if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current);
    liveSyncTimerRef.current = setTimeout(() => applyDraftToPreview(), 300);
    return () => { if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current); };
  }, [draftContent, draftContentNodes, draftContentHtml, showTextSplitEditor, applyDraftToPreview]);

  useEffect(() => {
    if (letter) {
      draftInitializedRef.current = false;
      setEditedLetter({ ...letter, content_html: letter.content_html || '', content_nodes: letter.content_nodes || null });
      setDraftContent(letter.content || ''); setDraftContentNodes(letter.content_nodes || null); setDraftContentHtml(letter.content_html || null);
      latestContentRef.current = { content: letter.content || '', contentNodes: letter.content_nodes || null };
      draftInitializedRef.current = true;
      setIsProofreadingMode(letter.status === 'review' || letter.status === 'pending_approval');
      setShowPagination(letter.show_pagination || false);
    } else {
      const currentDate = new Date().toISOString().split('T')[0];
      setEditedLetter({ title: '', content: '', content_html: '', content_nodes: null, recipient_name: '', recipient_address: '', status: 'draft', letter_date: currentDate });
      setDraftContent(''); setDraftContentNodes(null); setDraftContentHtml(null);
      draftInitializedRef.current = true; setIsProofreadingMode(false); setShowPagination(true);
    }
  }, [letter]);

  useEffect(() => { if (letter && letter.show_pagination !== undefined) setShowPagination(letter.show_pagination); }, [letter?.show_pagination]);
  useEffect(() => { if (isOpen && currentTenant && letter?.id) fetchWorkflowUserProfiles(letter); }, [isOpen, currentTenant, letter?.id]);
  const fetchCurrentTemplate = useCallback(async () => {
    const templateId = editedLetter?.template_id || letter?.template_id;
    if (!templateId) return;
    try {
      const { data, error } = await supabase.from('letter_templates').select('*').eq('id', templateId).single();
      if (error) throw error;
      setCurrentTemplate(data as LetterTemplate);
      if (data) applyTemplateDefaults(data as LetterTemplate);
    } catch (error) {
      debugConsole.error('Error fetching current template:', error);
    }
  }, [editedLetter?.template_id, letter?.template_id, applyTemplateDefaults]);

  useEffect(() => {
    if (isOpen && currentTenant && senderInfos.length > 0 && informationBlocks.length > 0) {
      void fetchCurrentTemplate();
    }
  }, [isOpen, currentTenant, letter?.id, senderInfos.length, informationBlocks.length, fetchCurrentTemplate]);

  useEffect(() => {
    if (!canEdit || isUpdatingFromRemoteRef.current || !letter?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { if (!isUpdatingFromRemoteRef.current && letter?.id) void handleAutoSave(); }, 3000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editedLetter, canEdit, letter?.id, showPagination, handleAutoSave]);

  const handleTemplateChange = async (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setEditedLetter(prev => ({ ...prev, template_id: undefined, sender_info_id: '', information_block_ids: [] }));
      setCurrentTemplate(null); return;
    }
    const template = templates.find(t => t.id === templateId);
    if (template) { setEditedLetter(prev => ({ ...prev, template_id: templateId })); setCurrentTemplate(template); applyTemplateDefaults(template); }
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const hasBusinessAddress = !!(contact.business_street || contact.business_postal_code || contact.business_city);
      setEditedLetter(prev => ({ ...prev, contact_id: contactId, recipient_name: contact.name, recipient_address: formatContactAddress(contact) }));
    }
  };

  const hasUnsavedChanges = !isUpdatingFromRemoteRef.current && letter && (
    editedLetter.title !== letter.title || editedLetter.content !== letter.content ||
    editedLetter.recipient_name !== letter.recipient_name || editedLetter.recipient_address !== letter.recipient_address ||
    editedLetter.subject !== letter.subject || editedLetter.reference_number !== letter.reference_number ||
    editedLetter.sender_info_id !== letter.sender_info_id ||
    JSON.stringify(editedLetter.information_block_ids || []) !== JSON.stringify(letter.information_block_ids || []) ||
    editedLetter.letter_date !== letter.letter_date || editedLetter.status !== letter.status ||
    showPagination !== (letter.show_pagination || false)
  );

  const substitutedBlocks = useMemo(() => {
    if (!currentTemplate) return { canvasBlocks: {}, lineBlocks: {} };
    const blockContent = currentTemplate?.layout_settings?.blockContent;
    if (!blockContent || typeof blockContent !== 'object') return { canvasBlocks: {}, lineBlocks: {} };
    const sender = senderInfos.find(s => s.id === editedLetter.sender_info_id);
    const contact = contacts.find(c => c.name === editedLetter.recipient_name);
    const infoBlock = informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id));
    const recipientData = contact ? {
      name: contact.name, street: [contact.business_street, contact.business_house_number].filter(Boolean).join(' '),
      postal_code: contact.business_postal_code || '', city: contact.business_city || '',
      country: contact.business_country || '', gender: contact.gender || '', last_name: contact.last_name || contact.name?.split(' ').pop() || '',
    } : editedLetter.recipient_name ? { name: editedLetter.recipient_name, street: '', postal_code: '', city: '', country: '' } : null;
    const varMap = buildVariableMap(
      { subject: editedLetter.subject, letterDate: editedLetter.letter_date, referenceNumber: editedLetter.reference_number },
      sender ? { name: sender.name, organization: sender.organization,
        wahlkreis_street: sender.wahlkreis_street ?? undefined, wahlkreis_house_number: sender.wahlkreis_house_number ?? undefined, wahlkreis_postal_code: sender.wahlkreis_postal_code ?? undefined, wahlkreis_city: sender.wahlkreis_city ?? undefined,
        landtag_street: sender.landtag_street ?? undefined, landtag_house_number: sender.landtag_house_number ?? undefined, landtag_postal_code: sender.landtag_postal_code ?? undefined, landtag_city: sender.landtag_city ?? undefined,
        phone: sender.phone ?? undefined, wahlkreis_email: sender.wahlkreis_email ?? undefined, landtag_email: sender.landtag_email ?? undefined } : null,
      recipientData, infoBlock ? {
        reference: (infoBlock.block_data && typeof infoBlock.block_data === 'object' && !Array.isArray(infoBlock.block_data))
          ? String((infoBlock.block_data as Record<string, unknown>).reference_pattern ?? '')
          : '',
        handler: (infoBlock.block_data && typeof infoBlock.block_data === 'object' && !Array.isArray(infoBlock.block_data))
          ? String((infoBlock.block_data as Record<string, unknown>).contact_name ?? '')
          : '',
        our_reference: ''
      } : null, attachments
    );
    const canvasBlocks: Record<string, HeaderElement[]> = {};
    const lineBlocks: Record<string, BlockLine[]> = {};
    for (const [key, data] of Object.entries(blockContent)) {
      if (isLineMode(data)) lineBlocks[key] = substituteBlockLines(data.lines, varMap);
      else if (Array.isArray(data) && data.length > 0) canvasBlocks[key] = substituteVariables(data as HeaderElement[], varMap);
    }
    return { canvasBlocks, lineBlocks };
  }, [currentTemplate, editedLetter, senderInfos, contacts, informationBlocks, attachments]);

  const templateDefaultFontFamily = useMemo(() => {
    const layoutFontFamily = (currentTemplate?.layout_settings?.content as { fontFamily?: unknown } | undefined)?.fontFamily;
    if (typeof layoutFontFamily === 'string' && layoutFontFamily.trim() !== '') return layoutFontFamily.trim();
    const draftNodesFontFamily = extractFontFamilyFromContentNodes(draftContentNodes);
    if (draftNodesFontFamily) return draftNodesFontFamily;
    const letterNodesFontFamily = extractFontFamilyFromContentNodes(letter?.content_nodes);
    if (letterNodesFontFamily) return letterNodesFontFamily;
    return DEFAULT_LETTER_FONT_STACK;
  }, [currentTemplate, draftContentNodes, letter?.content_nodes]);

  const computedSalutation = useMemo(() => {
    const salutationTemplate = currentTemplate?.layout_settings?.salutation?.template || 'Sehr geehrte Damen und Herren,';
    if (salutationTemplate === '{{anrede}}') {
      const contact = contacts.find(c => c.name === editedLetter.recipient_name);
      const recipientData = contact ? { name: contact.name, gender: contact.gender ?? undefined, last_name: contact.last_name || contact.name?.split(' ').pop() }
        : editedLetter.recipient_name ? { name: editedLetter.recipient_name } : null;
      const varMap = buildVariableMap({ subject: editedLetter.subject }, null, recipientData, null, null);
      return varMap['{{anrede}}'] || 'Sehr geehrte Damen und Herren,';
    }
    return salutationTemplate;
  }, [currentTemplate, editedLetter.recipient_name, contacts]);

  const getLayoutSettings = (): LetterLayoutSettings | undefined => {
    const ls = currentTemplate?.layout_settings;
    if (!ls) return undefined;
    const closingFormula = editedLetter.closing_formula || ls.closing?.formula;
    const closingName = editedLetter.closing_name || ls.closing?.signatureName;
    if (closingFormula || closingName) return { ...ls, closing: { ...(ls.closing || {}), formula: closingFormula || '', signatureName: closingName || '' } };
    return ls;
  };

  const toSerializedContentNodes = (nodes: LetterContentNodes | undefined): string | undefined => {
    if (!nodes) return undefined;
    return typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
  };

  const layoutTemplate = currentTemplate
    ? { ...currentTemplate, layout_settings: currentTemplate.layout_settings ?? undefined }
    : undefined;

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      <LetterEditorToolbar
        letter={letter}
        editedLetter={editedLetter}
        setEditedLetter={setEditedLetter}
        currentTemplate={currentTemplate}
        canEdit={canEdit}
        saving={saving}
        lastSaved={lastSaved}
        hasUnsavedChanges={!!hasUnsavedChanges}
        activeUsers={activeUsers}
        showDINPreview={showDINPreview}
        setShowDINPreview={setShowDINPreview}
        showBriefDetails={showBriefDetails}
        setShowBriefDetails={setShowBriefDetails}
        showPagination={showPagination}
        setShowPagination={setShowPagination}
        attachments={attachments}
        fetchAttachments={fetchAttachments}
        senderInfos={senderInfos}
        informationBlocks={informationBlocks}
        templates={templates}
        computedSalutation={computedSalutation}
        onTemplateChange={handleTemplateChange}
        onAutoSaveSchedule={() => {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => void handleAutoSave(), 1000);
        }}
      />

      {!canEdit && editedLetter.status === 'sent' && (
        <div className="bg-muted p-3 rounded-lg flex items-center gap-2 text-sm mt-3 mx-4">
          <EyeOff className="h-4 w-4" />Dieser Brief ist versendet und kann nicht mehr bearbeitet werden.
        </div>
      )}

      {/* Co-Author button bar */}
      {canEdit && currentStatus === 'draft' && letter?.id && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/20">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowWriterDialog(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" />Mitbearbeiter
          </Button>
        </div>
      )}

      {showBriefDetails && (
        <LetterBriefDetails editedLetter={editedLetter} setEditedLetter={setEditedLetter} canEdit={canEdit} isReviewer={isReviewer} userProfiles={userProfiles}
          onStatusTransition={handleStatusTransition} onReturnLetter={handleReturnLetter} broadcastContentChange={broadcastContentChange} />
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {showDINPreview ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-none flex items-center justify-between p-3 border-b bg-muted/30">
                <h3 className="text-sm font-medium">Druckvorschau (schreibgeschützt)</h3>
                <div className="flex items-center gap-2">
                  <Button variant={showLayoutDebug ? 'default' : 'outline'} size="sm" className="h-7" onClick={() => setShowLayoutDebug(!showLayoutDebug)}><Ruler className="h-3.5 w-3.5 mr-1" />Layout</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))}>-</Button>
                  <span className="text-xs min-w-[40px] text-center">{Math.round(previewZoom * 100)}%</span>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}>+</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewZoom(0.75)}>Reset</Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-muted/50 p-6">
                <div style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center', marginBottom: `${(previewZoom - 1) * 297}mm` }}>
                  <div className="mx-auto" style={{ width: '210mm', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
                    <DIN5008LetterLayout template={layoutTemplate} senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
                      informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id)) ? [informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))!] : undefined}
                      recipientAddress={editedLetter.recipient_address ? { name: editedLetter.recipient_name, address: editedLetter.recipient_address } : undefined}
                      subject={editedLetter.subject} letterDate={editedLetter.letter_date} referenceNumber={editedLetter.reference_number}
                      content={editedLetter.content_html || editedLetter.content || ''} attachments={attachments} showPagination={showPagination} debugMode={showLayoutDebug}
                      salutation={editedLetter.salutation_override || computedSalutation} layoutSettings={getLayoutSettings()}
                      addressFieldElements={substitutedBlocks.canvasBlocks.addressField} returnAddressElements={substitutedBlocks.canvasBlocks.returnAddress}
                      infoBlockElements={substitutedBlocks.canvasBlocks.infoBlock} subjectElements={substitutedBlocks.canvasBlocks.subject}
                      attachmentElements={substitutedBlocks.canvasBlocks.attachments} footerTextElements={substitutedBlocks.canvasBlocks.footer}
                      addressFieldLines={substitutedBlocks.lineBlocks.addressField} returnAddressLines={substitutedBlocks.lineBlocks.returnAddress}
                      infoBlockLines={substitutedBlocks.lineBlocks.infoBlock} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {showTextSplitEditor && (
                <div className="w-[52%] min-w-[420px] border-r bg-background flex flex-col">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-medium">Brieftext</h3>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Live</Badge>
                    </div>
                    <Button size="sm" variant="default" className="h-7 px-2" disabled={!canEdit || saving}
                      onClick={() => handleManualSave(latestContentRef.current.content, latestContentRef.current.contentNodes as any)}>
                      <Save className="h-3.5 w-3.5 mr-1" />Speichern
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowTextSplitEditor(false)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <EnhancedLexicalEditor key={letter?.id || 'new'} content={draftContent || letter?.content || ''} contentNodes={toSerializedContentNodes(draftContentNodes ?? letter?.content_nodes)}
                      onChange={({ plainText, nodesJson, html }) => { setDraftContent(plainText || ''); setDraftContentNodes(nodesJson && nodesJson.trim() !== '' ? nodesJson : null); setDraftContentHtml(html || null); }}
                      placeholder="Brieftext hier eingeben..." documentId={letter?.id} showToolbar={canEdit} editable={canEdit}
                      onMentionInsert={(userId) => pendingMentionsRef.current.add(userId)} defaultFontFamily={templateDefaultFontFamily} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto bg-muted/30 p-4">
                {!showTextSplitEditor && (
                  <div className="flex items-center gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={() => {
                      setDraftContent(editedLetter.content || ''); setDraftContentNodes(editedLetter.content_nodes || null); setDraftContentHtml(editedLetter.content_html || null); setShowTextSplitEditor(true);
                    }}><Edit3 className="h-4 w-4 mr-2" />Editor öffnen</Button>
                  </div>
                )}
                <LetterEditorCanvas template={currentTemplate as any ?? undefined} subject={editedLetter.subject} salutation={editedLetter.salutation_override || computedSalutation}
                  content={editedLetter.content_html || editedLetter.content || ''} contentNodes={editedLetter.content_nodes as any}
                  recipientAddress={editedLetter.recipient_address ? { name: editedLetter.recipient_name, address: editedLetter.recipient_address } : undefined}
                  letterDate={editedLetter.letter_date} referenceNumber={editedLetter.reference_number} attachments={attachments}
                  showPagination={showPagination} senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
                  informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id)) ? [informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))!] : undefined} layoutSettings={getLayoutSettings()}
                  displayContentHtml={editedLetter.content_html || editedLetter.content || ''}
                  addressFieldElements={substitutedBlocks.canvasBlocks.addressField} returnAddressElements={substitutedBlocks.canvasBlocks.returnAddress}
                  infoBlockElements={substitutedBlocks.canvasBlocks.infoBlock} subjectElements={substitutedBlocks.canvasBlocks.subject}
                  attachmentElements={substitutedBlocks.canvasBlocks.attachments} footerTextElements={substitutedBlocks.canvasBlocks.footer}
                  addressFieldLines={substitutedBlocks.lineBlocks.addressField} returnAddressLines={substitutedBlocks.lineBlocks.returnAddress}
                  infoBlockLines={substitutedBlocks.lineBlocks.infoBlock} canEdit={canEdit} documentId={letter?.id}
                  onContentChange={(content, nodes, html) => { setDraftContent(content || ''); setDraftContentNodes(nodes && nodes.trim() !== '' ? nodes : null); setDraftContentHtml(html || null); }}
                  onSubjectChange={(value) => setEditedLetter(prev => ({ ...prev, subject: value, title: value }))}
                  onRecipientNameChange={(value) => setEditedLetter(prev => ({ ...prev, recipient_name: value }))}
                  onRecipientAddressChange={(value) => setEditedLetter(prev => ({ ...prev, recipient_address: value }))}
                  onRecipientContactSelect={(contact) => {
                     const contactRecord = contact as Contact & { formatted_address?: string; address?: string };
                     const recipientAddress = contactRecord.formatted_address || contactRecord.address || '';
                     setEditedLetter(prev => ({ ...prev, contact_id: contactRecord.id, recipient_name: contactRecord.name, recipient_address: recipientAddress }));
                  }}
                  onSenderChange={(value) => setEditedLetter(prev => ({ ...prev, sender_info_id: value || undefined }))}
                  onInfoBlockChange={(newIds) => setEditedLetter(prev => ({ ...prev, information_block_ids: newIds }))}
                  onAttachmentNameChange={(attachmentId, displayName) => handleAttachmentNameChange(attachmentId, displayName, attachments, fetchAttachments)}
                  senderInfos={senderInfos} informationBlocks={informationBlocks} selectedSenderId={editedLetter.sender_info_id}
                  selectedRecipientContactId={editedLetter.contact_id} selectedInfoBlockIds={editedLetter.information_block_ids || []}
                  templateName={currentTemplate?.name} zoom={previewZoom} onZoomChange={setPreviewZoom} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showCommentDialog && <LetterCommentDialog onSubmit={(content) => { void handleAddComment(content); setShowCommentDialog(false); }} onClose={() => setShowCommentDialog(false)} />}

      <ReviewAssignmentDialog isOpen={showAssignmentDialog} onClose={() => setShowAssignmentDialog(false)} letterId={letter?.id || ''}
        letterData={{
          title: editedLetter.title || '',
          contentHtml: editedLetter.content_html || '',
          salutation: editedLetter.salutation_override || '',
          closingFormula: editedLetter.closing_formula || '',
          closingName: editedLetter.closing_name || '',
          subject: editedLetter.subject || '',
        }}
        onReviewAssigned={async (mode) => {
          const now = new Date().toISOString();
          fetchCollaborators(); setShowAssignmentDialog(false);
          const newStatus = mode === 'review' ? 'review' : 'pending_approval';
          setEditedLetter(prev => ({ ...prev, status: newStatus, submitted_for_review_at: now, submitted_for_review_by: user?.id }));
          setIsProofreadingMode(true); setSaving(true);
          try { const { error } = await supabase.from('letters').update({ status: newStatus, submitted_for_review_at: now, submitted_for_review_by: user?.id, updated_at: now }).eq('id', letter!.id); if (error) throw error; } catch (error) { debugConsole.error('Error saving status:', error); } finally { setSaving(false); }
        }}
        onSkipReview={async () => {
          const now = new Date().toISOString();
          setShowAssignmentDialog(false); setEditedLetter(prev => ({ ...prev, status: 'approved', approved_at: now, approved_by: user?.id })); setIsProofreadingMode(false); setSaving(true);
          try { const { error } = await supabase.from('letters').update({ status: 'approved', approved_at: now, approved_by: user?.id, updated_at: now }).eq('id', letter!.id); if (error) throw error; } catch (error) { debugConsole.error('Error saving status:', error); } finally { setSaving(false); }
        }}
      />

      {showWriterDialog && (
        <UserAssignmentDialog isOpen={showWriterDialog} onClose={() => setShowWriterDialog(false)} letterId={letter?.id || ''} role="writer"
          onAssignmentComplete={() => { fetchCollaborators(); setShowWriterDialog(false); }} />
      )}
    </div>
  );
};

export default LetterEditor;
