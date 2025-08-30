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
  attachments?: string[];
  className?: string;
  debugMode?: boolean;
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
  debugMode = false
}) => {
  const formatAddress = (address: any) => {
    if (!address) return '';
    
    // Handle different address formats
    const parts = [];
    
    // If address has structured fields
    if (typeof address === 'object' && address.name) {
      if (address.name) parts.push(address.name);
      if (address.company) parts.push(address.company);
      if (address.street) parts.push(address.street);
      if (address.postal_code && address.city) {
        parts.push(`${address.postal_code} ${address.city}`);
      }
      if (address.country && address.country !== 'Deutschland') {
        parts.push(address.country);
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
      {template?.letterhead_html && (
        <div 
          className="letter-header"
          style={{ 
            height: '45mm',
            borderBottom: '1px solid #e0e0e0',
            marginBottom: '8.46mm'
          }}
          dangerouslySetInnerHTML={{ __html: template.letterhead_html }}
        />
      )}

      {/* Letter Content Area - DIN 5008 konform */}
      <div style={{ 
        position: 'relative',
        paddingTop: '60mm', // Start after header area (45mm + 15mm margin)
        paddingLeft: '24.1mm', // DIN 5008 left margin
        paddingRight: '20mm', // DIN 5008 right margin
        paddingBottom: '16.9mm' // Bottom margin
      }}>
        
        {/* Main Address and Info Block Container - positioned at 105mm from top */}
        <div className="flex" style={{ 
          position: 'absolute',
          top: '105mm', // DIN 5008 standard position
          left: '24.1mm',
          right: '20mm',
          marginBottom: '8.46mm'
        }}>
          
          {/* Recipient Address Field - DIN 5008 exact dimensions */}
          <div style={{ 
            width: '85mm', // DIN 5008 standard
            height: '40mm', // DIN 5008 standard
            border: debugMode ? '1px solid #e0e0e0' : 'none',
            padding: '5mm 5mm 5mm 5mm', // Internal padding
            marginRight: '10mm',
            backgroundColor: debugMode ? 'rgba(255,0,0,0.05)' : 'transparent'
          }}>
            {/* Return Address Line at top of address field */}
            {senderInfo?.return_address_line && (
              <div style={{
                fontSize: '7pt',
                borderBottom: '0.5pt solid #000',
                paddingBottom: '1mm',
                marginBottom: '3mm',
                lineHeight: '1.0',
                maxWidth: '75mm' // Prevent overflow
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
            width: '75mm', // DIN 5008 standard
            height: '40mm',
            backgroundColor: debugMode ? 'rgba(0,0,255,0.05)' : 'transparent',
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

        {/* Subject Line - positioned at 169mm from top */}
        {subject && (
          <div style={{ 
            position: 'absolute',
            top: '169mm', // DIN 5008 content start
            left: '24.1mm',
            right: '20mm',
            marginBottom: '8.46mm',
            fontWeight: 'bold',
            fontSize: '11pt',
            backgroundColor: debugMode ? 'rgba(0,255,0,0.05)' : 'transparent'
          }}>
            {subject}
          </div>
        )}

        {/* Letter Content - starts after subject line */}
        <div 
          style={{ 
            position: 'absolute',
            top: subject ? '185mm' : '169mm', // Start below subject or at content line
            left: '24.1mm',
            right: '20mm',
            minHeight: '100mm',
            fontSize: '11pt',
            lineHeight: '1.2',
            backgroundColor: debugMode ? 'rgba(0,255,0,0.02)' : 'transparent'
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Attachments - positioned after content */}
        {attachments && attachments.length > 0 && (
          <div style={{ 
            position: 'absolute',
            top: '230mm', // Below main content area
            left: '24.1mm',
            right: '20mm',
            marginTop: '8.46mm',
            backgroundColor: debugMode ? 'rgba(128,128,128,0.05)' : 'transparent'
          }}>
            <div className="font-medium" style={{ marginBottom: '2mm', fontSize: '10pt' }}>
              Anlagen:
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '10pt' }}>
              {attachments.map((attachment, index) => (
                <li key={index} style={{ marginBottom: '1mm' }}>
                  - {attachment}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sender Address Block - DIN 5008 footer position */}
        {senderInfo && (
          <div style={{ 
            position: 'absolute',
            bottom: '16.9mm', // DIN 5008 bottom margin
            left: '24.1mm',
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
      </div>

      {/* Custom CSS from template */}
      {template?.letterhead_css && (
        <style dangerouslySetInnerHTML={{ __html: template.letterhead_css }} />
      )}

      {/* Debug Mode Overlays - Enhanced with precise measurements */}
      {debugMode && (
        <>
          {/* DIN 5008 measurement guides */}
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
            top: '105mm',
            left: '24.1mm',
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
            }}>Adressfeld: 85×40mm @ 105mm/24.1mm</span>
            
            {/* Window position indicator */}
            <div style={{
              position: 'absolute',
              top: '5mm',
              left: '5mm',
              fontSize: '7pt',
              color: 'red',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '1px'
            }}>Fenster: 5mm Innenabstand</div>
          </div>
          
          {/* Info block measurements */}
          <div style={{
            position: 'absolute',
            top: '105mm',
            left: '119.1mm',
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
            }}>Info-Block: 75×40mm @ 119.1mm</span>
          </div>
          
          {/* Content start line */}
          <div style={{
            position: 'absolute',
            top: '169mm',
            left: '24.1mm',
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
            }}>169mm - Inhaltsbeginn (DIN 5008)</span>
          </div>

          {/* Left margin guide */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '24.1mm',
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
            }}>Linker Rand: 24.1mm</span>
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