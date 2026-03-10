import { supabase } from "@/integrations/supabase/client";

interface DownloadDocumentOptions {
  filePath: string;
  fileName: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export const downloadDocument = async ({
  filePath,
  fileName,
  onSuccess,
  onError,
}: DownloadDocumentOptions) => {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error) throw error;

    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onSuccess?.();
  } catch (error) {
    onError?.(error);
  }
};
