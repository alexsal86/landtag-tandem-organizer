import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DIN5008LetterLayout } from './DIN5008LetterLayout';
import EnhancedLexicalEditor from '@/components/EnhancedLexicalEditor';
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
  onMentionInsert,
  zoom: externalZoom,
  onZoomChange,
}) => {
  const [internalZoom, setInternalZoom] = useState(0.75);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;

  const layout = layoutSettings || template?.layout_settings || {};
  const closingFormula = layout.closing?.formula;
  const hasSignature = Boolean(layout.closing?.signatureName || layout.closing?.signatureImagePath);

  // Compute content top position (after subject + salutation)
  const subjectTopMm = layout.subject?.top || 98.46;
  const subjectFontSizePt = layout.subject?.fontSize || 11;
  const salutationFontSizePt = layout.salutation?.fontSize || 11;

  // Calculate where editor starts: subject line + 2 blank lines + salutation + 1 blank line
  // Each "blank line" ≈ 4.5mm at 11pt
  const lineHeightMm = layout.content?.lineHeight || 4.5;
  const subjectLineMm = subject ? (subjectFontSizePt * 0.3528 * 1.2) : 0; // pt to mm with line-height
  const gapAfterSubjectMm = subject ? (lineHeightMm * 2) : 0; // 2 blank lines
  const salutationLineMm = salutation ? (salutationFontSizePt * 0.3528 * 1.2) : 0;
  const gapAfterSalutationMm = salutation ? lineHeightMm : 0; // 1 blank line

  const editorTopMm = subjectTopMm + subjectLineMm + gapAfterSubjectMm + salutationLineMm + gapAfterSalutationMm;

  // Footer/pagination constraints
  const paginationTopMm = 263.77;
  const paginationEnabled = showPagination && (layout.pagination?.enabled ?? true);
  const footerTopMm = layout.footer?.top || 272;

  // Available height for the content editor (before closing/attachments/footer)
  // We let the content flow naturally and let the page scroll if needed
  const closingHeightMm = closingFormula ? 20 : 0; // rough estimate for closing area
  const attachmentHeightMm = (attachments?.length || 0) > 0 ? ((attachments?.length || 0) * 5 + 10) : 0;
  const maxEditorHeightMm = Math.max(40, (paginationEnabled ? paginationTopMm - 4.23 : footerTopMm) - editorTopMm - closingHeightMm - attachmentHeightMm);

  return (
    <div className="flex flex-col h-full">
      {/* Zoom toolbar */}
      <div className="flex-none flex items-center justify-end gap-2 p-2 border-b bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs min-w-[50px] text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => setZoom(0.75)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Canvas area - scrollable gray background with centered A4 page */}
      <div className="flex-1 overflow-auto bg-muted/50" style={{ padding: '24px' }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: `${(zoom - 1) * 297}mm`,
          }}
        >
          <div
            className="mx-auto bg-white relative"
            style={{
              width: '210mm',
              minHeight: '297mm',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
              fontFamily: 'Arial, sans-serif',
              fontSize: '11pt',
              lineHeight: '1.2',
            }}
          >
            {/* Render the full DIN5008 letter layout as background - but hide the content area */}
            {/* We overlay the Lexical editor on top of the content area */}
            
            {/* Use DIN5008LetterLayout for all the static parts */}
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

            {/* Overlay: Lexical Editor positioned exactly where the content text goes */}
            <div
              style={{
                position: 'absolute',
                top: `${editorTopMm}mm`,
                left: '25mm',
                right: '20mm',
                maxHeight: `${maxEditorHeightMm}mm`,
                zIndex: 10,
              }}
            >
              <div
                className="group"
                style={{
                  border: '1px solid transparent',
                  borderRadius: '2px',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
                onMouseLeave={(e) => { 
                  if (!e.currentTarget.contains(document.activeElement)) {
                    e.currentTarget.style.borderColor = 'transparent'; 
                  }
                }}
                onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; }}
                onBlurCapture={(e) => { 
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    e.currentTarget.style.borderColor = 'transparent'; 
                  }
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
                    font-size: 11pt !important;
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
