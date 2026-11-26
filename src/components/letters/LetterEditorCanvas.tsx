import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { ZoomIn, ZoomOut, RotateCcw, Layout, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ContactSelector } from '@/features/contacts/components/ContactSelector';
import { DIN5008LetterLayout } from './DIN5008LetterLayout';
import { EditableCanvasOverlay } from './EditableCanvasOverlay';
import { InlineEditableText } from './InlineEditableText';
import {
  bodyLineHeightCss,
  computeLetterHeaderMetrics,
  resolveBodyLineHeightMm,
  resolveBodyParagraphGapMm,
  resolvePage2TopMm,
} from './din5008/headerMetrics';
import { computePageBreaks } from './din5008/pagination';
import type {
  InformationBlockRecord,
  LetterBlockLine,
  LetterCanvasElement,
  LetterAttachmentRecord,
  LetterLayoutSettings,
  LetterLayoutTemplateLike,
  SenderInformationRecord,
} from '@/types/letterLayout';

import {
  CONTENT_W_MM,
  MARGIN_L_MM,
  MARGIN_R_MM,
  MM_TO_PX,
  PAGE_H_MM,
  PAGE_W_MM,
  pxToMm,
} from './letterPageGeometry';
import {
  dedupeRecipientAddress,
  isEditableAttachment,
  type EditableAttachment,
} from './letterRecipient';
import { LetterAttachmentsSection } from './LetterAttachmentsSection';
import { LetterClosingSection } from './LetterClosingSection';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LetterEditorCanvasProps {
  subject?: string;
  salutation?: string;
  content: string;
  contentNodes?: string;
  recipientAddress?: { name?: string; address?: string };
  letterDate?: string;
  referenceNumber?: string;
  attachments?: LetterAttachmentRecord[];
  showPagination?: boolean;
  template?: LetterLayoutTemplateLike;
  layoutSettings?: LetterLayoutSettings;
  senderInfo?: SenderInformationRecord | null;
  informationBlock?: InformationBlockRecord[] | null;
  addressFieldElements?: LetterCanvasElement[];
  returnAddressElements?: LetterCanvasElement[];
  infoBlockElements?: LetterCanvasElement[];
  subjectElements?: LetterCanvasElement[];
  attachmentElements?: LetterCanvasElement[];
  footerTextElements?: LetterCanvasElement[];
  addressFieldLines?: LetterBlockLine[];
  returnAddressLines?: LetterBlockLine[];
  infoBlockLines?: LetterBlockLine[];
  canEdit?: boolean;
  documentId?: string;
  onContentChange: (content: string, contentNodes?: string, contentHtml?: string) => void;
  enableInlineContentEditing?: boolean;
  onRequestContentEdit?: () => void;
  /** Google-Docs-Modus: live editor rendered directly in the body zone of the page */
  inlineEditor?: React.ReactNode;
  /** HTML produced by the left-side editor — this is what we paginate */
  displayContentHtml?: string;
  onMentionInsert?: (userId: string, displayName: string) => void;
  isReviewMode?: boolean;
  reviewerName?: string;
  reviewerId?: string;
  showAcceptReject?: boolean;
  onSubjectChange?: (subject: string) => void;
  onSalutationChange?: (salutation: string) => void;
  onRecipientNameChange?: (name: string) => void;
  onRecipientAddressChange?: (address: string) => void;
  onRecipientContactSelect?: (contact: { id: string }) => void;
  onSenderChange?: (senderId: string) => void;
  onInfoBlockChange?: (blockIds: string[]) => void;
  onAttachmentNameChange?: (attachmentId: string, displayName: string) => void;
  senderInfos?: SenderInformationRecord[];
  informationBlocks?: InformationBlockRecord[];
  selectedSenderId?: string;
  selectedRecipientContactId?: string;
  selectedInfoBlockIds?: string[];
  templateName?: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const LetterEditorCanvas: React.FC<LetterEditorCanvasProps> = ({
  subject,
  salutation,
  content,
  contentNodes,
  recipientAddress,
  letterDate,
  referenceNumber,
  attachments,
  showPagination = false,
  template,
  layoutSettings,
  senderInfo,
  informationBlock,
  addressFieldElements,
  returnAddressElements,
  infoBlockElements,
  subjectElements,
  attachmentElements,
  footerTextElements,
  addressFieldLines,
  returnAddressLines,
  infoBlockLines,
  canEdit = true,
  documentId,
  onContentChange,
  enableInlineContentEditing = false,
  onRequestContentEdit,
  inlineEditor,
  displayContentHtml,
  isReviewMode = false,
  reviewerName = '',
  reviewerId = '',
  showAcceptReject = false,
  onMentionInsert,
  onSubjectChange,
  onSalutationChange,
  onRecipientNameChange,
  onRecipientAddressChange,
  onRecipientContactSelect,
  onSenderChange,
  onInfoBlockChange,
  onAttachmentNameChange,
  senderInfos = [],
  informationBlocks = [],
  selectedSenderId,
  selectedRecipientContactId,
  selectedInfoBlockIds = [],
  templateName,
  zoom: externalZoom,
  onZoomChange,
}) => {
  // ── font size helper ──
  const toFontSizePt = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
      const m = value.trim().toLowerCase().match(/([0-9]+(?:\.[0-9]+)?)/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return value.includes('px') ? n * 0.75 : n;
      }
    }
    return fallback;
  };

  // ── zoom ──
  const [internalZoom, setInternalZoom] = useState(0.75);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;

  const [isAttachmentOverlayHovered, setIsAttachmentOverlayHovered] = useState(false);
  const [isAttachmentOverlayOpen, setIsAttachmentOverlayOpen] = useState(false);
  const [isContactPopoverOpen, setIsContactPopoverOpen] = useState(false);
  // The layout can be rebuilt (e.g. template switch) and replace these nodes.
  // Storing the elements in state re-runs the measurement for the new nodes.
  const [subjectMeasureEl, setSubjectMeasureEl] = useState<HTMLDivElement | null>(null);
  const [salutationMeasureEl, setSalutationMeasureEl] = useState<HTMLDivElement | null>(null);
  const [measuredSubjectMm, setMeasuredSubjectMm] = useState<number | null>(null);
  const [measuredSalutationMm, setMeasuredSalutationMm] = useState<number | null>(null);


  // ── layout ──
  const layout: Partial<LetterLayoutSettings> = layoutSettings ?? template?.layout_settings ?? {};
  const contentFontSizePt = toFontSizePt(
    layout.content?.fontSize ?? layout.salutation?.fontSize, 11,
  );
  // Body grid shared with the PDF export: every line box is exactly
  // layout.content.lineHeight high and paragraphs keep one blank line.
  const bodyLineHeightMm = resolveBodyLineHeightMm(layout);
  const bodyParagraphGapMm = resolveBodyParagraphGapMm(bodyLineHeightMm);
  const bodyLineHeightRatio = bodyLineHeightCss(bodyLineHeightMm, contentFontSizePt);
  const subjectFontSizePt = toFontSizePt(layout.subject?.fontSize, 13);
  const salutationFontSizePt = toFontSizePt(layout.salutation?.fontSize, 11);
  const closingFontSizePt = toFontSizePt(layout.closing?.fontSize, 11);

  // ── inline header fields (page mode) ──
  // In page mode the header zones are typed into directly on the sheet; the
  // sender, return-address line and info block stay as selection overlays.
  const isInlinePage = Boolean(inlineEditor);
  const inlineHeaderEditing = isInlinePage && canEdit;
  const showSubjectField = Boolean(subject) || (inlineHeaderEditing && Boolean(onSubjectChange));
  const showSalutationField = Boolean(salutation) || (inlineHeaderEditing && Boolean(onSalutationChange));
  const showRecipientEditor = inlineHeaderEditing && Boolean(onRecipientNameChange) && Boolean(onRecipientAddressChange);

  // Measure the rendered subject/salutation so wrapped lines push the body down.
  useLayoutEffect(() => {
    const subjectEl = subjectMeasureEl;
    const salutationEl = salutationMeasureEl;

    const measureElement = (el: HTMLDivElement | null, setValue: React.Dispatch<React.SetStateAction<number | null>>) => {
      const next = el ? el.offsetHeight / MM_TO_PX : null;
      setValue((prev) => {
        if (prev === null || next === null) return next;
        return Math.abs(prev - next) < 0.01 ? prev : next;
      });
    };

    const measureAll = () => {
      measureElement(subjectEl, setMeasuredSubjectMm);
      measureElement(salutationEl, setMeasuredSalutationMm);
    };

    measureAll();
    if (document.fonts?.ready) {
      void document.fonts.ready.then(measureAll).catch(() => undefined);
    }

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureAll);
    if (subjectEl) observer.observe(subjectEl);
    if (salutationEl) observer.observe(salutationEl);
    return () => observer.disconnect();
  }, [subjectMeasureEl, salutationMeasureEl, showSubjectField, showSalutationField, isInlinePage]);

  const footerTopMm: number = layout.footer?.top ?? 272;
  const paginationGapMm = 4.23;
  const paginationTopMm: number = layout.pagination?.top ?? 263.77;
  const paginationEnabled = showPagination && (layout.pagination?.enabled ?? true);
  const contentBottomMm = paginationEnabled
    ? Math.min(footerTopMm, paginationTopMm - paginationGapMm)
    : footerTopMm;

  // ── page 2+ content boundaries from layout ──
  const page2TopMm: number = resolvePage2TopMm(layout);
  const page2BottomRaw: number = layout.content?.page2BottomMm ?? footerTopMm;
  const page2BottomMm = paginationEnabled
    ? Math.min(page2BottomRaw, paginationTopMm - paginationGapMm)
    : page2BottomRaw;

  // ── where content starts on page 1 ──
  const headerMetrics = computeLetterHeaderMetrics({
    layout,
    subjectLines: showSubjectField ? 1 : 0,
    salutationLines: showSalutationField ? 1 : 0,
    subjectHeightMm: measuredSubjectMm,
    salutationHeightMm: measuredSalutationMm,
  });
  const subjectTopMm = headerMetrics.subjectTopMm;
  const subjectHeightMm = headerMetrics.subjectHeightMm;
  const gapAfterSubjectMm = headerMetrics.gapAfterSubjectMm;
  const salutationHeightMm = headerMetrics.salutationHeightMm;
  const gapAfterSalutationMm = headerMetrics.gapAfterSalutationMm;
  const contentStartMm = headerMetrics.contentTopMm;

  // ── available body height per page (raw, no snapping) ──
  const page1BodyMmRaw = contentBottomMm - contentStartMm;
  const pageNBodyMmRaw = page2BottomMm - page2TopMm;

  // ── Measurement-based block breaks ──
  const [blockBreaks, setBlockBreaks] = useState<number[]>([]);

  // ── Line-level break collector using Range.getClientRects() ──
  const collectLineBreaks = useCallback(
    (el: HTMLDivElement): number[] => {
      const containerTop = el.getBoundingClientRect().top;
      const breaks: number[] = [];
      const TEXT_BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'BLOCKQUOTE']);

      const recordLineRects = (node: HTMLElement) => {
        // Try to get line-level rects via Range over all text nodes
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        if (rects.length > 0) {
          for (let k = 0; k < rects.length; k++) {
            const bottom = pxToMm(rects[k].bottom - containerTop);
            if (bottom > 0) breaks.push(bottom);
          }
        } else {
          // Fallback: use offsetTop + offsetHeight
          breaks.push(pxToMm(node.offsetTop + node.offsetHeight));
        }
      };

      const children = el.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (child.classList.contains('din5008-content-text')) {
          // Drill into content blocks
          const innerChildren = child.children;
          for (let j = 0; j < innerChildren.length; j++) {
            const inner = innerChildren[j] as HTMLElement;
            if (TEXT_BLOCK_TAGS.has(inner.tagName)) {
              recordLineRects(inner);
            } else {
              // Atomic block (table, image, etc.) — don't split
              breaks.push(pxToMm(inner.offsetTop + inner.offsetHeight));
            }
          }
        } else {
          // Atomic blocks outside content text (closing, attachments)
          breaks.push(pxToMm(child.offsetTop + child.offsetHeight));
        }
      }

      // Final break at total flow height
      breaks.push(pxToMm(el.scrollHeight));
      return breaks;
    },
    [],
  );

  // ── closing metadata ──
  const closingFormula: string | undefined = layout.closing?.formula;
  const closingName: string | undefined = layout.closing?.signatureName;
  const closingTitle: string | undefined = layout.closing?.signatureTitle;
  const closingImagePath: string | undefined = layout.closing?.signatureImagePath;

  // ── HTML to render ──
  const escapeHtml = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const renderedHtml =
    displayContentHtml ??
    (content ? `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>` : '');

  // ═══════════════════════════════════════════════════════════════════════════
  // Viewport/Offset Pagination: measure the full flow height, then compute
  // how many pages are needed. Each page shows a "window" into the flow.
  // ═══════════════════════════════════════════════════════════════════════════
  const flowMeasureRef = useRef<HTMLDivElement>(null);
  const [flowHeightMm, setFlowHeightMm] = useState(0);

  // Measure the hidden flow container and extract line-level break boundaries
  useEffect(() => {
    const el = flowMeasureRef.current;
    if (!el) return;

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      setFlowHeightMm(pxToMm(el.scrollHeight));
      setBlockBreaks(collectLineBreaks(el));
    };

    // Wait for fonts before first measurement to avoid stale glyph metrics
    document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [renderedHtml, closingFormula, closingName, attachments, collectLineBreaks]);

  // ── Compute page breaks from line-level break boundaries ──
  const pageOffsets = computePageBreaks(blockBreaks, page1BodyMmRaw, pageNBodyMmRaw, bodyLineHeightMm);
  const totalPages = Math.max(1, pageOffsets.length);

  // ── overlay dimensions ──
  const addressFieldWidth: number = layout.addressField?.width ?? 85;
  const returnAddressHeight: number = layout.addressField?.returnAddressHeight ?? 17.7;
  const addressZoneHeight: number = layout.addressField?.addressZoneHeight ?? 27.3;

  // ── closing block ──
  const renderClosing = () => (
    <LetterClosingSection
      formula={closingFormula}
      signatureImagePath={closingImagePath}
      signatureName={closingName}
      signatureTitle={closingTitle}
      fontSizePt={closingFontSizePt}
    />
  );

  // ── attachment list ──
  const renderAttachments = () => (
    <LetterAttachmentsSection
      attachments={attachments}
      hasSignature={Boolean(closingFormula)}
      fontSizePt={contentFontSizePt}
      canEdit={canEdit}
      editableAttachments={editableAttachmentList}
      onAttachmentNameChange={onAttachmentNameChange}
      hovered={isAttachmentOverlayHovered}
      open={isAttachmentOverlayOpen}
      onHoveredChange={setIsAttachmentOverlayHovered}
      onOpenChange={setIsAttachmentOverlayOpen}
    />
  );

  const editableAttachmentList: EditableAttachment[] = (attachments ?? []).map(a => ({
    id: a.id,
    file_name: a.file_name,
    display_name: a.display_name ?? undefined,
  })).filter(isEditableAttachment);

  // ── The complete content flow (used for both measurement and rendering) ──
  const renderContentFlow = (live = false) => (
    <>
      {live && inlineEditor ? (
        <div className="din5008-content-text">{inlineEditor}</div>
      ) : (
        <div
          className="din5008-content-text"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(renderedHtml) }}
        />
      )}
      {renderClosing()}
      {renderAttachments()}
    </>
  );

  // ── inline editors rendered inside the DIN layout ──
  const renderSubjectEditor = () => {
    if (!showSubjectField || !onSubjectChange) return undefined;
    return (
      <InlineEditableText
        value={subject ?? ''}
        onChange={onSubjectChange}
        ariaLabel="Betreff"
        placeholder="Betreff"
        style={{ flex: 1, fontWeight: 'inherit', fontSize: 'inherit', minHeight: '1.2em' }}
      />
    );
  };

  const renderSalutationEditor = () => {
    if (!showSalutationField || !onSalutationChange) return undefined;
    return (
      <InlineEditableText
        value={salutation ?? ''}
        onChange={onSalutationChange}
        ariaLabel="Anrede"
        placeholder="Sehr geehrte Damen und Herren,"
        style={{ fontSize: 'inherit', minHeight: '1.2em' }}
      />
    );
  };

  const renderRecipientEditor = () => {
    if (!showRecipientEditor) return undefined;
    const addressDisplay = dedupeRecipientAddress(recipientAddress?.name, recipientAddress?.address);
    return (
      <div className="group/recipient relative h-full">
        <InlineEditableText
          value={recipientAddress?.name ?? ''}
          onChange={(value) => onRecipientNameChange?.(value)}
          ariaLabel="Empfängername"
          placeholder="Name"
        />
        <InlineEditableText
          value={addressDisplay.display}
          onChange={(value) => onRecipientAddressChange?.(`${addressDisplay.hiddenPrefix}${value}`)}
          ariaLabel="Empfängeradresse"
          placeholder="Straße, PLZ Ort"
          multiline
        />
        {onRecipientContactSelect && (
          <div className="absolute -top-3 -right-3 opacity-0 transition-opacity group-hover/recipient:opacity-100 focus-within:opacity-100">
            <Popover open={isContactPopoverOpen} onOpenChange={setIsContactPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Empfänger aus Kontakten wählen"
                  aria-label="Empfänger aus Kontakten wählen"
                  className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-2 z-[200]" side="right" align="center" sideOffset={8}>
                <ContactSelector
                  onSelect={(contact) => {
                    onRecipientContactSelect(contact);
                    setIsContactPopoverOpen(false);
                  }}
                  selectedContactId={selectedRecipientContactId}
                  placeholder="Kontakt aus Adressbuch wählen..."
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    );
  };

  // ── editable overlays for page-1 zones ──
  const renderOverlays = (includeTextFieldOverlays = true) => (
    <>
            <EditableCanvasOverlay
              top={50}
              left={MARGIN_L_MM}
              width={addressFieldWidth}
              height={returnAddressHeight}
              label="Rücksendezeile"
              canEdit={canEdit && !!onSenderChange}
            >
              <div className="space-y-2">
                <Label className="text-xs">Absender</Label>
                <Select
                  value={selectedSenderId || 'none'}
                  onValueChange={(v) => onSenderChange?.(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Absender wählen..." />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="none">Kein Absender</SelectItem>
                    {senderInfos.map((info) => (
                      <SelectItem key={info.id} value={info.id}>{info.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </EditableCanvasOverlay>

            {includeTextFieldOverlays && (
            <EditableCanvasOverlay
              top={50 + returnAddressHeight}
              left={MARGIN_L_MM}
              width={addressFieldWidth}
              height={addressZoneHeight}
              label="Empfängeradresse"
              canEdit={canEdit && !!(onRecipientNameChange || onRecipientAddressChange)}
            >
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Aus Kontakten wählen</Label>
                  <ContactSelector
                    onSelect={(c) => onRecipientContactSelect?.(c)}
                    selectedContactId={selectedRecipientContactId}
                    placeholder="Kontakt aus Adressbuch wählen..."
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8 text-xs"
                    value={recipientAddress?.name || ''}
                    onChange={(e) => onRecipientNameChange?.(e.target.value)}
                    placeholder="Empfängername"
                  />
                </div>
                <div>
                  <Label className="text-xs">Adresse</Label>
                  <Textarea
                    className="text-xs min-h-[60px]"
                    value={recipientAddress?.address || ''}
                    onChange={(e) => onRecipientAddressChange?.(e.target.value)}
                    placeholder="Straße, PLZ Ort"
                    rows={3}
                  />
                </div>
              </div>
            </EditableCanvasOverlay>
            )}

            <EditableCanvasOverlay
              top={50}
              left={125}
              width={75}
              height={40}
              label="Informationsblock"
              canEdit={canEdit && !!onInfoBlockChange}
            >
              <div className="space-y-2">
                <Label className="text-xs">Blöcke auswählen</Label>
                {informationBlocks.map((block) => (
                  <label key={block.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedInfoBlockIds.includes(block.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...selectedInfoBlockIds, block.id]
                          : selectedInfoBlockIds.filter((id: string) => id !== block.id);
                        onInfoBlockChange?.(newIds);
                      }}
                      className="rounded border-input"
                    />
                    {block.label}
                  </label>
                ))}
                {informationBlocks.length === 0 && (
                  <p className="text-xs text-muted-foreground">Keine Blöcke verfügbar</p>
                )}
              </div>
            </EditableCanvasOverlay>

            {includeTextFieldOverlays && (
            <>
            <EditableCanvasOverlay
              top={subjectTopMm}
              left={MARGIN_L_MM}
              width={CONTENT_W_MM}
              height={subjectHeightMm + 2}
              label="Betreff"
              canEdit={canEdit && !!onSubjectChange}
            >
              <div>
                <Label className="text-xs">Betreff</Label>
                <Input
                  className="h-8 text-xs"
                  value={subject || ''}
                  onChange={(e) => onSubjectChange?.(e.target.value)}
                  placeholder="Betreff des Briefes"
                />
              </div>
            </EditableCanvasOverlay>

            {/* Anlagen-Overlay entfernt: Bearbeitung erfolgt inline im Content-Flow */}

            {salutation && (
              <EditableCanvasOverlay
                top={subjectTopMm + subjectHeightMm + gapAfterSubjectMm}
                left={MARGIN_L_MM}
                width={CONTENT_W_MM}
                height={salutationHeightMm + 2}
                label="Anrede"
                canEdit={canEdit && !!onSalutationChange}
              >
                <div>
                  <Label className="text-xs">Anrede</Label>
                  <Input
                    className="h-8 text-xs"
                    value={salutation || ''}
                    onChange={(e) => onSalutationChange?.(e.target.value)}
                    placeholder="Sehr geehrte Damen und Herren,"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leer = automatische Anrede
                  </p>
                </div>
              </EditableCanvasOverlay>
            )}
            </>
            )}
          </>
  );

  // ── Google-Docs-Modus: one continuous sheet with live editor and page-break markers ──
  const renderInlinePage = () => {
    const sheetHeightMm = Math.max(PAGE_H_MM, contentStartMm + flowHeightMm + 40);
    const breakMarkers = pageOffsets.slice(1).map((offset, i) => ({ top: contentStartMm + offset, page: i + 2 }));
    return (
      <div
        className="mx-auto bg-white text-black relative"
        style={{
          width: `${PAGE_W_MM}mm`,
          minHeight: `${sheetHeightMm}mm`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
          fontSize: `${contentFontSizePt}pt`,
          lineHeight: bodyLineHeightRatio,
        }}
      >
        <DIN5008LetterLayout
          template={template}
          senderInfo={senderInfo}
          informationBlock={informationBlock}
          recipientAddress={recipientAddress}
          subject={subject}
          letterDate={letterDate}
          referenceNumber={referenceNumber}
          content=""
          attachments={[]}
          showPagination={false}
          layoutSettings={layoutSettings}
          salutation={salutation}
          hideClosing={true}
          allowContentOverflow={false}
          subjectEditor={renderSubjectEditor()}
          salutationEditor={renderSalutationEditor()}
          recipientEditor={renderRecipientEditor()}
          subjectRef={setSubjectMeasureEl}
          salutationRef={setSalutationMeasureEl}
          addressFieldElements={addressFieldElements}
          returnAddressElements={returnAddressElements}
          infoBlockElements={infoBlockElements}
          subjectElements={subjectElements}
          attachmentElements={attachmentElements}
          footerTextElements={footerTextElements}
          addressFieldLines={addressFieldLines}
          returnAddressLines={returnAddressLines}
          infoBlockLines={infoBlockLines}
        />
        <div
          style={{
            position: 'absolute',
            top: `${contentStartMm}mm`,
            left: `${MARGIN_L_MM}mm`,
            right: `${MARGIN_R_MM}mm`,
            fontSize: `${contentFontSizePt}pt`,
            lineHeight: bodyLineHeightRatio,
            color: '#000',
            zIndex: 20,
            cursor: 'text',
          }}
        >
          {renderContentFlow(true)}
        </div>
        {breakMarkers.map((m) => (
          <div
            key={`break-${m.page}`}
            aria-hidden="true"
            style={{ position: 'absolute', top: `${m.top}mm`, left: 0, right: 0, pointerEvents: 'none', zIndex: 25 }}
            className="border-t border-dashed border-primary/50"
          >
            <span className="absolute right-[2mm] -top-[3.5mm] text-[7pt] text-primary bg-background/90 px-1 rounded-sm">
              Seitenumbruch – ab hier Seite {m.page}
            </span>
          </div>
        ))}
        {renderOverlays(false)}
      </div>
    );
  };

  // ── single page renderer (viewport/offset model) ──
  const renderPage = (pageIndex: number) => {
    const isFirst = pageIndex === 0;
    const localTopMm = isFirst ? contentStartMm : page2TopMm;

    // Use measured page offsets for offset and body height
    const offsetMm = pageOffsets[pageIndex] ?? 0;
    const nextOffset = pageOffsets[pageIndex + 1] ?? flowHeightMm;
    const bodyHeightMm = isFirst
      ? Math.min(page1BodyMmRaw, nextOffset - offsetMm)
      : Math.min(pageNBodyMmRaw, nextOffset - offsetMm);

    return (
      <div
        key={`page-${pageIndex}`}
        className="mx-auto bg-white text-black relative"
        style={{
          width: `${PAGE_W_MM}mm`,
          height: `${PAGE_H_MM}mm`,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
          fontSize: `${contentFontSizePt}pt`,
          lineHeight: bodyLineHeightRatio,
          marginBottom: pageIndex < totalPages - 1 ? '8mm' : 0,
        }}
      >
        {/* ── Page chrome (header, address zones, footer) — page 1 only ── */}
        {isFirst && (
          <DIN5008LetterLayout
            template={template}
            senderInfo={senderInfo}
            informationBlock={informationBlock}
            recipientAddress={recipientAddress}
            subject={subject}
            letterDate={letterDate}
            referenceNumber={referenceNumber}
            content=""
            attachments={[]}
            showPagination={false}
            layoutSettings={layoutSettings}
            salutation={salutation}
            hideClosing={true}
            allowContentOverflow={false}
            subjectRef={setSubjectMeasureEl}
            salutationRef={setSalutationMeasureEl}
            addressFieldElements={addressFieldElements}
            returnAddressElements={returnAddressElements}
            infoBlockElements={infoBlockElements}
            subjectElements={subjectElements}
            attachmentElements={attachmentElements}
            footerTextElements={footerTextElements}
            addressFieldLines={addressFieldLines}
            returnAddressLines={returnAddressLines}
            infoBlockLines={infoBlockLines}
          />
        )}

        {/* ── Fold/hole marks on all pages ── */}
        {!isFirst && layout.foldHoleMarks?.enabled !== false && (() => {
          const marks = layout.foldHoleMarks ?? { enabled: true, left: 3, strokeWidthPt: 1, foldMarkWidth: 5, holeMarkWidth: 8, topMarkY: 105, holeMarkY: 148.5, bottomMarkY: 210 };
          const markLeft = marks.left ?? 3;
          const foldW = marks.foldMarkWidth ?? 5;
          const holeW = marks.holeMarkWidth ?? 8;
          const strokePt = marks.strokeWidthPt ?? 1;
          const topY = marks.topMarkY ?? 105;
          const holeY = marks.holeMarkY ?? 148.5;
          const bottomY = marks.bottomMarkY ?? 210;
          return (
            <>
              {[topY, bottomY].map((y) => (
                <div key={`fold-${y}`} style={{
                  position: 'absolute', top: `${y}mm`, left: `${markLeft}mm`,
                  width: `${foldW}mm`, height: 0,
                  borderTop: `${strokePt}pt solid #999`,
                }} />
              ))}
              <div style={{
                position: 'absolute', top: `${holeY}mm`, left: `${markLeft}mm`,
                width: `${holeW}mm`, height: 0,
                borderTop: `${strokePt}pt solid #999`,
              }} />
            </>
          );
        })()}

        {/* ── Body viewport: shows a window into the content flow ── */}
        <div
          style={{
            position: 'absolute',
            top: `${localTopMm}mm`,
            left: `${MARGIN_L_MM}mm`,
            right: `${MARGIN_R_MM}mm`,
            height: `${bodyHeightMm}mm`,
            overflow: 'hidden',
            fontSize: `${contentFontSizePt}pt`,
            lineHeight: bodyLineHeightRatio,
            color: '#000',
          }}
        >
          {/* Inner flow shifted by offset */}
          <div
            style={{
              transform: `translateY(-${offsetMm}mm)`,
              width: '100%',
            }}
          >
            {renderContentFlow()}
          </div>
        </div>

        {/* ── Pagination ── */}
        {paginationEnabled && (
          <div
            style={{
              position: 'absolute',
              top: `${paginationTopMm}mm`,
              right: layout.pagination?.align === 'left' ? 'auto' : `${MARGIN_R_MM}mm`,
              left: layout.pagination?.align === 'left' ? `${MARGIN_L_MM}mm` : undefined,
              fontSize: `${layout.pagination?.fontSize ?? 8}pt`,
              color: '#666',
              fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
              pointerEvents: 'none',
            }}
          >
            Seite {pageIndex + 1} von {totalPages}
          </div>
        )}

        {/* ── Editable overlays (page 1 only) ── */}
        {isFirst && renderOverlays()}

        {/* Click-to-edit on body zone */}
        {canEdit && onRequestContentEdit && (
          <button
            type="button"
            onClick={() => onRequestContentEdit()}
            aria-label="Brieftext bearbeiten"
            style={{
              position: 'absolute',
              top: `${localTopMm}mm`,
              left: `${MARGIN_L_MM}mm`,
              right: `${MARGIN_R_MM}mm`,
              height: `${bodyHeightMm}mm`,
              background: 'transparent',
              border: '1px dashed transparent',
              cursor: 'text',
              transition: 'border-color 0.15s',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(59,130,246,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          />
        )}
      </div>
    );
  };

  // ── main render ──
  return (
    <div
      className="flex flex-col h-full"
      style={{ '--letter-paragraph-gap': `${bodyParagraphGapMm}mm` } as React.CSSProperties}
    >
      {/* Hidden measurement container — same width/font as real body */}
      <div
        ref={flowMeasureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          width: `${CONTENT_W_MM}mm`,
          fontSize: `${contentFontSizePt}pt`,
          fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
          lineHeight: bodyLineHeightRatio,
          top: '-99999px',
          left: '-99999px',
        }}
      >
        {renderContentFlow()}
      </div>

      {/* Toolbar */}
      <div className="flex-none flex items-center justify-between gap-2 p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
          {templateName && (
            <Badge variant="outline" className="text-xs gap-1 shrink-0">
              <Layout className="h-3 w-3" />
              {templateName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="h-7 px-2"
            onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs min-w-[50px] text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline" size="sm" className="h-7 px-2"
            onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="sm" className="h-7 px-2"
            onClick={() => setZoom(0.75)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className="flex-1 overflow-auto bg-muted/50" style={{ padding: '24px' }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            paddingBottom: `${(1 - zoom) * totalPages * PAGE_H_MM * MM_TO_PX}px`,
          }}
        >
          {inlineEditor ? renderInlinePage() : Array.from({ length: totalPages }, (_, i) => renderPage(i))}
        </div>
      </div>

      <style>{`
        .inline-edit-field {
          border-radius: 2px;
          transition: background-color 120ms ease, box-shadow 120ms ease;
          cursor: text;
        }
        .inline-edit-field:hover {
          background-color: rgba(59, 130, 246, 0.05);
        }
        .inline-edit-field:focus {
          background-color: rgba(59, 130, 246, 0.07);
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
        }
        .inline-edit-field:empty::before {
          content: attr(data-placeholder);
          color: rgba(0, 0, 0, 0.35);
          pointer-events: none;
        }
        .din5008-content-text,
        .din5008-content-text * {
          color: #000 !important;
        }
        .din5008-content-text p {
          margin: 0 0 var(--letter-paragraph-gap, 4.5mm) 0;
        }
        .din5008-content-text p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
};
