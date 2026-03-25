import React from 'react';
import type { LetterBlockLine, LetterCanvasElement, InformationBlockRecord, LetterLayoutSettings, RecipientAddress, SenderInformationRecord } from '@/types/letterLayout';

interface DIN5008AddressInfoSectionProps {
  layout: LetterLayoutSettings;
  debugMode: boolean;
  returnAddressLines?: BlockLine[];
  returnAddressElements?: HeaderElement[];
  senderInfo?: SenderInformationRecord | null;
  returnAddressFontSizePt: number;
  renderBlockLines: (lines: BlockLine[], options?: { underlineLastContentLine?: boolean }) => React.ReactNode;
  renderCanvasBlockElements: (elements: HeaderElement[]) => React.ReactNode;
  addressFieldLines?: BlockLine[];
  addressFieldElements?: HeaderElement[];
  recipientFontSizePt: number;
  formatAddress: (address?: RecipientAddress | string) => string;
  recipientAddress?: RecipientAddress | string;
  infoBlockLines?: BlockLine[];
  infoBlockElements?: HeaderElement[];
  renderInformationBlock: (informationBlock?: InformationBlockRecord) => React.ReactNode;
  informationBlock?: InformationBlockRecord[] | null;
  letterDate?: string;
}

export const DIN5008AddressInfoSection: React.FC<DIN5008AddressInfoSectionProps> = ({
  layout,
  debugMode,
  returnAddressLines,
  returnAddressElements,
  senderInfo,
  returnAddressFontSizePt,
  renderBlockLines,
  renderCanvasBlockElements,
  addressFieldLines,
  addressFieldElements,
  recipientFontSizePt,
  formatAddress,
  recipientAddress,
  infoBlockLines,
  infoBlockElements,
  renderInformationBlock,
  informationBlock,
  letterDate,
}) => {
  const primaryInformationBlock = informationBlock?.[0];

  return (
    <div className="flex" style={{ position: 'absolute', top: '50mm', left: '25mm', right: '20mm' }}>
      <div
        style={{
          width: `${layout.addressField?.width || 85}mm`,
          height: `${layout.addressField?.height || 45}mm`,
          border: debugMode ? '2px dashed red' : 'none',
          padding: '0',
          marginRight: '10mm',
          backgroundColor: debugMode ? 'rgba(255,0,0,0.05)' : 'transparent',
          position: 'relative',
        }}
      >
        <div style={{ height: `${layout.addressField?.returnAddressHeight || 17.7}mm`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {returnAddressLines && returnAddressLines.length > 0 ? (
            <div>{renderBlockLines(returnAddressLines, { underlineLastContentLine: true })}</div>
          ) : returnAddressElements && returnAddressElements.length > 0 ? (
            <div style={{ position: 'relative', height: '100%' }}>{renderCanvasBlockElements(returnAddressElements)}</div>
          ) : senderInfo?.return_address_line ? (
            <div style={{ fontSize: `${returnAddressFontSizePt}pt`, lineHeight: '1.0', maxWidth: '75mm' }}>
              {senderInfo.return_address_line.split('\n').filter((line: string) => line.trim()).map((line: string, index: number, arr: string[]) => (
                <div key={`${line}-${index}`}>
                  <span style={index === arr.length - 1 ? { display: 'inline-block', borderBottom: '0.5pt solid #000', paddingBottom: '0.3mm' } : { display: 'inline-block' }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ height: `${layout.addressField?.addressZoneHeight || 27.3}mm` }}>
          {addressFieldLines && addressFieldLines.length > 0 ? (
            renderBlockLines(addressFieldLines)
          ) : addressFieldElements && addressFieldElements.length > 0 ? (
            renderCanvasBlockElements(addressFieldElements)
          ) : (
            <div style={{ fontSize: `${recipientFontSizePt}pt`, lineHeight: '1.2', maxWidth: '75mm' }}>
              {formatAddress(recipientAddress)}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '100mm',
          top: '0mm',
          width: '75mm',
          height: '40mm',
          backgroundColor: debugMode ? 'rgba(0,0,255,0.05)' : 'transparent',
          border: debugMode ? '2px dashed blue' : 'none',
          padding: '2mm',
        }}
      >
        {infoBlockLines && infoBlockLines.length > 0 ? (
          renderBlockLines(infoBlockLines)
        ) : infoBlockElements && infoBlockElements.length > 0 ? (
          renderCanvasBlockElements(infoBlockElements)
        ) : (
          <>
            {renderInformationBlock(primaryInformationBlock)}
            {letterDate && !primaryInformationBlock && (
              <div style={{ marginTop: '8mm' }}>
                <div className="font-medium" style={{ fontSize: '9pt' }}>Datum</div>
                <div style={{ fontSize: '9pt' }}>{new Date(letterDate).toLocaleDateString('de-DE')}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
