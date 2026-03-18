import { supabase } from '@/integrations/supabase/client';
import { generateLetterPDF } from '@/utils/letterPDFGenerator';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';
import type { LetterPdfGenerationResult, LetterRecord } from '@/components/letter-pdf/types';

type ArchivedDocumentInsert = Database['public']['Tables']['documents']['Insert'];
type LetterAttachment = Database['public']['Tables']['letter_attachments']['Row'];
type LetterUpdate = Database['public']['Tables']['letters']['Update'];

type ArchivableLetter = LetterRecord & Pick<Database['public']['Tables']['letters']['Row'], 'tenant_id'>;

export const archiveLetter = async (letter: ArchivableLetter, userId: string): Promise<boolean> => {
  try {
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

    if (uploadError) throw uploadError;

    const { data: attachments, error: attachmentsError } = await supabase
      .from('letter_attachments')
      .select('*')
      .eq('letter_id', letter.id)
      .order('created_at');

    if (attachmentsError) throw attachmentsError;

    const archivedAttachments: LetterAttachment[] = attachments ?? [];
    const documentPayload: ArchivedDocumentInsert = {
      user_id: userId,
      tenant_id: letter.tenant_id,
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

    if (dbError) throw dbError;

    const letterUpdatePayload: LetterUpdate = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: userId,
    };

    const { error: letterUpdateError } = await supabase
      .from('letters')
      .update(letterUpdatePayload)
      .eq('id', letter.id);

    if (letterUpdateError) throw letterUpdateError;

    return true;
  } catch (error: unknown) {
    debugConsole.error('Error archiving letter:', error);
    return false;
  }
};
