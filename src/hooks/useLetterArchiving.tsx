import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';
import type { LetterPdfGenerationResult, LetterRecord } from '@/components/letter-pdf/types';

type ArchivedDocumentInsert = Database['public']['Tables']['documents']['Insert'];
type LetterAttachment = Database['public']['Tables']['letter_attachments']['Row'];
type LetterUpdate = Database['public']['Tables']['letters']['Update'];

export const useLetterArchiving = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  const archiveLetter = async (letter: LetterRecord): Promise<boolean> => {
    if (!user || !currentTenant) {
      toast({
        title: 'Fehler',
        description: 'Benutzer oder Mandant nicht gefunden.',
        variant: 'destructive',
      });
      return false;
    }

    setIsArchiving(true);

    try {
      const { generateLetterPDF } = await import('@/utils/letterPDFGenerator');
      const pdfResult: LetterPdfGenerationResult | null = await generateLetterPDF(letter);

      if (!pdfResult?.blob || !pdfResult.filename) {
        throw new Error('PDF generation failed');
      }

      const { blob: pdfBlob, filename } = pdfResult;
      const filePath = `archived_letters/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: attachments, error: attachmentsError } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letter.id)
        .order('created_at');

      if (attachmentsError) {
        throw attachmentsError;
      }

      const archivedAttachments: LetterAttachment[] = attachments ?? [];
      const documentPayload: ArchivedDocumentInsert = {
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
        archived_attachments: archivedAttachments,
      };

      const { error: dbError } = await supabase
        .from('documents')
        .insert([documentPayload])
        .select('id')
        .single();

      if (dbError) {
        throw dbError;
      }

      const letterUpdatePayload: LetterUpdate = {
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      };

      const { error: letterUpdateError } = await supabase
        .from('letters')
        .update(letterUpdatePayload)
        .eq('id', letter.id);

      if (letterUpdateError) {
        throw letterUpdateError;
      }

      toast({
        title: 'Brief archiviert',
        description: `Der Brief wurde erfolgreich als PDF archiviert: ${filename}`,
      });

      return true;
    } catch (error: unknown) {
      debugConsole.error('Error archiving letter:', error);
      toast({
        title: 'Archivierungsfehler',
        description: error instanceof Error ? error.message : 'Der Brief konnte nicht archiviert werden.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsArchiving(false);
    }
  };

  return {
    archiveLetter,
    isArchiving,
  };
};
