import React, { useState, useEffect } from 'react';
import { Search, Plus, Database, MoreVertical, Users, Eye, Edit, Trash2, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import LexicalEditor from '@/components/LexicalEditor';


interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  creator_name?: string;
}

const KnowledgeBaseView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Handle URL-based document selection
  useEffect(() => {
    console.log('URL change detected - documentId:', documentId, 'documents count:', documents.length);
    if (documentId && documents.length > 0) {
      const doc = documents.find(d => d.id === documentId);
      if (doc) {
        console.log('Document found for URL:', doc.title);
        setSelectedDocument(doc);
        setIsEditorOpen(true);
        setIsSidebarCollapsed(true);
      } else {
        console.log('Document not found for ID:', documentId, 'redirecting to /knowledge');
        navigate('/knowledge');
      }
    } else if (!documentId) {
      console.log('No documentId in URL, closing editor');
      setSelectedDocument(null);
      setIsEditorOpen(false);
      setIsSidebarCollapsed(false);
    }
  }, [documentId, documents, navigate]);

  // Create document form state
  const [newDocument, setNewDocument] = useState({
    title: '',
    content: '',
    category: 'general',
    is_published: false
  });

  const categories = [
    { value: 'all', label: 'Alle Kategorien' },
    { value: 'general', label: 'Allgemein' },
    { value: 'technical', label: 'Technisch' },
    { value: 'process', label: 'Prozesse' },
    { value: 'policy', label: 'Richtlinien' },
    { value: 'meeting', label: 'Besprechungen' }
  ];

  const fetchDocuments = async () => {
    if (!user) {
      console.log('No user available for fetchDocuments');
      return;
    }

    console.log('Fetching knowledge documents for user:', user.id);
    try {
      console.log('Starting supabase query...');
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('updated_at', { ascending: false });

      console.log('Supabase query result:', { data: data?.length || 0, error });

      if (error) throw error;

      if (data && data.length > 0) {
        console.log('Fetching creator names for', data.length, 'documents');
        // Fetch creator names separately to avoid join issues
        const documentsWithCreator = await Promise.all(
          data.map(async (doc) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', doc.created_by)
              .maybeSingle();
            
            return {
              ...doc,
              creator_name: profile?.display_name || 'Unbekannt'
            };
          })
        );

        console.log('Setting documents with creators:', documentsWithCreator.length);
        setDocuments(documentsWithCreator);
      } else {
        console.log('No documents found, setting empty array');
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
    console.log('KnowledgeBaseView: useEffect triggered, user:', user?.id);
    if (user) {
      fetchDocuments();
    } else {
      console.log('No user, setting loading to false');
      setLoading(false);
    }
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
    if (!user || !newDocument.title.trim()) return;

    try {
      // Get user's primary tenant ID
      const { data: tenantData, error: tenantError } = await supabase.rpc('get_user_primary_tenant_id', {
        _user_id: user.id
      });

      if (tenantError) {
        console.error('Error getting tenant ID:', tenantError);
        throw new Error('Fehler beim Ermitteln der Tenant-ID');
      }

      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([{
          title: newDocument.title,
          content: newDocument.content,
          category: newDocument.category,
          created_by: user.id,
          tenant_id: tenantData,
          is_published: newDocument.is_published
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Dokument erstellt",
        description: "Das neue Dokument wurde erfolgreich erstellt.",
      });

      setIsCreateDialogOpen(false);
      setNewDocument({
        title: '',
        content: '',
        category: 'general',
        is_published: false
      });

      // Open editor for the new document
      setSelectedDocument(data);
      setIsEditorOpen(true);
      setIsSidebarCollapsed(true);
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: "Das Dokument konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Fehler beim Löschen",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(c => c.value === category)?.label || category;
  };

  console.log('KnowledgeBaseView render:', { loading, documentsCount: documents.length, user: user?.id });

  if (loading) {
    console.log('Showing loading state');
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
      {/* Document Selection Sidebar - Collapsible */}
      <div className={`${
        selectedDocument && isEditorOpen 
          ? isSidebarCollapsed 
            ? 'w-12' 
            : 'w-80' 
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
          <div className="flex-1 flex flex-col">
            {/* Header with collapse button when editor is open */}
            <div className="flex-none border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
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
                      <CardHeader>
                        <CardTitle>Neues Dokument erstellen</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
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
                          <Label htmlFor="category">Kategorie</Label>
                          <Select value={newDocument.category} onValueChange={(value) => setNewDocument(prev => ({ ...prev, category: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.slice(1).map(category => (
                                <SelectItem key={category.value} value={category.value}>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="content">Inhalt</Label>
                          <Textarea
                            id="content"
                            value={newDocument.content}
                            onChange={(e) => setNewDocument(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Inhalt des Dokuments..."
                            rows={4}
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
                        <Button onClick={handleCreateDocument} disabled={!newDocument.title.trim()}>
                          Dokument erstellen
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="manage" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Dokumente durchsuchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

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
                                : 'Versuchen Sie andere Suchbegriffe oder Kategorien.'
                              }
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4">
                          {filteredDocuments.map((doc) => (
                            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent 
                                className="p-4"
                                onClick={() => {
                                  console.log('Document clicked:', doc.id, 'navigating to:', `/knowledge/${doc.id}`);
                                  navigate(`/knowledge/${doc.id}`);
                                }}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3 className="font-medium text-foreground truncate">{doc.title}</h3>
                                      <Badge variant="secondary" className="text-xs">
                                        {getCategoryLabel(doc.category)}
                                      </Badge>
                                      {doc.is_published && (
                                        <Badge variant="outline" className="text-xs">
                                          Öffentlich
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                      <span 
                                        dangerouslySetInnerHTML={{
                                          __html: (() => {
                                            const content = doc.content || 'Kein Inhalt verfügbar...';
                                            // Convert markdown to HTML for display
                                            const htmlContent = content
                                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                              .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
                                              .replace(/~~(.*?)~~/g, '<del>$1</del>')
                                              .replace(/^### (.*$)/gm, '<strong>$1</strong>')
                                              .replace(/^## (.*$)/gm, '<strong>$1</strong>')
                                              .replace(/^# (.*$)/gm, '<strong>$1</strong>');
                                            
                                            // Remove HTML tags for length calculation
                                            const textContent = htmlContent.replace(/<[^>]*>/g, '');
                                            
                                            if (textContent.length <= 100) {
                                              return htmlContent;
                                            }
                                            
                                            // Truncate to 100 characters and add ellipsis
                                            const truncated = textContent.substring(0, 100);
                                            const lastSpace = truncated.lastIndexOf(' ');
                                            const cutPoint = lastSpace > 80 ? lastSpace : 100;
                                            
                                            // Apply formatting to truncated text
                                            return content
                                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                              .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
                                              .replace(/~~(.*?)~~/g, '<del>$1</del>')
                                              .replace(/^### (.*$)/gm, '<strong>$1</strong>')
                                              .replace(/^## (.*$)/gm, '<strong>$1</strong>')
                                              .replace(/^# (.*$)/gm, '<strong>$1</strong>')
                                              .replace(/<[^>]*>/g, '')
                                              .substring(0, cutPoint) + '...';
                                          })()
                                        }}
                                      />
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {doc.creator_name}
                                      </div>
                                      <div>
                                        Hinzugefügt: {formatDate(doc.created_at)}
                                      </div>
                                      {doc.updated_at !== doc.created_at && (
                                        <div>
                                          Aktualisiert: {formatDate(doc.updated_at)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    {doc.created_by === user?.id && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteDocument(doc.id);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Löschen
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Document Editor with Demo Features */}
      {selectedDocument && isEditorOpen && (
        <div className="flex-1 flex flex-col">
          <div className="border-b border-border p-4 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selectedDocument.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {getCategoryLabel(selectedDocument.category)} • {formatDate(selectedDocument.updated_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Kollaboration aktiv
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditorOpen(false);
                    setSelectedDocument(null);
                    setIsSidebarCollapsed(false);
                    navigate('/knowledge');
                  }}
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Kollaborativer Editor: {selectedDocument.title}
                </CardTitle>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>• Änderungen werden in Echtzeit synchronisiert</div>
                  <div>• Cursor-Positionen anderer Benutzer werden angezeigt</div>
                  <div>• Automatisches Speichern alle paar Sekunden</div>
                  <div>• Vollständige Rich-Text Formatierung verfügbar</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg min-h-[400px]">
                  <LexicalEditor
                    key={selectedDocument.id}
                    documentId={selectedDocument.id}
                    enableCollaboration={true}
                    initialContent=""
                    placeholder={`Beginnen Sie zu schreiben in "${selectedDocument.title}"...`}
                    showToolbar={true}
                    onChange={(content) => {
                      console.log('Document content changed:', content.length, 'characters');
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseView;