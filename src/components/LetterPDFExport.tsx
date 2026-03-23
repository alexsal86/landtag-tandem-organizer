import React from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePDFData } from './letter-pdf/usePDFData';
import { generatePDF } from './letter-pdf/pdfGenerator';
import type { LetterPDFExportProps } from './letter-pdf/types';

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false,
  debugMode = false,
  showPagination = false,
  variant = 'default',
  size = 'default',
  onPDFGenerated
}) => {
  const { toast } = useToast();
  const { template, senderInfo, informationBlock, attachments, contact } = usePDFData(letter);

  const exportToPDF = async () => {
    try {
      const result = await generatePDF({
        letter,
        template,
        senderInfo,
        informationBlock,
        attachments,
        showPagination,
        returnBlob: false,
        contact,
      });

      toast({
        title: "PDF erstellt",
        description: `Der Brief wurde als PDF gespeichert.`,
      });

      if (onPDFGenerated) {
        const blobResult = await generatePDF({
          letter, template, senderInfo, informationBlock, attachments,
          showPagination, returnBlob: true,
        });
        if (blobResult) onPDFGenerated(blobResult.blob, blobResult.filename);
      }
    } catch (error) {
      debugConsole.error('Error exporting PDF:', error);
      toast({
        title: "Export-Fehler",
        description: "Der Brief konnte nicht als PDF exportiert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={exportToPDF}
      disabled={disabled}
      className={variant === 'icon-only' ? "" : "flex items-center gap-2"}
    >
      <Download className="h-4 w-4" />
      {variant === 'default' && (disabled ? 'Export...' : 'PDF')}
    </Button>
  );
};

export default LetterPDFExport;
export { LetterPDFExport };
