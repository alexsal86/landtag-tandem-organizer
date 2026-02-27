import React from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { HeaderElement, TextElement } from '@/components/canvas-engine/types';
import { type BlockLine, type BlockLineData, isLineMode } from '@/components/letters/BlockLineEditor';
import { buildFooterBlocksFromStored } from '@/components/letters/footerBlockUtils';

interface DIN5008LetterLayoutProps {
  template?: any;
  senderInfo?: any;
  informationBlock?: any;
  recipientAddress?: any;
  content: string;
  subject?: string;
  letterDate?: string;
  referenceNumber?: string;
  attachments?: any[];
  className?: string;
  debugMode?: boolean;
  showPagination?: boolean;
  layoutSettings?: any;
  salutation?: string;
  // Canvas-based block elements (substituted)
  addressFieldElements?: HeaderElement[];
  returnAddressElements?: HeaderElement[];
  infoBlockElements?: HeaderElement[];
  subjectElements?: HeaderElement[];
  attachmentElements?: HeaderElement[];
  footerTextElements?: HeaderElement[];
  // Line-mode block data (substituted)
  addressFieldLines?: BlockLine[];
  returnAddressLines?: BlockLine[];
  infoBlockLines?: BlockLine[];
}

export const DIN5008LetterLayout: React.FC<DIN5008LetterLayoutProps> = ({
  template,
  senderInfo,
  informationBlock,
  recipientAddress,
  content,
  subject,
  letterDate,
  referenceNumber,
  attachments,
  className = "",
  debugMode = false,
  showPagination = false,
  layoutSettings,
  salutation,
  addressFieldElements,
  returnAddressElements,
  infoBlockElements,
  subjectElements,
  attachmentElements,
  footerTextElements,
  addressFieldLines,
  returnAddressLines,
  infoBlockLines,
}) => {
  // Load layout settings from prop, template, or use defaults
  const DEFAULT_LAYOUT = {
    pageWidth: 210,
    pageHeight: 297,
    margins: { left: 25, right: 20, top: 45, bottom: 25 },
    header: { height: 45, marginBottom: 8.46 },
    addressField: { top: 46, left: 25, width: 85, height: 40 },
    infoBlock: { top: 50, left: 125, width: 75, height: 40 },
    subject: { top: 98.46, marginBottom: 8 },
    content: { top: 98.46, maxHeight: 165, lineHeight: 4.5 },
    footer: { top: 272, height: 18 },
    attachments: { top: 230 }
  };
  
  const layout = layoutSettings || template?.layout_settings || DEFAULT_LAYOUT;
  const paginationGapMm = 4.23;
  const paginationHeightMm = 4.23;
  const contentTopMm = Number(layout.content?.top ?? 98.46);
  const footerTopMm = Number(layout.footer?.top ?? 272);
  const paginationTopMm = Number(layout.pagination?.top ?? (footerTopMm - paginationGapMm - paginationHeightMm));
  const contentMaxHeightMm = showPagination
    ? Math.max(20, paginationTopMm - paginationGapMm - contentTopMm)
    : 165;
  const formatAddress = (address: any) => {
    if (!address) return '';
    
    // Handle different address formats
    const parts = [];
    
    // If address has structured fields or simple name+address format
    if (typeof address === 'object' && address.name) {
      if (address.name) parts.push(address.name);
      
      // Check if this is the simple {name, address} format
      if (address.address && typeof address.address === 'string') {
        // Split address string into lines and filter empty lines
        const addressLines = address.address.split('\n').filter(line => line.trim());
        
        // Prevent duplication: skip first line if it matches the name
        if (addressLines.length > 0 && addressLines[0].trim() === address.name?.trim()) {
          // First line is the name, so add remaining lines only
          parts.push(...addressLines.slice(1));
        } else {
          // First line is not the name, add all address lines
          parts.push(...addressLines);
        }
      } else {
        // Otherwise, it's the structured format
        if (address.company) parts.push(address.company);
        if (address.street) parts.push(address.street);
        if (address.postal_code && address.city) {
          parts.push(`${address.postal_code} ${address.city}`);
        }
        if (address.country && address.country !== 'Deutschland') {
          parts.push(address.country);
        }
      }
    } 
    // If address is a simple string
    else if (typeof address === 'string') {
      return address;
    }
    // If address has recipient_name and recipient_address separately 
    else if (address.recipient_name || address.recipient_address) {
      if (address.recipient_name) parts.push(address.recipient_name);
      if (address.recipient_address) {
        // Split address string into lines and add each non-empty line
        const addressLines = address.recipient_address.split('\n').filter(line => line.trim());
        parts.push(...addressLines);
      }
    }
    
    return parts.join('\n');
  };

  const formatSenderAddress = (sender: any) => {
    if (!sender) return '';
    const parts = [];
    if (sender.organization) parts.push(sender.organization);
    if (sender.name) parts.push(sender.name);
    if (sender.street && sender.house_number) {
      parts.push(`${sender.street} ${sender.house_number}`);
    }
    if (sender.postal_code && sender.city) {
      parts.push(`${sender.postal_code} ${sender.city}`);
    }
    return parts.join('\n');
  };

  const renderInformationBlock = (info: any) => {
    if (!info) return null;

    switch (info.block_type) {
      case 'contact':
        return (
          <div className="space-y-1">
            <div className="font-medium">{info.label}</div>
            {info.block_data.contact_name && (
              <div>{info.block_data.contact_name}</div>
            )}
            {info.block_data.contact_title && (
              <div className="text-sm text-muted-foreground">{info.block_data.contact_title}</div>
            )}
            {info.block_data.contact_phone && (
              <div className="text-sm">Tel: {info.block_data.contact_phone}</div>
            )}
            {info.block_data.contact_email && (
              <div className="text-sm">{info.block_data.contact_email}</div>
            )}
          </div>
        );
      case 'date':
        const date = new Date();
        const formatDate = (date: Date, format: string) => {
          switch (format) {
            case 'dd.mm.yyyy':
              return date.toLocaleDateString('de-DE');
            case 'dd.mm.yy':
              return date.toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });
            case 'yyyy-mm-dd':
              return date.toISOString().split('T')[0];
            default:
              return date.toLocaleDateString('de-DE');
          }
        };
        return (
          <div className="space-y-1">
            <div className="font-medium">{info.label}</div>
            <div>{formatDate(date, info.block_data.date_format || 'dd.mm.yyyy')}</div>
            {info.block_data.show_time && (
              <div className="text-sm">{date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
            )}
          </div>
        );
      case 'reference':
        return (
          <div className="space-y-1">
            <div className="font-medium">{info.label}</div>
            <div>
              {info.block_data.reference_prefix && `${info.block_data.reference_prefix} `}
              {referenceNumber || info.block_data.reference_pattern}
            </div>
          </div>
        );
      case 'custom':
        return (
          <div className="space-y-1">
            <div className="font-medium">{info.label}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{info.block_data.custom_content}</div>
          </div>
        );
      default:
        return null;
    }
  };

  // Footer blocks rendering (identical to PDF logic)
  const renderFooterBlocks = () => {
    if (!template?.footer_blocks) return null;

    const sortedBlocks = buildFooterBlocksFromStored(template.footer_blocks);

    return (
      <div
        className="flex"
        style={{
          position: 'absolute',
          top: '272mm',
          left: '25mm',
          right: '20mm',
          height: '18mm',
          fontSize: '8pt',
          backgroundColor: debugMode ? 'rgba(128,0,128,0.05)' : 'transparent'
        }}
      >
        {sortedBlocks.map((block: any, index: number) => {
          const blockWidth = block.widthUnit === 'cm'
            ? `${Math.max(1, Number(block.widthValue) || 1)}cm`
            : `${Math.max(1, Number(block.widthValue) || 25)}%`;

          return (
            <div
              key={block.id || index}
              style={{ width: blockWidth, paddingRight: '2mm', fontSize: '8pt', lineHeight: 1 }}
            >
              {block.title && <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{block.title}</div>}
              <div>
                {(block.lines || []).map((line: any, lineIndex: number) => {
                  if (line.type === 'spacer') {
                    return <div key={lineIndex} style={{ height: `${Math.max(0.5, Number(line.spacerHeight) || 1)}mm` }} />;
                  }
                  const content = line.type === 'label-value'
                    ? `${line.label || ''} ${line.value || ''}`.trim()
                    : (line.value || '');
                  if (!content) return null;
                  return <div key={lineIndex} style={{ fontSize: `${Math.max(6, Math.min(12, Number(line.fontSize) || 8))}pt`, fontWeight: line.valueBold ? 'bold' : 'normal', color: line.color || undefined }}>{content}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  /** Render canvas-based block elements positioned in mm coordinates */
  const renderCanvasBlockElements = (elements: HeaderElement[]) => (
    <div className="relative w-full h-full">
      {elements.map((element, index) => {
        if (element.type === 'text') {
          const textEl = element as TextElement;
          return (
            <div
              key={element.id || index}
              className="absolute"
              style={{
                left: `${element.x || 0}mm`,
                top: `${element.y || 0}mm`,
                width: element.width ? `${element.width}mm` : 'auto',
                fontSize: `${textEl.fontSize || 10}pt`,
                fontFamily: textEl.fontFamily || 'Arial, sans-serif',
                fontWeight: textEl.fontWeight || 'normal',
                fontStyle: textEl.fontStyle || 'normal',
                textDecoration: textEl.textDecoration || 'none',
                color: textEl.color || '#000000',
                lineHeight: `${textEl.textLineHeight || 1.2}`,
                textAlign: textEl.textAlign || 'left',
                whiteSpace: element.width ? 'pre-wrap' : 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {textEl.content || ''}
            </div>
          );
        }
        if (element.type === 'image' && (element as any).imageUrl) {
          return (
            <img
              key={element.id || index}
              src={(element as any).imageUrl}
              alt=""
              className="absolute"
              style={{
                left: `${element.x || 0}mm`,
                top: `${element.y || 0}mm`,
                width: `${element.width || 20}mm`,
                height: `${element.height || 10}mm`,
                objectFit: 'contain',
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );

  /** Render line-mode block lines sequentially */
  const renderBlockLines = (lines: BlockLine[], options?: { underlineLastContentLine?: boolean }) => {
    const lastContentIndex = options?.underlineLastContentLine
      ? [...lines].map((line, index) => ({ line, index })).reverse().find((entry) => entry.line.type !== 'spacer')?.index ?? -1
      : -1;

    return (
      <div className="space-y-0" style={{ fontFamily: 'Arial, sans-serif' }}>
        {lines.map((line, index) => {
          if (line.type === 'spacer') {
            return <div key={line.id} style={{ height: `${line.spacerHeight || 2}mm` }} />;
          }

          const underlineThisLine = index === lastContentIndex;
          const lineWrapperStyle: React.CSSProperties = underlineThisLine
            ? { display: 'inline-block', borderBottom: '0.5pt solid #000', paddingBottom: '0.3mm' }
            : { display: 'inline-block' };

          if (line.type === 'text-only') {
            return (
              <div key={line.id} style={{ lineHeight: '1.3' }}>
                <span style={{ ...lineWrapperStyle, fontSize: `${line.fontSize || 9}pt`, fontWeight: line.valueBold ? 'bold' : 'normal' }}>
                  {line.value || '\u00A0'}
                </span>
              </div>
            );
          }

          // label-value
          return (
            <div key={line.id} style={{ lineHeight: '1.3' }}>
              <span style={{ ...lineWrapperStyle, fontSize: `${line.fontSize || 9}pt` }}>
                <span style={{ fontWeight: line.labelBold !== false ? 'bold' : 'normal' }}>{line.label || ''}</span>
                <span style={{ fontWeight: line.valueBold ? 'bold' : 'normal' }}>{line.value || ''}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

    return (
    <div className={`din5008-letter bg-white ${className}`} style={{ 
      minHeight: '297mm', 
      width: '210mm', 
      margin: '0 auto',
      padding: '0',
      fontFamily: 'Arial, sans-serif',
      fontSize: '11pt',
      lineHeight: '1.2',
      position: 'relative'
    }}>
      {/* Template Header */}
      {template && (
        <div 
          className="letter-header"
          style={{ 
            height: '45mm',
            borderBottom: '1px solid #e0e0e0',
            marginBottom: '8.46mm'
          }}
        >
          {template.header_layout_type === 'structured' && template.header_text_elements ? (
            <div 
              className="relative bg-white w-full h-full overflow-hidden"
              style={{ 
                width: '100%',
                height: '100%',
                position: 'relative'
              }}
            >
              {template.header_text_elements.map((element: any, index: number) => (
                <div key={index}>
                  {element.type === 'text' && (
                    <div
                      className="absolute"
                      style={{
                        // Use direct mm coordinates - same as PDF generation
                        left: `${element.x || 0}mm`,
                        top: `${element.y || 0}mm`,
                        fontSize: `${element.fontSize || 12}pt`,
                        fontFamily: element.fontFamily || 'Arial, sans-serif',
                        fontWeight: element.fontWeight || 'normal',
                        color: element.color || '#000000',
                        width: `${element.width || 100}mm`,
                        lineHeight: '1.2',
                        pointerEvents: 'none',
                        textAlign: (element.textAlign as 'left' | 'center' | 'right') || 'left',
                        fontStyle: element.fontStyle || 'normal',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {element.content || element.text}
                    </div>
                  )}
                  {element.type === 'image' && element.imageUrl && (
                    <img
                      src={element.imageUrl}
                      alt="Header Image"
                      className="absolute"
                      style={{
                        left: `${element.x || 0}mm`,
                        top: `${element.y || 0}mm`,
                        width: `${element.width || 100}mm`,
                        height: `${element.height || 50}mm`,
                        objectFit: 'contain'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : template?.letterhead_html ? (
            <div dangerouslySetInnerHTML={{ __html: template.letterhead_html }} />
          ) : null}
        </div>
      )}

      {/* All elements positioned absolutely to page - exactly like PDF */}
      
      {/* Main Address and Info Block Container - positioned at 50mm from top (same as PDF) */}
      <div className="flex" style={{ 
        position: 'absolute',
        top: '50mm', // DIN 5008 position from page top
        left: '25mm',
        right: '20mm'
      }}>
          
          {/* Recipient Address Field - DIN 5008 exact dimensions */}
          <div style={{ 
            width: `${layout.addressField?.width || 85}mm`,
            height: `${layout.addressField?.height || 45}mm`,
            border: debugMode ? '2px dashed red' : 'none',
            padding: '0',
            marginRight: '10mm',
            backgroundColor: debugMode ? 'rgba(255,0,0,0.05)' : 'transparent',
            position: 'relative',
          }}>
            {/* Vermerkzone (return address) */}
            <div style={{ height: `${layout.addressField?.returnAddressHeight || 17.7}mm`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {returnAddressLines && returnAddressLines.length > 0 ? (
                <div>
                  {renderBlockLines(returnAddressLines, { underlineLastContentLine: true })}
                </div>
              ) : returnAddressElements && returnAddressElements.length > 0 ? (
                <div style={{ position: 'relative', height: '100%' }}>
                  {renderCanvasBlockElements(returnAddressElements)}
                </div>
              ) : senderInfo?.return_address_line ? (
                <div style={{ fontSize: '7pt', lineHeight: '1.0', maxWidth: '75mm' }}>
                  {senderInfo.return_address_line.split('\n').filter((line) => line.trim()).map((line, index, arr) => (
                    <div key={`${line}-${index}`}>
                      <span style={index === arr.length - 1 ? { display: 'inline-block', borderBottom: '0.5pt solid #000', paddingBottom: '0.3mm' } : { display: 'inline-block' }}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            
            {/* Anschriftzone (recipient address) */}
            <div style={{ height: `${layout.addressField?.addressZoneHeight || 27.3}mm` }}>
              {addressFieldLines && addressFieldLines.length > 0 ? (
                renderBlockLines(addressFieldLines)
              ) : addressFieldElements && addressFieldElements.length > 0 ? (
                renderCanvasBlockElements(addressFieldElements)
              ) : (
                <div style={{ 
                  fontSize: '10pt',
                  lineHeight: '1.2',
                  maxWidth: '75mm'
                }}>
                  {formatAddress(recipientAddress)}
                </div>
              )}
            </div>
          </div>

          {/* Information Block - DIN 5008 positioned */}
          <div style={{ 
            position: 'absolute',
            left: '100mm', // 125mm from left edge of page (corrected positioning)
            top: '0mm', // Same top as address field
            width: '75mm', // DIN 5008 standard
            height: '40mm',
            backgroundColor: debugMode ? 'rgba(0,0,255,0.05)' : 'transparent',
            border: debugMode ? '2px dashed blue' : 'none',
            padding: '2mm'
          }}>
            {infoBlockLines && infoBlockLines.length > 0 ? (
              renderBlockLines(infoBlockLines)
            ) : infoBlockElements && infoBlockElements.length > 0 ? (
              renderCanvasBlockElements(infoBlockElements)
            ) : (
              <>
                {renderInformationBlock(informationBlock)}
                {letterDate && !informationBlock && (
                  <div style={{ marginTop: '8mm' }}>
                    <div className="font-medium" style={{ fontSize: '9pt' }}>Datum</div>
                    <div style={{ fontSize: '9pt' }}>{new Date(letterDate).toLocaleDateString('de-DE')}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      {/* Subject + Salutation + Content - integrated per DIN 5008 */}
      {layout.subject?.integrated !== false ? (
        /* Integrated mode: Subject → 2 blank lines → Salutation → 1 blank line → Content */
        <div 
          style={{ 
            position: 'absolute',
            top: `${layout.subject?.top || 98.46}mm`,
            left: '25mm',
            right: '20mm',
            maxHeight: `${contentMaxHeightMm}mm`,
            fontSize: '11pt',
            lineHeight: '1.2',
            backgroundColor: debugMode ? 'rgba(0,255,0,0.02)' : 'transparent',
            overflow: 'hidden'
          }}
        >
          {/* Subject line (bold) with optional prefix shape */}
          {subject && (
            <div style={{ 
              fontWeight: layout.subject?.fontWeight || 'bold', 
              fontSize: `${layout.subject?.fontSize || 11}pt`,
              marginBottom: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '2mm'
            }}>
              {layout.subject?.prefixShape && layout.subject.prefixShape !== 'none' && (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {layout.subject.prefixShape === 'line' && <span style={{ display: 'inline-block', width: '5mm', height: '0.5mm', backgroundColor: '#000' }} />}
                  {layout.subject.prefixShape === 'circle' && <span style={{ display: 'inline-block', width: '3mm', height: '3mm', borderRadius: '50%', border: '0.3mm solid #000' }} />}
                  {layout.subject.prefixShape === 'rectangle' && <span style={{ display: 'inline-block', width: '3mm', height: '3mm', border: '0.3mm solid #000' }} />}
                  {layout.subject.prefixShape === 'sunflower' && <svg width="3.5mm" height="3.5mm" viewBox="0 0 438.44 440.44" xmlns="http://www.w3.org/2000/svg"><path fill="#FAE301" d="M438.19,192.22c-1.19,4.48-6.5,4.84-5,12c-7.66,9-20.1,13.23-29.99,20c6.67,11.32,21.85,14.14,26.99,26.99c-9.87,14.8-30.1,19.23-52.99,21c8.72,14.95,31.73,24.26,33,50c-28.34,18.14-64.04-4.79-85.99-15c2.73,22.27,17.36,41.29,18.99,67.99c-33.95-2.37-42.78-29.88-64.99-44c4.32,10.2,11.41,26.26,10,47c-0.79,11.57-7.28,43.11-14,43.99c-4.15,0.55-14.93-17.16-18-20.99c-6.9-8.64-11.95-13.44-16.99-21c-4.81,16.86-8.68,34.65-17,47.99c-7.76,1.24-9.93,8.07-15,12c-8.91-21.41-13.42-47.24-20-70.99c-5.18,9.26-12.32,18.82-18.99,28c-6.25,8.58-11.15,20.55-22,21.99c2.05-19.39,4.7-41.99,3-61.99c-10.52,9.15-22.62,25.37-37,34c-3.54,0.54-2.46-3.54-6-3c-2.16-21.96-5.51-45.66,4-61.99c-17.62,11.37-33.94,24.05-58.99,27.99c-0.57-7.04,5.84-15.38,8-23c-0.35-3.31-5.76-1.57-9-2c3.7-25.63,20.74-37.92,31-56.99c-24.29-3.71-54.67-1.32-70.99-13c3.79-5.53,11.53-7.13,16.99-11c-7.76-8.23-18.7-13.29-26.99-20.99c9.26-6.32,19.59-7.2,28.99-12c13.79-7.04,26.64-13.57,48-14c-27.98-7.35-48.65-22.01-58-47.99c4.23-4.11,14.35-2.32,20-5c-4.93-9.79-14.28-20.31-16-30c7,0,12.31-1.69,20-1c-1.21-3.79-1.93-8.06-4-11c17.83-2.82,35.45,3.21,51.99,5c-8.27-19.05-19.88-34.77-26.99-54.99c24.72,0.28,41.43,8.56,55.99,19c-0.3-20.69,4.41-43.98,11-61c8.62,5.38,14.72,13.28,23,19c2.74-9.92,5-20.33,5-32.99c22.91,14.41,44.17,30.48,50.99,60.99c6.41-31.25,29.82-45.5,51.99-60.99c7.65,14.2,9.75,33.98,8,54.99c15.43-12.23,26.75-28.58,51-32c3.01,11.13-1.78,22.81-1,35c13.71-5.65,24.24-19.7,37.99-22c0.63,35.96-13.66,57-29.99,75.99c27.03-3.96,52.23-9.76,73.99-19c-7.15,33.85-21.89,60.11-55,68C383.41,159.51,418.31,171.48,438.19,192.22z"/></svg>}
                  {layout.subject.prefixShape === 'lion' && <svg width="5mm" height="2.5mm" viewBox="0 0 151.8 62.1" xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="m 28.5,17.5 c 1.2,-0.4 1.3,-1.4 1,-2 -2.3,0.6 -5,1.3 -8.6,0.8 C 17,15.9 16.2,13.8 16.2,12.4 H 16.1 L 16,12.3 v 0.2 c -0.1,0.1 -0.2,0.3 -0.2,0.4 -1,2.2 0,4.9 4.2,5.3 4.5,0.5 7.4,-0.4 8.5,-0.7 z"/><path fill="#000" d="m 150,48.2 c -1.4,-1.4 -3,-2.6 -4.5,-3.5 -2.5,-1.5 -4.6,-2.4 -4.6,-2.4 C 140.7,39.6 139.4,35.3 137.7,31.3 c -1,-2.3 -2.2,-4.5 -3.5,-6.1 l 0.3,0.3 c 4.1,-1 7.1,-5.3 6.8,-10.2 -0.4,-6.1 -6.1,-12.5 -19.7,-9.8 -5,1 -9,2.4 -12.9,4 -4,1.7 -7.9,3.5 -12.5,5.1 C 91.5,16.2 87.6,17 84.5,16.7 81.7,16.5 79.6,15.4 78.4,13.6 76.7,11.1 79.2,8.5 80.2,7.8 82.1,6.6 83.8,4.5 82.8,1 c -1.8,0.3 -5,1.4 -7.6,3.4 -2.1,1.6 -3.8,3.9 -3.8,7 0.1,4.2 3,7.5 7.8,8.6 3.2,0.7 5.8,1 8.8,0.6 4.3,-0.6 9.7,-2.5 19.3,-6.1 9,-3.4 14,-4.9 17.9,-5.1 2.5,-0.1 4.4,0.2 6.6,1 1.4,0.5 2.3,1.3 3,2.1 0.8,1 1,2.2 1,3.3 -0.2,2.1 -1.7,4.1 -4,4.6 h -1.7 c -0.7,-0.1 -1.5,-0.2 -2.4,-0.4 -2.6,-0.5 -6.1,-1.1 -11.6,-0.5 -3.3,0.3 -7.3,1.1 -12.2,2.7 C 93.7,25.5 86,26.8 80.1,27 71.7,27.3 66.8,25.4 63,23.9 62.6,20.2 61.8,17.2 60.7,14.8 59,10.9 56.7,8.4 55.2,7.1 c 0,0 0.9,-0.5 1.3,-3.5 -2.2,-0.4 -5.2,0.8 -5.2,0.8 0,0 -5.6,-3.6 -13.2,-2.3 C 35.2,2.6 33.8,3.4 33,4.7 26.9,6.9 26.4,7.3 24.9,8.2 24,8.9 24,9.4 24,9.9 c 0,0.5 0.3,0.8 0.4,0.9 0.2,0.2 0.3,0.4 0.3,0.7 0.1,1.7 0.1,2.3 0.6,3.7 0.2,0.6 0.8,0.5 1.4,0.3 4,-1.5 5.7,0.4 5.7,2.1 0,1.5 -0.8,2.9 -3.7,3.1 h -1.3 c -0.4,0 -0.7,0 -0.7,0.6 0,0.4 0.9,2.7 1,3.1 0.4,1.2 0.7,1.4 1.7,1.4 1.9,0 4.4,-0.5 5.2,-0.7 0,0 -0.1,2.5 0.7,5.8 -6.7,-2.5 -11.8,-3.2 -17.5,-3 -5.6,0.2 -9.4,1.4 -11.9,2.8 -4.5,2.5 -4.9,5.7 -4.9,5.7 0,0 6.5,1.5 9.2,0.8 1.8,-0.6 3,-2.3 3,-2.3 0,0 4.3,0.9 9.9,3.9 2.8,1.5 6,3.5 9.2,6.3 0.1,0 7.5,-2.9 7.8,-3 0.2,-0.1 0.4,-0.1 0.6,0.2 0.2,0.2 0.1,0.5 -0.1,0.6 -0.7,0.6 -5.2,3.6 -9.8,6.3 -3,1.8 -6.2,3.7 -9,5.4 -2.2,-0.3 -3.2,-0.3 -5.2,-0.3 -4.4,0.1 -7.3,3.9 -7.3,6.7 h 17 c 0.7,-0.2 7.8,-1.7 15,-3.1 5.2,-1 10.4,-2 13.3,-2.6 1.3,-0.2 1.9,-0.4 2.2,-0.4 0.5,-0.1 0.9,-0.2 1.4,-0.6 0.2,-0.2 0.4,-0.5 0.6,-1 0.1,-0.4 0.7,-2.1 0.7,-2.1 l 3.7,-0.4 c 4.9,-0.4 9.3,-1.4 13.3,-2.7 5.1,-1.6 9.5,-3.7 13.3,-5.5 C 94.5,40.4 98.4,38.5 101.7,38.4 c -0.5,3.3 0.3,5.9 0.8,8.4 0.5,2.4 0.8,4.8 -0.5,7.7 -9.9,0 -8.8,6.6 -8.8,6.6 H 110.3 c 0,0 1.2,-3.8 4,-8.2 1.4,-2.1 3.2,-4.4 5.4,-6.4 0.4,-0.4 0.3,-0.8 0.1,-1.1 -1.9,-2.4 -2.9,-6.9 -3.1,-7.8 v -0.2 c 0,-0.2 0,-0.5 0.3,-0.5 0.3,-0.1 0.5,0 0.5,0.2 0.1,0.1 0.1,0.2 0.1,0.3 0,0.2 0.2,0.4 0.2,0.6 0.1,0.4 0.4,1 0.8,1.7 0.8,1.4 1.9,3 3.6,4.6 2.2,2.1 5,3.7 7.7,5 3.3,1.5 6.6,2.6 9,3.3 2.8,0.8 3.1,1.7 3.1,2 h -1.2 c -1.4,0.2 -3,0.3 -4.9,2.1 -1.9,1.8 -1.5,4.3 -1.5,4.3 h 11.8 c 1.5,0 2.1,-0.9 2.6,-2.6 0.3,-1.1 1.7,-6.7 1.8,-7.1 0.5,-1.7 0,-2.6 -0.6,-3.1 z"/></svg>}
                  {layout.subject.prefixShape === 'wappen' && <img src="/assets/wappen-bw.svg" alt="Wappen" style={{ width: '3.5mm', height: '3.5mm', objectFit: 'contain' }} />}
                </span>
              )}
              {subject}
            </div>
          )}
          {/* 2 blank lines after subject (or start here if no subject) */}
          {subject && <div style={{ height: '9mm' }} />}
          {/* Salutation */}
          {salutation && (
            <div style={{ fontSize: `${layout.salutation?.fontSize || 11}pt` }}>
              {salutation}
            </div>
          )}
          {/* 1 blank line after salutation */}
          {salutation && <div style={{ height: '4.5mm' }} />}
          {/* Letter content */}
          <div dangerouslySetInnerHTML={{ __html: content }} />
          {/* Closing formula + signature */}
          {layout.closing?.formula && (
            <>
              <div style={{ height: '9mm' }} />
              <div style={{ fontSize: `${layout.closing?.fontSize || 11}pt` }}>
                {layout.closing.formula}
              </div>
              {layout.closing.signatureImagePath && (
                <div style={{ marginTop: '2mm', marginBottom: '2mm' }}>
                  <img 
                    src={(() => {
                      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(layout.closing.signatureImagePath!);
                      return publicUrl;
                    })()}
                    alt="Unterschrift"
                    style={{ maxHeight: '15mm', maxWidth: '50mm', objectFit: 'contain' }}
                  />
                </div>
              )}
              {!layout.closing.signatureImagePath && layout.closing.signatureName && <div style={{ height: '4.5mm' }} />}
              {!layout.closing.signatureImagePath && !layout.closing.signatureName && null}
              {layout.closing.signatureName && (
                <div style={{ fontSize: `${layout.closing?.fontSize || 11}pt` }}>
                  {layout.closing.signatureName}
                </div>
              )}
              {layout.closing.signatureTitle && (
                <div style={{ fontSize: `${(layout.closing?.fontSize || 11) - 1}pt`, color: '#555' }}>
                  {layout.closing.signatureTitle}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Legacy mode: separate subject block + content */}
          {(subject || (subjectElements && subjectElements.length > 0)) && (
            <div style={{ 
              position: 'absolute',
              top: `calc(${contentTopMm}mm + 3mm)`,
              left: '25mm',
              right: '20mm',
              fontWeight: subjectElements && subjectElements.length > 0 ? 'normal' : 'bold',
              fontSize: '11pt',
              backgroundColor: debugMode ? 'rgba(0,255,0,0.05)' : 'transparent',
              height: subjectElements && subjectElements.length > 0 ? '12mm' : 'auto',
            }}>
              {subjectElements && subjectElements.length > 0 ? (
                renderCanvasBlockElements(subjectElements)
              ) : (
                subject
              )}
            </div>
          )}

          <div 
            style={{ 
              position: 'absolute',
              top: subject ? `calc(${contentTopMm}mm + 11mm)` : `calc(${contentTopMm}mm + 3mm)`,
              left: '25mm',
              right: '20mm',
              maxHeight: `${contentMaxHeightMm}mm`,
              fontSize: '11pt',
              lineHeight: '1.2',
              backgroundColor: debugMode ? 'rgba(0,255,0,0.02)' : 'transparent',
              overflow: 'hidden'
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </>
      )}

      {/* Attachments - positioned after content */}
      {attachments && attachments.length > 0 && (
        <div style={{ 
          position: 'absolute',
          top: '230mm', // Below main content area
          left: '25mm',
          right: '20mm',
          backgroundColor: debugMode ? 'rgba(128,128,128,0.05)' : 'transparent'
        }}>
          <div className="font-medium" style={{ marginBottom: '2mm', fontSize: '10pt' }}>
            Anlagen:
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '10pt' }}>
            {attachments.map((attachment, index) => (
              <li key={index} style={{ marginBottom: '1mm' }}>
                - {typeof attachment === 'string' ? attachment : (attachment.display_name || attachment.file_name)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Template Footer Blocks - matches PDF exactly */}
      {renderFooterBlocks()}

      {/* Fallback Sender Address Block - only if no template footer */}
      {!template?.footer_blocks && senderInfo && (
        <div style={{ 
          position: 'absolute',
          top: '272mm', // DIN 5008 footer position (same as template footer)
          left: '25mm',
          right: '20mm',
          fontSize: '8pt',
          color: '#666',
          backgroundColor: debugMode ? 'rgba(255,165,0,0.05)' : 'transparent',
          padding: debugMode ? '2mm' : '0'
        }}>
          {formatSenderAddress(senderInfo)}
          {senderInfo.phone && <div>Tel: {senderInfo.phone}</div>}
          {senderInfo.email && <div>E-Mail: {senderInfo.email}</div>}
          {senderInfo.website && <div>Web: {senderInfo.website}</div>}
        </div>
      )}

      {/* Pagination Footer */}
      {showPagination && (
        <div style={{
          position: 'absolute',
          top: `${paginationTopMm}mm`,
          left: layout.pagination?.align === 'left' ? '25mm' : undefined,
          right: layout.pagination?.align !== 'left' ? '20mm' : undefined,
          textAlign: layout.pagination?.align || 'right',
          fontSize: `${layout.pagination?.fontSize || 8}pt`,
          color: '#666',
          fontFamily: 'Arial, sans-serif'
        }}>
          Seite 1 von 1
        </div>
      )}

      {/* Custom CSS from template */}
      {template?.letterhead_css && (
        <style dangerouslySetInnerHTML={{ __html: template.letterhead_css }} />
      )}

      {/* Debug Mode Overlays - Enhanced with precise measurements */}
      {debugMode && (
        <>
          {/* DIN 5008 measurement guides - identical to PDF */}
          <div style={{
            position: 'absolute',
            top: '45mm',
            left: '0',
            right: '0',
            height: '2px',
            backgroundColor: 'red',
            zIndex: 1000
          }}>
            <span style={{
              position: 'absolute',
              left: '5mm',
              top: '-18px',
              fontSize: '9pt',
              color: 'red',
              backgroundColor: 'white',
              padding: '3px',
              border: '1px solid red'
            }}>45mm - Header Ende (DIN 5008)</span>
          </div>
          
          {/* Address field measurements */}
          <div style={{
            position: 'absolute',
            top: '50mm',
            left: '25mm',
            width: '85mm',
            height: '40mm',
            border: '2px dashed red',
            zIndex: 1000,
            pointerEvents: 'none'
          }}>
            <span style={{
              position: 'absolute',
              top: '-25px',
              left: '0',
              fontSize: '9pt',
              color: 'red',
              backgroundColor: 'white',
              padding: '3px',
              border: '1px solid red'
            }}>Adressfeld: 85×40mm @ 50mm/25mm</span>
            
            {/* Return address area indicator */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '85mm',
              height: '17.7mm',
              border: '1px dashed rgba(255,100,100,0.8)',
              backgroundColor: 'rgba(255,100,100,0.1)'
            }}>
              <span style={{
                position: 'absolute',
                top: '14mm',
                left: '2mm',
                fontSize: '6pt',
                color: 'rgba(255,100,100,1)',
                backgroundColor: 'white',
                padding: '1px'
              }}>Rücksendeangaben: 17.7mm</span>
            </div>
          </div>
          
          {/* Info block measurements */}
          <div style={{
            position: 'absolute',
            top: '50mm',
            left: '125mm',
            width: '75mm',
            height: '40mm',
            border: '2px dashed blue',
            zIndex: 1000,
            pointerEvents: 'none'
          }}>
            <span style={{
              position: 'absolute',
              top: '-25px',
              left: '0',
              fontSize: '9pt',
              color: 'blue',
              backgroundColor: 'white',
              padding: '3px',
              border: '1px solid blue'
            }}>Info-Block: 75×40mm @ 50mm/125mm</span>
          </div>
          
          {/* Content start line */}
          <div style={{
            position: 'absolute',
            top: '98.46mm',
            left: '25mm',
            right: '20mm',
            height: '2px',
            backgroundColor: 'green',
            zIndex: 1000
          }}>
            <span style={{
              position: 'absolute',
              left: '0',
              top: '-18px',
              fontSize: '9pt',
              color: 'green',
              backgroundColor: 'white',
              padding: '3px',
              border: '1px solid green'
            }}>98.46mm - Inhaltsbeginn (DIN 5008)</span>
          </div>

          {/* Footer area measurement */}
          <div style={{
            position: 'absolute',
            top: '272mm',
            left: '25mm',
            right: '20mm',
            height: '18mm',
            border: '2px dashed purple',
            zIndex: 1000,
            pointerEvents: 'none',
            backgroundColor: 'rgba(128,0,128,0.05)'
          }}>
            <span style={{
              position: 'absolute',
              top: '-25px',
              left: '0',
              fontSize: '9pt',
              color: 'purple',
              backgroundColor: 'white',
              padding: '3px',
              border: '1px solid purple'
            }}>Fußzeile: 272mm-290mm (18mm Höhe)</span>
          </div>

          {/* Pagination position indicator */}
          <div style={{
            position: 'absolute',
            top: 'calc(272mm - 8.46mm)',
            left: '25mm',
            right: '20mm',
            height: '4.23mm',
            border: '1px dashed magenta',
            zIndex: 1000,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255,0,255,0.1)'
          }}>
            <span style={{
              position: 'absolute',
              top: '-18px',
              right: '0',
              fontSize: '8pt',
              color: 'magenta',
              backgroundColor: 'white',
              padding: '2px',
              border: '1px solid magenta'
            }}>Paginierung: Unterkante 4.23mm über Fußzeile</span>
          </div>

          {/* Left margin guide */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '25mm',
            width: '2px',
            height: '100%',
            backgroundColor: 'orange',
            opacity: 0.7,
            zIndex: 999
          }}>
            <span style={{
              position: 'absolute',
              left: '5px',
              top: '15mm',
              fontSize: '8pt',
              color: 'orange',
              backgroundColor: 'white',
              padding: '2px',
              transform: 'rotate(90deg)',
              transformOrigin: 'left',
              border: '1px solid orange'
            }}>Linker Rand: 25mm</span>
          </div>
          
          {/* Right margin guide */}
          <div style={{
            position: 'absolute',
            top: '0',
            right: '20mm',
            width: '2px',
            height: '100%',
            backgroundColor: 'orange',
            opacity: 0.7,
            zIndex: 999
          }}>
            <span style={{
              position: 'absolute',
              right: '5px',
              top: '15mm',
              fontSize: '8pt',
              color: 'orange',
              backgroundColor: 'white',
              padding: '2px',
              transform: 'rotate(90deg)',
              transformOrigin: 'right',
              border: '1px solid orange'
            }}>Rechter Rand: 20mm</span>
          </div>
          
          {/* Bottom margin guide */}
          <div style={{
            position: 'absolute',
            bottom: '16.9mm',
            left: '0',
            right: '0',
            height: '2px',
            backgroundColor: 'purple',
            opacity: 0.7,
            zIndex: 999
          }}>
            <span style={{
              position: 'absolute',
              left: '5mm',
              bottom: '5px',
              fontSize: '8pt',
              color: 'purple',
              backgroundColor: 'white',
              padding: '2px',
              border: '1px solid purple'
            }}>Unterer Rand: 16.9mm</span>
          </div>
          
          {/* Page dimensions indicator */}
          <div style={{
            position: 'absolute',
            top: '5mm',
            right: '5mm',
            fontSize: '8pt',
            color: '#333',
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: '5px',
            border: '1px solid #333',
            borderRadius: '3px'
          }}>
            <div><strong>DIN A4:</strong> 210×297mm</div>
            <div><strong>Schriftart:</strong> Arial 11pt</div>
            <div><strong>Zeilenabstand:</strong> 1.2</div>
          </div>
        </>
      )}
    </div>
  );
};
