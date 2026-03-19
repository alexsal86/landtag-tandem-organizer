import React from 'react';
import { getLetterAssetPublicUrl } from './letterAssetUrls';

type LetterAttachmentLike = string | { id?: string; file_name?: string | null; display_name?: string | null } | null | undefined;

export const getLetterAttachmentNames = (attachments?: LetterAttachmentLike[]): string[] =>
  (attachments ?? [])
    .map((attachment) => (typeof attachment === 'string' ? attachment : (attachment?.display_name || attachment?.file_name || '')))
    .filter(Boolean) as string[];

interface LetterClosingBlockProps {
  formula?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureImagePath?: string | null;
  fontSizePt: number;
  className?: string;
}

export const LetterClosingBlock: React.FC<LetterClosingBlockProps> = ({
  formula,
  signatureName,
  signatureTitle,
  signatureImagePath,
  fontSizePt,
  className,
}) => {
  if (!formula) return null;
  const signatureImageUrl = getLetterAssetPublicUrl(signatureImagePath);

  return (
    <>
      <div style={{ height: '9mm' }} />
      <div className={className} style={{ fontSize: `${fontSizePt}pt` }}>
        {formula}
      </div>
      {signatureImageUrl && (
        <div style={{ marginTop: '2mm', marginBottom: '2mm' }}>
          <img
            src={signatureImageUrl}
            alt="Unterschrift"
            style={{ maxHeight: '15mm', maxWidth: '50mm', objectFit: 'contain' }}
          />
        </div>
      )}
      {!signatureImageUrl && signatureName && <div style={{ height: '4.5mm' }} />}
      {signatureName && (
        <div className={className} style={{ fontSize: `${fontSizePt}pt`, color: '#000' }}>
          {signatureName}
        </div>
      )}
      {signatureTitle && (
        <div style={{ fontSize: `${fontSizePt - 1}pt`, color: '#555' }}>
          {signatureTitle}
        </div>
      )}
    </>
  );
};

interface LetterAttachmentListProps {
  attachments?: LetterAttachmentLike[];
  fontSizePt: number;
  hasSignature: boolean;
  className?: string;
  dash?: string;
  containerStyle?: React.CSSProperties;
  headingStyle?: React.CSSProperties;
  itemStyle?: React.CSSProperties;
  children?: React.ReactNode;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export const LetterAttachmentList: React.FC<LetterAttachmentListProps> = ({
  attachments,
  fontSizePt,
  hasSignature,
  className,
  dash = '-',
  containerStyle,
  headingStyle,
  itemStyle,
  children,
  onMouseEnter,
  onMouseLeave,
}) => {
  const attachmentNames = getLetterAttachmentNames(attachments);
  if (!attachmentNames.length) return null;

  return (
    <div
      className={className}
      style={{
        marginTop: hasSignature ? '4.5mm' : '13.5mm',
        fontSize: `${fontSizePt}pt`,
        ...containerStyle,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      <div style={{ fontWeight: 700, ...headingStyle }}>Anlagen</div>
      {attachmentNames.map((attachmentName, index) => (
        <div key={`${attachmentName}-${index}`} style={{ marginTop: '1mm', paddingLeft: '5mm', ...itemStyle }}>
          {dash} {attachmentName}
        </div>
      ))}
    </div>
  );
};
