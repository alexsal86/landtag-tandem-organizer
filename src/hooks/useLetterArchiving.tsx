import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  template_id?: string;
  subject?: string;
  reference_number?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  letter_date?: string;
  status: string;
  sent_date?: string;
  created_at: string;
}

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
}

export const useLetterArchiving = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  const archiveLetter = async (letter: Letter): Promise<boolean> => {
    if (!user || !currentTenant) {
      toast({
        title: "Fehler",
        description: "Benutzer oder Mandant nicht gefunden.",
        variant: "destructive",
      });
      return false;
    }

    setIsArchiving(true);

    try {
      // Use generateLetterPDF from letterPDFGenerator which has the exact same logic as LetterPDFExport
      const { generateLetterPDF } = await import('@/utils/letterPDFGenerator');
      
      // Generate PDF blob using the exact same logic as LetterPDFExport
      const pdfResult = await generateLetterPDF(letter);
      
      if (!pdfResult) {
        throw new Error('PDF generation failed');
      }

      const { blob: pdfBlob, filename } = pdfResult;

      // Upload PDF to storage
      const filePath = `archived_letters/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Fetch letter attachments for archiving metadata
      const { data: attachments } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letter.id)
        .order('created_at');

      // Create document record in database
      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: `Archivierter Brief: ${letter.title}`,
          description: `Automatisch archiviert am ${new Date().toLocaleDateString('de-DE')}`,
          file_name: filename,
          file_path: filePath,
          file_size: pdfBlob.size,
          file_type: 'application/pdf',
          category: 'correspondence',
          status: 'archived',
          document_type: 'archived_letter',
          source_letter_id: letter.id,
          archived_attachments: attachments || []
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update letter status to sent (if not already)
      const { error: letterUpdateError } = await supabase
        .from('letters')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: user.id
        })
        .eq('id', letter.id);

      if (letterUpdateError) throw letterUpdateError;

      toast({
        title: "Brief archiviert",
        description: `Der Brief wurde erfolgreich als PDF archiviert: ${filename}`,
      });

      return true;

    } catch (error: any) {
      console.error('Error archiving letter:', error);
      toast({
        title: "Archivierungsfehler",
        description: error.message || "Der Brief konnte nicht archiviert werden.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsArchiving(false);
    }
  };

  return {
    archiveLetter,
    isArchiving
  };
};