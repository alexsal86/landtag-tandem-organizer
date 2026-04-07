import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { useViewPreference } from "@/hooks/useViewPreference";
import { useToast } from "@/hooks/use-toast";
import { useTopics } from "@/hooks/useTopics";
import { useDocumentCategories } from "@/hooks/useDocumentCategories";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useStakeholderPreload } from "@/hooks/useStakeholderPreload";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Upload, Download, Trash2, Plus, Search, Filter, Calendar, Tag, FileType, Folder, FolderPlus, FolderInput, Home, ChevronRight, MoreVertical, Edit, Mail, Edit3, Send, Grid, List, Settings, RotateCcw, ListTodo, ListTree, Info, UserPlus, Newspaper, Save } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

import LetterEditor from "./LetterEditor";
import { PressReleasesList } from "./press/PressReleasesList";
import { PressReleaseEditor } from "./press/PressReleaseEditor";
import { PressReleaseWizard, type PressWizardResult } from "./press/PressReleaseWizard";
import { LetterWizard } from "./letters/LetterWizard";
import LetterPDFExport from "./LetterPDFExport";
import LetterDOCXExport from "./LetterDOCXExport";
import { EmailComposer } from "./emails/EmailComposer";
import { EmailHistory } from "./emails/EmailHistory";
import { EmailTemplateManager } from "./emails/EmailTemplateManager";
import { DocumentContactManager } from "./documents/DocumentContactManager";
import { DocumentContactAddDialog } from "./documents/DocumentContactAddDialog";
import { SenderInformationManager } from "@/components/administration/SenderInformationManager";

import { useDocumentsData } from "./documents/hooks/useDocumentsData";
import { useDocumentOperations } from "./documents/hooks/useDocumentOperations";
import { DocumentDialogs } from "./documents/DocumentDialogs";
import { STATUS_LABELS, getStatusColor, formatFileSize } from "./documents/types";
import type { Document, Letter, DocumentFolder } from "./documents/types";
import {
  isDocumentCategoryOption,
  isDocumentTagOption,
  isDocumentFolderWithCount,
  type DocumentDialogState,
} from "./documents/operationsContract";

const AUTO_ARCHIVE_DEFAULT_DAYS = 30;
const AUTO_ARCHIVE_SETTING_KEY = "letters_auto_archive_days";
const AUTO_ARCHIVE_LOCAL_KEY = "autoArchiveDays";

const parseAutoArchiveDays = (value: unknown): number | null => {
  const rawValue = typeof value === "string" ? parseInt(value, 10) : value;
  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) return null;
  const normalizedValue = Math.round(rawValue);
  return normalizedValue >= 1 && normalizedValue <= 365 ? normalizedValue : null;
};

export function DocumentsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const initialTab: 'documents' | 'letters' | 'emails' | 'press' =
    initialTabParam === 'letters' || initialTabParam === 'emails' || initialTabParam === 'press' ? initialTabParam : 'documents';
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { toast } = useToast();
  const { viewType, setViewType } = useViewPreference({ key: 'documents' });
  const { topics: tags } = useTopics();
  const { categories: documentCategories } = useDocumentCategories();
  const { personContacts } = useAllPersonContacts();
  const { stakeholders } = useStakeholderPreload();
  const allContacts = [...personContacts, ...stakeholders];

  const [activeTab, setActiveTab] = useState<'documents' | 'letters' | 'emails' | 'press'>(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [letterSubTab, setLetterSubTab] = useState<'active' | 'archived'>('active');
  const [emailSubTab, setEmailSubTab] = useState<'compose' | 'history' | 'templates' | 'settings'>('compose');

  // Letter editor state
  const [showLetterEditor, setShowLetterEditor] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<Letter | undefined>(undefined);
  const [showWizard, setShowWizard] = useState(false);

  // Press state
  const [showPressEditor, setShowPressEditor] = useState(false);
  const [showPressWizard, setShowPressWizard] = useState(false);
  const [selectedPressReleaseId, setSelectedPressReleaseId] = useState<string | null>(null);
  const [pressDraftConfig, setPressDraftConfig] = useState<PressWizardResult | null>(null);

  // Upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("draft");
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadContacts, setUploadContacts] = useState<string[]>([]);
  const [uploadContactType, setUploadContactType] = useState("related");
  const [contactSearch, setContactSearch] = useState("");

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState("draft");
  const [editFolderId, setEditFolderId] = useState("");

  // Folder state
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColor, setFolderColor] = useState("#3b82f6");
  const [showMoveFolderDialog, setShowMoveFolderDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState("");

  // Archive settings
  const [showArchiveSettings, setShowArchiveSettings] = useState(false);
  const [autoArchiveDays, setAutoArchiveDays] = useState(AUTO_ARCHIVE_DEFAULT_DAYS);
  const [showArchivedLetterDetails, setShowArchivedLetterDetails] = useState(false);
  const [selectedArchivedDocument, setSelectedArchivedDocument] = useState<Document | null>(null);

  const data = useDocumentsData(activeTab);
  const ops = useDocumentOperations({
    user: data.user, currentTenant: data.currentTenant,
    fetchDocuments: data.fetchDocuments, fetchFolders: data.fetchFolders,
    fetchLetters: data.fetchLetters, activeTab, letters: data.letters,
  });

  const safeCategories = documentCategories.filter(isDocumentCategoryOption);
  const safeTags = tags.filter(isDocumentTagOption);
  const safeFolders = data.folders.filter(isDocumentFolderWithCount);

  const dialogState: DocumentDialogState = {
    showEditDialog,
    showMoveFolderDialog,
    showArchiveSettings,
    showArchivedLetterDetails,
    taskDialogMode: ops.taskDialogMode,
  };

  // URL syncing
  useEffect(() => {
    const localSetting = parseAutoArchiveDays(localStorage.getItem(AUTO_ARCHIVE_LOCAL_KEY));
    if (localSetting !== null) {
      setAutoArchiveDays(localSetting);
    }
  }, []);

  useEffect(() => {
    if (!data.currentTenant?.id) return;
    let isActive = true;

    const loadArchiveSettings = async () => {
      const { data: archiveSetting, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("tenant_id", data.currentTenant.id)
        .eq("setting_key", AUTO_ARCHIVE_SETTING_KEY)
        .maybeSingle();

      if (error) {
        debugConsole.warn("Konnte Archivierungseinstellung nicht laden:", error);
        return;
      }

      const persistedSetting = parseAutoArchiveDays(archiveSetting?.setting_value);
      if (!isActive || persistedSetting === null) return;

      setAutoArchiveDays(persistedSetting);
      localStorage.setItem(AUTO_ARCHIVE_LOCAL_KEY, persistedSetting.toString());
    };

    loadArchiveSettings();
    return () => {
      isActive = false;
    };
  }, [data.currentTenant?.id]);

  useEffect(() => {
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');
    if (action === 'create-document') { setShowUploadDialog(true); searchParams.delete('action'); setSearchParams(searchParams, { replace: true }); }
    if (tab === 'emails') setActiveTab('emails');
    if (tab === 'letters') { setActiveTab('letters'); setLetterSubTab('active'); }
    if (action === 'compose-press') { setActiveTab('emails'); setEmailSubTab('compose'); }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const currentTabParam = searchParams.get('tab');
    const desiredTabParam = activeTab === 'documents' ? null : activeTab;
    if (currentTabParam === desiredTabParam) return;
    const nextParams = new URLSearchParams(searchParams);
    if (desiredTabParam) nextParams.set('tab', desiredTabParam); else nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    const letterId = searchParams.get('letter');
    if (!letterId || activeTab !== 'letters') return;
    navigate(`/letters/${letterId}`);
    const nextParams = new URLSearchParams(searchParams); nextParams.delete('letter');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, activeTab, navigate]);

  const getCategoryLabel = (name: string) => safeCategories.find(c => c.name === name)?.label || name;

  const filteredDocuments = data.documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) || doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || doc.category === filterCategory;
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
    const matchesFolder = currentFolder ? doc.folder_id === currentFolder : !doc.folder_id;
    return matchesSearch && matchesCategory && matchesStatus && matchesFolder;
  });

  const currentFolderSubfolders = data.folders.filter(f => f.parent_folder_id === currentFolder);

  const filteredLetters = data.letters.filter(letter => {
    const matchesSearch = letter.title.toLowerCase().includes(searchTerm.toLowerCase()) || letter.content.toLowerCase().includes(searchTerm.toLowerCase()) || letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || letter.status === filterStatus;
    const isActiveStatus = ['draft', 'review', 'approved'].includes(letter.status);
    const isArchivedStatus = ['sent', 'archived'].includes(letter.status);
    const matchesSubTab = letterSubTab === 'active' ? isActiveStatus : isArchivedStatus;
    return matchesSearch && matchesStatus && matchesSubTab;
  });

  const getCurrentFolderPath = (): DocumentFolder[] => {
    const path: DocumentFolder[] = [];
    let current = currentFolder;
    while (current) { const folder = data.folders.find(f => f.id === current); if (!folder) break; path.unshift(folder); current = folder.parent_folder_id || null; }
    return path;
  };

  const handleEditDocument = (doc: Document) => {
    setEditingDocument(doc); setEditTitle(doc.title); setEditDescription(doc.description || "");
    setEditCategory(doc.category ?? ''); setEditTags(doc.tags || []); setEditStatus(doc.status);
    setEditFolderId(doc.folder_id || ""); setShowEditDialog(true);
  };

  const handleCreateLetter = () => { setSelectedLetter(undefined); setShowWizard(true); };

  const handleWizardComplete = (config: { occasion: string; recipientName: string; recipientAddress: string; contactId?: string; templateId?: string; senderInfoId?: string; }) => {
    setShowWizard(false);
    setSelectedLetter({ id: undefined, title: '', content: '', content_html: '', status: 'draft', template_id: config.templateId, sender_info_id: config.senderInfoId, information_block_ids: [], tenant_id: data.currentTenant?.id || '', created_by: data.user?.id || '', created_at: '', updated_at: '', recipient_name: config.recipientName, recipient_address: config.recipientAddress, contact_id: config.contactId } as any);
    setShowLetterEditor(true);
  };

  const resetUploadForm = () => { setUploadFile(null); setUploadTitle(""); setUploadDescription(""); setUploadTags([]); setUploadFolderId(""); setUploadContacts([]); setUploadContactType("related"); setShowUploadDialog(false); };

  const filteredContactsForUpload = allContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.organization?.toLowerCase().includes(contactSearch.toLowerCase()));

  const saveArchiveSettings = async () => {
    const sanitizedDays = parseAutoArchiveDays(autoArchiveDays) ?? AUTO_ARCHIVE_DEFAULT_DAYS;
    setAutoArchiveDays(sanitizedDays);
    localStorage.setItem(AUTO_ARCHIVE_LOCAL_KEY, sanitizedDays.toString());

    if (data.currentTenant?.id) {
      const payload = {
        tenant_id: data.currentTenant.id,
        setting_key: AUTO_ARCHIVE_SETTING_KEY,
        setting_value: sanitizedDays.toString(),
      };

      const { error } = await supabase
        .from("app_settings")
        .upsert(payload, { onConflict: "tenant_id,setting_key" });

      if (error) {
        toast({ title: "Einstellungen konnten nicht gespeichert werden", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Einstellungen tenantweit gespeichert" });
      setShowArchiveSettings(false);
      return;
    }

    toast({ title: "Einstellung nur lokal gespeichert" });
    setShowArchiveSettings(false);
  const saveArchiveSettings = () => { localStorage.setItem('autoArchiveDays', autoArchiveDays.toString()); toast({ title: "Einstellungen gespeichert" }); setShowArchiveSettings(false); };
  const getLetterActionLabel = (action: 'task' | 'subtask' | 'edit' | 'restore' | 'delete') => {
    const labels = {
      task: "Brief als Aufgabe anlegen",
      subtask: "Brief als Unteraufgabe anlegen",
      edit: "Brief bearbeiten",
      restore: "Brief wiederherstellen",
      delete: "Brief löschen",
    } as const;
    return labels[action];
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {activeTab === 'documents' ? 'Dokumentenverwaltung' : activeTab === 'press' ? 'Pressemitteilungen' : 'Briefverwaltung'}
              </h1>
              <p className="text-muted-foreground">
                {activeTab === 'documents' ? 'Verwalten Sie Ihre parlamentarischen Dokumente' : activeTab === 'press' ? 'Erstellen und veröffentlichen Sie Pressemitteilungen' : 'Erstellen und verwalten Sie Ihre Abgeordnetenbriefe'}
              </p>
            </div>
            {activeTab !== 'press' && activeTab !== 'emails' && (
              <div className="flex gap-2">
                {activeTab === 'documents' ? (
                  <>
                    <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
                      <DialogTrigger asChild><Button variant="outline" className="gap-2"><FolderPlus className="h-4 w-4" />Ordner erstellen</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader><DialogTitle>Neuen Ordner erstellen</DialogTitle><DialogDescription>Erstellen Sie einen neuen Ordner zur Organisation Ihrer Dokumente</DialogDescription></DialogHeader>
                        <div className="space-y-4">
                          <div><Label>Ordnername</Label><Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="z.B. Projektdokumente" /></div>
                          <div><Label>Beschreibung (optional)</Label><Textarea value={folderDescription} onChange={e => setFolderDescription(e.target.value)} rows={2} /></div>
                          <div><Label>Farbe</Label><Input type="color" value={folderColor} onChange={e => setFolderColor(e.target.value)} /></div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>Abbrechen</Button>
                            <Button onClick={() => ops.handleCreateFolder({ mutation: { type: "create-folder", name: folderName, description: folderDescription, color: folderColor, parentFolderId: currentFolder }, onSuccess: () => { setFolderName(""); setFolderDescription(""); setFolderColor("#3b82f6"); setShowCreateFolderDialog(false); } })} disabled={!folderName}><FolderPlus className="h-4 w-4 mr-2" />Erstellen</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Dokument hochladen</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader><DialogTitle>Neues Dokument hochladen</DialogTitle><DialogDescription>Laden Sie ein neues Dokument in Ihre Verwaltung hoch</DialogDescription></DialogHeader>
                        <div className="space-y-4">
                          <div><Label className="flex items-center gap-2">Datei auswählen <span className="text-destructive">*</span></Label><Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" /></div>
                          <div><Label className="flex items-center gap-2">Titel <span className="text-destructive">*</span></Label><Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Dokumententitel" /></div>
                          <div><Label>Beschreibung</Label><Textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder="Optionale Beschreibung" /></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><Label>Kategorie</Label><Select value={uploadCategory} onValueChange={setUploadCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{safeCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Status</Label><Select value={uploadStatus} onValueChange={setUploadStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
                          </div>
                          <div><Label>Tags</Label><MultiSelect options={safeTags.map(t => ({ value: t.label, label: t.label }))} selected={uploadTags} onChange={setUploadTags} placeholder="Tags auswählen..." /></div>
                          <div><Label>Ordner (optional)</Label><Select value={uploadFolderId || undefined} onValueChange={v => setUploadFolderId(v || "")}><SelectTrigger><SelectValue placeholder="Kein Ordner" /></SelectTrigger><SelectContent>{data.folders.filter(f => f.parent_folder_id === currentFolder).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
                          <div>
                            <Label>Kontakte & Stakeholder (optional)</Label>
                            <div className="space-y-3">
                              <Select value={uploadContactType} onValueChange={setUploadContactType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recipient">Empfänger</SelectItem><SelectItem value="cc">In Kopie</SelectItem><SelectItem value="mentioned">Erwähnt</SelectItem><SelectItem value="stakeholder">Stakeholder</SelectItem><SelectItem value="related">Verbunden</SelectItem></SelectContent></Select>
                              <Input placeholder="Kontakte suchen..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                              <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                                {filteredContactsForUpload.length === 0 ? <p className="text-sm text-muted-foreground">{contactSearch ? 'Keine Kontakte gefunden' : 'Keine Kontakte verfügbar'}</p> : (
                                  <div className="space-y-2">
                                    {uploadContacts.length > 0 && (<><p className="text-xs font-medium text-muted-foreground mb-2">Ausgewählt ({uploadContacts.length})</p>{filteredContactsForUpload.filter(c => uploadContacts.includes(c.id)).map(c => (<label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"><Checkbox checked onCheckedChange={() => setUploadContacts(uploadContacts.filter(id => id !== c.id))} /><span className="text-sm">{c.contact_type === 'organization' ? '🏢 ' : '👤 '}{c.name}{c.organization && ` (${c.organization})`}</span></label>))}<Separator className="my-2" /><p className="text-xs font-medium text-muted-foreground mb-2">Verfügbar</p></>)}
                                    {filteredContactsForUpload.filter(c => !uploadContacts.includes(c.id)).map(c => (<label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"><Checkbox checked={false} onCheckedChange={() => setUploadContacts([...uploadContacts, c.id])} /><span className="text-sm">{c.contact_type === 'organization' ? '🏢 ' : '👤 '}{c.name}{c.organization && ` (${c.organization})`}</span></label>))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={resetUploadForm}>Abbrechen</Button>
                            <Button onClick={() => ops.handleUpload({ uploadFile, mutation: { type: "upload", title: uploadTitle, description: uploadDescription, category: uploadCategory, tags: uploadTags, status: uploadStatus, folderId: uploadFolderId, contacts: uploadContacts, contactType: uploadContactType }, setLoading: data.setLoading, onSuccess: resetUploadForm })} disabled={!uploadFile || !uploadTitle || data.loading}><Upload className="h-4 w-4 mr-2" />{data.loading ? "Wird hochgeladen..." : "Hochladen"}</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleCreateLetter} className="gap-2"><Mail className="h-4 w-4" />Abgeordnetenbrief</Button>
                    <Button variant="outline" onClick={() => setShowArchiveSettings(true)} className="gap-2"><Settings className="h-4 w-4" />Archiv-Einstellungen</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="flex border-b">
              {(['documents', 'letters', 'emails', 'press'] as const).map(tab => {
                const icons = { documents: FileText, letters: Mail, emails: Send, press: Newspaper };
                const labels = { documents: 'Dokumente', letters: 'Briefe', emails: 'E-Mails', press: 'Presse' };
                const Icon = icons[tab];
                return (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'press') { setShowPressEditor(false); setShowPressWizard(false); setSelectedPressReleaseId(null); setPressDraftConfig(null); } }} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    <Icon className="h-4 w-4 inline mr-2" />{labels[tab]}
                  </button>
                );
              })}
            </div>
            {activeTab === 'letters' && (
              <div className="mt-4">
                <div className="flex border-b">
                  <button onClick={() => setLetterSubTab('active')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${letterSubTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Aktive Briefe</button>
                  <button onClick={() => setLetterSubTab('archived')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${letterSubTab === 'archived' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Versendete/Archivierte</button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Auto-Archivierung: {autoArchiveDays} Tage nach Versand ({data.currentTenant?.id ? "tenantweite Einstellung aus App-Settings" : "nur lokaler Browserwert"}).
                </p>
              </div>
            )}
          </div>

          {/* Filters */}
          {activeTab !== 'emails' && activeTab !== 'press' && (
            <Card><CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center flex-1">
                  <div className="flex items-center gap-2 min-w-[200px]"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder={activeTab === 'documents' ? "Dokumente durchsuchen..." : "Briefe durchsuchen..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                  {activeTab === 'documents' && (<div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" /><Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Kategorien</SelectItem>{safeCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.label}</SelectItem>)}</SelectContent></Select></div>)}
                  <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem>{activeTab === 'documents' ? Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>) : letterSubTab === 'active' ? ['draft', 'review', 'approved'].map(s => <SelectItem key={s} value={s}>{s === 'draft' ? 'Entwurf' : s === 'review' ? 'Zur Prüfung' : 'Genehmigt'}</SelectItem>) : ['sent', 'archived'].map(s => <SelectItem key={s} value={s}>{s === 'sent' ? 'Versendet' : 'Archiviert'}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button variant={viewType === 'card' ? 'default' : 'ghost'} size="sm" onClick={() => setViewType('card')} className="h-8 w-8 p-0"><Grid className="h-4 w-4" /></Button>
                  <Button variant={viewType === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewType('list')} className="h-8 w-8 p-0"><List className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent></Card>
          )}
        </div>

        {/* Breadcrumb */}
        {activeTab === 'documents' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Button variant="ghost" size="sm" onClick={() => setCurrentFolder(null)} className="gap-2"><Home className="h-4 w-4" />Alle Dokumente</Button>
            {getCurrentFolderPath().map(folder => (<div key={folder.id} className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /><Button variant="ghost" size="sm" onClick={() => setCurrentFolder(folder.id)}>{folder.name}</Button></div>))}
          </div>
        )}

        {/* Content */}
        {activeTab === 'press' ? (
          showPressWizard ? <PressReleaseWizard onComplete={(config) => { setPressDraftConfig(config); setShowPressWizard(false); setSelectedPressReleaseId(null); setShowPressEditor(true); }} onCancel={() => setShowPressWizard(false)} /> :
          showPressEditor ? <PressReleaseEditor pressReleaseId={selectedPressReleaseId} initialDraft={selectedPressReleaseId ? null : pressDraftConfig} onBack={() => { setShowPressEditor(false); setSelectedPressReleaseId(null); setPressDraftConfig(null); }} /> :
          <PressReleasesList onCreateNew={() => { setSelectedPressReleaseId(null); setPressDraftConfig(null); setShowPressWizard(true); setShowPressEditor(false); }} onSelect={(id) => { setPressDraftConfig(null); setSelectedPressReleaseId(id); setShowPressEditor(true); setShowPressWizard(false); }} />
        ) : data.loading && (activeTab === 'documents' ? data.documents.length === 0 : activeTab === 'letters' ? data.letters.length === 0 : false) ? (
          <div className="text-center py-8"><p className="text-muted-foreground">{activeTab === 'documents' ? 'Dokumente werden geladen...' : 'Briefe werden geladen...'}</p></div>
        ) : activeTab === 'emails' ? (
          <div className="space-y-6">
            <div className="mb-6"><div className="flex border-b">
              {(['compose', 'history', 'settings'] as const).map(sub => {
                const labels = { compose: 'E-Mail verfassen', history: 'E-Mail-Verlauf', settings: 'Absender-Einstellungen' };
                return <button key={sub} onClick={() => setEmailSubTab(sub)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${emailSubTab === sub ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{labels[sub]}</button>;
              })}
            </div></div>
            {emailSubTab === 'compose' && <EmailComposer />}
            {emailSubTab === 'history' && <EmailHistory />}
            {emailSubTab === 'settings' && <SenderInformationManager />}
          </div>
        ) : activeTab === 'documents' ? (
          <>
            {/* Folders */}
            {currentFolderSubfolders.length > 0 && (
              <div className="mb-6"><h3 className="text-lg font-semibold mb-3">Ordner</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentFolderSubfolders.map(folder => (
                  <Card key={folder.id} className="hover:shadow-lg cursor-pointer transition-shadow overflow-hidden" onClick={() => setCurrentFolder(folder.id)}>
                    <CardContent className="p-4"><div className="flex items-center gap-3 min-w-0">
                      <Folder className="h-8 w-8 flex-shrink-0" style={{ color: folder.color ?? undefined }} />
                      <div className="flex-1 min-w-0 overflow-hidden"><h3 className="font-semibold truncate">{folder.name}</h3><p className="text-xs text-muted-foreground">{folder.documentCount || 0} Dokument{folder.documentCount !== 1 ? 'e' : ''}</p></div>
                      <DropdownMenu><DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent onClick={e => e.stopPropagation()}><DropdownMenuItem onClick={e => { e.stopPropagation(); ops.handleDeleteFolder(folder.id, safeFolders); }}><Trash2 className="h-4 w-4 mr-2" />Löschen</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                    </div>{folder.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{folder.description}</p>}</CardContent>
                  </Card>
                ))}
              </div></div>
            )}

            {/* Documents */}
            {filteredDocuments.length === 0 && currentFolderSubfolders.length === 0 ? (
              <Card><CardContent className="p-8 text-center"><FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">Keine Dokumente gefunden</h3><p className="text-muted-foreground mb-4">{data.documents.length === 0 ? "Laden Sie Ihr erstes Dokument hoch." : "Keine Dokumente entsprechen Ihren Filterkriterien."}</p>{data.documents.length === 0 && <Button onClick={() => setShowUploadDialog(true)} className="gap-2"><Plus className="h-4 w-4" />Erstes Dokument hochladen</Button>}</CardContent></Card>
            ) : viewType === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map(doc => (
                  <Card key={doc.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-2 min-w-0"><div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden"><FileText className="h-5 w-5 text-primary flex-shrink-0" /><CardTitle className="text-lg truncate">{doc.title}</CardTitle></div><Badge className={`${getStatusColor(doc.status)} flex-shrink-0`}>{STATUS_LABELS[doc.status] || doc.status}</Badge></div>{doc.description && <CardDescription className="line-clamp-2 break-words">{doc.description}</CardDescription>}</CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Folder className="h-4 w-4 flex-shrink-0" /><span className="truncate">{getCategoryLabel(doc.category ?? '')}</span></div>
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 flex-shrink-0" /><span>{format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}</span></div>
                        <div className="flex items-center gap-2"><FileType className="h-4 w-4 flex-shrink-0" /><span className="truncate">{doc.file_name}</span></div>
                        <div><span>Größe: {formatFileSize(doc.file_size ?? undefined)}</span></div>
                      </div>
                      {doc.tags && doc.tags.length > 0 && <div className="flex flex-wrap gap-1">{doc.tags.map((tag, i) => <Badge key={i} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}</div>}
                      <DocumentContactManager documentId={doc.id} compact />
                      <Separator />
                      <TooltipProvider><div className="flex justify-between gap-2"><div className="flex gap-1">
                        {doc.document_type === 'archived_letter' && doc.source_letter_id && <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => { setSelectedArchivedDocument(doc); setShowArchivedLetterDetails(true); }}><Info className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Details</TooltipContent></Tooltip>}
                        {doc.document_type !== 'archived_letter' && <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handleEditDocument(doc)}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Bearbeiten</TooltipContent></Tooltip>}
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => ops.handleDownload(doc)}><Download className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => { setSelectedDocument(doc); setShowMoveFolderDialog(true); }}><FolderInput className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Verschieben</TooltipContent></Tooltip>
                        <DocumentContactAddDialog documentId={doc.id} trigger={<Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm"><UserPlus className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Kontakt hinzufügen</TooltipContent></Tooltip>} />
                      </div>
                      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => ops.handleDelete(doc)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Löschen</TooltipContent></Tooltip>
                      </div></TooltipProvider>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card><Table><TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Kategorie</TableHead><TableHead>Status</TableHead><TableHead>Erstellt</TableHead><TableHead>Größe</TableHead><TableHead>Kontakte</TableHead><TableHead className="text-right">Aktionen</TableHead></TableRow></TableHeader><TableBody>
                {filteredDocuments.map(doc => (
                  <TableRow key={doc.id}><TableCell className="font-medium"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><div><div>{doc.title}</div>{doc.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</div>}</div></div></TableCell><TableCell>{getCategoryLabel(doc.category ?? '')}</TableCell><TableCell><Badge className={getStatusColor(doc.status)}>{STATUS_LABELS[doc.status] || doc.status}</Badge></TableCell><TableCell>{format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}</TableCell><TableCell>{formatFileSize(doc.file_size ?? undefined)}</TableCell><TableCell><DocumentContactManager documentId={doc.id} compact /></TableCell>
                  <TableCell className="text-right"><TooltipProvider><div className="flex items-center gap-1 justify-end">
                    {doc.document_type === 'archived_letter' && doc.source_letter_id && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => { setSelectedArchivedDocument(doc); setShowArchivedLetterDetails(true); }}><Info className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Details</TooltipContent></Tooltip>}
                    {doc.document_type !== 'archived_letter' && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => handleEditDocument(doc)}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Bearbeiten</TooltipContent></Tooltip>}
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => ops.handleDownload(doc)}><Download className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => ops.handleDelete(doc)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Löschen</TooltipContent></Tooltip>
                  </div></TooltipProvider></TableCell></TableRow>
                ))}
              </TableBody></Table></Card>
            )}
          </>
        ) : (
          /* Letters tab */
          filteredLetters.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">Keine Briefe gefunden</h3><p className="text-muted-foreground mb-4">{data.letters.length === 0 ? "Erstellen Sie Ihren ersten Abgeordnetenbrief." : "Keine Briefe entsprechen Ihren Filterkriterien."}</p>{data.letters.length === 0 && <Button onClick={handleCreateLetter} className="gap-2"><Mail className="h-4 w-4" />Ersten Brief erstellen</Button>}</CardContent></Card>
          ) : viewType === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLetters.map(letter => (
                <Card key={letter.id} ref={highlightRef(letter.id)} className={`hover:shadow-lg transition-shadow ${isHighlighted(letter.id) ? 'notification-highlight' : ''}`}>
                  <CardHeader className="pb-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><CardTitle className="text-lg">{letter.title}</CardTitle></div><Badge className={letter.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : letter.status === 'archived' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' : letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-gray-100 text-gray-800'}>{letter.status === 'draft' ? 'Entwurf' : letter.status === 'review' ? 'Zur Prüfung' : letter.status === 'approved' ? 'Genehmigt' : letter.status === 'sent' ? 'Versendet' : 'Archiviert'}</Badge></div>{letter.recipient_name && <CardDescription>An: {letter.recipient_name}</CardDescription>}</CardHeader>
                  <CardContent><div className="space-y-2 text-sm text-muted-foreground"><div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>Erstellt: {format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}</span></div>{letter.sent_date && <div className="flex items-center gap-2"><Send className="h-4 w-4" /><span>Versand: {format(new Date(letter.sent_date), "dd.MM.yyyy", { locale: de })}</span></div>}</div><Separator className="my-3" /><div className="flex flex-wrap gap-1">
                    {letterSubTab === 'active' ? (<><LetterPDFExport letter={letter as any} disabled={false} showPagination={letter.show_pagination || false} /><LetterDOCXExport letter={letter as any} /><Button variant="outline" size="sm" title="Als Aufgabe" aria-label={getLetterActionLabel('task')} onClick={() => ops.openTaskDialog(letter, 'task')}><ListTodo className="h-4 w-4" /></Button><Button variant="outline" size="sm" title="Als Unteraufgabe" aria-label={getLetterActionLabel('subtask')} onClick={() => ops.openTaskDialog(letter, 'subtask')}><ListTree className="h-4 w-4" /></Button><Button variant="outline" size="sm" aria-label={getLetterActionLabel('edit')} onClick={() => ops.handleEditLetter(letter)}><Edit3 className="h-4 w-4 mr-1" />Bearbeiten</Button></>) : (<><LetterPDFExport letter={letter as any} disabled={false} showPagination /><LetterDOCXExport letter={letter as any} /><Button variant="outline" size="sm" aria-label={getLetterActionLabel('restore')} onClick={() => ops.handleRestoreLetter(letter.id!)}><RotateCcw className="h-4 w-4 mr-1" />Wiederherstellen</Button></>)}
                    <Button variant="outline" size="sm" aria-label={getLetterActionLabel('delete')} onClick={() => ops.handleDeleteLetter(letter.id!)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><Table><TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Empfänger</TableHead><TableHead>Erstellt / Versand</TableHead><TableHead>Export</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aktionen</TableHead></TableRow></TableHeader><TableBody>
              {filteredLetters.map(letter => (
                <TableRow key={letter.id}><TableCell className="font-medium"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{letter.title}</div></TableCell><TableCell>{letter.recipient_name || '-'}</TableCell><TableCell><div className="space-y-1 text-sm"><div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /><span>{format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}</span></div><div className="flex items-center gap-2 text-muted-foreground"><Send className="h-3.5 w-3.5" /><span>{letter.sent_date ? format(new Date(letter.sent_date), "dd.MM.yyyy", { locale: de }) : '-'}</span></div></div></TableCell><TableCell><div className="flex flex-col items-start gap-1"><LetterPDFExport letter={letter as any} disabled={false} showPagination={letter.show_pagination || false} size="sm" /><LetterDOCXExport letter={letter as any} size="sm" /></div></TableCell><TableCell><Badge className={letter.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : letter.status === 'archived' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' : letter.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : letter.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-gray-100 text-gray-800'}>{letter.status === 'draft' ? 'Entwurf' : letter.status === 'review' ? 'Zur Prüfung' : letter.status === 'approved' ? 'Genehmigt' : letter.status === 'sent' ? 'Versendet' : 'Archiviert'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex items-center gap-1 justify-end">
                  {letterSubTab === 'active' ? (<><Button variant="ghost" size="sm" title="Als Aufgabe" aria-label={getLetterActionLabel('task')} onClick={() => ops.openTaskDialog(letter, 'task')}><ListTodo className="h-4 w-4" /></Button><Button variant="ghost" size="sm" title="Als Unteraufgabe" aria-label={getLetterActionLabel('subtask')} onClick={() => ops.openTaskDialog(letter, 'subtask')}><ListTree className="h-4 w-4" /></Button><Button variant="ghost" size="sm" aria-label={getLetterActionLabel('edit')} onClick={() => ops.handleEditLetter(letter)}><Edit3 className="h-4 w-4" /></Button></>) : (<Button variant="ghost" size="sm" aria-label={getLetterActionLabel('restore')} onClick={() => ops.handleRestoreLetter(letter.id!)}><RotateCcw className="h-4 w-4" /></Button>)}
                  <Button variant="ghost" size="sm" aria-label={getLetterActionLabel('delete')} onClick={() => ops.handleDeleteLetter(letter.id!)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell></TableRow>
              ))}
            </TableBody></Table></Card>
          )
        )}

        {/* Letter Wizard */}
        {showWizard && <LetterWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />}

        {/* Letter Editor (only for new unsaved letters) */}
        <LetterEditor letter={selectedLetter as any} isOpen={showLetterEditor && !selectedLetter?.id} onClose={() => { setShowLetterEditor(false); setSelectedLetter(undefined); data.fetchLetters(); }} onSave={() => data.fetchLetters()} />

        <DocumentDialogs
          showEditDialog={dialogState.showEditDialog} setShowEditDialog={setShowEditDialog}
          editingDocument={editingDocument}
          editTitle={editTitle} setEditTitle={setEditTitle}
          editDescription={editDescription} setEditDescription={setEditDescription}
          editCategory={editCategory} setEditCategory={setEditCategory}
          editTags={editTags} setEditTags={setEditTags}
          editStatus={editStatus} setEditStatus={setEditStatus}
          editFolderId={editFolderId} setEditFolderId={setEditFolderId}
          documentCategories={safeCategories} tags={safeTags} folders={safeFolders}
          loading={data.loading}
          onUpdateDocument={() => ops.handleUpdateDocument({ editingDocument, mutation: { type: "update", documentId: editingDocument?.id || "", title: editTitle, description: editDescription, category: editCategory, tags: editTags, status: editStatus, folderId: editFolderId }, onSuccess: () => { setShowEditDialog(false); setEditingDocument(null); } }) as any}
          showMoveFolderDialog={dialogState.showMoveFolderDialog} setShowMoveFolderDialog={setShowMoveFolderDialog}
          selectedDocument={selectedDocument} setSelectedDocument={setSelectedDocument}
          moveToFolderId={moveToFolderId} setMoveToFolderId={setMoveToFolderId}
          onMoveDocument={() => ops.handleMoveDocument(selectedDocument, { type: "move-document", documentId: selectedDocument?.id || "", folderId: moveToFolderId }, () => { setShowMoveFolderDialog(false); setSelectedDocument(null); setMoveToFolderId(""); }) as any}
          taskDialogMode={dialogState.taskDialogMode} taskTitle={ops.taskTitle} setTaskTitle={ops.setTaskTitle}
          taskDescription={ops.taskDescription} setTaskDescription={ops.setTaskDescription}
          parentTaskId={ops.parentTaskId} setParentTaskId={ops.setParentTaskId}
          availableParentTasks={ops.availableParentTasks} isCreatingTask={ops.isCreatingTask}
          onCloseTaskDialog={ops.closeTaskDialog} onCreateTaskFromLetter={ops.createTaskFromLetter}
          showArchiveSettings={dialogState.showArchiveSettings} setShowArchiveSettings={setShowArchiveSettings}
          autoArchiveDays={autoArchiveDays} setAutoArchiveDays={setAutoArchiveDays}
          archiveSettingsScopeDescription={data.currentTenant?.id ? "Diese Einstellung wird tenantweit in den App-Einstellungen gespeichert." : "Ohne aktiven Tenant wird diese Einstellung nur in diesem Browser gespeichert."}
          onSaveArchiveSettings={saveArchiveSettings}
          selectedArchivedDocument={selectedArchivedDocument}
          showArchivedLetterDetails={dialogState.showArchivedLetterDetails}
          setShowArchivedLetterDetails={setShowArchivedLetterDetails}
          setSelectedArchivedDocument={setSelectedArchivedDocument}
        />
      </div>
    </div>
  );
}
}
