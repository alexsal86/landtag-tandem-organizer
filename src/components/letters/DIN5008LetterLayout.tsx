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
  className = ""
}) => {
  const formatAddress = (address: any) => {
    if (!address) return '';
    const parts = [];
    if (address.name) parts.push(address.name);
    if (address.company) parts.push(address.company);
    if (address.street) parts.push(address.street);
    if (address.postal_code && address.city) {
      parts.push(`${address.postal_code} ${address.city}`);
    }
    if (address.country && address.country !== 'Deutschland') {
      parts.push(address.country);
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
      lineHeight: '1.2'
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
        
        {/* Return Address Line */}
        {senderInfo?.return_address_line && (
          <div style={{
            position: 'absolute',
            top: '45mm',
            left: '24.1mm',
            fontSize: '8pt',
            borderBottom: '1px solid #000',
            paddingBottom: '1mm',
            marginBottom: '3mm',
            width: '85mm'
          }}>
            {senderInfo.return_address_line}
          </div>
        )}

        {/* Main Address and Info Block Container */}
        <div className="flex" style={{ 
          marginTop: senderInfo?.return_address_line ? '12mm' : '0',
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
            <div style={{ fontSize: '9pt', marginBottom: '3mm' }}>
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
    </div>
  );
};