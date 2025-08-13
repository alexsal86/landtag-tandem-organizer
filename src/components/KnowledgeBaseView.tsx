import React, { useState, useEffect } from 'react';
import { Search, Plus, Database, MoreVertical, Users, Eye, Edit, Trash2, User } from 'lucide-react';
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
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import KnowledgeDocumentEditor from './KnowledgeDocumentEditor';

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
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select(`
          *,
          profiles!knowledge_documents_created_by_fkey(display_name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const documentsWithCreator = data?.map(doc => ({
        ...doc,
        creator_name: (doc.profiles as any)?.display_name || 'Unbekannt'
      })) || [];

      setDocuments(documentsWithCreator);
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
      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([{
          title: newDocument.title,
          content: newDocument.content,
          category: newDocument.category,
          created_by: user.id,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Dokumente werden geladen...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-none border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Wissensdatenbank</h1>
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
                      <Card key={doc.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
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
                                {doc.content || 'Kein Inhalt verfügbar...'}
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
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setIsEditorOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Bearbeiten
                              </Button>
                              {doc.created_by === user?.id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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

      {/* Document Editor */}
      {selectedDocument && (
        <KnowledgeDocumentEditor
          document={selectedDocument}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedDocument(null);
          }}
          onSave={() => {
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
};

export default KnowledgeBaseView;