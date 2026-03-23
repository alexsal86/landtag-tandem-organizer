import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';

export interface ArchiveLetterResult {
  success: boolean;
  documentId?: string;
  archivedAt?: string;
  archivedBy?: string;
  followUpTaskId?: string | null;
  error?: string;
}

export const archiveLetter = async (letterId: string, userId: string): Promise<ArchiveLetterResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('archive-letter', {
      body: { letterId, userId },
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Die Archivierung konnte nicht abgeschlossen werden.',
      };
    }

    return {
      success: true,
      documentId: data.documentId,
      archivedAt: data.archivedAt,
      archivedBy: data.archivedBy,
      followUpTaskId: data.followUpTaskId ?? null,
    };
  } catch (error: unknown) {
    debugConsole.error('Error archiving letter:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Die Archivierung konnte nicht abgeschlossen werden.',
    };
  }
};
