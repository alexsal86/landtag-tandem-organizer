import React from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchPDFData } from '@/components/letter-pdf/fetchPDFData';
import type { LetterPDFExportProps, InformationBlockContract, AttachmentContract } from '@/components/letter-pdf/types';
import { notify } from "@/lib/notify";

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false,
  debugMode = false,
  showPagination = false,
  variant = 'default',
  size = 'default',
  onPDFGenerated
}) => {
  const [exporting, setExporting] = React.useState(false);

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const [{ generatePDF }, { template, senderInfo, informationBlock, attachments, contact }] = await Promise.all([
        import("@/components/letter-pdf/pdfGenerator"),
        fetchPDFData(letter),
      ]);
      await generatePDF({
        letter,
        template,
        senderInfo,
        informationBlock: informationBlock as unknown as InformationBlockContract,
        attachments: attachments as unknown as AttachmentContract[],
        showPagination,
        returnBlob: false,
        contact,
      });

      notify.success("PDF erstellt", {
        description: `Der Brief wurde als PDF gespeichert.`
});

      if (onPDFGenerated) {
        const blobResult = await generatePDF({
          letter, template, senderInfo, informationBlock: informationBlock as unknown as InformationBlockContract, attachments: attachments as unknown as AttachmentContract[],
          showPagination, returnBlob: true, contact,
        });
        if (blobResult) onPDFGenerated(blobResult.blob, blobResult.filename);
      }
    } catch (error) {
      debugConsole.error('Error exporting PDF:', error);
      notify.error("Export-Fehler", {
        description: "Der Brief konnte nicht als PDF exportiert werden."
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={exportToPDF}
      disabled={disabled || exporting}
      className={variant === 'icon-only' ? "" : "flex items-center gap-2"}
    >
      <Download className="h-4 w-4" />
      {variant === 'default' && (disabled || exporting ? 'Export...' : 'PDF')}
    </Button>
  );
};

export default LetterPDFExport;
export { LetterPDFExport };
