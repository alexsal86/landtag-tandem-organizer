import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileImage, FileSpreadsheet, FileText, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface DecisionAttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
}

const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeStoragePath = (rawPath: string) => {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  const stripBucketPrefix = (value: string) =>
    safeDecode(value)
      .split(/[?#]/, 1)[0]
      .replace(/^\/+/, '')
      .replace(/^decision-attachments\//, '');

  if (!isHttpUrl(trimmed)) {
    return stripBucketPrefix(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const marker = '/decision-attachments/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return '';
    const pathInBucket = parsed.pathname.slice(markerIndex + marker.length);
    return stripBucketPrefix(pathInBucket);
  } catch {
    return '';
  }
};

// --- PDF Thumbnail via pdfjs-dist ---
function PdfPreview({ url, fileName }: { url: string; fileName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      } catch (e) {
        console.error("PDF render error:", e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <iframe title={fileName} src={url} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-background/70 p-4 flex items-center justify-center">
      {loading && <div className="text-sm text-muted-foreground">PDF wird geladen...</div>}
      <canvas ref={canvasRef} className={`max-w-full max-h-full ${loading ? 'hidden' : ''}`} />
    </div>
  );
}

// --- Excel Preview ---
function ExcelPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rendered = XLSX.utils.sheet_to_html(firstSheet, { editable: false });
        if (!cancelled) setHtml(rendered);
      } catch (e) {
        console.error("Excel render error:", e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Excel wird geladen...</div>;
  if (error || !html) return <div className="h-full flex items-center justify-center text-sm text-destructive">Excel-Vorschau fehlgeschlagen.</div>;

  return (
    <div className="h-full w-full overflow-auto p-4 bg-background/70">
      <div
        className="text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// --- Word Preview ---
function WordPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const mammoth = await import("mammoth");
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (e) {
        console.error("Word render error:", e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Word-Dokument wird geladen...</div>;
  if (error || !html) return <div className="h-full flex items-center justify-center text-sm text-destructive">Word-Vorschau fehlgeschlagen.</div>;

  return (
    <div className="h-full w-full overflow-auto p-6 bg-background/70">
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

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
        const pathToUse = normalizedFilePath || filePath;
        if (!pathToUse) {
          throw new Error('Invalid storage path');
        }

        // For images: ALWAYS use blob URL to avoid Cross-Origin-Resource-Policy (CORP) issues
        // caused by coi-serviceworker setting COEP: require-corp.
        // <img src="signed-url"> is blocked by CORP, but blob URLs are same-origin.
        if (isImage) {
          const { data: blobData, error: downloadError } = await supabase.storage
            .from('decision-attachments')
            .download(pathToUse);
          if (downloadError) throw downloadError;
          const blobUrl = URL.createObjectURL(blobData);
          setSignedUrl(blobUrl);
          return;
        }

        // For all other types (PDF, Word, Excel): use signed URL first (pdfjs/fetch internals
        // handle CORP differently), with download fallback.
        const { data, error: signedUrlError } = await supabase.storage
          .from('decision-attachments')
          .createSignedUrl(pathToUse, 60 * 10);

        if (!signedUrlError && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
          return;
        }

        // Fallback: download the file and create a blob URL
        const { data: blobData, error: downloadError } = await supabase.storage
          .from('decision-attachments')
          .download(pathToUse);

        if (downloadError) throw downloadError;
        const blobUrl = URL.createObjectURL(blobData);
        setSignedUrl(blobUrl);
      } catch (e: any) {
        console.error('Error loading preview:', e, 'path:', normalizedFilePath, 'raw:', filePath);
        setError(`Vorschau konnte nicht geladen werden. (${e?.message || 'Unbekannter Fehler'})`);
      } finally {
        setLoading(false);
      }
    };

    loadSignedUrl();
  }, [open, filePath, normalizedFilePath]);

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

      if (!normalizedFilePath) throw new Error('Invalid storage path');

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

  const renderPreview = () => {
    if (loading) {
      return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Vorschau wird geladen...</div>;
    }
    if (error) {
      return <div className="h-full flex items-center justify-center text-sm text-destructive">{error}</div>;
    }
    if (!signedUrl) {
      return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Keine Vorschau verfügbar.</div>;
    }

    if (isPdf) return <PdfPreview url={signedUrl} fileName={fileName} />;
    if (isImage) {
      return (
        <div className="h-full w-full overflow-auto bg-background/70 p-4 flex items-center justify-center">
          <img
            src={signedUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              // If the signed URL fails (e.g. expired), show an error message
              (e.target as HTMLImageElement).style.display = 'none';
              setError('Bildvorschau konnte nicht geladen werden. Bitte herunterladen.');
            }}
          />
        </div>
      );
    }
    if (isWord && extension === 'docx') return <WordPreview url={signedUrl} />;
    if (isExcel) return <ExcelPreview url={signedUrl} />;

    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
        {isExcel ? <FileSpreadsheet className="h-6 w-6" /> : isImage ? <FileImage className="h-6 w-6" /> : isWord ? <FileIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
        Vorschau für diesen Dateityp ({extension}) ist nicht verfügbar.
      </div>
    );
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

        <div className="flex-1 min-h-[60vh] border rounded-md overflow-auto bg-muted/20">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
