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
  FolderPlus,
  FolderInput,
  Home,
  ChevronRight,
  MoreVertical,
  Edit,
  Mail,
  Edit3,
  Send,
  Grid,
  List,
  Settings,
  Archive,
  RotateCcw,
  Info,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import LetterEditor from "./LetterEditor";
import LetterTemplateSelector from "./LetterTemplateSelector";
import LetterPDFExport from "./LetterPDFExport";
import LetterDOCXExport from "./LetterDOCXExport";
import { ArchivedLetterDetails } from "./letters/ArchivedLetterDetails";
import { useLetterArchiving } from "@/hooks/useLetterArchiving";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmailComposer } from "./emails/EmailComposer";
import { EmailHistory } from "./emails/EmailHistory";

interface DocumentFolder {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_folder_id?: string;
  color: string;
  icon: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  documentCount?: number;
}

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
  document_type?: string;
  source_letter_id?: string;
  archived_attachments?: any[];
  folder_id?: string;
}

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  status: 'draft' | 'review' | 'approved' | 'sent' | 'archived';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  show_pagination?: boolean;
  archived_at?: string;
  archived_by?: string;
}

export function DocumentsView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { viewType, setViewType } = useViewPreference({ key: 'documents' });
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showLetterEditor, setShowLetterEditor] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<Letter | undefined>(undefined);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'letters' | 'emails'>('documents');
  const [letterSubTab, setLetterSubTab] = useState<'active' | 'archived'>('active');
  const [autoArchiveDays, setAutoArchiveDays] = useState(30);
  const [showArchiveSettings, setShowArchiveSettings] = useState(false);
  const [showArchivedLetterDetails, setShowArchivedLetterDetails] = useState(false);
  const [selectedArchivedDocument, setSelectedArchivedDocument] = useState<Document | null>(null);
  
  // Folder management state
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showMoveFolderDialog, setShowMoveFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColor, setFolderColor] = useState("#3b82f6");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState<string>("");
  
  // Letter archiving hook
  const { archiveLetter, isArchiving } = useLetterArchiving();

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadStatus, setUploadStatus] = useState("draft");
  const [uploadFolderId, setUploadFolderId] = useState<string>("");

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
        fetchFolders();
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
      setDocuments((data || []).map(doc => ({
        ...doc,
        archived_attachments: Array.isArray(doc.archived_attachments) ? doc.archived_attachments : []
      })));
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

  const fetchFolders = async () => {
    if (!currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      
      // Count documents in each folder
      const foldersWithCounts = await Promise.all((data || []).map(async (folder) => {
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('folder_id', folder.id);
        
        return {
          ...folder,
          documentCount: count || 0
        };
      }));
      
      setFolders(foldersWithCounts);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
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
          tenant_id: currentTenant?.id || '',
          title: uploadTitle,
          description: uploadDescription,
          file_name: uploadFile.name,
          file_path: fileName,
          file_size: uploadFile.size,
          file_type: uploadFile.type,
          category: uploadCategory,
          tags: uploadTags ? uploadTags.split(',').map(tag => tag.trim()) : [],
          status: uploadStatus,
          folder_id: uploadFolderId || null,
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
      setUploadFolderId("");
      setShowUploadDialog(false);
      
      // Refresh documents and folders
      if (activeTab === 'documents') {
        fetchDocuments();
        fetchFolders();
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
      // Only attempt to delete from storage if it's not an archived letter document
      if (document.document_type !== 'archived_letter') {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.file_path]);

        if (storageError) {
          console.warn('Storage deletion error:', storageError);
          // Don't throw error for storage deletion, as archived letters may not be in normal storage
        }
      }

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

  const handleShowArchivedLetterDetails = (document: Document) => {
    setSelectedArchivedDocument(document);
    setShowArchivedLetterDetails(true);
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
    const matchesFolder = currentFolder ? doc.folder_id === currentFolder : !doc.folder_id;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesFolder;
  });

  const currentFolderSubfolders = folders.filter(f => f.parent_folder_id === currentFolder);

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = letter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         letter.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || letter.status === filterStatus;
    
    // Filter by sub-tab
    const isActiveStatus = ['draft', 'review', 'approved'].includes(letter.status);
    const isArchivedStatus = ['sent', 'archived'].includes(letter.status);
    const matchesSubTab = letterSubTab === 'active' ? isActiveStatus : isArchivedStatus;
    
    return matchesSearch && matchesStatus && matchesSubTab;
  });

  const handleCreateLetter = () => {
    setSelectedLetter(undefined);
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: any) => {
    console.log('=== DOCUMENTSVIEW TEMPLATE SELECTION START ===');
    console.log('Template selected:', template);
    console.log('Template ID:', template?.id);
    console.log('Template default_sender_id:', template?.default_sender_id);
    console.log('Template default_info_blocks:', template?.default_info_blocks);
    
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
    
    console.log('=== DOCUMENTSVIEW NEW LETTER CREATED ===');
    console.log('New letter object:', newLetter);
    console.log('New letter template_id:', newLetter.template_id);
    console.log('New letter sender_info_id:', newLetter.sender_info_id);
    console.log('New letter information_block_ids:', newLetter.information_block_ids);
    
    setSelectedLetter(newLetter);
    setShowLetterEditor(true);
    
    console.log('=== DOCUMENTSVIEW TEMPLATE SELECTION END ===');
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

  const handleArchiveLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief archivieren? Es wird automatisch ein PDF erstellt und in der Dokumentenverwaltung gespeichert.')) return;

    const letter = letters.find(l => l.id === letterId);
    if (!letter) {
      toast({
        title: "Fehler",
        description: "Brief nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    const success = await archiveLetter(letter);
    if (success) {
      // Refresh both letters and documents
      fetchLetters();
      if (activeTab === 'documents') {
        fetchDocuments();
      }
    }
  };

  const handleRestoreLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief wieder aktivieren?')) return;

    try {
      const { error } = await supabase
        .from('letters')
        .update({ 
          status: 'draft',
          archived_at: null,
          archived_by: null
        })
        .eq('id', letterId);

      if (error) throw error;

      toast({
        title: "Brief wiederhergestellt",
        description: "Der Brief wurde erfolgreich wiederhergestellt.",
      });

      fetchLetters();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Der Brief konnte nicht wiederhergestellt werden.",
        variant: "destructive",
      });
    }
  };

  const saveArchiveSettings = async () => {
    try {
      // In a real implementation, this would save to a settings table
      localStorage.setItem('autoArchiveDays', autoArchiveDays.toString());
      
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Auto-Archivierung wurde konfiguriert.",
      });
      
      setShowArchiveSettings(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Die Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  // Folder management functions
  const handleCreateFolder = async () => {
    if (!folderName || !user || !currentTenant) return;

    try {
      const { error } = await supabase
        .from('document_folders')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          name: folderName,
          description: folderDescription,
          parent_folder_id: currentFolder,
          color: folderColor,
        });

      if (error) throw error;

      toast({
        title: "Ordner erstellt",
        description: `Der Ordner "${folderName}" wurde erfolgreich erstellt.`,
      });

      setFolderName("");
      setFolderDescription("");
      setFolderColor("#3b82f6");
      setShowCreateFolderDialog(false);
      fetchFolders();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (folder.documentCount && folder.documentCount > 0) {
      toast({
        title: "Ordner nicht leer",
        description: "Bitte verschieben oder löschen Sie zuerst alle Dokumente in diesem Ordner.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Möchten Sie den Ordner "${folder.name}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      toast({
        title: "Ordner gelöscht",
        description: "Der Ordner wurde erfolgreich gelöscht.",
      });

      fetchFolders();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMoveDocument = async () => {
    if (!selectedDocument) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ folder_id: moveToFolderId || null })
        .eq('id', selectedDocument.id);

      if (error) throw error;

      toast({
        title: "Dokument verschoben",
        description: "Das Dokument wurde erfolgreich verschoben.",
      });

      setShowMoveFolderDialog(false);
      setSelectedDocument(null);
      setMoveToFolderId("");
      fetchDocuments();
      fetchFolders();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const navigateToFolder = (folderId: string) => {
    setCurrentFolder(folderId);
  };

  const navigateUp = () => {
    const currentFolderData = folders.find(f => f.id === currentFolder);
    if (currentFolderData?.parent_folder_id) {
      setCurrentFolder(currentFolderData.parent_folder_id);
    } else {
      setCurrentFolder(null);
    }
  };

  const getCurrentFolderPath = (): DocumentFolder[] => {
    const path: DocumentFolder[] = [];
    let current = currentFolder;
    
    while (current) {
      const folder = folders.find(f => f.id === current);
      if (!folder) break;
      path.unshift(folder);
      current = folder.parent_folder_id || null;
    }
    
    return path;
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
                  <>
                    <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <FolderPlus className="h-4 w-4" />
                          Ordner erstellen
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                          <DialogTitle>Neuen Ordner erstellen</DialogTitle>
                          <DialogDescription>
                            Erstellen Sie einen neuen Ordner zur Organisation Ihrer Dokumente
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="folder-name">Ordnername</Label>
                            <Input
                              id="folder-name"
                              value={folderName}
                              onChange={(e) => setFolderName(e.target.value)}
                              placeholder="z.B. Projektdokumente"
                            />
                          </div>
                          <div>
                            <Label htmlFor="folder-description">Beschreibung (optional)</Label>
                            <Textarea
                              id="folder-description"
                              value={folderDescription}
                              onChange={(e) => setFolderDescription(e.target.value)}
                              placeholder="Ordnerbeschreibung"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor="folder-color">Farbe</Label>
                            <Input
                              id="folder-color"
                              type="color"
                              value={folderColor}
                              onChange={(e) => setFolderColor(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
                              Abbrechen
                            </Button>
                            <Button onClick={handleCreateFolder} disabled={!folderName}>
                              <FolderPlus className="h-4 w-4 mr-2" />
                              Erstellen
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
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
                        <div>
                          <Label htmlFor="folder">Ordner (optional)</Label>
                          <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Kein Ordner" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Kein Ordner</SelectItem>
                              {folders.filter(f => f.parent_folder_id === currentFolder).map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                  </>
                 ) : (
                   <div className="flex gap-2">
                     <Button onClick={handleCreateLetter} className="gap-2">
                       <Mail className="h-4 w-4" />
                       Abgeordnetenbrief
                     </Button>
                     <Button 
                       variant="outline" 
                       onClick={() => setShowArchiveSettings(true)}
                       className="gap-2"
                     >
                       <Settings className="h-4 w-4" />
                       Archiv-Einstellungen
                     </Button>
                   </div>
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
                <button
                  onClick={() => setActiveTab('emails')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'emails'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Send className="h-4 w-4 inline mr-2" />
                  E-Mails
                </button>
              </div>
               
               {/* Letter Sub-tabs */}
               {activeTab === 'letters' && (
                 <div className="flex border-b mt-4">
                   <button
                     onClick={() => setLetterSubTab('active')}
                     className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                       letterSubTab === 'active'
                         ? 'border-primary text-primary'
                         : 'border-transparent text-muted-foreground hover:text-foreground'
                     }`}
                   >
                     Aktive Briefe
                   </button>
                   <button
                     onClick={() => setLetterSubTab('archived')}
                     className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                       letterSubTab === 'archived'
                         ? 'border-primary text-primary'
                         : 'border-transparent text-muted-foreground hover:text-foreground'
                     }`}
                   >
                     Versendete/Archivierte
                   </button>
                 </div>
               )}
             </div>

          {/* Filters */}
          {activeTab !== 'emails' && (
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
                           : letterSubTab === 'active'
                             ? ['draft', 'review', 'approved'].map((status) => (
                                 <SelectItem key={status} value={status}>
                                   {status === 'draft' ? 'Entwurf' : 
                                    status === 'review' ? 'Zur Prüfung' :
                                    'Genehmigt'}
                                 </SelectItem>
                               ))
                             : ['sent', 'archived'].map((status) => (
                                 <SelectItem key={status} value={status}>
                                   {status === 'sent' ? 'Versendet' : 'Archiviert'}
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
          )}
        </div>

        {/* Breadcrumb Navigation */}
        {activeTab === 'documents' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCurrentFolder(null)}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Alle Dokumente
            </Button>
            {getCurrentFolderPath().map((folder) => (
              <div key={folder.id} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentFolder(folder.id)}
                >
                  {folder.name}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Content Grid */}
        {loading && (activeTab === 'documents' ? documents.length === 0 : activeTab === 'letters' ? letters.length === 0 : false) ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {activeTab === 'documents' ? 'Dokumente werden geladen...' : 'Briefe werden geladen...'}
            </p>
          </div>
        ) : activeTab === 'emails' ? (
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex border-b">
                <button
                  onClick={() => setLetterSubTab('active')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    letterSubTab === 'active'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Send className="h-4 w-4 inline mr-2" />
                  E-Mail verfassen
                </button>
                <button
                  onClick={() => setLetterSubTab('archived')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    letterSubTab === 'archived'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Inbox className="h-4 w-4 inline mr-2" />
                  E-Mail-Verlauf
                </button>
              </div>
            </div>
            
            {letterSubTab === 'active' ? <EmailComposer /> : <EmailHistory />}
          </div>
        ) : activeTab === 'documents' ? (
          <>
            {/* Folders Grid */}
            {currentFolderSubfolders.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Ordner</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentFolderSubfolders.map((folder) => (
                    <Card 
                      key={folder.id}
                      className="hover:shadow-lg cursor-pointer transition-shadow overflow-hidden"
                      onClick={() => navigateToFolder(folder.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Folder className="h-8 w-8 flex-shrink-0" style={{ color: folder.color }} />
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h3 className="font-semibold truncate">{folder.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {folder.documentCount || 0} Dokument{folder.documentCount !== 1 ? 'e' : ''}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {folder.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section */}
            {filteredDocuments.length === 0 && currentFolderSubfolders.length === 0 ? (
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
                <Card key={document.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                      </div>
                      <Badge className={`${getStatusColor(document.status)} flex-shrink-0`}>
                        {statusLabels[document.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    {document.description && (
                      <CardDescription className="line-clamp-2 break-words">
                        {document.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{categoryLabels[document.category as keyof typeof categoryLabels]}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{format(new Date(document.created_at), "dd.MM.yyyy", { locale: de })}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileType className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{document.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">Größe: {formatFileSize(document.file_size)}</span>
                      </div>
                    </div>
                    
                    {document.tags && document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 overflow-hidden">
                        {document.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs truncate max-w-full">
                            <Tag className="h-3 w-3 mr-1 flex-shrink-0" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />
                    
                     <div className="flex justify-between gap-2">
                       <div className="flex gap-1">
                         {document.document_type === 'archived_letter' && document.source_letter_id && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleShowArchivedLetterDetails(document)}
                             className="gap-1"
                           >
                             <Info className="h-4 w-4" />
                             Details
                           </Button>
                         )}
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
                           onClick={() => {
                             setSelectedDocument(document);
                             setShowMoveFolderDialog(true);
                           }}
                           className="gap-1"
                         >
                           <FolderInput className="h-4 w-4" />
                           Verschieben
                         </Button>
                       </div>
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
                             {document.document_type === 'archived_letter' && document.source_letter_id && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => handleShowArchivedLetterDetails(document)}
                                 title="Brief-Details anzeigen"
                               >
                                 <Info className="h-4 w-4" />
                               </Button>
                             )}
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
          )}
          </>
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
                           letter.status === 'archived' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                           letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                           letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                           'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                         }>
                           {letter.status === 'draft' ? 'Entwurf' : 
                            letter.status === 'review' ? 'Zur Prüfung' :
                            letter.status === 'approved' ? 'Genehmigt' : 
                            letter.status === 'sent' ? 'Versendet' : 'Archiviert'}
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
                           {letterSubTab === 'active' ? (
                             <>
                                  <LetterPDFExport 
                                    letter={letter} 
                                    disabled={false}
                                    showPagination={letter.show_pagination || false}
                                  />
                                  <LetterDOCXExport 
                                    letter={letter} 
                                  />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditLetter(letter)}
                                >
                                  <Edit3 className="h-4 w-4 mr-1" />
                                  Bearbeiten
                                </Button>
                                 {/* Archive button removed - now automatic on status "sent" */}
                             </>
                           ) : (
                             <>
                               <LetterPDFExport 
                                 letter={letter} 
                                 disabled={false}
                                 showPagination={true}
                               />
                               <LetterDOCXExport 
                                 letter={letter} 
                               />
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleRestoreLetter(letter.id)}
                               >
                                 <RotateCcw className="h-4 w-4 mr-1" />
                                 Wiederherstellen
                               </Button>
                             </>
                           )}
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
                             letter.status === 'archived' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                             letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                             letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                             'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                           }>
                             {letter.status === 'draft' ? 'Entwurf' : 
                              letter.status === 'review' ? 'Zur Prüfung' :
                              letter.status === 'approved' ? 'Genehmigt' : 
                              letter.status === 'sent' ? 'Versendet' : 'Archiviert'}
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
                              {letterSubTab === 'active' ? (
                                <>
                                    <LetterPDFExport 
                                      letter={letter} 
                                      disabled={false}
                                      showPagination={letter.show_pagination || false}
                                    />
                                    <LetterDOCXExport 
                                      letter={letter} 
                                    />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditLetter(letter)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                   {/* Archive button removed - now automatic on status "sent" */}
                                </>
                             ) : (
                               <>
                                 <LetterPDFExport 
                                   letter={letter} 
                                   disabled={false}
                                   showPagination={true}
                                 />
                                 <LetterDOCXExport 
                                   letter={letter} 
                                 />
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleRestoreLetter(letter.id)}
                                 >
                                   <RotateCcw className="h-4 w-4" />
                                 </Button>
                               </>
                             )}
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
          letter={selectedLetter as any}
          isOpen={showLetterEditor}
          onClose={() => {
            handleCloseLetterEditor();
            // Refresh letters when editor closes to get latest status
            fetchLetters();
          }}
          onSave={handleSaveLetter}
        />
        
        {/* Archive Settings Dialog */}
        <Dialog open={showArchiveSettings} onOpenChange={setShowArchiveSettings}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Auto-Archivierung Einstellungen</DialogTitle>
              <DialogDescription>
                Konfigurieren Sie die automatische Archivierung von Briefen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="archiveDays">Archivierung nach (Tage)</Label>
                <Input
                  id="archiveDays"
                  type="number"
                  value={autoArchiveDays}
                  onChange={(e) => setAutoArchiveDays(parseInt(e.target.value) || 30)}
                  placeholder="30"
                  min="1"
                  max="365"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Briefe werden automatisch {autoArchiveDays} Tage nach dem Versenden archiviert
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowArchiveSettings(false)}>
                  Abbrechen
                </Button>
                <Button onClick={saveArchiveSettings}>
                  Speichern
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Move Document Dialog */}
        <Dialog open={showMoveFolderDialog} onOpenChange={setShowMoveFolderDialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Dokument verschieben</DialogTitle>
              <DialogDescription>
                Wählen Sie einen Zielordner für "{selectedDocument?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="target-folder">Zielordner</Label>
                <Select value={moveToFolderId} onValueChange={setMoveToFolderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordner wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Kein Ordner (Hauptebene)</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowMoveFolderDialog(false);
                  setSelectedDocument(null);
                  setMoveToFolderId("");
                }}>
                  Abbrechen
                </Button>
                <Button onClick={handleMoveDocument}>
                  <FolderInput className="h-4 w-4 mr-2" />
                  Verschieben
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Archived Letter Details Dialog */}
        {selectedArchivedDocument && (
          <ArchivedLetterDetails
            document={selectedArchivedDocument}
            isOpen={showArchivedLetterDetails}
            onClose={() => {
              setShowArchivedLetterDetails(false);
              setSelectedArchivedDocument(null);
            }}
          />
        )}
      </div>
    </div>
  );
}