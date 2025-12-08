import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Database, User, ChevronLeft, ChevronRight, Lock, Unlock, Save, Trash2 } from 'lucide-react';
import EnhancedLexicalEditor from './EnhancedLexicalEditor';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { useKnowledgeDocumentTopics } from '@/hooks/useKnowledgeDocumentTopics';
import { TopicSelector, TopicDisplay } from '@/components/topics/TopicSelector';

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  is_locked: boolean;
  creator_name?: string;
}

const KnowledgeBaseView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const { topics, getActiveTopics } = useTopics();
  
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [documentTopicsMap, setDocumentTopicsMap] = useState<Record<string, string[]>>({});
  const [editorContent, setEditorContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Topic management for selected document
  const { 
    assignedTopics: selectedDocTopics, 
    setTopics: setSelectedDocTopics,
    refreshTopics: refreshSelectedDocTopics 
  } = useKnowledgeDocumentTopics(selectedDocument?.id);
  
  // Create document form state
  const [newDocument, setNewDocument] = useState({
    title: '',
    content: '',
    is_published: false,
    selectedTopics: [] as string[]
  });

  // Handle URL-based document selection
  useEffect(() => {
    if (documentId && documents.length > 0) {
      const doc = documents.find(d => d.id === documentId);
      if (doc) {
        if (!selectedDocument || selectedDocument.id !== doc.id) {
          setSelectedDocument(doc);
          setEditorContent(doc.content || '');
          setIsEditorOpen(true);
          setIsSidebarCollapsed(true);
          setHasUnsavedChanges(false);
        }
      } else if (!loading) {
        navigate('/knowledge', { replace: true });
      }
    } else if (!documentId && (isEditorOpen || selectedDocument)) {
      setSelectedDocument(null);
      setIsEditorOpen(false);
      setIsSidebarCollapsed(false);
      setHasUnsavedChanges(false);
    }
  }, [documentId, documents, navigate, loading, selectedDocument, isEditorOpen]);

  // Fetch all document topics for list display
  const fetchAllDocumentTopics = async (docIds: string[]) => {
    if (docIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('knowledge_document_topics')
        .select('document_id, topic_id')
        .in('document_id', docIds);

      if (error) throw error;
      
      const topicsMap: Record<string, string[]> = {};
      data?.forEach(item => {
        if (!topicsMap[item.document_id]) {
          topicsMap[item.document_id] = [];
        }
        topicsMap[item.document_id].push(item.topic_id);
      });
      setDocumentTopicsMap(topicsMap);
    } catch (error) {
      console.error('Error fetching document topics:', error);
    }
  };

  const fetchDocuments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const documentsWithCreator = await Promise.all(
          data.map(async (doc) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', doc.created_by)
              .maybeSingle();
            
            return {
              ...doc,
              is_locked: doc.is_locked || false,
              creator_name: profile?.display_name || 'Unbekannt'
            };
          })
        );

        setDocuments(documentsWithCreator);
        await fetchAllDocumentTopics(documentsWithCreator.map(d => d.id));
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Fehler beim Laden der Dokumente",
        description: "Die Dokumente konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  // Fetch tenant ID
  useEffect(() => {
    const fetchTenantId = async () => {
      if (!user) {
        setTenantId(null);
        return;
      }

      try {
        const { data: tenantData, error: tenantError } = await supabase.rpc('get_user_primary_tenant_id', {
          _user_id: user.id
        });

        if (!tenantError) {
          setTenantId(tenantData);
        }
      } catch (error) {
        console.error('Error fetching tenant ID:', error);
      }
    };

    fetchTenantId();
  }, [user]);

  // Real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('knowledge-documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_documents'
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleCreateDocument = async () => {
    if (!user || !newDocument.title.trim() || !tenantId) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([{
          title: newDocument.title,
          content: newDocument.content,
          category: 'general',
          created_by: user.id,
          tenant_id: tenantId,
          is_published: newDocument.is_published,
          is_locked: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Save topics for the new document
      if (newDocument.selectedTopics.length > 0) {
        const { error: topicsError } = await supabase
          .from('knowledge_document_topics')
          .insert(newDocument.selectedTopics.map(topic_id => ({ 
            document_id: data.id, 
            topic_id 
          })));
        
        if (topicsError) console.error('Error saving topics:', topicsError);
      }

      toast({
        title: "Dokument erstellt",
        description: "Das neue Dokument wurde erfolgreich erstellt.",
      });

      setNewDocument({
        title: '',
        content: '',
        is_published: false,
        selectedTopics: []
      });

      const docWithCreator = {
        ...data,
        is_locked: false,
        creator_name: user.user_metadata?.display_name || user.email || 'Unknown'
      };
      setSelectedDocument(docWithCreator);
      setEditorContent(data.content || '');
      setIsEditorOpen(true);
      setIsSidebarCollapsed(true);
      
      navigate(`/knowledge/${data.id}`, { replace: true });
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: "Das Dokument konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedDocument || !user) return;

    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .update({ 
          content: editorContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDocument.id);

      if (error) throw error;

      // Save topics
      await setSelectedDocTopics(selectedDocTopics);

      setHasUnsavedChanges(false);
      toast({
        title: "Gespeichert",
        description: "Das Dokument wurde gespeichert.",
      });

      // Update local document
      setSelectedDocument(prev => prev ? { ...prev, content: editorContent } : null);
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Das Dokument konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleToggleLock = async () => {
    if (!selectedDocument || !user) return;
    
    // Only creator can toggle lock
    if (selectedDocument.created_by !== user.id) {
      toast({
        title: "Keine Berechtigung",
        description: "Nur der Ersteller kann den Sperrstatus ändern.",
        variant: "destructive",
      });
      return;
    }

    try {
      const newLockState = !selectedDocument.is_locked;
      const { error } = await supabase
        .from('knowledge_documents')
        .update({ is_locked: newLockState })
        .eq('id', selectedDocument.id);

      if (error) throw error;

      setSelectedDocument(prev => prev ? { ...prev, is_locked: newLockState } : null);
      setDocuments(prev => prev.map(d => 
        d.id === selectedDocument.id ? { ...d, is_locked: newLockState } : d
      ));

      toast({
        title: newLockState ? "Dokument gesperrt" : "Dokument entsperrt",
        description: newLockState 
          ? "Das Dokument ist jetzt schreibgeschützt." 
          : "Das Dokument kann jetzt bearbeitet werden.",
      });
    } catch (error) {
      console.error('Error toggling lock:', error);
      toast({
        title: "Fehler",
        description: "Der Sperrstatus konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich gelöscht.",
      });

      if (selectedDocument?.id === docId) {
        navigate('/knowledge', { replace: true });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Fehler beim Löschen",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = !selectedTopicFilter || 
                        (documentTopicsMap[doc.id]?.includes(selectedTopicFilter));
    return matchesSearch && matchesTopic;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Extract plain text preview from content (handles HTML)
  const getPreviewText = (content: string, maxLength: number = 300) => {
    if (!content) return 'Kein Inhalt verfügbar...';
    
    // Remove HTML tags
    const textContent = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (textContent.length <= maxLength) return textContent;
    
    const truncated = textContent.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace > maxLength - 50 ? lastSpace : maxLength) + '...';
  };

  const canEdit = selectedDocument && !selectedDocument.is_locked;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-muted-foreground">Dokumente werden geladen...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar */}
      <div className={`${
        selectedDocument && isEditorOpen 
          ? isSidebarCollapsed 
            ? 'w-12' 
            : 'w-96' 
          : 'w-full'
      } flex flex-col transition-all duration-300 border-r border-border`}>
        
        {/* Collapsed Sidebar Toggle */}
        {selectedDocument && isEditorOpen && isSidebarCollapsed && (
          <div className="p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-full h-8 p-0"
              title="Sidebar öffnen"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Full Sidebar Content */}
        {(!selectedDocument || !isEditorOpen || !isSidebarCollapsed) && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-semibold text-foreground">Wissensdatenbank</h1>
                  </div>
                  {selectedDocument && isEditorOpen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSidebarCollapsed(true)}
                      title="Sidebar minimieren"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Tabs defaultValue="manage" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="add" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Hinzufügen
                    </TabsTrigger>
                    <TabsTrigger value="manage" className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Verwalten ({documents.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="add" className="mt-0">
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <div>
                          <Label htmlFor="title">Titel</Label>
                          <Input
                            id="title"
                            value={newDocument.title}
                            onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Titel des Dokuments..."
                          />
                        </div>
                        <div>
                          <Label>Themen</Label>
                          <TopicSelector
                            selectedTopicIds={newDocument.selectedTopics}
                            onTopicsChange={(topicIds) => setNewDocument(prev => ({ ...prev, selectedTopics: topicIds }))}
                            placeholder="Themen auswählen..."
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="published"
                            checked={newDocument.is_published}
                            onCheckedChange={(checked) => setNewDocument(prev => ({ ...prev, is_published: checked }))}
                          />
                          <Label htmlFor="published">Für alle sichtbar</Label>
                        </div>
                        <Button 
                          onClick={handleCreateDocument} 
                          disabled={!newDocument.title.trim()}
                          className="w-full"
                        >
                          Dokument erstellen
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="manage" className="mt-0">
                    <div className="space-y-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Dokumente durchsuchen..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      {/* Topic Filter */}
                      <div className="flex flex-wrap gap-2">
                        <Badge 
                          variant={selectedTopicFilter === null ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedTopicFilter(null)}
                        >
                          Alle
                        </Badge>
                        {getActiveTopics().slice(0, 6).map(topic => (
                          <Badge
                            key={topic.id}
                            variant={selectedTopicFilter === topic.id ? "default" : "outline"}
                            className="cursor-pointer"
                            style={selectedTopicFilter === topic.id ? { backgroundColor: topic.color } : {}}
                            onClick={() => setSelectedTopicFilter(
                              selectedTopicFilter === topic.id ? null : topic.id
                            )}
                          >
                            {topic.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredDocuments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {documents.length === 0 ? 'Keine Dokumente vorhanden' : 'Keine Ergebnisse gefunden'}
                    </h3>
                    <p className="text-muted-foreground">
                      {documents.length === 0 
                        ? 'Erstellen Sie Ihr erstes Dokument über den "Hinzufügen" Tab.'
                        : 'Versuchen Sie andere Suchbegriffe oder Filter.'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => (
                    <Card 
                      key={doc.id} 
                      className={`hover:shadow-md transition-shadow cursor-pointer ${
                        selectedDocument?.id === doc.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => navigate(`/knowledge/${doc.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-medium text-foreground">{doc.title}</h3>
                              {doc.is_locked && (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              {doc.is_published && (
                                <Badge variant="outline" className="text-xs">Öffentlich</Badge>
                              )}
                            </div>
                            
                            {/* Topics */}
                            {documentTopicsMap[doc.id]?.length > 0 && (
                              <div className="mb-2">
                                <TopicDisplay 
                                  topicIds={documentTopicsMap[doc.id]} 
                                  maxDisplay={3}
                                />
                              </div>
                            )}
                            
                            {/* Extended Preview - 300 characters */}
                            <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
                              {getPreviewText(doc.content, 300)}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {doc.creator_name}
                              </div>
                              <div>
                                {formatDate(doc.updated_at)}
                              </div>
                            </div>
                          </div>
                          
                          {doc.created_by === user?.id && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
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

      {/* Document Editor */}
      {selectedDocument && isEditorOpen && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Header */}
          <div className="border-b border-border p-4 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground truncate">{selectedDocument.title}</h2>
                  {selectedDocument.is_locked && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Gesperrt
                    </Badge>
                  )}
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Ungespeichert
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedDocument.updated_at)} • {selectedDocument.creator_name}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Topics in Editor */}
                <div className="hidden md:block">
                  <TopicSelector
                    selectedTopicIds={selectedDocTopics}
                    onTopicsChange={(topicIds) => {
                      setSelectedDocTopics(topicIds);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Themen..."
                    compact
                  />
                </div>
                
                {/* Lock Toggle - Only for creator */}
                {selectedDocument.created_by === user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleLock}
                    title={selectedDocument.is_locked ? "Entsperren" : "Sperren"}
                  >
                    {selectedDocument.is_locked ? (
                      <Unlock className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                {/* Save Button */}
                {canEdit && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveDocument}
                    disabled={!hasUnsavedChanges}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Speichern
                  </Button>
                )}
                
                {/* Close Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (!confirm('Sie haben ungespeicherte Änderungen. Trotzdem schließen?')) {
                        return;
                      }
                    }
                    navigate('/knowledge', { replace: true });
                  }}
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
          
          {/* Editor Content */}
          <div className="flex-1 overflow-hidden">
            <EnhancedLexicalEditor
              content={selectedDocument.content || ''}
              onChange={(newContent) => {
                setEditorContent(newContent);
                if (newContent !== selectedDocument.content) {
                  setHasUnsavedChanges(true);
                }
              }}
              placeholder={canEdit ? "Beginnen Sie mit der Bearbeitung..." : "Dieses Dokument ist schreibgeschützt."}
              documentId={selectedDocument.id}
              enableCollaboration={false}
              showToolbar={canEdit}
              editable={canEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseView;
