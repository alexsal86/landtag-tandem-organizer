import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, File, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isEmailFile, isEmlFile, isMsgFile, parseEmlFile, parseMsgFile, type EmailMetadata } from '@/utils/emlParser';
import { useDecisionAttachmentUpload } from '@/hooks/useDecisionAttachmentUpload';
import { EmailPreviewCard } from './EmailPreviewCard';
import { EmailPreviewDialog } from './EmailPreviewDialog';

interface UploadedFile {
  id?: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  uploaded_by?: string;
  uploader_name?: string;
  created_at?: string;
  email_metadata?: EmailMetadata | null;
}

interface DecisionFileUploadProps {
  decisionId?: string;
  onFilesChange?: () => void;
  canUpload?: boolean;
  mode?: 'view' | 'creation';
  onFilesSelected?: (files: File[]) => void;
  onFilesPrepared?: (payload: { files: File[]; metadataByIdentity: Record<string, EmailMetadata | null> }) => void;
}

interface SelectedFileEntry {
  file: File;
  emailMetadata?: EmailMetadata | null;
}

const getFileIdentity = (file: File) => `${file.name}::${file.size}::${file.lastModified}`;

export function DecisionFileUpload({
  decisionId,
  onFilesChange,
  canUpload = true,
  mode = 'view',
  onFilesSelected,
  onFilesPrepared
}: DecisionFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; filePath: string; fileName: string }>({
    open: false, filePath: '', fileName: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadDecisionAttachments } = useDecisionAttachmentUpload();

  useEffect(() => {
    if (decisionId && mode === 'view') {
      loadExistingFiles();
    }
  }, [decisionId, mode]);

  useEffect(() => {
    if (mode === 'creation') {
      const files = selectedFiles.map(entry => entry.file);
      const metadataByIdentity = Object.fromEntries(
        selectedFiles.map(entry => [getFileIdentity(entry.file), entry.emailMetadata ?? null])
      );

      onFilesSelected?.(files);
      onFilesPrepared?.({ files, metadataByIdentity });
    }
  }, [mode, onFilesPrepared, onFilesSelected, selectedFiles]);

  const loadExistingFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decision_attachments')
        .select('*')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uploaderIds = data?.map(f => f.uploaded_by).filter(Boolean) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', uploaderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const formattedFiles = data?.map(file => ({
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        file_size: file.file_size ?? 0,
        file_type: file.file_type,
        uploaded_by: file.uploaded_by,
        uploader_name: profileMap.get(file.uploaded_by)?.display_name || 'Unbekannt',
        created_at: file.created_at,
        email_metadata: file.email_metadata as unknown as EmailMetadata | null,
      })) || [];

      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const processFiles = async (fileList: File[]) => {
    const entries: SelectedFileEntry[] = [];
    for (const file of fileList) {
      if (isEmlFile(file)) {
        try {
          const parsed = await parseEmlFile(file);
          entries.push({ file, emailMetadata: parsed.metadata });
        } catch (e) {
          console.error('EML parse error:', e);
          entries.push({ file, emailMetadata: null });
        }
      } else if (isMsgFile(file)) {
        try {
          const parsed = await parseMsgFile(file);
          entries.push({ file, emailMetadata: parsed.metadata });
        } catch (e) {
          console.error('MSG parse error:', e);
          entries.push({ file, emailMetadata: null });
        }
      } else {
        entries.push({ file, emailMetadata: null });
      }
    }
    return entries;
  };

  const addSelectedEntries = async (incomingFiles: File[]) => {
    const incomingEntries = await processFiles(incomingFiles);

    setSelectedFiles(prev => {
      const existing = new Set(prev.map(entry => getFileIdentity(entry.file)));
      const dedupedIncoming = incomingEntries.filter(entry => !existing.has(getFileIdentity(entry.file)));
      return [...prev, ...dedupedIncoming];
    });

    toast({
      title: 'Dateien ausgewählt',
      description: 'Ausgewählte Dateien werden nach Erstellung hochgeladen.',
    });
  };

  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!canUpload) return;

    const filesArray = Array.from(fileList);

    if (mode === 'creation') {
      await addSelectedEntries(filesArray);
      return;
    }

    if (!decisionId) return;
    await uploadFiles(filesArray);
  };

  const uploadFiles = async (filesArray: File[]) => {
    if (!decisionId) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const preparedEntries = await processFiles(filesArray);
      const metadataByIdentity = Object.fromEntries(
        preparedEntries.map(entry => [getFileIdentity(entry.file), entry.emailMetadata ?? null])
      );

      const uploadResult = await uploadDecisionAttachments({
        decisionId,
        userId: user.id,
        files: preparedEntries.map(entry => entry.file),
        metadataByIdentity,
      });

      if (uploadResult.uploadedCount > 0) {
        toast({
          title: 'Dateien hochgeladen',
          description: `${uploadResult.uploadedCount} Datei(en) wurden erfolgreich hochgeladen.`,
        });
      }

      if (uploadResult.failed.length > 0) {
        toast({
          title: 'Upload teilweise fehlgeschlagen',
          description: uploadResult.failed.map(f => `${f.fileName}: ${f.reason}`).join(' | '),
          variant: 'destructive',
        });
      }
    } finally {
      setUploading(false);
      loadExistingFiles();
      onFilesChange?.();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!canUpload) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (mode === 'creation') {
      await addSelectedEntries(droppedFiles);
    } else {
      await uploadFiles(droppedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUpload) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canUpload) return;

    const clipboardFiles = Array.from(e.clipboardData.files || []);
    const itemFiles = Array.from(e.clipboardData.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);

    const filesByIdentity = new Map<string, File>();
    [...clipboardFiles, ...itemFiles].forEach(file => {
      filesByIdentity.set(getFileIdentity(file), file);
    });

    const pastedFiles = Array.from(filesByIdentity.values());
    if (pastedFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    if (mode === 'creation') {
      await addSelectedEntries(pastedFiles);
    } else {
      await uploadFiles(pastedFiles);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('decision-attachments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download gestartet',
        description: `${fileName} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download fehlgeschlagen',
        description: 'Die Datei konnte nicht heruntergeladen werden.',
        variant: 'destructive',
      });
    }
  };

  const removeFile = async (fileId: string, filePath: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('decision-attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('task_decision_attachments')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast({
        title: 'Datei gelöscht',
        description: 'Die Datei wurde erfolgreich gelöscht.',
      });

      loadExistingFiles();
      onFilesChange?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Löschung fehlgeschlagen',
        description: 'Die Datei konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canDelete = async (fileUploadedBy: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    if (fileUploadedBy === user.id) return true;
    const { data: decision } = await supabase
      .from('task_decisions')
      .select('created_by')
      .eq('id', decisionId)
      .single();
    return decision?.created_by === user.id;
  };

  const toFallbackEmailMetadata = (fileName: string): EmailMetadata => ({
    subject: fileName,
    from: 'Unbekannt',
    to: [],
    date: new Date().toISOString(),
    hasHtmlBody: false,
    attachmentCount: 0,
  });

  const renderFileItem = (file: UploadedFile) => {
    const fileLooksLikeEmail = file.file_name.toLowerCase().endsWith('.eml') || file.file_name.toLowerCase().endsWith('.msg');
    const emailMetadata = file.email_metadata || (fileLooksLikeEmail ? toFallbackEmailMetadata(file.file_name) : null);

    if (emailMetadata) {
      return (
        <EmailPreviewCard
          key={file.id}
          metadata={emailMetadata}
          fileName={file.file_name}
          fileSize={file.file_size}
          onPreviewOpen={() => setPreviewDialog({ open: true, filePath: file.file_path, fileName: file.file_name })}
          onDownload={() => downloadFile(file.file_path, file.file_name)}
          onRemove={file.uploaded_by ? async () => {
            if (await canDelete(file.uploaded_by)) {
              removeFile(file.id!, file.file_path);
            } else {
              toast({
                title: 'Keine Berechtigung',
                description: 'Sie können nur Ihre eigenen Dateien löschen.',
                variant: 'destructive',
              });
            }
          } : undefined}
        />
      );
    }

    return (
      <div key={file.id} className="flex items-center justify-between p-2 bg-muted rounded">
        <div className="flex items-center space-x-2 flex-1">
          <File className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.file_size)} • {file.uploader_name}
              {file.created_at && ` • ${new Date(file.created_at).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
              })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => downloadFile(file.file_path, file.file_name)}>
            <Download className="h-4 w-4" />
          </Button>
          {file.uploaded_by && (
            <Button type="button" variant="ghost" size="sm" onClick={async () => {
              if (await canDelete(file.uploaded_by)) {
                removeFile(file.id!, file.file_path);
              } else {
                toast({ title: 'Keine Berechtigung', description: 'Sie können nur Ihre eigenen Dateien löschen.', variant: 'destructive' });
              }
            }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onPaste={handlePaste}
          tabIndex={0}
          role="button"
          aria-label="Dateien per Drag-and-Drop, Klick oder Einfügen hochladen"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">
            {uploading ? 'Wird hochgeladen...' : 'Dateien hierher ziehen, klicken oder mit Strg+V einfügen'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dokumente, Bilder oder E-Mails (.eml, .msg) aus Outlook (inkl. Einfügen aus Zwischenablage)
          </p>
        </div>
      )}

      {mode === 'creation' && selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Ausgewählte Dateien ({selectedFiles.length})</p>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {selectedFiles.map((entry, index) => (
                  (entry.emailMetadata || isEmailFile(entry.file)) ? (
                    <EmailPreviewCard
                      key={index}
                      metadata={entry.emailMetadata ?? toFallbackEmailMetadata(entry.file.name)}
                      fileName={entry.file.name}
                      fileSize={entry.file.size}
                      onPreviewOpen={() => {}}
                      onDownload={() => {}}
                      onRemove={() => removeSelectedFile(index)}
                    />
                  ) : (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center space-x-2 flex-1">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(entry.file.size)}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSelectedFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'view' && files.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {files.map(renderFileItem)}
            </div>
          </CardContent>
        </Card>
      ) : mode === 'view' ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Noch keine Dateien hochgeladen
        </p>
      ) : null}

      <EmailPreviewDialog
        open={previewDialog.open}
        onOpenChange={(open) => setPreviewDialog(prev => ({ ...prev, open }))}
        filePath={previewDialog.filePath}
        fileName={previewDialog.fileName}
      />
    </div>
  );
}
