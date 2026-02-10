import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Paperclip, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseEmlFromArrayBuffer, parseMsgFromArrayBuffer, type ParsedEmail } from '@/utils/emlParser';

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
}

export function EmailPreviewDialog({ open, onOpenChange, filePath, fileName }: EmailPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<ParsedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open && filePath) {
      loadAndParseEmail();
    } else {
      setEmail(null);
      setError(null);
    }
  }, [open, filePath]);

  const loadAndParseEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dlError } = await supabase.storage
        .from('decision-attachments')
        .download(filePath);

      if (dlError) throw dlError;

      const buffer = await data.arrayBuffer();
      const isMsgExt = fileName.toLowerCase().endsWith('.msg');
      const parsed = isMsgExt
        ? await parseMsgFromArrayBuffer(buffer)
        : await parseEmlFromArrayBuffer(buffer);
      setEmail(parsed);
    } catch (e: any) {
      console.error('Error parsing email:', e);
      setError('Die E-Mail konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (email?.htmlBody && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; padding: 16px; color: #333; margin: 0; }
              img { max-width: 100%; height: auto; }
              a { color: hsl(var(--primary)); }
            </style>
          </head>
          <body>${email.htmlBody}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [email?.htmlBody]);

  const downloadAttachment = (att: { filename: string; mimeType: string; content: Uint8Array }) => {
    const blob = new Blob([new Uint8Array(att.content)], { type: att.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {email?.metadata.subject || fileName}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-8">{error}</p>
        )}

        {email && !loading && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="text-sm space-y-1 border-b border-border pb-3">
              <p><span className="font-medium">Von:</span> {email.metadata.from}</p>
              {email.metadata.to.length > 0 && (
                <p><span className="font-medium">An:</span> {email.metadata.to.join(', ')}</p>
              )}
              <p><span className="font-medium">Datum:</span> {new Date(email.metadata.date).toLocaleString('de-DE')}</p>
            </div>

            {/* Body */}
            {email.htmlBody ? (
              <iframe
                ref={iframeRef}
                className="w-full border border-border rounded min-h-[300px]"
                sandbox="allow-same-origin"
                title="E-Mail Inhalt"
              />
            ) : email.textBody ? (
              <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded max-h-[400px] overflow-y-auto">
                {email.textBody}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {fileName.toLowerCase().endsWith('.msg')
                  ? 'Kein darstellbarer Inhalt. Originalformatierung nur in Outlook verfügbar.'
                  : 'Kein Inhalt verfügbar'}
              </p>
            )}

            {/* Attachments */}
            {email.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Paperclip className="h-4 w-4" />
                  Anhänge ({email.attachments.length})
                </p>
                <div className="space-y-1">
                  {email.attachments.map((att, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <span className="truncate flex-1">{att.filename}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatFileSize(att.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAttachment(att)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
