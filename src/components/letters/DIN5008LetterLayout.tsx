import React from 'react';
import { Card } from '@/components/ui/card';

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
  showPagination = false
}) => {
  const formatAddress = (address: any) => {
    if (!address) return '';
    
    // Handle different address formats
    const parts = [];
    
    // If address has structured fields or simple name+address format
    if (typeof address === 'object' && address.name) {
      if (address.name) parts.push(address.name);
      
      // Check if this is the simple {name, address} format
      if (address.address && typeof address.address === 'string') {
        // Split address string into lines and add each non-empty line
        const addressLines = address.address.split('\n').filter(line => line.trim());
        parts.push(...addressLines);
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
            <div>{info.block_data.custom_content}</div>
          </div>
        );
      default:
        return null;
    }
  };

  // Footer blocks rendering (identical to PDF logic)
  const renderFooterBlocks = () => {
    if (!template?.footer_blocks) return null;
    
    const footerBlocks = Array.isArray(template.footer_blocks) ? template.footer_blocks : [];
    const sortedBlocks = footerBlocks.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    return (
      <div 
        className="flex" 
        style={{ 
          position: 'absolute',
          top: '272mm', // DIN 5008 footer position (exact as PDF)
          left: '25mm',
          right: '20mm',
          height: '18mm', // Footer area height
          fontSize: '8pt',
          backgroundColor: debugMode ? 'rgba(128,0,128,0.05)' : 'transparent'
        }}
      >
        {sortedBlocks.map((block: any, index: number) => {
          if (!block.content) return null;
          
          const blockWidth = `${block.widthPercent || 25}%`;
          const fontSize = Math.max(6, Math.min(14, block.fontSize || 8)) + 'pt';
          const lineHeight = block.lineHeight || 0.8;
          const fontWeight = block.fontWeight === 'bold' ? 'bold' : 'normal';
          const color = block.color || '#000000';
          
          return (
            <div 
              key={index}
              style={{ 
                width: blockWidth,
                fontSize: fontSize,
                fontWeight: fontWeight,
                color: color,
                lineHeight: lineHeight,
                paddingRight: '2mm'
              }}
            >
              {/* Block title with highlight support */}
              {block.title && (
                <div style={{
                  fontWeight: block.titleHighlight ? (block.titleFontWeight || 'bold') : 'bold',
                  fontSize: block.titleHighlight ? Math.max(8, Math.min(20, block.titleFontSize || 13)) + 'pt' : fontSize,
                  color: block.titleHighlight ? (block.titleColor || '#107030') : color,
                  marginBottom: '1mm'
                }}>
                  {block.title}
                </div>
              )}
              
              {/* Block content with formatting */}
              <div style={{ whiteSpace: 'pre-line' }}>
                {block.content
                  .replace(/^Tel: /, '') // Remove "Tel: " prefix
                  .replace(/^Web: /, '') // Remove "Web: " prefix
                  .replace(/^https?:\/\/(www\.)?/, '') // Clean URLs
                  .replace(/@/, '@\n') // Line break after @
                  .replace(/^Instagram: /, '@ ') // Replace social media prefixes
                  .replace(/^Facebook: /, '@ ')
                }
              </div>
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
            width: '85mm', // DIN 5008 standard
            height: '40mm', // DIN 5008 standard
            border: debugMode ? '2px dashed red' : 'none',
            padding: '0', // Kein interner Abstand
            marginRight: '10mm',
            backgroundColor: debugMode ? 'rgba(255,0,0,0.05)' : 'transparent'
          }}>
            {/* Return Address Line at top of address field - 17.7mm height */}
            {senderInfo?.return_address_line && (
              <div style={{
                fontSize: '7pt',
                borderBottom: '0.5pt solid #000',
                paddingBottom: '1mm',
                marginBottom: '3mm',
                lineHeight: '1.0',
                maxWidth: '75mm', // Prevent overflow
                height: '17.7mm', // DIN 5008 Rücksendeangaben-Höhe
                display: 'flex',
                alignItems: 'flex-end' // Text am unteren Rand der 17.7mm
              }}>
                {senderInfo.return_address_line}
              </div>
            )}
            
            {/* Recipient Address */}
            <div style={{ 
              fontSize: '10pt', // Slightly larger for better readability
              lineHeight: '1.2',
              maxWidth: '75mm' // Prevent overflow
            }}>
              {formatAddress(recipientAddress)}
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
            {renderInformationBlock(informationBlock)}
            
            {letterDate && !informationBlock && (
              <div style={{ marginTop: '8mm' }}>
                <div className="font-medium" style={{ fontSize: '9pt' }}>Datum</div>
                <div style={{ fontSize: '9pt' }}>{new Date(letterDate).toLocaleDateString('de-DE')}</div>
              </div>
            )}
          </div>
        </div>

      {/* Subject Line - positioned at 98.46mm + 3mm from page top (same as PDF) */}
      {subject && (
        <div style={{ 
          position: 'absolute',
          top: 'calc(98.46mm + 3mm)', // Betreff beginnt unter der Linie
          left: '25mm',
          right: '20mm',
          fontWeight: 'bold',
          fontSize: '11pt',
          backgroundColor: debugMode ? 'rgba(0,255,0,0.05)' : 'transparent'
        }}>
          {subject}
        </div>
      )}

      {/* Letter Content - starts after subject line (same as PDF) */}
      <div 
        style={{ 
          position: 'absolute',
          top: subject ? 'calc(98.46mm + 11mm)' : 'calc(98.46mm + 3mm)', // Start below subject or below content line
          left: '25mm',
          right: '20mm',
          maxHeight: '161mm', // Until footer starts at 272mm
          fontSize: '11pt',
          lineHeight: '1.2',
          backgroundColor: debugMode ? 'rgba(0,255,0,0.02)' : 'transparent',
          overflow: 'hidden'
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />

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
          top: '281.15mm', // 297mm - 15.85mm from bottom
          right: '20mm',
          fontSize: '8pt',
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
            top: 'calc(272mm - 4.23mm)',
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
            }}>Paginierung: 4.23mm über Fußzeile</span>
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