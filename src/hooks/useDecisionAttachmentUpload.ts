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
  rollbackOnAnyFailure?: boolean;
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

async function uploadToStorageWithCandidates(filePath: string, file: File, maxAttempts = 2) {
  const candidateErrors: string[] = [];

  for (const contentType of getUploadContentTypeCandidates(file)) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await supabase.storage
        .from('decision-attachments')
        .upload(filePath, file, { contentType });

      if (!result.error && result.data) {
        return { uploadData: result.data, candidateErrors };
      }

      candidateErrors.push(`[${contentType}] Versuch ${attempt}/${maxAttempts}: ${normalizeError(result.error)}`);
    }
  }

  throw new Error(candidateErrors.join(' | ') || 'Upload fehlgeschlagen');
}

async function uploadOneFile(file: File, decisionId: string, userId: string) {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = `${userId}/decisions/${decisionId}/${uniqueSuffix}-${file.name}`;

  const { uploadData } = await uploadToStorageWithCandidates(filePath, file);

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

  return { filePath: uploadData.path };
}

async function rollbackAttachmentBatch(decisionId: string, uploadedPaths: string[]) {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from('decision-attachments').remove(uploadedPaths);
  }

  await supabase
    .from('task_decision_attachments')
    .delete()
    .eq('decision_id', decisionId);
}

export function useDecisionAttachmentUpload() {
  const uploadDecisionAttachments = async ({
    decisionId,
    userId,
    files,
    onFileStart,
    rollbackOnAnyFailure = false,
  }: UploadParams): Promise<UploadResult> => {
    const failed: UploadFailure[] = [];
    const uploadedPaths: string[] = [];
    let uploadedCount = 0;

    for (const [index, file] of files.entries()) {
      onFileStart?.(file, index, files.length);
      try {
        const result = await uploadOneFile(file, decisionId, userId);
        uploadedPaths.push(result.filePath);
        uploadedCount += 1;
      } catch (error) {
        const reason = normalizeError(error);
        failed.push({
          fileName: file.name,
          reason,
          candidateErrors: reason.split(' | '),
        });

        if (rollbackOnAnyFailure) {
          await rollbackAttachmentBatch(decisionId, uploadedPaths);
          return { uploadedCount: 0, failed };
        }
      }
    }

    return { uploadedCount, failed };
  };

  return { uploadDecisionAttachments };
}
