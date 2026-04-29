import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateLetterDOCX } from "@/utils/letterDOCXGenerator";
import { debugConsole } from '@/utils/debugConsole';
import type { LetterRecord } from '@/components/letter-pdf/types';

interface LetterDOCXExportProps {
  letter: LetterRecord;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function LetterDOCXExport({ 
  letter, 
  variant = "ghost", 
  size = "sm", 
  className = "" 
}: LetterDOCXExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const result = await generateLetterDOCX(letter);
      
      if (!result) {
        throw new Error('DOCX-Generierung fehlgeschlagen');
      }

      const { blob, filename } = result;

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast({
        title: "DOCX erfolgreich exportiert",
        description: `Brief wurde als ${filename} heruntergeladen.`,
      });

    } catch (error: unknown) {
      debugConsole.error('DOCX Export Error:', error);
      toast({
        title: "Export-Fehler",
        description: error instanceof Error ? error.message : "Der Brief konnte nicht als DOCX exportiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className={className || "flex items-center gap-2"}
    >
      <Download className="h-4 w-4" />
      {isExporting ? "Exportiert..." : "DOCX"}
    </Button>
  );
}
