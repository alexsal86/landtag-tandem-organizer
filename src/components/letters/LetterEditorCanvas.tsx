import React, { useEffect, useState, useRef } from 'react';
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
import type { HeaderElement } from '@/components/canvas-engine/types';
import type { BlockLine } from '@/components/letters/BlockLineEditor';

// ─── DIN A4 constants ────────────────────────────────────────────────────────
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_L_MM = 25;
const MARGIN_R_MM = 20;
const CONTENT_W_MM = PAGE_W_MM - MARGIN_L_MM - MARGIN_R_MM; // 165 mm

// 1 mm = 3.7795 px @ 96 dpi
const MM_TO_PX = 3.7795;
const mmToPx = (mm: number) => mm * MM_TO_PX;
const pxToMm = (px: number) => px / MM_TO_PX;

// ─── Types ───────────────────────────────────────────────────────────────────
interface PageSlice {
  html: string;
}

interface LetterEditorCanvasProps {
  subject?: string;
  salutation?: string;
  content: string;
  contentNodes?: any;
  recipientAddress?: any;
  letterDate?: string;
  referenceNumber?: string;
  attachments?: any[];
  showPagination?: boolean;
  template?: any;
  layoutSettings?: any;
  senderInfo?: any;
  informationBlock?: any;
  addressFieldElements?: HeaderElement[];
  returnAddressElements?: HeaderElement[];
  infoBlockElements?: HeaderElement[];
  subjectElements?: HeaderElement[];
  attachmentElements?: HeaderElement[];
  footerTextElements?: HeaderElement[];
  addressFieldLines?: BlockLine[];
  returnAddressLines?: BlockLine[];
  infoBlockLines?: BlockLine[];
  canEdit?: boolean;
  documentId?: string;
  onContentChange: (content: string, contentNodes?: string, contentHtml?: string) => void;
  enableInlineContentEditing?: boolean;
  onRequestContentEdit?: () => void;
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
  onRecipientContactSelect?: (contact: any) => void;
  onSenderChange?: (senderId: string) => void;
  onInfoBlockChange?: (blockIds: string[]) => void;
  senderInfos?: any[];
  informationBlocks?: any[];
  selectedSenderId?: string;
  selectedRecipientContactId?: string;
  selectedInfoBlockIds?: string[];
  templateName?: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

// ─── HTML page splitter ───────────────────────────────────────────────────────
/**
 * Splits HTML into per-page slices by measuring each top-level DOM node
 * in a hidden container and greedily filling pages.
 *
 * Each node is kept intact (no mid-paragraph splitting). If a single node
 * is taller than one page it occupies its own page.
 */
function splitHtmlIntoPages(
  html: string,
  page1HeightMm: number,
  pageNHeightMm: number,
  fontSizePt: number,
  contentWidthPx: number,
): PageSlice[] {
  if (!html?.trim()) return [{ html: '' }];

  // Hidden measurement host
  const host = document.createElement('div');
  host.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    `width:${contentWidthPx}px`,
    `font-size:${fontSizePt}pt`,
    'font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif',
    'line-height:1.2',
    'top:-99999px',
    'left:-99999px',
  ].join(';');
  document.body.appendChild(host);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const nodes = Array.from(wrapper.childNodes);

  const pages: PageSlice[] = [];
  let pageIdx = 0;
  let usedMm = 0;
  let sliceNodes: Node[] = [];

  const availMm = (i: number) => (i === 0 ? page1HeightMm : pageNHeightMm);

  const flushPage = () => {
    const tmp = document.createElement('div');
    sliceNodes.forEach((n) => tmp.appendChild(n.cloneNode(true)));
    pages.push({ html: tmp.innerHTML });
  };

  for (const node of nodes) {
    // Measure this node in isolation
    host.innerHTML = '';
    host.appendChild(node.cloneNode(true));
    const nodeHeightMm = pxToMm(host.scrollHeight);
    const avail = availMm(pageIdx);

    if (sliceNodes.length > 0 && usedMm + nodeHeightMm > avail) {
      // Current node overflows → flush current page and start a new one
      flushPage();
      pageIdx++;
      sliceNodes = [];
      usedMm = 0;
    }

    sliceNodes.push(node.cloneNode(true));
    usedMm += nodeHeightMm;
  }

  if (sliceNodes.length > 0) flushPage();

  document.body.removeChild(host);
  return pages.length > 0 ? pages : [{ html: '' }];
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

  // ── layout ──
  const layout = layoutSettings || template?.layout_settings || {};
  const contentFontSizePt = toFontSizePt(
    layout.content?.fontSize ?? layout.salutation?.fontSize, 11,
  );
  const subjectFontSizePt = toFontSizePt(layout.subject?.fontSize, 13);
  const salutationFontSizePt = toFontSizePt(layout.salutation?.fontSize, 11);
  const closingFontSizePt = toFontSizePt(layout.closing?.fontSize, 11);

  const footerTopMm: number = layout.footer?.top ?? 272;
  const page2TopMm: number = layout.margins?.top ?? 25;

  // ── where content starts on page 1 ──
  const subjectTopMm: number = layout.subject?.top ?? 98.46;
  const subjectHeightMm = subject ? subjectFontSizePt * 0.3528 * 1.2 : 0;
  const gapAfterSubjectMm = subject ? 9 : 0;          // ~2 blank lines
  const salutationHeightMm = salutation ? salutationFontSizePt * 0.3528 * 1.2 : 0;
  const gapAfterSalutationMm = salutation ? 4.5 : 0;  // ~1 blank line
  const contentStartMm =
    subjectTopMm
    + subjectHeightMm
    + gapAfterSubjectMm
    + salutationHeightMm
    + gapAfterSalutationMm;

  // ── available body height per page ──
  const page1BodyMm = footerTopMm - contentStartMm;
  const pageNBodyMm = footerTopMm - page2TopMm;

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

  // ── split into pages ──
  const [pages, setPages] = useState<PageSlice[]>([{ html: '' }]);
  const splitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(splitTimer.current);
    splitTimer.current = setTimeout(() => {
      const slices = splitHtmlIntoPages(
        renderedHtml,
        page1BodyMm,
        pageNBodyMm,
        contentFontSizePt,
        mmToPx(CONTENT_W_MM),
      );
      setPages(slices);
    }, 150); // debounce: avoid layout thrash while typing
    return () => clearTimeout(splitTimer.current);
  }, [renderedHtml, page1BodyMm, pageNBodyMm, contentFontSizePt]);

  const totalPages = pages.length;

  // ── overlay dimensions ──
  const addressFieldWidth: number = layout.addressField?.width ?? 85;
  const returnAddressHeight: number = layout.addressField?.returnAddressHeight ?? 17.7;
  const addressZoneHeight: number = layout.addressField?.addressZoneHeight ?? 27.3;

  // ── closing block ──
  const renderClosing = () => {
    if (!closingFormula) return null;
    return (
      <div style={{
        fontSize: `${closingFontSizePt}pt`,
        color: '#000',
        fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
      }}>
        <div style={{ height: '9mm' }} />
        <div>{closingFormula}</div>
        {closingImagePath && (() => {
          const { data: { publicUrl } } = supabase.storage
            .from('letter-assets')
            .getPublicUrl(closingImagePath);
          return (
            <div style={{ marginTop: '2mm', marginBottom: '2mm' }}>
              <img
                src={publicUrl}
                alt="Unterschrift"
                style={{ maxHeight: '15mm', maxWidth: '50mm', objectFit: 'contain' }}
              />
            </div>
          );
        })()}
        {!closingImagePath && closingName && <div style={{ height: '4.5mm' }} />}
        {closingName && <div>{closingName}</div>}
        {closingTitle && (
          <div style={{ fontSize: `${closingFontSizePt - 1}pt`, color: '#555' }}>
            {closingTitle}
          </div>
        )}
      </div>
    );
  };

  // ── attachment list ──
  const renderAttachments = () => {
    const list = (attachments ?? [])
      .map((a) => (typeof a === 'string' ? a : a.display_name || a.file_name || ''))
      .filter(Boolean);
    if (!list.length) return null;
    return (
      <div style={{
        marginTop: closingFormula ? '4.5mm' : '13.5mm',
        fontSize: `${contentFontSizePt}pt`,
        color: '#000',
        fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
      }}>
        <div style={{ fontWeight: 700 }}>Anlagen</div>
        {list.map((name, i) => (
          <div key={`${name}-${i}`} style={{ marginTop: '1mm', paddingLeft: '5mm' }}>
            – {name}
          </div>
        ))}
      </div>
    );
  };

  // ── single page renderer ──
  const renderPage = (pageIndex: number) => {
    const slice = pages[pageIndex] ?? { html: '' };
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === totalPages - 1;
    const localTopMm = isFirst ? contentStartMm : page2TopMm;
    // Height available for body text on this page
    const bodyHeightMm = footerTopMm - localTopMm;

    return (
      <div
        key={`page-${pageIndex}`}
        className="mx-auto bg-white relative"
        style={{
          width: `${PAGE_W_MM}mm`,
          height: `${PAGE_H_MM}mm`,
          // hard clip — content CANNOT overflow the page boundary
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
          fontSize: `${contentFontSizePt}pt`,
          lineHeight: '1.2',
          marginBottom: pageIndex < totalPages - 1 ? '8mm' : 0,
        }}
      >
        {/* ── Page chrome (header, address zones, footer) ── */}
        {isFirst ? (
          <DIN5008LetterLayout
            template={template}
            senderInfo={senderInfo}
            informationBlock={informationBlock}
            recipientAddress={recipientAddress}
            subject={subject}
            letterDate={letterDate}
            referenceNumber={referenceNumber}
            content=""      // we render content ourselves
            attachments={[]}
            showPagination={false}
            layoutSettings={layoutSettings}
            salutation={salutation}
            hideClosing={true}
            allowContentOverflow={false}
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
        ) : (
          // Pages 2+: only footer chrome, no header or address block
          <DIN5008LetterLayout
            template={template}
            senderInfo={senderInfo}
            informationBlock={undefined}
            recipientAddress={null}
            subject={undefined}
            content=""
            showPagination={false}
            layoutSettings={layoutSettings}
            hideClosing={true}
            allowContentOverflow={false}
            footerTextElements={footerTextElements}
          />
        )}

        {/* ── Body content for this page slice ──
            height is exactly the body zone → overflow:hidden clips anything
            that might exceed the footer boundary (should not happen after
            splitting, but this is the safety net). ── */}
        <div
          style={{
            position: 'absolute',
            top: `${localTopMm}mm`,
            left: `${MARGIN_L_MM}mm`,
            right: `${MARGIN_R_MM}mm`,
            height: `${bodyHeightMm}mm`,
            overflow: 'hidden',
            fontSize: `${contentFontSizePt}pt`,
            lineHeight: '1.2',
            color: '#000',
          }}
        >
          <div
            className="din5008-content-text"
            dangerouslySetInnerHTML={{ __html: slice.html }}
          />

          {/* Closing + attachments flow after body on the last page */}
          {isLast && (
            <>
              {renderClosing()}
              {renderAttachments()}
            </>
          )}
        </div>

        {/* ── Pagination ── */}
        {showPagination && (
          <div
            style={{
              position: 'absolute',
              top: '263.77mm',
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
        {isFirst && (
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
                    {senderInfos.map((info: any) => (
                      <SelectItem key={info.id} value={info.id}>{info.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </EditableCanvasOverlay>

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
              zIndex: 20,
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
    <div className="flex flex-col h-full">
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
            // Let the scroll container see the correct height after scaling
            paddingBottom: `${(1 - zoom) * totalPages * PAGE_H_MM * MM_TO_PX}px`,
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => renderPage(i))}
        </div>
      </div>

      <style>{`
        .din5008-content-text,
        .din5008-content-text * {
          color: #000 !important;
        }
        .din5008-content-text p {
          margin: 0 0 4.5mm 0;
        }
        .din5008-content-text p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
};
