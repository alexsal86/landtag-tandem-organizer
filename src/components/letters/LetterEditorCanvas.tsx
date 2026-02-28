import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContactSelector } from '@/components/ContactSelector';
import { DIN5008LetterLayout } from './DIN5008LetterLayout';
import { supabase } from '@/integrations/supabase/client';
import { EditableCanvasOverlay } from './EditableCanvasOverlay';
import EnhancedLexicalEditor from '@/components/EnhancedLexicalEditor';
import { useContentPagination, FOLLOW_PAGE_CONTENT_TOP_MM } from './useContentPagination';
import { CSS_PX_PER_MM } from '@/lib/units';
import type { HeaderElement } from '@/components/canvas-engine/types';
import type { BlockLine } from '@/components/letters/BlockLineEditor';

interface LetterEditorCanvasProps {
  // Letter data
  subject?: string;
  salutation?: string;
  content: string;
  contentNodes?: any;
  recipientAddress?: any;
  letterDate?: string;
  referenceNumber?: string;
  attachments?: any[];
  showPagination?: boolean;

  // Template/layout data
  template?: any;
  layoutSettings?: any;
  senderInfo?: any;
  informationBlock?: any;

  // Substituted block elements
  addressFieldElements?: HeaderElement[];
  returnAddressElements?: HeaderElement[];
  infoBlockElements?: HeaderElement[];
  subjectElements?: HeaderElement[];
  attachmentElements?: HeaderElement[];
  footerTextElements?: HeaderElement[];
  addressFieldLines?: BlockLine[];
  returnAddressLines?: BlockLine[];
  infoBlockLines?: BlockLine[];

  // Editor controls
  canEdit?: boolean;
  documentId?: string;
  onContentChange: (content: string, contentNodes?: string, contentHtml?: string) => void;
  onMentionInsert?: (userId: string, displayName: string) => void;

  // Track Changes / Review mode
  isReviewMode?: boolean;
  reviewerName?: string;
  reviewerId?: string;
  showAcceptReject?: boolean;

  // Editable field callbacks
  onSubjectChange?: (subject: string) => void;
  onSalutationChange?: (salutation: string) => void;
  onRecipientNameChange?: (name: string) => void;
  onRecipientAddressChange?: (address: string) => void;
  onRecipientContactSelect?: (contact: any) => void;
  onSenderChange?: (senderId: string) => void;
  onInfoBlockChange?: (blockIds: string[]) => void;

  // Data for popover selects
  senderInfos?: any[];
  informationBlocks?: any[];
  selectedSenderId?: string;
  selectedRecipientContactId?: string;
  selectedInfoBlockIds?: string[];
  templateName?: string;

  // Zoom
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

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
  senderInfos = [],
  informationBlocks = [],
  selectedSenderId,
  selectedRecipientContactId,
  selectedInfoBlockIds = [],
  templateName,
  zoom: externalZoom,
  onZoomChange,
}) => {
  const toFontSizePt = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
      const match = value.trim().toLowerCase().match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) return value.includes('px') ? parsed * 0.75 : parsed;
      }
    }
    return fallback;
  };

  const [internalZoom, setInternalZoom] = useState(0.75);
  const [contentHeightMm, setContentHeightMm] = useState(0);
  const toolbarPortalRef = useRef<HTMLDivElement>(null);
  const editorMeasureRef = useRef<HTMLDivElement>(null);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;

  const layout = layoutSettings || template?.layout_settings || {};
  const closingFormula = layout.closing?.formula;

  // Compute content top position (after subject + salutation)
  const subjectTopMm = layout.subject?.top || 98.46;
  const subjectFontSizePt = toFontSizePt(layout.subject?.fontSize, 11);
  const salutationFontSizePt = toFontSizePt(layout.salutation?.fontSize, 11);
  const contentFontSizePt = toFontSizePt(layout.content?.fontSize, salutationFontSizePt);

  const lineHeightMm = layout.content?.lineHeight || 4.5;
  const subjectLineMm = subject ? (subjectFontSizePt * 0.3528 * 1.2) : 0;
  const gapAfterSubjectMm = subject ? (lineHeightMm * 2) : 0;
  const salutationLineMm = salutation ? (salutationFontSizePt * 0.3528 * 1.2) : 0;
  const gapAfterSalutationMm = salutation ? lineHeightMm : 0;

  const editorTopMm = subjectTopMm + subjectLineMm + gapAfterSubjectMm + salutationLineMm + gapAfterSalutationMm;

  // Footer/pagination constraints  
  const footerTopMm = layout.footer?.top || 272;

  // Layout positions for overlays
  const addressFieldTop = 50;
  const addressFieldLeft = 25;
  const addressFieldWidth = layout.addressField?.width || 85;
  const returnAddressHeight = layout.addressField?.returnAddressHeight || 17.7;
  const addressZoneHeight = layout.addressField?.addressZoneHeight || 27.3;
  const infoBlockLeft = 125;
  const infoBlockWidth = 75;
  const infoBlockHeight = 40;

  // ── ResizeObserver to measure editor content height ──
  useEffect(() => {
    const el = editorMeasureRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const heightPx = entry.contentRect.height;
        setContentHeightMm(heightPx / CSS_PX_PER_MM);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Pagination ──
  const { totalPages, pages } = useContentPagination(editorTopMm, footerTopMm, contentHeightMm);

  // Closing block height estimate (mm)
  const closingHeightMm = closingFormula ? 25 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar above canvas */}
      <div className="flex-none flex items-center justify-between gap-2 p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
          <div ref={toolbarPortalRef} className="flex items-center" />
          {templateName && (
            <Badge variant="outline" className="text-xs gap-1 shrink-0">
              <Layout className="h-3 w-3" />
              {templateName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs min-w-[50px] text-center font-medium">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setZoom(0.75)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas area – scrollable container with page gaps */}
      <div className="flex-1 overflow-auto bg-muted/50" style={{ padding: '24px' }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: `${(zoom - 1) * 297 * totalPages}mm`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* ═══ Render each page ═══ */}
          {pages.map((page) => {
            const isPage1 = page.pageNumber === 1;
            return (
              <div
                key={page.pageNumber}
                className="bg-white relative"
                style={{
                  width: '210mm',
                  height: '297mm',
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
                  fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
                  fontSize: `${contentFontSizePt}pt`,
                  lineHeight: '1.2',
                  flexShrink: 0,
                }}
              >
                {/* DIN5008 Layout (header, address, info, footer, pagination, fold marks) */}
                <DIN5008LetterLayout
                  template={template}
                  senderInfo={senderInfo}
                  informationBlock={informationBlock}
                  recipientAddress={recipientAddress}
                  subject={subject}
                  letterDate={letterDate}
                  referenceNumber={referenceNumber}
                  content=""
                  attachments={attachments}
                  showPagination={showPagination}
                  layoutSettings={layoutSettings}
                  salutation={salutation}
                  hideClosing={true}
                  pageNumber={page.pageNumber}
                  totalPages={totalPages}
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

                {/* ── Editable Overlays (page 1 only) ── */}
                {isPage1 && (
                  <>
                    <EditableCanvasOverlay
                      top={addressFieldTop}
                      left={addressFieldLeft}
                      width={addressFieldWidth}
                      height={returnAddressHeight}
                      label="Rücksendezeile"
                      canEdit={canEdit && !!onSenderChange}
                    >
                      <div className="space-y-2">
                        <Label className="text-xs">Absender</Label>
                        <Select
                          value={selectedSenderId || 'none'}
                          onValueChange={(value) => onSenderChange?.(value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Absender wählen..." />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="none">Kein Absender</SelectItem>
                            {senderInfos.map((info: any) => (
                              <SelectItem key={info.id} value={info.id}>{info.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </EditableCanvasOverlay>

                    <EditableCanvasOverlay
                      top={addressFieldTop + returnAddressHeight}
                      left={addressFieldLeft}
                      width={addressFieldWidth}
                      height={addressZoneHeight}
                      label="Empfängeradresse"
                      canEdit={canEdit && !!(onRecipientNameChange || onRecipientAddressChange)}
                    >
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Aus Kontakten wählen</Label>
                          <ContactSelector
                            onSelect={(contact) => onRecipientContactSelect?.(contact)}
                            selectedContactId={selectedRecipientContactId}
                            placeholder="Kontakt aus Adressbuch wählen..."
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input className="h-8 text-xs" value={recipientAddress?.name || ''} onChange={(e) => onRecipientNameChange?.(e.target.value)} placeholder="Empfängername" />
                        </div>
                        <div>
                          <Label className="text-xs">Adresse</Label>
                          <Textarea className="text-xs min-h-[60px]" value={recipientAddress?.address || ''} onChange={(e) => onRecipientAddressChange?.(e.target.value)} placeholder="Straße, PLZ Ort" rows={3} />
                        </div>
                      </div>
                    </EditableCanvasOverlay>

                    <EditableCanvasOverlay
                      top={addressFieldTop}
                      left={infoBlockLeft}
                      width={infoBlockWidth}
                      height={infoBlockHeight}
                      label="Informationsblock"
                      canEdit={canEdit && !!onInfoBlockChange}
                    >
                      <div className="space-y-2">
                        <Label className="text-xs">Blöcke auswählen</Label>
                        {informationBlocks.map((block: any) => (
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

                    <EditableCanvasOverlay
                      top={subjectTopMm}
                      left={25}
                      width={165}
                      height={subjectLineMm + 2}
                      label="Betreff"
                      canEdit={canEdit && !!onSubjectChange}
                    >
                      <div>
                        <Label className="text-xs">Betreff</Label>
                        <Input className="h-8 text-xs" value={subject || ''} onChange={(e) => onSubjectChange?.(e.target.value)} placeholder="Betreff des Briefes" />
                      </div>
                    </EditableCanvasOverlay>

                    {salutation && (
                      <EditableCanvasOverlay
                        top={subjectTopMm + subjectLineMm + gapAfterSubjectMm}
                        left={25}
                        width={165}
                        height={salutationLineMm + 2}
                        label="Anrede"
                        canEdit={canEdit && !!onSalutationChange}
                      >
                        <div>
                          <Label className="text-xs">Anrede</Label>
                          <Input className="h-8 text-xs" value={salutation || ''} onChange={(e) => onSalutationChange?.(e.target.value)} placeholder="Sehr geehrte Damen und Herren," />
                          <p className="text-xs text-muted-foreground mt-1">Leer = automatische Anrede</p>
                        </div>
                      </EditableCanvasOverlay>
                    )}
                  </>
                )}

                {/* ── Editor content clipped to this page ── */}
                <div
                  style={{
                    position: 'absolute',
                    top: isPage1 ? `${editorTopMm}mm` : `${FOLLOW_PAGE_CONTENT_TOP_MM}mm`,
                    left: '25mm',
                    right: '20mm',
                    height: `${page.contentHeightMm}mm`,
                    overflow: 'hidden',
                    zIndex: 10,
                  }}
                >
                  <div
                    ref={isPage1 ? editorMeasureRef : undefined}
                    style={{
                      position: 'relative',
                      top: isPage1 ? 0 : `-${page.contentOffsetMm}mm`,
                    }}
                  >
                    {isPage1 && (
                      <div
                        className="group"
                        style={{
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
                        onMouseLeave={(e) => { 
                          if (!e.currentTarget.contains(document.activeElement)) e.currentTarget.style.borderColor = 'transparent'; 
                        }}
                        onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; }}
                        onBlurCapture={(e) => { 
                          if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.style.borderColor = 'transparent'; 
                        }}
                      >
                        <div className="letter-canvas-editor">
                          <EnhancedLexicalEditor
                            content={content}
                            contentNodes={contentNodes}
                            onChange={onContentChange}
                            placeholder="Brieftext hier eingeben..."
                            documentId={documentId}
                            showToolbar={canEdit}
                            editable={canEdit}
                            onMentionInsert={onMentionInsert}
                            renderToolbarPortal={toolbarPortalRef}
                            defaultFontSize={`${contentFontSizePt}pt`}
                            isReviewMode={isReviewMode}
                            reviewerName={reviewerName}
                            reviewerId={reviewerId}
                            showAcceptReject={showAcceptReject}
                          />
                          <style>{`
                            .letter-canvas-editor > .relative {
                              border: none !important;
                              border-radius: 0 !important;
                              min-height: auto !important;
                              background: transparent !important;
                            }
                            .letter-canvas-editor .editor-input {
                              min-height: 50px !important;
                              padding: 0 !important;
                              background: transparent !important;
                              font-family: Arial, sans-serif !important;
                              font-size: ${contentFontSizePt}pt !important;
                              line-height: 1.2 !important;
                              color: #000 !important;
                            }
                            .letter-canvas-editor .editor-placeholder {
                              left: 0 !important;
                              top: 0 !important;
                            }
                          `}</style>
                        </div>
                      </div>
                    )}
                    {/* Follow pages: render a non-interactive clone of the editor content that is offset */}
                    {!isPage1 && (
                      <div
                        className="letter-canvas-editor"
                        style={{ pointerEvents: 'none' }}
                      >
                        <EnhancedLexicalEditor
                          content={content}
                          contentNodes={contentNodes}
                          onChange={() => {}}
                          placeholder=""
                          documentId={documentId}
                          showToolbar={false}
                          editable={false}
                          defaultFontSize={`${contentFontSizePt}pt`}
                          isReviewMode={isReviewMode}
                          reviewerName={reviewerName}
                          reviewerId={reviewerId}
                          showAcceptReject={false}
                        />
                        <style>{`
                          .letter-canvas-editor > .relative {
                            border: none !important;
                            border-radius: 0 !important;
                            min-height: auto !important;
                            background: transparent !important;
                          }
                          .letter-canvas-editor .editor-input {
                            min-height: 50px !important;
                            padding: 0 !important;
                            background: transparent !important;
                            font-family: Arial, sans-serif !important;
                            font-size: ${contentFontSizePt}pt !important;
                            line-height: 1.2 !important;
                            color: #000 !important;
                          }
                          .letter-canvas-editor .editor-placeholder {
                            left: 0 !important;
                            top: 0 !important;
                          }
                        `}</style>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic closing block on the last page */}
                {page.pageNumber === totalPages && closingFormula && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `${297 - footerTopMm + 2}mm`,
                      left: '25mm',
                      right: '20mm',
                      zIndex: 5,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{ fontSize: `${layout.closing?.fontSize || 11}pt`, color: '#000' }}>
                      {closingFormula}
                    </div>
                    {layout.closing?.signatureImagePath && (() => {
                      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(layout.closing.signatureImagePath!);
                      return (
                        <div style={{ marginTop: '2mm', marginBottom: '2mm' }}>
                          <img src={publicUrl} alt="Unterschrift" style={{ maxHeight: '15mm', maxWidth: '50mm', objectFit: 'contain' }} />
                        </div>
                      );
                    })()}
                    {!layout.closing?.signatureImagePath && layout.closing?.signatureName && <div style={{ height: '4.5mm' }} />}
                    {layout.closing?.signatureName && (
                      <div style={{ fontSize: `${layout.closing?.fontSize || 11}pt`, color: '#000' }}>
                        {layout.closing.signatureName}
                      </div>
                    )}
                    {layout.closing?.signatureTitle && (
                      <div style={{ fontSize: `${(layout.closing?.fontSize || 11) - 1}pt`, color: '#555' }}>
                        {layout.closing.signatureTitle}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
