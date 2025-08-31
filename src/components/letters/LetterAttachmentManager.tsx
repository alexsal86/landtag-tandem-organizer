import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Download, Trash2, X, Edit, Plus, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
  display_name?: string; // For customizable display in letter
}

interface LetterAttachmentManagerProps {
  letterId: string;
  attachments: Attachment[];
  onAttachmentUpdate: (attachments: Attachment[]) => void;
  readonly?: boolean;
}

const LetterAttachmentManager: React.FC<LetterAttachmentManagerProps> = ({
  letterId,
  attachments,
  onAttachmentUpdate,
  readonly = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);

  // Fetch documents from document management
  useEffect(() => {
    if (showDocumentSelector) {
      fetchDocuments();
    }
  }, [showDocumentSelector]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Dokumente konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || readonly) return;

    setUploading(true);
    
    try {
      const newAttachments = [...attachments];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // File size limit (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Datei zu groß",
            description: `${file.name} ist größer als 10MB und wurde übersprungen.`,
            variant: "destructive",
          });
          continue;
        }

        const fileName = `${Math.random().toString(36).substring(2)}_${file.name}`;
        const filePath = `${letterId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) {
          toast({
            title: "Upload-Fehler",
            description: `${file.name} konnte nicht hochgeladen werden: ${uploadError.message}`,
            variant: "destructive",
          });
          continue;
        }

        // Save attachment record
        const { data: insertData, error: insertError } = await supabase
          .from('letter_attachments')
          .insert({
            letter_id: letterId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id
          })
          .select()
          .single();

        if (insertError) {
          // Clean up uploaded file
          await supabase.storage.from('documents').remove([filePath]);
          toast({
            title: "Datenbankfehler",
            description: `${file.name} konnte nicht gespeichert werden: ${insertError.message}`,
            variant: "destructive",
          });
          continue;
        }
        
        newAttachments.push(insertData);
      }

      onAttachmentUpdate(newAttachments);
      toast({
        title: "Upload erfolgreich",
        description: "Alle Dateien wurden erfolgreich hochgeladen.",
      });
    } catch (error) {
      toast({
        title: "Upload-Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [letterId, readonly, user?.id, attachments, onAttachmentUpdate, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download-Fehler",
        description: "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (readonly) return;

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('letter_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([attachment.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      const updatedAttachments = attachments.filter(att => att.id !== attachment.id);
      onAttachmentUpdate(updatedAttachments);
      
      toast({
        title: "Datei gelöscht",
        description: `${attachment.file_name} wurde erfolgreich gelöscht.`,
      });
    } catch (error: any) {
      toast({
        title: "Lösch-Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditDisplayName = (attachment: Attachment) => {
    setEditingAttachment(attachment);
    setNewDisplayName(attachment.display_name || attachment.file_name);
  };

  const handleSaveDisplayName = async () => {
    if (!editingAttachment) return;

    try {
      const { error } = await supabase
        .from('letter_attachments')
        .update({ display_name: newDisplayName })
        .eq('id', editingAttachment.id);

      if (error) throw error;

      const updatedAttachments = attachments.map(att => 
        att.id === editingAttachment.id 
          ? { ...att, display_name: newDisplayName }
          : att
      );
      
      onAttachmentUpdate(updatedAttachments);
      setEditingAttachment(null);
      setNewDisplayName("");

      toast({
        title: "Anzeigename aktualisiert",
        description: "Der Anzeigename wurde erfolgreich geändert.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Der Anzeigename konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const handleAddDocumentAttachment = async (document: any) => {
    try {
      const { data, error } = await supabase
        .from('letter_attachments')
        .insert({
          letter_id: letterId,
          file_name: document.file_name,
          file_path: document.file_path,
          file_type: document.file_type,
          file_size: document.file_size,
          uploaded_by: document.user_id,
          display_name: document.title // Use document title as display name
        })
        .select()
        .single();

      if (error) throw error;

      const updatedAttachments = [...attachments, data];
      onAttachmentUpdate(updatedAttachments);

      toast({
        title: "Dokument hinzugefügt",
        description: `${document.title} wurde als Anlage hinzugefügt.`,
      });

      setShowDocumentSelector(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Anlagen
          <Badge variant="secondary">{attachments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readonly && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Dateien hierher ziehen oder klicken zum Auswählen
              </p>
              <div className="flex justify-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Wird hochgeladen...' : 'Datei hochladen'}
                </Button>
                <Dialog open={showDocumentSelector} onOpenChange={setShowDocumentSelector}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Aus Dokumenten
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Dokument aus Verwaltung auswählen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => handleAddDocumentAttachment(doc)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Hinzufügen
                          </Button>
                        </div>
                      ))}
                      {documents.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Keine Dokumente verfügbar
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xls,.xlsx,.ppt,.pptx"
              />
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{attachment.display_name || attachment.file_name}</p>
                      {!readonly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDisplayName(attachment)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatFileSize(attachment.file_size)}</span>
                      {attachment.file_type && (
                        <>
                          <span>•</span>
                          <span>{attachment.file_type}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readonly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(attachment)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Keine Anlagen vorhanden</p>
          </div>
        )}

        {/* Edit Display Name Dialog */}
        <Dialog open={!!editingAttachment} onOpenChange={() => setEditingAttachment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anzeigename bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="display-name">Anzeigename in Brief</Label>
                <Input
                  id="display-name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Name wie er im Brief erscheinen soll"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingAttachment(null)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSaveDisplayName}>
                  Speichern
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default LetterAttachmentManager;