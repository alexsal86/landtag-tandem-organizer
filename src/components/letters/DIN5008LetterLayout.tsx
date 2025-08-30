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

      {/* Letter Content Area */}
      <div style={{ padding: '20mm 20mm 16.9mm 24.1mm' }}>
        
        {/* Main Address and Info Block Container */}
        <div className="flex" style={{ 
          marginTop: '0',
          marginBottom: '8.46mm'
        }}>
          
          {/* Recipient Address Field */}
          <div style={{ 
            width: '85mm',
            height: '40mm',
            border: '1px solid #e0e0e0',
            padding: '5mm',
            marginRight: '10mm'
          }}>
            {/* Return Address Line at top of address field */}
            {senderInfo?.return_address_line && (
              <div style={{
                fontSize: '7pt',
                borderBottom: '1px solid #000',
                paddingBottom: '1mm',
                marginBottom: '3mm',
                lineHeight: '1.0'
              }}>
                {senderInfo.return_address_line}
              </div>
            )}
            
            {/* Recipient Address */}
            <div style={{ fontSize: '9pt', lineHeight: '1.1' }}>
              {formatAddress(recipientAddress)}
            </div>
          </div>

          {/* Information Block */}
          <div style={{ width: '75mm' }}>
            {renderInformationBlock(informationBlock)}
            
            {letterDate && (
              <div style={{ marginTop: '8mm' }}>
                <div className="font-medium">Datum</div>
                <div>{new Date(letterDate).toLocaleDateString('de-DE')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Subject Line */}
        {subject && (
          <div style={{ 
            marginBottom: '8.46mm',
            fontWeight: 'bold'
          }}>
            {subject}
          </div>
        )}

        {/* Letter Content */}
        <div 
          style={{ 
            marginBottom: '8.46mm',
            minHeight: '100mm'
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginTop: '8.46mm' }}>
            <div className="font-medium" style={{ marginBottom: '2mm' }}>
              Anlagen:
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {attachments.map((attachment, index) => (
                <li key={index} style={{ marginBottom: '1mm' }}>
                  - {attachment}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sender Address Block */}
        {senderInfo && (
          <div style={{ 
            position: 'absolute',
            bottom: '16.9mm',
            left: '24.1mm',
            fontSize: '9pt',
            color: '#666'
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

      {/* Debug Mode Overlays */}
      {debugMode && (
        <>
          {/* DIN 5008 measurement guides */}
          <div style={{
            position: 'absolute',
            top: '45mm',
            left: '0',
            right: '0',
            height: '1px',
            backgroundColor: 'red',
            zIndex: 1000
          }}>
            <span style={{
              position: 'absolute',
              left: '5mm',
              top: '-15px',
              fontSize: '8pt',
              color: 'red',
              backgroundColor: 'white',
              padding: '2px'
            }}>45mm - Header Ende</span>
          </div>
          
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
              top: '-20px',
              left: '0',
              fontSize: '8pt',
              color: 'red',
              backgroundColor: 'white',
              padding: '2px'
            }}>Adressfeld: 85×40mm @ 24.1mm</span>
          </div>
          
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
              top: '-20px',
              left: '0',
              fontSize: '8pt',
              color: 'blue',
              backgroundColor: 'white',
              padding: '2px'
            }}>Info-Block: 75mm @ 119.1mm</span>
          </div>
          
          <div style={{
            position: 'absolute',
            top: '169mm',
            left: '24.1mm',
            right: '20mm',
            height: '1px',
            backgroundColor: 'green',
            zIndex: 1000
          }}>
            <span style={{
              position: 'absolute',
              left: '0',
              top: '-15px',
              fontSize: '8pt',
              color: 'green',
              backgroundColor: 'white',
              padding: '2px'
            }}>169mm - Inhaltsbeginn</span>
          </div>

          {/* Margin guides */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '24.1mm',
            width: '1px',
            height: '100%',
            backgroundColor: 'orange',
            opacity: 0.5,
            zIndex: 999
          }}>
            <span style={{
              position: 'absolute',
              left: '5px',
              top: '10mm',
              fontSize: '8pt',
              color: 'orange',
              backgroundColor: 'white',
              padding: '2px',
              transform: 'rotate(90deg)',
              transformOrigin: 'left'
            }}>Linker Rand: 24.1mm</span>
          </div>
        </>
      )}
    </div>
  );
};