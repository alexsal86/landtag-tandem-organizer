import React from 'react';

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
    
    // If address is a string, return as is
    if (typeof address === 'string') {
      return address;
    }
    
    // If address is an object, format it
    const parts = [];
    if (address.name) parts.push(address.name);
    if (address.company) parts.push(address.company);
    if (address.street) {
      if (address.house_number) {
        parts.push(`${address.street} ${address.house_number}`);
      } else {
        parts.push(address.street);
      }
    }
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

    const currentDate = letterDate ? new Date(letterDate) : new Date();

    switch (info.block_type) {
      case 'contact':
        return (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{info.label}</div>
            {info.block_data.contact_name && (
              <div>{info.block_data.contact_name}</div>
            )}
            {info.block_data.contact_title && (
              <div className="text-xs text-gray-600">{info.block_data.contact_title}</div>
            )}
            {info.block_data.contact_phone && (
              <div className="text-xs">Tel: {info.block_data.contact_phone}</div>
            )}
            {info.block_data.contact_email && (
              <div className="text-xs">{info.block_data.contact_email}</div>
            )}
          </div>
        );
      case 'date':
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
          <div className="space-y-1 text-sm">
            <div className="font-medium">{info.label}</div>
            <div>{formatDate(currentDate, info.block_data.date_format || 'dd.mm.yyyy')}</div>
            {info.block_data.show_time && (
              <div className="text-xs">{currentDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
            )}
          </div>
        );
      case 'reference':
        return (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{info.label}</div>
            <div>
              {info.block_data.reference_prefix && `${info.block_data.reference_prefix} `}
              {referenceNumber || info.block_data.reference_pattern}
            </div>
          </div>
        );
      case 'custom':
        return (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{info.label}</div>
            <div>{info.block_data.custom_content}</div>
          </div>
        );
      default:
        return null;
    }
  };

  const currentDate = letterDate ? new Date(letterDate) : new Date();

  return (
    <div className={`din5008-letter bg-white ${className}`} style={{
      width: '210mm',
      minHeight: '297mm',
      margin: '0 auto',
      fontFamily: 'Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '11pt',
      lineHeight: '1.3',
      color: '#000',
      position: 'relative',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)'
    }}>
      
      {/* Template Header */}
      {template?.letterhead_html && (
        <div 
          style={{ 
            height: '45mm',
            borderBottom: '1px solid #e5e5e5',
            overflow: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: template.letterhead_html }}
        />
      )}

      {/* Letter Content Area */}
      <div style={{ 
        padding: '20mm',
        paddingTop: template?.letterhead_html ? '8.46mm' : '20mm',
        minHeight: template?.letterhead_html ? '252mm' : '257mm'
      }}>
        
        {/* Return Address Line */}
        {senderInfo?.return_address_line && (
          <div style={{
            fontSize: '8pt',
            borderBottom: '1px solid #000',
            paddingBottom: '1mm',
            marginBottom: '8mm',
            width: '85mm',
            lineHeight: '1.2'
          }}>
            {senderInfo.return_address_line}
          </div>
        )}

        {/* Address and Info Block Container */}
        <div style={{ 
          display: 'flex',
          marginBottom: '16.93mm',
          gap: '10mm'
        }}>
          
          {/* Recipient Address Field */}
          <div style={{ 
            width: '85mm',
            minHeight: '40mm',
            border: '1px solid #d0d0d0',
            padding: '5mm',
            fontSize: '11pt',
            lineHeight: '1.3'
          }}>
            <div style={{ whiteSpace: 'pre-line' }}>
              {formatAddress(recipientAddress)}
            </div>
          </div>

          {/* Information Block */}
          <div style={{ width: '75mm', fontSize: '11pt' }}>
            {renderInformationBlock(informationBlock)}
            
            {/* Always show date if not in info block */}
            {(!informationBlock || informationBlock.block_type !== 'date') && (
              <div style={{ marginTop: '8mm' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>Datum</div>
                <div>{currentDate.toLocaleDateString('de-DE')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Subject Line */}
        {subject && (
          <div style={{ 
            marginBottom: '8.46mm',
            fontWeight: 'bold',
            fontSize: '11pt'
          }}>
            {subject}
          </div>
        )}

        {/* Letter Content */}
        <div 
          style={{ 
            marginBottom: '16.93mm',
            minHeight: '80mm',
            fontSize: '11pt',
            lineHeight: '1.4'
          }}
        >
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              [Briefinhalt hier eingeben...]
            </div>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginTop: '8.46mm' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>
              Anlagen:
            </div>
            <div>
              {attachments.map((attachment, index) => (
                <div key={index} style={{ marginBottom: '1mm' }}>
                  - {attachment}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sender Address Block (Footer) */}
        {senderInfo && (
          <div style={{ 
            position: 'absolute',
            bottom: '16.9mm',
            left: '20mm',
            fontSize: '9pt',
            color: '#666',
            lineHeight: '1.2'
          }}>
            <div style={{ whiteSpace: 'pre-line' }}>
              {formatSenderAddress(senderInfo)}
            </div>
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