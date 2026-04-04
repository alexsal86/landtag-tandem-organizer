import { useState, useEffect } from 'react';
import { Search, Plus, Database, User, ChevronLeft, ChevronRight, Lock, Unlock, Save, Trash2, Upload, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuickAccessMenuItem } from "@/components/shared/QuickAccessMenuItem";
import EnhancedLexicalEditor from './EnhancedLexicalEditor';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useNotificationHighlight } from '@/hooks/useNotificationHighlight';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTopics } from '@/hooks/useTopics';
import { useKnowledgeDocumentTopics } from '@/hooks/useKnowledgeDocumentTopics';
import { TopicSelector, TopicDisplay } from '@/components/topics/TopicSelector';
import { useKnowledgeData } from './knowledge/hooks/useKnowledgeData';
import { useKnowledgeVersionHistory } from './knowledge/hooks/useKnowledgeVersionHistory';
import { KnowledgeVersionHistory } from './knowledge/KnowledgeVersionHistory';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DecisionFileUpload } from '@/components/task-decisions/DecisionFileUpload';
import type { EmailMetadata } from '@/utils/emlParser';

const KnowledgeBaseView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subId, documentId: legacyDocumentId } = useParams<{ subId?: string; documentId?: string }>();
  const documentId = subId ?? legacyDocumentId;
  const [searchParams, setSearchParams] = useSearchParams();
  const { isHighlighted, highlightRef, highlightId } = useNotificationHighlight();
  const { getActiveTopics } = useTopics();

  const data = useKnowledgeData();
  const { createVersion } = useKnowledgeVersionHistory(data.selectedDocument?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [newDocument, setNewDocument] = useState({ title: '', content: '', is_published: false, selectedTopics: [] as string[] });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [selectedUploadMetadataByIdentity, setSelectedUploadMetadataByIdentity] = useState<Record<string, EmailMetadata | null>>({});
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const { assignedTopics: selectedDocTopics, setTopics: setSelectedDocTopics } = useKnowledgeDocumentTopics(data.selectedDocument?.id);

  // URL action handler
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-article') { searchParams.delete('action'); setSearchParams(searchParams, { replace: true }); }
  }, [searchParams, setSearchParams]);

  // Auto-open from highlight
  useEffect(() => {
    if (highlightId && !documentId && data.documents.length > 0) {
      const doc = data.documents.find(d => d.id === highlightId);
      if (doc) navigate(`/knowledge/${doc.id}`, { replace: true });
    }
  }, [highlightId, documentId, data.documents, navigate]);

  // URL-based document selection
  useEffect(() => {
    if (documentId && data.documents.length > 0) {
      const doc = data.documents.find(d => d.id === documentId);
      if (doc) {
        if (!data.selectedDocument || data.selectedDocument.id !== doc.id) {
          data.setSelectedDocument(doc);
          data.setEditorContent({
            plainText: doc.plain_text || '',
            nodesJson: doc.content_nodes || undefined,
            html: doc.content_html || undefined,
          });
          data.setIsEditorOpen(true);
          data.setIsSidebarCollapsed(false);
          data.setHasUnsavedChanges(false);
        }
      } else if (!data.loading) navigate('/knowledge', { replace: true });
    } else if (!documentId && (data.isEditorOpen || data.selectedDocument)) {
      data.setSelectedDocument(null);
      data.setIsEditorOpen(false);
      data.setIsSidebarCollapsed(false);
      data.setHasUnsavedChanges(false);
    }
  }, [documentId, data.documents, navigate, data.loading]);

  const filteredDocuments = data.documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || (doc.plain_text || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = !selectedTopicFilter || (data.documentTopicsMap[doc.id]?.includes(selectedTopicFilter));
    return matchesSearch && matchesTopic;
  });

  const formatDate = (s: string) => new Date(s).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' });
  const getPreviewText = (content: string, maxLength = 300) => {
    if (!content) return 'Kein Inhalt verfügbar...';
    const t = content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (t.length <= maxLength) return t;
    const tr = t.substring(0, maxLength); const ls = tr.lastIndexOf(' ');
    return tr.substring(0, ls > maxLength - 50 ? ls : maxLength) + '...';
  };

  const canEdit = data.selectedDocument && !data.selectedDocument.is_locked;

  const resetUploadState = () => {
    setSelectedUploadFiles([]);
    setSelectedUploadMetadataByIdentity({});
  };

  const handleKnowledgeUpload = async () => {
    if (!user || !data.selectedDocument || !data.tenantId) return;
    if (selectedUploadFiles.length === 0) {
      toast({ title: 'Keine Dateien ausgewählt', description: 'Bitte wählen Sie mindestens eine Datei aus.', variant: 'destructive' });
      return;
    }

    setIsUploadingFiles(true);

    const uploadedPaths: string[] = [];
    try {
      for (const [index, file] of selectedUploadFiles.entries()) {
        const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
        const storagePath = `${user.id}/knowledge-${data.selectedDocument.id}-${Date.now()}-${index}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file);
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);

        const identity = `${file.name}::${file.size}::${file.lastModified}`;
        const emailTag = selectedUploadMetadataByIdentity[identity] ? 'email' : 'file';

        const { error: dbError } = await supabase.from('documents').insert({
          user_id: user.id,
          tenant_id: data.tenantId,
          title: file.name,
          description: `Upload aus Wissen: ${data.selectedDocument.title}`,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          file_type: file.type,
          category: 'knowledge',
          status: 'draft',
          tags: [`knowledge:${data.selectedDocument.id}`, emailTag],
        });

        if (dbError) throw dbError;
      }

      toast({
        title: 'Upload erfolgreich',
        description: `${selectedUploadFiles.length} Datei(en) wurden aus Wissen hochgeladen.`,
      });
      resetUploadState();
      setShowUploadDialog(false);
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('documents').remove(uploadedPaths);
      }
      toast({
        title: 'Upload fehlgeschlagen',
        description: 'Die Dateien konnten nicht vollständig hochgeladen werden.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingFiles(false);
    }
  };

  if (data.loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" /><div className="text-muted-foreground">Dokumente werden geladen...</div></div></div>;

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar */}
      <div className={`${data.selectedDocument && data.isEditorOpen ? data.isSidebarCollapsed ? 'w-12' : 'w-96' : 'w-full'} flex flex-col transition-all duration-300 border-r border-border`}>
        {data.selectedDocument && data.isEditorOpen && data.isSidebarCollapsed && (
          <div className="p-2 border-b"><Button variant="ghost" size="sm" onClick={() => data.setIsSidebarCollapsed(false)} className="w-full h-8 p-0" title="Sidebar öffnen"><ChevronRight className="h-4 w-4" /></Button></div>
        )}
        {(!data.selectedDocument || !data.isEditorOpen || !data.isSidebarCollapsed) && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-none border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3"><Database className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold text-foreground">Wissensdatenbank</h1></div>
                  {data.selectedDocument && data.isEditorOpen && <Button variant="ghost" size="sm" onClick={() => data.setIsSidebarCollapsed(true)} title="Sidebar minimieren"><ChevronLeft className="h-4 w-4" /></Button>}
                </div>
                <Tabs defaultValue="manage" className="w-full">
                  <TabsList className="mb-4"><TabsTrigger value="add" className="flex items-center gap-2"><Plus className="h-4 w-4" />Hinzufügen</TabsTrigger><TabsTrigger value="manage" className="flex items-center gap-2"><Database className="h-4 w-4" />Verwalten ({data.documents.length})</TabsTrigger></TabsList>
                  <TabsContent value="add" className="mt-0">
                    <Card><CardContent className="p-4 space-y-4">
                      <div><Label htmlFor="title">Titel</Label><Input id="title" value={newDocument.title} onChange={(e) => setNewDocument(p => ({ ...p, title: e.target.value }))} placeholder="Titel des Dokuments..." /></div>
                      <div><Label>Themen</Label><TopicSelector selectedTopicIds={newDocument.selectedTopics} onTopicsChange={(ids) => setNewDocument(p => ({ ...p, selectedTopics: ids }))} placeholder="Themen auswählen..." /></div>
                      <div className="flex items-center space-x-2"><Switch id="published" checked={newDocument.is_published} onCheckedChange={(c) => setNewDocument(p => ({ ...p, is_published: c }))} /><Label htmlFor="published">Für alle sichtbar</Label></div>
                      <Button onClick={() => { data.handleCreateDocument(newDocument); setNewDocument({ title: '', content: '', is_published: false, selectedTopics: [] }); }} disabled={!newDocument.title.trim()} className="w-full">Dokument erstellen</Button>
                    </CardContent></Card>
                  </TabsContent>
                  <TabsContent value="manage" className="mt-0">
                    <div className="space-y-4">
                      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Dokumente durchsuchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={selectedTopicFilter === null ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedTopicFilter(null)}>Alle</Badge>
                        {getActiveTopics().slice(0, 6).map(topic => <Badge key={topic.id} variant={selectedTopicFilter === topic.id ? "default" : "outline"} className="cursor-pointer" style={selectedTopicFilter === topic.id ? { backgroundColor: topic.color ?? undefined } : {}} onClick={() => setSelectedTopicFilter(selectedTopicFilter === topic.id ? null : topic.id)}>{topic.label}</Badge>)}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredDocuments.length === 0 ? (
                <Card><CardContent className="py-12 text-center"><Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-medium text-foreground mb-2">{data.documents.length === 0 ? 'Keine Dokumente vorhanden' : 'Keine Ergebnisse gefunden'}</h3><p className="text-muted-foreground">{data.documents.length === 0 ? 'Erstellen Sie Ihr erstes Dokument über den "Hinzufügen" Tab.' : 'Versuchen Sie andere Suchbegriffe oder Filter.'}</p></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map(doc => (
                    <Card key={doc.id} ref={highlightRef(doc.id)} className={cn("hover:shadow-md transition-shadow cursor-pointer", data.selectedDocument?.id === doc.id && 'ring-2 ring-primary', isHighlighted(doc.id) && "notification-highlight")} onClick={() => navigate(`/knowledge/${doc.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium text-foreground">{doc.title}</h3>
                              {doc.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                              {doc.is_published && <Badge variant="outline" className="text-xs">Öffentlich</Badge>}
                            </div>
                            {data.documentTopicsMap[doc.id]?.length > 0 && <div className="mb-2"><TopicDisplay topicIds={data.documentTopicsMap[doc.id]} maxDisplay={3} /></div>}
                            <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{getPreviewText(doc.plain_text || '', 300)}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground"><div className="flex items-center gap-1"><User className="h-3 w-3" />{doc.creator_name}</div><div>{formatDate(doc.updated_at)}</div></div>
                          </div>
                          {doc.created_by === user?.id && <div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => data.handleDeleteDocument(doc.id)}><Trash2 className="h-4 w-4" /></Button></div>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor */}
      {data.selectedDocument && data.isEditorOpen && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border p-4 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground truncate">{data.selectedDocument.title}</h2>
                  {data.selectedDocument.is_locked && <Badge variant="secondary" className="flex items-center gap-1"><Lock className="h-3 w-3" />Gesperrt</Badge>}
                  {data.hasUnsavedChanges && <Badge variant="outline" className="text-orange-600 border-orange-600">Ungespeichert</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(data.selectedDocument.updated_at)} • {data.selectedDocument.creator_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden md:block"><TopicSelector selectedTopicIds={selectedDocTopics} onTopicsChange={(ids) => { setSelectedDocTopics(ids); data.setHasUnsavedChanges(true); }} placeholder="Themen..." compact /></div>
                <KnowledgeVersionHistory documentId={data.selectedDocument.id} currentContent={data.editorContent.plainText} currentTitle={data.selectedDocument.title} tenantId={data.selectedDocument.tenant_id || ''} />
                {canEdit && <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)}><Upload className="h-4 w-4 mr-1" />Upload</Button>}
                {data.selectedDocument.created_by === user?.id && <Button variant="outline" size="sm" onClick={data.handleToggleLock} title={data.selectedDocument.is_locked ? "Entsperren" : "Sperren"}>{data.selectedDocument.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</Button>}
                {canEdit && <Button variant="default" size="sm" onClick={async () => { await createVersion({ id: data.selectedDocument!.id, title: data.selectedDocument!.title, content: data.editorContent.plainText, content_html: data.editorContent.html || data.selectedDocument!.content_html, tenant_id: data.selectedDocument!.tenant_id }); data.handleSaveDocument(selectedDocTopics, setSelectedDocTopics); }} disabled={!data.hasUnsavedChanges}><Save className="h-4 w-4 mr-1" />Speichern</Button>}
                <Button variant="outline" size="sm" onClick={() => { if (data.hasUnsavedChanges && !confirm('Sie haben ungespeicherte Änderungen. Trotzdem schließen?')) return; navigate('/knowledge', { replace: true }); }}>Schließen</Button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <EnhancedLexicalEditor key={data.selectedDocument.id} content={data.selectedDocument.plain_text || ''} contentNodes={data.selectedDocument.content_nodes || undefined} onChange={(nextContent) => {
              data.setEditorContent(nextContent);
              const hasChanged =
                (nextContent.plainText || '') !== (data.selectedDocument?.plain_text || '') ||
                (nextContent.nodesJson || '') !== (data.selectedDocument?.content_nodes || '') ||
                (nextContent.html || '') !== (data.selectedDocument?.content_html || '');
              data.setHasUnsavedChanges(hasChanged);
            }} placeholder={canEdit ? "Beginnen Sie mit der Bearbeitung..." : "Dieses Dokument ist schreibgeschützt."} documentId={data.selectedDocument.id} enableCollaboration={false} showToolbar={!!canEdit} editable={!!canEdit} />
          </div>

          <Dialog open={showUploadDialog} onOpenChange={(open) => { setShowUploadDialog(open); if (!open) resetUploadState(); }}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Dateien zu Wissen hochladen</DialogTitle>
                <DialogDescription>
                  Gleiche Upload-Funktion wie bei Entscheidungen: Drag & Drop, Klick oder Strg+V – inklusive Outlook-Mails (.eml/.msg).
                </DialogDescription>
              </DialogHeader>

              <DecisionFileUpload
                mode="creation"
                canUpload={!isUploadingFiles}
                onFilesPrepared={({ files, metadataByIdentity }) => {
                  setSelectedUploadFiles(files);
                  setSelectedUploadMetadataByIdentity(metadataByIdentity);
                }}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploadingFiles}>Abbrechen</Button>
                <Button onClick={handleKnowledgeUpload} disabled={isUploadingFiles || selectedUploadFiles.length === 0}>
                  {isUploadingFiles ? 'Wird hochgeladen...' : `Hochladen (${selectedUploadFiles.length})`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseView;
