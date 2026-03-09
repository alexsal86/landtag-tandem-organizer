import { useState, useEffect } from 'react';
import { History, ChevronRight, ArrowLeftRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useKnowledgeVersionHistory, type DocumentVersion } from './hooks/useKnowledgeVersionHistory';
import { computeDiff, stripHtml, type DiffSegment } from '@/utils/textDiff';

interface Props {
  documentId: string;
  currentContent: string | null;
  currentTitle: string;
  tenantId: string;
}

function DiffView({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap p-4 bg-muted/30 rounded-lg border border-border">
      {segments.map((seg, i) => (
        <span
          key={i}
          className={cn(
            seg.type === 'added' && 'bg-green-500/20 text-green-700 dark:text-green-400',
            seg.type === 'removed' && 'bg-red-500/20 text-red-700 dark:text-red-400 line-through',
          )}
        >
          {seg.value}
        </span>
      ))}
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('de-DE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function KnowledgeVersionHistory({ documentId, currentContent, currentTitle, tenantId }: Props) {
  const { versions, loading, fetchVersions } = useKnowledgeVersionHistory(documentId);
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [diffSegments, setDiffSegments] = useState<DiffSegment[]>([]);
  const [compareTarget, setCompareTarget] = useState<'current' | 'previous'>('current');

  useEffect(() => {
    if (open) fetchVersions();
  }, [open, fetchVersions]);

  useEffect(() => {
    if (!selectedVersion) {
      setDiffSegments([]);
      return;
    }

    const oldText = stripHtml(selectedVersion.content || '');

    if (compareTarget === 'current') {
      const newText = stripHtml(currentContent || '');
      setDiffSegments(computeDiff(oldText, newText));
    } else {
      // Compare with previous version
      const idx = versions.findIndex(v => v.id === selectedVersion.id);
      const prevVersion = versions[idx + 1]; // versions are sorted DESC
      if (prevVersion) {
        const prevText = stripHtml(prevVersion.content || '');
        setDiffSegments(computeDiff(prevText, oldText));
      } else {
        setDiffSegments([{ type: 'added', value: oldText }]);
      }
    }
  }, [selectedVersion, compareTarget, currentContent, versions]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Versionshistorie">
          <History className="h-4 w-4 mr-1" />
          <span className="hidden lg:inline">Versionen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorie — {currentTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Version list */}
          <div className="w-72 flex-shrink-0 border-r border-border pr-4">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Noch keine Versionen.</p>
                  <p className="mt-1 text-xs">Versionen werden beim Speichern erstellt.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        selectedVersion?.id === v.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">
                          V{v.version_number}
                        </Badge>
                        <ChevronRight className={cn(
                          'h-3 w-3 text-muted-foreground transition-opacity',
                          selectedVersion?.id === v.id ? 'opacity-100' : 'opacity-0'
                        )} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(v.created_at)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <User className="h-3 w-3" />
                        {v.creator_name}
                      </div>
                      {v.change_summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                          {v.change_summary}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Diff view */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {selectedVersion ? (
              <>
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  <span className="text-sm text-muted-foreground">Vergleich:</span>
                  <Button
                    variant={compareTarget === 'current' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCompareTarget('current')}
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                    V{selectedVersion.version_number} → Aktuell
                  </Button>
                  <Button
                    variant={compareTarget === 'previous' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCompareTarget('previous')}
                    disabled={versions[versions.length - 1]?.id === selectedVersion.id}
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                    Vorgänger → V{selectedVersion.version_number}
                  </Button>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
                    Hinzugefügt
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                    Entfernt
                  </span>
                </div>

                <ScrollArea className="flex-1">
                  {diffSegments.length > 0 ? (
                    <DiffView segments={diffSegments} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Keine Unterschiede gefunden.
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Wählen Sie eine Version aus, um Änderungen anzuzeigen.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
