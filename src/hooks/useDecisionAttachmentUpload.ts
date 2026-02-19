import { supabase } from '@/integrations/supabase/client';
import {
  getUploadContentType,
  getUploadContentTypeCandidates,
  isEmlFile,
  isMsgFile,
  parseEmlFile,
  parseMsgFile,
  type EmailMetadata,
} from '@/utils/emlParser';

export interface UploadFailure {
  fileName: string;
  reason: string;
  candidateErrors: string[];
}

export interface UploadResult {
  uploadedCount: number;
  failed: UploadFailure[];
}

interface UploadParams {
  decisionId: string;
  userId: string;
  files: File[];
  onFileStart?: (file: File, index: number, total: number) => void;
}

function normalizeError(error: unknown): string {
  if (!error) return 'Unbekannter Fehler';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') return value;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function uploadOneFile(file: File, decisionId: string, userId: string) {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = `${userId}/decisions/${decisionId}/${uniqueSuffix}-${file.name}`;

  const candidateErrors: string[] = [];
  let uploadData: { path: string } | null = null;

  for (const contentType of getUploadContentTypeCandidates(file)) {
    const result = await supabase.storage
      .from('decision-attachments')
      .upload(filePath, file, { contentType });

    if (!result.error && result.data) {
      uploadData = result.data;
      break;
    }

    candidateErrors.push(`[${contentType}] ${normalizeError(result.error)}`);
  }

  if (!uploadData) {
    throw new Error(candidateErrors.join(' | ') || 'Upload fehlgeschlagen');
  }

  let emailMeta: EmailMetadata | null = null;
  if (isEmlFile(file)) {
    try {
      emailMeta = (await parseEmlFile(file)).metadata;
    } catch (error) {
      console.error('EML parse error during upload:', error);
    }
  } else if (isMsgFile(file)) {
    try {
      emailMeta = (await parseMsgFile(file)).metadata;
    } catch (error) {
      console.error('MSG parse error during upload:', error);
    }
  }

  const insertData: Record<string, unknown> = {
    decision_id: decisionId,
    file_path: uploadData.path,
    file_name: file.name,
    file_size: file.size,
    file_type: getUploadContentType(file),
    uploaded_by: userId,
  };

  if (emailMeta) {
    insertData.email_metadata = emailMeta;
  }

  const { error: dbError } = await supabase
    .from('task_decision_attachments')
    .insert(insertData as never);

  if (dbError) {
    await supabase.storage.from('decision-attachments').remove([uploadData.path]);
    throw dbError;
  }
}

export function useDecisionAttachmentUpload() {
  const uploadDecisionAttachments = async ({ decisionId, userId, files, onFileStart }: UploadParams): Promise<UploadResult> => {
    const failed: UploadFailure[] = [];
    let uploadedCount = 0;

    for (const [index, file] of files.entries()) {
      onFileStart?.(file, index, files.length);
      try {
        await uploadOneFile(file, decisionId, userId);
        uploadedCount += 1;
      } catch (error) {
        const reason = normalizeError(error);
        failed.push({
          fileName: file.name,
          reason,
          candidateErrors: reason.split(' | '),
        });
      }
    }

    return { uploadedCount, failed };
  };

  return { uploadDecisionAttachments };
}
