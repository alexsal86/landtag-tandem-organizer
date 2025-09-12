import React, { useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw, Eye, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  createdAt: string;
  createdBy: string;
  authorName: string;
  changes: string;
  snapshotType: 'auto' | 'manual';
}

interface VersionHistoryPluginProps {
  documentId: string;
  onVersionRestore?: (content: string) => void;
}

const VersionHistoryDialog: React.FC<{
  versions: DocumentVersion[];
  onRestore: (version: DocumentVersion) => void;
  onClose: () => void;
  onPreview: (version: DocumentVersion) => void;
}> = ({ versions, onRestore, onClose, onPreview }) => {
  return (
    <Card className="w-96 h-96">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Versionshistorie</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Version {version.version}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      version.snapshotType === 'manual' 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {version.snapshotType === 'manual' ? 'Manuell' : 'Auto'}
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground mb-2">
                  {version.authorName} • {new Date(version.createdAt).toLocaleString()}
                </div>
                
                {version.changes && (
                  <div className="text-xs mb-2 text-muted-foreground">
                    {version.changes}
                  </div>
                )}
                
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview(version)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Vorschau
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(version)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Wiederherstellen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const VersionPreviewDialog: React.FC<{
  version: DocumentVersion;
  onClose: () => void;
  onRestore: (version: DocumentVersion) => void;
}> = ({ version, onClose, onRestore }) => {
  return (
    <Card className="w-3/4 h-3/4 max-w-4xl max-h-96">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Version {version.version} Vorschau
            </h3>
            <p className="text-sm text-muted-foreground">
              {version.authorName} • {new Date(version.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(version)}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Wiederherstellen
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="prose prose-sm max-w-none p-4 border rounded bg-muted/10">
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {version.content}
            </pre>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export function VersionHistoryPlugin({ 
  documentId, 
  onVersionRestore 
}: VersionHistoryPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date>(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-save mechanism
  useEffect(() => {
    if (!documentId) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeSinceLastSave = now.getTime() - lastAutoSave.getTime();
      
      // Auto-save every 5 minutes
      if (timeSinceLastSave > 5 * 60 * 1000) {
        createSnapshot('auto');
        setLastAutoSave(now);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [documentId, lastAutoSave]);

  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_document_snapshots')
        .select(`
          *,
          profiles!knowledge_document_snapshots_created_by_fkey (display_name)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const versionsData = data?.map((snapshot: any) => ({
        id: snapshot.id,
        documentId: snapshot.document_id,
        version: snapshot.document_version,
        content: snapshot.yjs_state || '',
        createdAt: snapshot.created_at,
        createdBy: snapshot.created_by,
        authorName: snapshot.profiles?.display_name || 'Unknown User',
        changes: 'Content changes', // Could be enhanced with diff
        snapshotType: snapshot.snapshot_type as 'auto' | 'manual'
      })) || [];

      setVersions(versionsData);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const createSnapshot = async (type: 'auto' | 'manual' = 'manual') => {
    if (!user) return;

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const content = root.getTextContent();
      
      // Create snapshot in database
      supabase.functions.invoke('create-knowledge-snapshot', {
        body: {
          documentId,
          content,
          snapshotType: type
        }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error creating snapshot:', error);
        } else {
          if (type === 'manual') {
            toast({
              title: "Erfolg",
              description: "Snapshot wurde erstellt",
            });
          }
          loadVersions();
        }
      });
    });
  };

  const restoreVersion = async (version: DocumentVersion) => {
    try {
      // Restore content to editor
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (version.content) {
          // Simple text restoration - could be enhanced for rich content
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(version.content));
          root.append(paragraph);
        }
      });

      onVersionRestore?.(version.content);
      
      toast({
        title: "Erfolg",
        description: `Version ${version.version} wurde wiederhergestellt`,
      });

      setShowHistory(false);
      setShowPreview(false);
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Wiederherstellen der Version",
        variant: "destructive",
      });
    }
  };

  const openHistory = () => {
    loadVersions();
    setShowHistory(true);
  };

  const previewVersion = (version: DocumentVersion) => {
    setSelectedVersion(version);
    setShowPreview(true);
    setShowHistory(false);
  };

  return (
    <>
      {/* History Button in Toolbar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={openHistory}
        className="h-8"
        title="Versionshistorie"
      >
        <History className="h-4 w-4" />
      </Button>

      {/* Manual Snapshot Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => createSnapshot('manual')}
        className="h-8"
        title="Snapshot erstellen"
      >
        <Clock className="h-4 w-4" />
      </Button>

      {/* Version History Dialog */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <VersionHistoryDialog
            versions={versions}
            onRestore={restoreVersion}
            onClose={() => setShowHistory(false)}
            onPreview={previewVersion}
          />
        </div>
      )}

      {/* Version Preview Dialog */}
      {showPreview && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <VersionPreviewDialog
            version={selectedVersion}
            onClose={() => setShowPreview(false)}
            onRestore={restoreVersion}
          />
        </div>
      )}
    </>
  );
}