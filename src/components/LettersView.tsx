import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, Filter, Calendar, User, Eye, Edit3, Trash2, Grid, List, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useViewPreference } from '@/hooks/useViewPreference';
import LetterEditor from './LetterEditor';
import LetterTemplateSelector from './LetterTemplateSelector';
import LetterPDFExport from './LetterPDFExport';

interface Letter {
  id?: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  template_id?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  status: 'draft' | 'review' | 'approved' | 'sent';
  sent_date?: string;
  sent_method?: string;
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  user_id?: string;
  archived_at?: string | null;
}

const LettersView: React.FC = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { viewType, setViewType } = useViewPreference({ key: 'letters' });
  
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  useEffect(() => {
    if (currentTenant) {
      fetchLetters();
    }
  }, [currentTenant]);

  const fetchLetters = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLetters(data as any || []);
    } catch (error) {
      console.error('Error fetching letters:', error);
      toast({
        title: "Fehler",
        description: "Briefe konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      letter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || letter.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleNewLetter = () => {
    setSelectedLetter(null);
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: any) => {
    console.log('Template selected:', template);
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    
    // Create a new letter object with template information
    const newLetter: any = {
      id: undefined, // New letter has no ID yet
      title: '',
      content: '',
      content_html: '',
      status: 'draft',
      template_id: template?.id,
      sender_info_id: template?.default_sender_id,
      information_block_ids: template?.default_info_blocks || [],
      tenant_id: currentTenant?.id || '',
      user_id: user?.id || '',
      created_by: user?.id || '',
      created_at: '',
      updated_at: '',
      recipient_name: '',
      recipient_address: '',
      archived_at: null
    };
    
    console.log('New letter with template:', newLetter);
    setSelectedLetter(newLetter);
    setIsEditorOpen(true);
  };

  const handleEditLetter = (letter: Letter) => {
    setSelectedLetter(letter);
    setIsEditorOpen(true);
  };

  const handleDeleteLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('letters')
        .delete()
        .eq('id', letterId);

      if (error) throw error;

      toast({
        title: "Brief gelöscht",
        description: "Der Brief wurde erfolgreich gelöscht.",
      });

      fetchLetters();
    } catch (error) {
      console.error('Error deleting letter:', error);
      toast({
        title: "Fehler",
        description: "Der Brief konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const statusLabels: { [key: string]: string } = {
    draft: 'Entwurf',
    review: 'Zur Prüfung',
    approved: 'Genehmigt',
    sent: 'Versendet'
  };

  const statusColors: { [key: string]: string } = {
    draft: 'bg-gray-100 text-gray-800',
    review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    sent: 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Briefe</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Korrespondenz</p>
        </div>
        <Button onClick={handleNewLetter} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Neuer Brief
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Briefe durchsuchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status filtern..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="review">Zur Prüfung</SelectItem>
                    <SelectItem value="approved">Genehmigt</SelectItem>
                    <SelectItem value="sent">Versendet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={viewType === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('card')}
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Letters Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Briefe werden geladen...</p>
        </div>
      ) : filteredLetters.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Keine Briefe gefunden</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Keine Briefe entsprechen Ihren Filterkriterien.'
              : 'Erstellen Sie Ihren ersten Brief.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={handleNewLetter}>
              <Plus className="h-4 w-4 mr-2" />
              Ersten Brief erstellen
            </Button>
          )}
        </div>
      ) : (
        viewType === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLetters.map((letter) => (
              <Card key={letter.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                <CardTitle className="text-lg line-clamp-2">{letter.title}</CardTitle>
                    <Badge className={`ml-2 ${statusColors[letter.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[letter.status] || letter.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Recipient */}
                  {letter.recipient_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="truncate">{letter.recipient_name}</span>
                    </div>
                  )}
                  
                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(letter.updated_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  
                  {/* Content Preview */}
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {letter.content || 'Kein Inhalt vorhanden'}
                  </p>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditLetter(letter)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <LetterPDFExport 
                        letter={letter as any} 
                        variant="icon-only"
                        size="sm"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteLetter(letter.id!)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Status Actions for non-sent letters */}
                    {letter.status !== 'sent' && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Status ändern im Editor</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLetters.map((letter) => (
                  <TableRow key={letter.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {letter.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {letter.recipient_name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[letter.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[letter.status] || letter.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(letter.updated_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditLetter(letter)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <LetterPDFExport 
                          letter={letter as any} 
                          variant="icon-only"
                          size="sm"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteLetter(letter.id!)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      {/* Template Selector Dialog */}
      {showTemplateSelector && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Template für neuen Brief auswählen</h2>
              <Button variant="ghost" onClick={() => setShowTemplateSelector(false)}>
                ×
              </Button>
            </div>
            <LetterTemplateSelector
              onSelect={handleTemplateSelect}
            />
          </div>
        </div>
      )}

      {/* Letter Editor */}
      <LetterEditor
        letter={selectedLetter as any}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedLetter(null);
          // Refresh letters when editor closes to get latest status
          fetchLetters();
        }}
        onSave={() => {
          fetchLetters();
          setIsEditorOpen(false);
          setSelectedLetter(null);
        }}
      />
    </div>
  );
};

export default LettersView;