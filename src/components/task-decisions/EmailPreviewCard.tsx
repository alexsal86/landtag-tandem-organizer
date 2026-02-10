import { Mail, Eye, Paperclip, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailMetadata } from '@/utils/emlParser';

interface EmailPreviewCardProps {
  metadata: EmailMetadata;
  fileName: string;
  fileSize: number;
  onPreviewOpen: () => void;
  onDownload: () => void;
  onRemove?: () => void;
}

export function EmailPreviewCard({
  metadata,
  fileName,
  fileSize,
  onPreviewOpen,
  onDownload,
  onRemove,
}: EmailPreviewCardProps) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{metadata.subject}</p>
            <p className="text-xs text-muted-foreground">
              Von: {metadata.from}
            </p>
            {metadata.to.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                An: {metadata.to.join(', ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDate(metadata.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onDownload} title="EML herunterladen">
            <Download className="h-4 w-4" />
          </Button>
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} title="Entfernen">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreviewOpen}
          className="text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          Vorschau öffnen
        </Button>
        {metadata.attachmentCount > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {metadata.attachmentCount} Anhang{metadata.attachmentCount !== 1 ? 'e' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
