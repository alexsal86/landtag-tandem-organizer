import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Users, Eye, EyeOff, AlertTriangle, Edit3, FileText, MessageSquare, Ruler, Paperclip, Settings, Layout, Building, Info } from 'lucide-react';
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
import { approveLetterWithoutReview } from '@/services/letterWorkflow';
import { debugConsole } from '@/utils/debugConsole';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import LetterBriefDetails from '@/components/letters/LetterBriefDetails';
import LetterCommentDialog from '@/components/letters/LetterCommentDialog';
import {
  type Letter, type LetterTemplate, type Contact,
  type LetterContentNodes,
  DEFAULT_LETTER_FONT_STACK, STATUS_LABELS, extractFontFamilyFromContentNodes,
  formatContactAddress, getNextStatus,
} from '@/components/letters/types';
import type { LetterLayoutSettings } from '@/types/letterLayout';

/**
 * Felder, die der Autosave schreibt. Der Snapshot dient nur dem Vergleich:
 * bloßes Öffnen eines Briefs darf keinen Schreibvorgang auslösen und keine
 * noch nicht geladenen Felder (z. B. content_nodes) überschreiben.
 */
const AUTOSAVE_FIELDS = [
  'title', 'subject', 'content', 'content_nodes', 'content_html',
  'recipient_name', 'recipient_address', 'contact_id', 'template_id',
  'reference_number', 'sender_info_id', 'information_block_ids',
  'letter_date', 'expected_response_date', 'salutation_override',
  'closing_formula', 'closing_name',
] as const;

/** content_nodes kommt je nach Quelle als Objekt (DB) oder JSON-String (Editor). */
const parseContentNodes = (value: unknown): unknown => {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value); } catch { return value; }
};

/** Schlüsselreihenfolge-unabhängig, damit derselbe Inhalt nicht als Änderung zählt. */
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

const autosaveSnapshot = (letter: Partial<Letter>, showPagination: boolean): string =>
  stableStringify({
    ...Object.fromEntries(AUTOSAVE_FIELDS.map((field) => [
      field,
      field === 'content_nodes' ? parseContentNodes(letter[field]) : letter[field] ?? null,
    ])),
    show_pagination: showPagination,
  });

interface LetterEditorProps {
  letter?: Letter;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Meldet den Dirty-Zustand, damit die Seite das Verlassen absichern kann. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Stellt der Seite denselben Speicherpfad wie der Editor-Button bereit. */
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

const LetterEditor: React.FC<LetterEditorProps> = ({ letter, isOpen, onClose, onSave, onDirtyChange, saveRef }) => {
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
  const [viewMode, setViewMode] = useState<'page' | 'split'>('page');
  const [draftContent, setDraftContent] = useState('');
  const [draftContentNodes, setDraftContentNodes] = useState<LetterContentNodes>(null);
  const [draftContentHtml, setDraftContentHtml] = useState<string | null>(null);
  // Autosave erst, wenn der vollständige Datensatz in den Editor übernommen wurde.
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedSnapshotRef = useRef<string | null>(null);
  // Schließen und Verwerfen dürfen nichts stillschweigend verlieren.
  const [closePrompt, setClosePrompt] = useState<null | 'close' | 'discard'>(null);
  const [isClosing, setIsClosing] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isUpdatingFromRemoteRef = useRef(false);
  const latestContentRef = useRef<{ content: string; contentNodes?: LetterContentNodes }>({ content: '' });
  const pendingMentionsRef = useRef<Set<string>>(new Set());
  const draftInitializedRef = useRef(false);
  const pageToolbarRef = useRef<HTMLDivElement>(null);
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

  /** Ein neu angelegter Brief lebt nach dem ersten Speichern ohne neues `letter`-Prop weiter. */
  const persistedLetterId = letter?.id ?? editedLetter.id;

  const isDirty = useMemo(() => {
    if (!canEdit) return false;
    if (!isHydrated || hydratedSnapshotRef.current === null) {
      return Boolean(editedLetter.title?.trim() || editedLetter.content?.trim());
    }
    return autosaveSnapshot(editedLetter, showPagination) !== hydratedSnapshotRef.current;
  }, [canEdit, isHydrated, editedLetter, showPagination]);

  const toSerializedContentNodes = (nodes: LetterContentNodes | undefined): string | undefined => {
    if (!nodes) return undefined;
    return typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
  };

  /** Nach erfolgreichem Schreiben ist der gespeicherte Stand die neue Vergleichsbasis. */
  const markSavedBaseline = useCallback((saved: Partial<Letter> = {}) => {
    const content = (saved.content ?? latestContentRef.current.content ?? editedLetter.content ?? '').trim();
    const contentNodes = saved.content_nodes ?? latestContentRef.current.contentNodes ?? editedLetter.content_nodes ?? null;
    hydratedSnapshotRef.current = autosaveSnapshot({ ...editedLetter, ...saved, content, content_nodes: contentNodes }, showPagination);
    setEditedLetter(prev => ({ ...prev, ...saved, content, content_nodes: contentNodes }));
  }, [editedLetter, showPagination, setEditedLetter]);

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
      // Einheitlicher Stand für Editor, Vorschau und Snapshot; der Live-Sync
      // schreibt den Text ebenfalls getrimmt zurück.
      const hydrated = {
        ...letter,
        content: (letter.content || '').trim(),
        content_html: letter.content_html || '',
        content_nodes: letter.content_nodes || null,
      };
      draftInitializedRef.current = false;
      setEditedLetter(hydrated);
      setDraftContent(hydrated.content); setDraftContentNodes(hydrated.content_nodes); setDraftContentHtml(hydrated.content_html);
      latestContentRef.current = { content: hydrated.content, contentNodes: hydrated.content_nodes };
      draftInitializedRef.current = true;
      setIsProofreadingMode(letter.status === 'review' || letter.status === 'pending_approval');
      setShowPagination(letter.show_pagination || false);
      hydratedSnapshotRef.current = autosaveSnapshot(hydrated, letter.show_pagination || false);
      setIsHydrated(true);
    } else {
      const currentDate = new Date().toISOString().split('T')[0];
      setEditedLetter({ title: '', content: '', content_html: '', content_nodes: null, recipient_name: '', recipient_address: '', status: 'draft', letter_date: currentDate });
      setDraftContent(''); setDraftContentNodes(null); setDraftContentHtml(null);
      draftInitializedRef.current = true; setIsProofreadingMode(false); setShowPagination(true);
      // Ein neuer Brief hat noch keine ID; gespeichert wird er über "Speichern".
      hydratedSnapshotRef.current = null;
      setIsHydrated(false);
    }
  }, [letter]);

  useEffect(() => { if (letter && letter.show_pagination !== undefined) setShowPagination(letter.show_pagination); }, [letter?.show_pagination]);
  useEffect(() => { if (isOpen && currentTenant && letter?.id) fetchWorkflowUserProfiles(letter); }, [isOpen, currentTenant, letter?.id]);
  const fetchCurrentTemplate = useCallback(async () => {
    const templateId = editedLetter?.template_id || letter?.template_id;
    if (!templateId) return;
    try {
      const { data, error } = await supabase.from('letter_templates').select('id, name, default_sender_id, default_info_blocks, layout_settings').eq('id', templateId).single();
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
    if (!isHydrated) return;
    if (!canEdit || isUpdatingFromRemoteRef.current || !persistedLetterId) return;
    // Unverändert gegenüber dem geladenen Stand: nichts zu speichern.
    if (autosaveSnapshot(editedLetter, showPagination) === hydratedSnapshotRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (isUpdatingFromRemoteRef.current) return;
      void handleAutoSave().then(ok => { if (ok) markSavedBaseline(); });
    }, 3000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editedLetter, canEdit, persistedLetterId, showPagination, isHydrated, handleAutoSave, markSavedBaseline]);

  // Ein neu angelegter Brief ist nach dem ersten Speichern kein Entwurf mehr.
  useEffect(() => {
    if (!letter && editedLetter.id && !isHydrated) setIsHydrated(true);
  }, [letter, editedLetter.id, isHydrated]);

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

  const layoutTemplate: import('@/types/letterLayout').LetterLayoutTemplateLike | undefined = currentTemplate
    ? {
        layout_settings: currentTemplate.layout_settings ?? undefined,
        header_layout_type: (currentTemplate as { header_layout_type?: string | null }).header_layout_type ?? undefined,
        header_text_elements: Array.isArray((currentTemplate as { header_text_elements?: unknown }).header_text_elements)
          ? ((currentTemplate as { header_text_elements?: unknown }).header_text_elements as import('@/types/letterLayout').LetterCanvasElement[])
          : undefined,
        letterhead_html: (currentTemplate as { letterhead_html?: string | null }).letterhead_html ?? undefined,
        letterhead_css: (currentTemplate as { letterhead_css?: string | null }).letterhead_css ?? undefined,
        footer_blocks: (currentTemplate as { footer_blocks?: unknown }).footer_blocks,
      }
    : undefined;

  /**
   * Schreibt sofort, statt den Autosave-Timer abzuwarten: ausstehende
   * Editor-Änderungen werden zuerst in den Stand übernommen (Flush).
   */
  const saveLetter = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current);
    const content = (draftInitializedRef.current ? draftContent : latestContentRef.current.content) ?? '';
    const contentNodes = draftInitializedRef.current ? draftContentNodes : latestContentRef.current.contentNodes;
    const contentHtml = draftInitializedRef.current ? draftContentHtml : editedLetter.content_html;
    latestContentRef.current = { content, contentNodes: contentNodes ?? null };
    const ok = await handleManualSave(content, toSerializedContentNodes(contentNodes ?? undefined), contentHtml ?? undefined);
    if (ok) markSavedBaseline({ content, content_nodes: contentNodes ?? null, content_html: contentHtml ?? undefined });
    return ok;
  }, [draftContent, draftContentNodes, draftContentHtml, editedLetter.content_html, handleManualSave, markSavedBaseline, toSerializedContentNodes]);

  const finishClose = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (liveSyncTimerRef.current) clearTimeout(liveSyncTimerRef.current);
    setClosePrompt(null);
    setIsClosing(false);
    onClose();
  }, [onClose]);

  /** Schließen: ungespeicherte Änderungen werden nicht stillschweigend verworfen. */
  const requestClose = useCallback(() => {
    if (isClosing) return;
    if (!isDirty) { finishClose(); return; }
    setClosePrompt('close');
  }, [finishClose, isClosing, isDirty]);

  /** Verwerfen: bewusst ohne Schreiben schließen. */
  const requestDiscard = useCallback(() => {
    if (isClosing) return;
    if (!isDirty) { finishClose(); return; }
    setClosePrompt('discard');
  }, [finishClose, isClosing, isDirty]);

  const saveAndClose = useCallback(async () => {
    setIsClosing(true);
    const ok = await saveLetter();
    if (!ok) { setIsClosing(false); return; }
    finishClose();
  }, [finishClose, saveLetter]);

  const discardAndClose = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    finishClose();
  }, [finishClose]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = saveLetter;
    return () => { saveRef.current = null; };
  }, [saveRef, saveLetter]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col bg-background border rounded-lg">
      <LetterEditorToolbar
        letter={letter}
        editedLetter={editedLetter}
        setEditedLetter={setEditedLetter}
        currentTemplate={currentTemplate}
        canEdit={canEdit}
        saving={saving}
        lastSaved={lastSaved}
        hasUnsavedChanges={isDirty}
        closing={isClosing}
        onClose={requestClose}
        onDiscard={requestDiscard}
        activeUsers={activeUsers}
        showDINPreview={showDINPreview}
        setShowDINPreview={setShowDINPreview}
        onManageCollaborators={canEdit && currentStatus === 'draft' && letter?.id ? () => setShowWriterDialog(true) : undefined}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          if (mode === 'page') setShowTextSplitEditor(true);
          setViewMode(mode);
        }}
        onSave={() => void saveLetter()}
        zoom={previewZoom}
        onZoomChange={setPreviewZoom}
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

      {showBriefDetails && (
        <LetterBriefDetails editedLetter={editedLetter} setEditedLetter={setEditedLetter} canEdit={canEdit} isReviewer={isReviewer} userProfiles={userProfiles}
          onStatusTransition={handleStatusTransition} onReturnLetter={handleReturnLetter} broadcastContentChange={broadcastContentChange} />
      )}

      {/* Content */}
      {showDINPreview ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-none flex items-center justify-between p-3 border-b bg-muted/30">
            <h3 className="text-sm font-medium">Druckvorschau (schreibgeschützt)</h3>
            <div className="flex items-center gap-2">
              <Button variant={showLayoutDebug ? 'default' : 'outline'} size="sm" className="h-7" onClick={() => setShowLayoutDebug(!showLayoutDebug)}><Ruler className="h-3.5 w-3.5 mr-1" />Layout</Button>
            </div>
          </div>
          <div className="flex-1 bg-muted/50 p-6">
            <div className="mx-auto" style={{ zoom: previewZoom, width: '210mm', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
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
      ) : (
        <div className="flex-1 flex min-w-0">
          {viewMode === 'split' && showTextSplitEditor && (
            <div className="w-[52%] min-w-[420px] border-r bg-background flex flex-col">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-medium">Brieftext</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Live</Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowTextSplitEditor(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="p-3">
                <EnhancedLexicalEditor key={letter?.id || 'new'} content={draftContent || letter?.content || ''} contentNodes={toSerializedContentNodes(draftContentNodes ?? letter?.content_nodes)}
                  onChange={({ plainText, nodesJson, html }) => { setDraftContent(plainText || ''); setDraftContentNodes(nodesJson && nodesJson.trim() !== '' ? nodesJson : null); setDraftContentHtml(html || null); }}
                  placeholder="Brieftext hier eingeben..." documentId={letter?.id} showToolbar={canEdit} editable={canEdit}
                  onMentionInsert={(userId) => pendingMentionsRef.current.add(userId)} defaultFontFamily={templateDefaultFontFamily} />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 bg-muted/30 p-4">
            {viewMode === 'page' && canEdit && <div ref={pageToolbarRef} className="sticky top-0 z-sticky mb-3 rounded-md border bg-background shadow-sm" />}
            {viewMode === 'split' && !showTextSplitEditor && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={() => {
                  setDraftContent(editedLetter.content || ''); setDraftContentNodes(editedLetter.content_nodes || null); setDraftContentHtml(editedLetter.content_html || null); setShowTextSplitEditor(true);
                }}><Edit3 className="h-4 w-4 mr-2" />Editor öffnen</Button>
              </div>
            )}
            <LetterEditorCanvas template={layoutTemplate} subject={editedLetter.subject} salutation={editedLetter.salutation_override || computedSalutation}
              content={editedLetter.content_html || editedLetter.content || ''} contentNodes={toSerializedContentNodes(editedLetter.content_nodes ?? undefined)}
              recipientAddress={editedLetter.recipient_address ? { name: editedLetter.recipient_name, address: editedLetter.recipient_address } : undefined}
              letterDate={editedLetter.letter_date} referenceNumber={editedLetter.reference_number} attachments={attachments}
              showPagination={showPagination} senderInfo={senderInfos.find(s => s.id === editedLetter.sender_info_id)}
              informationBlock={informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id)) ? [informationBlocks.find(b => editedLetter.information_block_ids?.includes(b.id))!] : undefined} layoutSettings={getLayoutSettings()}
              displayContentHtml={viewMode === 'page' ? (draftContentHtml ?? editedLetter.content_html ?? editedLetter.content ?? '') : (editedLetter.content_html || editedLetter.content || '')}
              inlineEditor={viewMode === 'page' ? (
                <EnhancedLexicalEditor key={`page-${letter?.id || 'new'}`} bare content={draftContent || letter?.content || ''} contentNodes={toSerializedContentNodes(draftContentNodes ?? letter?.content_nodes)}
                  onChange={({ plainText, nodesJson, html }) => { setDraftContent(plainText || ''); setDraftContentNodes(nodesJson && nodesJson.trim() !== '' ? nodesJson : null); setDraftContentHtml(html || null); }}
                  placeholder="Hier direkt auf dem Brief schreiben…" documentId={letter?.id} showToolbar={canEdit} editable={canEdit}
                  renderToolbarPortal={pageToolbarRef}
                  onMentionInsert={(userId) => pendingMentionsRef.current.add(userId)} defaultFontFamily={templateDefaultFontFamily} />
              ) : undefined}
              addressFieldElements={substitutedBlocks.canvasBlocks.addressField} returnAddressElements={substitutedBlocks.canvasBlocks.returnAddress}
              infoBlockElements={substitutedBlocks.canvasBlocks.infoBlock} subjectElements={substitutedBlocks.canvasBlocks.subject}
              attachmentElements={substitutedBlocks.canvasBlocks.attachments} footerTextElements={substitutedBlocks.canvasBlocks.footer}
              addressFieldLines={substitutedBlocks.lineBlocks.addressField} returnAddressLines={substitutedBlocks.lineBlocks.returnAddress}
              infoBlockLines={substitutedBlocks.lineBlocks.infoBlock} canEdit={canEdit} documentId={letter?.id}
              onContentChange={(content, nodes, html) => { setDraftContent(content || ''); setDraftContentNodes(nodes && nodes.trim() !== '' ? nodes : null); setDraftContentHtml(html || null); }}
              onSubjectChange={(value) => setEditedLetter(prev => ({ ...prev, subject: value, title: value }))}
              onSalutationChange={(value) => setEditedLetter(prev => ({ ...prev, salutation_override: value }))}
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
              zoom={previewZoom} />
          </div>
        </div>
      )}

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
          setShowAssignmentDialog(false); setSaving(true);
          try {
            // Die Datenbank kennt nur die Kanten aus ALLOWED_TRANSITIONS;
            // deshalb läuft die Abkürzung über pending_approval.
            const result = await approveLetterWithoutReview(letter!.id, editedLetter.status || 'draft', user!.id, !!editedLetter.workflow_locked);
            setEditedLetter(prev => ({ ...prev, ...(result.updates as Partial<Letter>) }));
            setIsProofreadingMode(false);
          } catch (error) { debugConsole.error('Error saving status:', error); } finally { setSaving(false); }
        }}
      />

      {showWriterDialog && (
        <UserAssignmentDialog isOpen={showWriterDialog} onClose={() => setShowWriterDialog(false)} letterId={letter?.id || ''} role="writer"
          onAssignmentComplete={() => { fetchCollaborators(); setShowWriterDialog(false); }} />
      )}

      {/* Dirty-Guard: Schließen und Verwerfen fragen nach, statt Tippen zu verlieren. */}
      <AlertDialog open={closePrompt !== null} onOpenChange={(open) => { if (!open && !isClosing) setClosePrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen sind noch nicht gespeichert</AlertDialogTitle>
            <AlertDialogDescription>
              {closePrompt === 'discard'
                ? 'Ihre Änderungen werden verworfen und der Editor geschlossen.'
                : 'Beim Schließen bleiben Ihre Änderungen nur erhalten, wenn Sie sie vorher speichern.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Weiter bearbeiten</AlertDialogCancel>
            <Button variant="destructive" onClick={discardAndClose} disabled={isClosing}>Verwerfen</Button>
            <AlertDialogAction
              disabled={isClosing || saving}
              onClick={(event) => { event.preventDefault(); void saveAndClose(); }}
            >
              {isClosing ? 'Speichert…' : 'Speichern und schließen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LetterEditor;
