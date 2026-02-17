import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DecisionAttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
}

const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const normalizeStoragePath = (rawPath: string) => {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  const stripBucketPrefix = (value: string) =>
    decodeURIComponent(value)
      .replace(/^\/+/, '')
      .replace(/^decision-attachments\//, '');

  if (!isHttpUrl(trimmed)) {
    return stripBucketPrefix(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const marker = '/decision-attachments/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return '';
    }

    const pathInBucket = parsed.pathname.slice(markerIndex + marker.length);
    return stripBucketPrefix(pathInBucket);
  } catch {
    return '';
  }
};

export function DecisionAttachmentPreviewDialog({
  open,
  onOpenChange,
  filePath,
  fileName,
}: DecisionAttachmentPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extension = useMemo(() => getFileExtension(fileName), [fileName]);
  const normalizedFilePath = useMemo(() => normalizeStoragePath(filePath), [filePath]);
  const isPdf = extension === 'pdf';
  const isWord = extension === 'doc' || extension === 'docx';
  const isExcel = extension === 'xls' || extension === 'xlsx';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);

  useEffect(() => {
    if (!open || !filePath) {
      setSignedUrl(null);
      return;
    }

    const loadSignedUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isHttpUrl(filePath) && !normalizedFilePath) {
          setSignedUrl(filePath);
          return;
        }

        if (!normalizedFilePath) {
          throw new Error('Invalid storage path');
        }

        const { data, error: signedUrlError } = await supabase.storage
          .from('decision-attachments')
          .createSignedUrl(normalizedFilePath, 60 * 10);

        if (signedUrlError) throw signedUrlError;
        setSignedUrl(data.signedUrl);
      } catch (e) {
        console.error('Error creating signed URL for preview:', e);
        setError('Vorschau konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    loadSignedUrl();
  }, [open, filePath, normalizedFilePath]);

  const officeViewerUrl = signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : '';

  const handleDownload = async () => {
    try {
      if (isHttpUrl(filePath) && !normalizedFilePath) {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        const directBlob = await response.blob();
        const directUrl = URL.createObjectURL(directBlob);
        const directAnchor = document.createElement('a');
        directAnchor.href = directUrl;
        directAnchor.download = fileName;
        document.body.appendChild(directAnchor);
        directAnchor.click();
        document.body.removeChild(directAnchor);
        URL.revokeObjectURL(directUrl);
        return;
      }

      if (!normalizedFilePath) {
        throw new Error('Invalid storage path');
      }

      const { data, error: downloadError } = await supabase.storage
        .from('decision-attachments')
        .download(normalizedFilePath);

      if (downloadError) throw downloadError;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error downloading preview file:', e);
      setError('Datei konnte nicht heruntergeladen werden.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="truncate">Vorschau: {fileName}</span>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Herunterladen
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-[60vh] border rounded-md overflow-hidden bg-muted/20">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Vorschau wird geladen...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-sm text-destructive">
              {error}
            </div>
          ) : isPdf && signedUrl ? (
            <iframe title={fileName} src={signedUrl} className="w-full h-full" />
          ) : isImage && signedUrl ? (
            <div className="h-full w-full overflow-auto bg-background/70 p-4 flex items-center justify-center">
              <img src={signedUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (isWord || isExcel) && signedUrl ? (
            <iframe title={fileName} src={officeViewerUrl} className="w-full h-full" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
              {isExcel ? <FileSpreadsheet className="h-6 w-6" /> : isImage ? <FileImage className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              Vorschau für diesen Dateityp ist nicht verfügbar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
