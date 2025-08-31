import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useViewPreference } from "@/hooks/useViewPreference";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Tag,
  FileType,
  Folder,
  Mail,
  Edit3,
  Send,
  Grid,
  List
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import LetterEditor from "./LetterEditor";
import LetterTemplateSelector from "./LetterTemplateSelector";
import LetterPDFExport from "./LetterPDFExport";

interface Document {
  id: string;
  title: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  category: string;
  tags?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  status: 'draft' | 'review' | 'approved' | 'sent';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export function DocumentsView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { viewType, setViewType } = useViewPreference({ key: 'documents' });
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showLetterEditor, setShowLetterEditor] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<Letter | undefined>(undefined);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'letters'>('documents');

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadStatus, setUploadStatus] = useState("draft");

  const categoryLabels = {
    general: "Allgemein",
    legal: "Rechtlich",
    parliamentary: "Parlamentarisch",
    correspondence: "Korrespondenz",
    reports: "Berichte",
    proposals: "Anträge"
  };

  const statusLabels = {
    draft: "Entwurf",
    review: "Überprüfung",
    approved: "Genehmigt",
    archived: "Archiviert"
  };

  useEffect(() => {
    if (user && currentTenant) {
      if (activeTab === 'documents') {
        fetchDocuments();
      } else {
        fetchLetters();
      }
    }
  }, [user, currentTenant, activeTab]);

  const fetchDocuments = async () => {
    if (!currentTenant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Fehler beim Laden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLetters = async () => {
    if (!currentTenant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLetters((data || []) as Letter[]);
    } catch (error: any) {
      toast({
        title: "Fehler beim Laden der Briefe",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle || !user) return;

    setLoading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant?.id || '', // Use current tenant ID
          title: uploadTitle,
          description: uploadDescription,
          file_name: uploadFile.name,
          file_path: fileName,
          file_size: uploadFile.size,
          file_type: uploadFile.type,
          category: uploadCategory,
          tags: uploadTags ? uploadTags.split(',').map(tag => tag.trim()) : [],
          status: uploadStatus,
        });

      if (dbError) throw dbError;

      toast({
        title: "Dokument hochgeladen",
        description: "Das Dokument wurde erfolgreich gespeichert.",
      });

      // Reset form and close dialog
      setUploadFile(null);
      setUploadTitle("");
      setUploadDescription("");
      setUploadTags("");
      setShowUploadDialog(false);
      
      // Refresh documents
      if (activeTab === 'documents') {
        fetchDocuments();
      }
    } catch (error: any) {
      toast({
        title: "Upload-Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error: any) {
      toast({
        title: "Download-Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Dokument löschen möchten?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich entfernt.",
      });

      if (activeTab === 'documents') {
        fetchDocuments();
      }
    } catch (error: any) {
      toast({
        title: "Lösch-Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unbekannt";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || doc.category === filterCategory;
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // For documents section, show archived letters as special documents
  const archivedLetters = documents.filter(doc => doc.document_type === 'archived_letter');

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = letter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         letter.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || letter.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateLetter = () => {
    setSelectedLetter(undefined);
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: any) => {
    setShowTemplateSelector(false);
    setSelectedLetter(undefined);
    setShowLetterEditor(true);
  };

  const handleEditLetter = (letter: Letter) => {
    setSelectedLetter(letter);
    setShowLetterEditor(true);
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
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Der Brief konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleCloseLetterEditor = () => {
    setShowLetterEditor(false);
    setSelectedLetter(undefined);
  };

  const handleSaveLetter = () => {
    fetchLetters();
  };

  // Helper function to render documents grid
  const renderDocumentsGrid = (docs: Document[]) => {
    return viewType === 'card' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {docs.map((document) => (
          <Card key={document.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                </div>
                <Badge className={getStatusColor(document.status)}>
                  {statusLabels[document.status as keyof typeof statusLabels]}
                </Badge>
              </div>
              {document.description && (
                <CardDescription className="line-clamp-2">
                  {document.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  <span>{categoryLabels[document.category as keyof typeof categoryLabels]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileType className="h-4 w-4" />
                  <span>{document.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Größe: {formatFileSize(document.file_size)}</span>
                </div>
              </div>
              
              {document.tags && document.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {document.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator />
              
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(document)}
                  className="gap-1"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(document)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </Button>
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
              <TableHead>Kategorie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead>Größe</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div>{document.title}</div>
                      {document.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {document.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {categoryLabels[document.category as keyof typeof categoryLabels]}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(document.status)}>
                    {statusLabels[document.status as keyof typeof statusLabels]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}
                </TableCell>
                <TableCell>
                  {formatFileSize(document.file_size)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(document)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(document)}
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
    );
  };

  // Helper function to render archived letters grid
  const renderArchivedLettersGrid = (letters: any[]) => {
    return viewType === 'card' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">
        {letters.map((letter) => (
          <Card key={letter.id} className="hover:shadow-lg transition-shadow border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg truncate">
                    {letter.title}
                    <span className="ml-2 text-xs text-blue-600 font-normal">[ARCHIV]</span>
                  </CardTitle>
                </div>
                <Badge className="bg-blue-100 text-blue-800">
                  Archiviert
                </Badge>
              </div>
              {letter.description && (
                <CardDescription className="line-clamp-2">
                  {letter.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}</span>
                </div>
                
                {/* Show workflow information for archived letters */}
                {letter.workflow_history && (
                  <div className="mt-3 p-2 bg-blue-50 rounded border-l-2 border-blue-200">
                    <h4 className="font-medium text-blue-900 text-xs mb-1">Workflow-Verlauf:</h4>
                    <div className="space-y-1 text-xs text-blue-700">
                      {letter.workflow_history.submitted_for_review_at && (
                        <div>Zur Prüfung: {format(new Date(letter.workflow_history.submitted_for_review_at), "dd.MM.yyyy", { locale: de })}</div>
                      )}
                      {letter.workflow_history.approved_at && (
                        <div>Genehmigt: {format(new Date(letter.workflow_history.approved_at), "dd.MM.yyyy", { locale: de })}</div>
                      )}
                      {letter.workflow_history.sent_at && (
                        <div>Versendet: {format(new Date(letter.workflow_history.sent_at), "dd.MM.yyyy", { locale: de })}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Show attachments info */}
                {letter.archived_attachments && letter.archived_attachments.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <h4 className="font-medium text-gray-900 text-xs mb-1">Anlagen ({letter.archived_attachments.length}):</h4>
                    <div className="space-y-1 text-xs text-gray-700">
                      {letter.archived_attachments.map((attachment: any, index: number) => (
                        <div key={index} className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {attachment.display_name || attachment.file_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />
              
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(letter)}
                  className="gap-1"
                  title="Vollständiges Brief-PDF mit Anlagen herunterladen"
                >
                  <Download className="h-4 w-4" />
                  Brief-PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(letter)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <Card className="opacity-90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brief-Titel</TableHead>
              <TableHead>Empfänger</TableHead>
              <TableHead>Archiviert</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {letters.map((letter) => (
              <TableRow key={letter.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <div>
                      <div>{letter.title} <span className="text-xs text-blue-600">[ARCHIV]</span></div>
                      {letter.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {letter.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {letter.description?.includes('Empfänger:') ? 
                    letter.description.split('Empfänger: ')[1] : 'Unbekannt'}
                </TableCell>
                <TableCell>
                  {format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}
                </TableCell>
                <TableCell>
                  <div className="text-xs">
                    {letter.workflow_history?.sent_at && 
                      `Versendet: ${format(new Date(letter.workflow_history.sent_at), "dd.MM.yyyy", { locale: de })}`
                    }
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(letter)}
                      title="Brief-PDF herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(letter)}
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
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {activeTab === 'documents' ? 'Dokumentenverwaltung' : 'Briefverwaltung'}
                </h1>
                <p className="text-muted-foreground">
                  {activeTab === 'documents' 
                    ? 'Verwalten Sie Ihre parlamentarischen Dokumente' 
                    : 'Erstellen und verwalten Sie Ihre Abgeordnetenbriefe'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {activeTab === 'documents' ? (
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Dokument hochladen
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Neues Dokument hochladen</DialogTitle>
                        <DialogDescription>
                          Laden Sie ein neues Dokument in Ihre Verwaltung hoch
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="file">Datei auswählen</Label>
                          <Input
                            id="file"
                            type="file"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                          />
                        </div>
                        <div>
                          <Label htmlFor="title">Titel</Label>
                          <Input
                            id="title"
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            placeholder="Dokumententitel"
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Beschreibung</Label>
                          <Textarea
                            id="description"
                            value={uploadDescription}
                            onChange={(e) => setUploadDescription(e.target.value)}
                            placeholder="Optionale Beschreibung"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="category">Kategorie</Label>
                            <Select value={uploadCategory} onValueChange={setUploadCategory}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(categoryLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="status">Status</Label>
                            <Select value={uploadStatus} onValueChange={setUploadStatus}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="tags">Tags (kommagetrennt)</Label>
                          <Input
                            id="tags"
                            value={uploadTags}
                            onChange={(e) => setUploadTags(e.target.value)}
                            placeholder="Tag1, Tag2, Tag3"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                            Abbrechen
                          </Button>
                          <Button 
                            onClick={handleUpload} 
                            disabled={!uploadFile || !uploadTitle || loading}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {loading ? "Wird hochgeladen..." : "Hochladen"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button onClick={handleCreateLetter} className="gap-2">
                    <Mail className="h-4 w-4" />
                    Abgeordnetenbrief
                  </Button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'documents'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Dokumente
                </button>
                <button
                  onClick={() => setActiveTab('letters')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'letters'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Mail className="h-4 w-4 inline mr-2" />
                  Briefe
                </button>
              </div>
            </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center flex-1">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={activeTab === 'documents' ? "Dokumente durchsuchen..." : "Briefe durchsuchen..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {activeTab === 'documents' && (
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle Kategorien</SelectItem>
                          {Object.entries(categoryLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        {activeTab === 'documents' 
                          ? Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))
                          : ['draft', 'review', 'approved', 'sent'].map((status) => (
                              <SelectItem key={status} value={status}>
                                {status === 'draft' ? 'Entwurf' : 
                                 status === 'review' ? 'Zur Prüfung' :
                                 status === 'approved' ? 'Genehmigt' : 'Versendet'}
                              </SelectItem>
                            ))
                        }
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
        </div>

        {/* Content Grid */}
        {loading && (activeTab === 'documents' ? documents.length === 0 : letters.length === 0) ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {activeTab === 'documents' ? 'Dokumente werden geladen...' : 'Briefe werden geladen...'}
            </p>
          </div>
        ) : activeTab === 'documents' ? (
          filteredDocuments.length === 0 && archivedLetters.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Dokumente gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {documents.length === 0 
                    ? "Laden Sie Ihr erstes Dokument hoch, um zu beginnen."
                    : "Keine Dokumente entsprechen Ihren Filterkriterien."
                  }
                </p>
                {documents.length === 0 && (
                  <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Erstes Dokument hochladen
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            viewType === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((document) => (
                <Card key={document.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(document.status)}>
                        {statusLabels[document.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    {document.description && (
                      <CardDescription className="line-clamp-2">
                        {document.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        <span>{categoryLabels[document.category as keyof typeof categoryLabels]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>{document.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Größe: {formatFileSize(document.file_size)}</span>
                      </div>
                    </div>
                    
                    {document.tags && document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {document.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />
                    
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(document)}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(document)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Löschen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            ) : (
            viewType === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((document) => (
                <Card key={document.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(document.status)}>
                        {statusLabels[document.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    {document.description && (
                      <CardDescription className="line-clamp-2">
                        {document.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        <span>{categoryLabels[document.category as keyof typeof categoryLabels]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>{document.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Größe: {formatFileSize(document.file_size)}</span>
                      </div>
                    </div>
                    
                    {document.tags && document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {document.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />
                    
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(document)}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(document)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Löschen
                      </Button>
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
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead>Größe</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>{document.title}</div>
                              {document.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {document.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {categoryLabels[document.category as keyof typeof categoryLabels]}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(document.status)}>
                            {statusLabels[document.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}
                        </TableCell>
                        <TableCell>
                          {formatFileSize(document.file_size)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(document)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(document)}
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
        ) : (
            // Letters tab
          filteredLetters.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Briefe gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {letters.length === 0 
                    ? "Erstellen Sie Ihren ersten Abgeordnetenbrief, um zu beginnen."
                    : "Keine Briefe entsprechen Ihren Filterkriterien."
                  }
                </p>
                {letters.length === 0 && (
                  <Button onClick={handleCreateLetter} className="gap-2">
                    <Mail className="h-4 w-4" />
                    Ersten Brief erstellen
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            viewType === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLetters.map((letter) => (
                  <Card key={letter.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg truncate">{letter.title}</CardTitle>
                        </div>
                        <Badge className={
                          letter.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }>
                          {letter.status === 'draft' ? 'Entwurf' : 
                           letter.status === 'review' ? 'Zur Prüfung' :
                           letter.status === 'approved' ? 'Genehmigt' : 'Versendet'}
                        </Badge>
                      </div>
                      {letter.recipient_name && (
                        <CardDescription className="line-clamp-2">
                          An: {letter.recipient_name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}</span>
                        </div>
                        {letter.sent_date && (
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            <span>Versendet: {format(new Date(letter.sent_date), "dd.MM.yyyy", { locale: de })}</span>
                          </div>
                        )}
                        {letter.expected_response_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Antwort erwartet: {format(new Date(letter.expected_response_date), "dd.MM.yyyy", { locale: de })}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditLetter(letter)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Bearbeiten
                          </Button>
                              <LetterPDFExport 
                                letter={letter} 
                                disabled={false}
                                showPagination={true}
                              />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLetter(letter.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                      <TableHead>Versendet</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLetters.map((letter) => (
                      <TableRow key={letter.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {letter.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          {letter.recipient_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            letter.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }>
                            {letter.status === 'draft' ? 'Entwurf' : 
                             letter.status === 'review' ? 'Zur Prüfung' :
                             letter.status === 'approved' ? 'Genehmigt' : 'Versendet'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}
                        </TableCell>
                        <TableCell>
                          {letter.sent_date ? format(new Date(letter.sent_date), "dd.MM.yyyy", { locale: de }) : '-'}
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
                              letter={letter} 
                              disabled={false}
                              showPagination={true}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLetter(letter.id)}
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
          letter={selectedLetter}
          isOpen={showLetterEditor}
          onClose={() => {
            handleCloseLetterEditor();
            // Refresh letters when editor closes to get latest status
            fetchLetters();
          }}
          onSave={handleSaveLetter}
        />
      </div>
    </div>
  );
}