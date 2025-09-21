import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, X, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { parsePDFFile, analyzeProtocolStructure } from '@/utils/pdfParser';

interface DrucksachenUploadProps {
  onUploadSuccess: (protocol: any) => void;
  onProtocolsRefresh: () => void;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  protocolId?: string;
}

export function DrucksachenUpload({ onUploadSuccess, onProtocolsRefresh }: DrucksachenUploadProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadFile[] = Array.from(files)
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        file,
        progress: 0,
        status: 'pending'
      }));

    if (newFiles.length !== files.length) {
      toast.error('Nur PDF-Dateien sind erlaubt');
    }

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  // Remove file from upload list
  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Check for duplicate files (storage + database)
  const checkForDuplicates = async (fileName: string) => {
    if (!currentTenant) return { exists: false };

    const timestamp = new Date().toISOString().slice(0, 10);
    const generatedFileName = `${timestamp}-${fileName}`;
    const filePath = `${currentTenant.id}/${generatedFileName}`;

    // Check storage
    const { data: storageData } = await supabase.storage
      .from('parliament-protocols')
      .list(currentTenant.id, { search: generatedFileName });

    const storageExists = storageData?.some(file => file.name === generatedFileName);

    // Check database
    const { data: dbData } = await supabase
      .from('parliament_protocols')
      .select('id, original_filename')
      .eq('tenant_id', currentTenant.id)
      .eq('original_filename', fileName);

    const dbExists = dbData && dbData.length > 0;

    return { 
      exists: storageExists || dbExists, 
      storageExists, 
      dbExists, 
      filePath,
      orphaned: storageExists && !dbExists 
    };
  };

  // Clean up orphaned files
  const cleanupOrphanedFile = async (filePath: string) => {
    try {
      await supabase.storage
        .from('parliament-protocols')
        .remove([filePath]);
      console.log('Cleaned up orphaned file:', filePath);
      return true;
    } catch (error) {
      console.error('Failed to cleanup orphaned file:', error);
      return false;
    }
  };

  // Upload a single file
  const uploadFile = async (fileData: UploadFile, index: number) => {
    if (!currentTenant || !user) return;

    let uploadedFilePath: string | null = null;
    let protocolId: string | null = null;

    try {
      // Step 1: Check for duplicates
      const duplicateCheck = await checkForDuplicates(fileData.file.name);
      
      if (duplicateCheck.exists) {
        if (duplicateCheck.orphaned) {
          // Clean up orphaned file and retry
          const cleaned = await cleanupOrphanedFile(duplicateCheck.filePath);
          if (cleaned) {
            toast.info('Verwaiste Datei bereinigt, Upload wird fortgesetzt...');
          } else {
            throw new Error('Datei existiert bereits im Storage (Bereinigung fehlgeschlagen)');
          }
        } else {
          throw new Error('Datei bereits hochgeladen');
        }
      }

      // Update status to uploading
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'uploading', progress: 25 } : f
      ));

      // Step 2: Parse PDF locally FIRST for immediate feedback
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'processing', progress: 50 } : f
      ));
      
      let parsedData = null;
      let pdfMetadata = null;
      try {
        console.log('Starting local PDF analysis...');
        const pdfData = await parsePDFFile(fileData.file);
        const structuredData = analyzeProtocolStructure(pdfData.text);
        parsedData = {
          raw_text: pdfData.text,
          agendaItems: structuredData.agendaItems,
          speeches: structuredData.speeches,
          sessions: structuredData.sessions
        };
        pdfMetadata = pdfData.metadata;
        console.log('Local PDF analysis completed:', {
          agendaItems: structuredData.agendaItems.length,
          speeches: structuredData.speeches.length,
          sessions: structuredData.sessions.length,
          textLength: pdfData.text.length
        });
        
        // Show preview to user
        toast.success(`PDF analysiert: ${structuredData.agendaItems.length} Tagesordnungspunkte, ${structuredData.speeches.length} Reden gefunden`);
      } catch (parseError) {
        console.error('Local PDF parsing failed:', parseError);
        toast.error(`PDF-Analyse fehlgeschlagen: ${parseError.message}`);
        throw parseError;
      }

      // Step 3: Upload file to storage
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'uploading', progress: 75 } : f
      ));

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${timestamp}-${fileData.file.name}`;
      const filePath = `${currentTenant.id}/${fileName}`;
      uploadedFilePath = filePath; // Track for cleanup

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('parliament-protocols')
        .upload(filePath, fileData.file);

      if (uploadError) throw uploadError;

      // Step 4: Create protocol record with parsed metadata
      const protocolMetadata = {
        legislature_period: pdfMetadata?.legislature || '17',
        session_number: pdfMetadata?.sessionNumber || '0',
        protocol_date: pdfMetadata?.date || new Date().toISOString().split('T')[0]
      };

      const { data: protocolData, error: dbError } = await supabase
        .from('parliament_protocols')
        .insert({
          tenant_id: currentTenant.id,
          uploaded_by: user.id,
          original_filename: fileData.file.name,
          file_path: filePath,
          file_size: fileData.file.size,
          processing_status: 'processing',
          raw_text: parsedData?.raw_text?.slice(0, 50000), // Truncate for storage
          ...protocolMetadata
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insertion failed:', dbError);
        throw new Error(`Datenbankfehler: ${dbError.message}`);
      }

      protocolId = protocolData.id;

      // Step 5: Send structured data to edge function for database insertion
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'processing', progress: 90 } : f
      ));

      try {
        const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-parliament-protocol', {
          body: { 
            protocolId: protocolData.id,
            structuredData: parsedData // Send the already analyzed data
          }
        });
        
        if (analysisError) {
          console.warn('Database insertion error:', analysisError);
          // Still mark as completed with warning
          toast.warning('PDF hochgeladen, aber Datenbankfehler bei der Analyse');
        } else {
          console.log('Database insertion completed:', analysisResult);
          toast.success('PDF erfolgreich analysiert und gespeichert');
        }
      } catch (error) {
        console.warn('Analysis function error:', error);
        toast.warning('PDF hochgeladen, aber Analyse-Service nicht verfügbar');
      }

      // Update status to completed
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'completed', protocolId: protocolData.id, progress: 100 } : f
      ));

      onUploadSuccess(protocolData);
      onProtocolsRefresh(); // Refresh the list
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Cleanup on error: remove uploaded file if database insert failed
      if (uploadedFilePath && !protocolId) {
        console.log('Cleaning up uploaded file due to database error...');
        try {
          await supabase.storage
            .from('parliament-protocols')
            .remove([uploadedFilePath]);
          console.log('Successfully cleaned up orphaned file');
        } catch (cleanupError) {
          console.error('Failed to cleanup file after error:', cleanupError);
        }
      }

      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unbekannter Fehler'
        } : f
      ));
      toast.error(`Fehler beim Upload: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  // Upload all pending files
  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending');

    for (const { file, index } of pendingFiles) {
      await uploadFile(file, index);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Clean up orphaned files function for admin use
  const cleanupOrphanedFiles = async () => {
    if (!currentTenant) return;

    try {
      // Get all files in storage
      const { data: storageFiles } = await supabase.storage
        .from('parliament-protocols')
        .list(currentTenant.id);

      if (!storageFiles) return;

      // Get all database records
      const { data: dbRecords } = await supabase
        .from('parliament_protocols')
        .select('file_path')
        .eq('tenant_id', currentTenant.id);

      const dbFilePaths = new Set(dbRecords?.map(r => r.file_path.split('/').pop()) || []);
      
      const orphanedFiles = storageFiles.filter(file => !dbFilePaths.has(file.name));

      if (orphanedFiles.length > 0) {
        const filesToRemove = orphanedFiles.map(file => `${currentTenant.id}/${file.name}`);
        await supabase.storage
          .from('parliament-protocols')
          .remove(filesToRemove);
        
        toast.success(`${orphanedFiles.length} verwaiste Dateien bereinigt`);
      } else {
        toast.info('Keine verwaisten Dateien gefunden');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Fehler bei der Bereinigung');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Protokoll hochladen</CardTitle>
              <CardDescription>
                Laden Sie PDF-Protokolle des Landtags Baden-Württemberg zur Analyse hoch
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={cleanupOrphanedFiles}
              className="text-xs"
            >
              Bereinigung
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                PDF-Dateien hier ablegen oder auswählen
              </p>
              <p className="text-sm text-muted-foreground">
                Unterstützte Formate: PDF (max. 50 MB)
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Dateien auswählen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Ausgewählte Dateien</h3>
                <Button
                  onClick={uploadAllFiles}
                  disabled={!uploadFiles.some(f => f.status === 'pending')}
                >
                  Alle hochladen
                </Button>
              </div>
              
              <div className="space-y-2">
                {uploadFiles.map((fileData, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(fileData.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fileData.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {fileData.status === 'error' && fileData.error && (
                            <p className="text-xs text-red-600">{fileData.error}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {(fileData.status === 'uploading' || fileData.status === 'processing') && (
                          <div className="w-24">
                            <Progress value={fileData.progress} className="h-2" />
                          </div>
                        )}
                        
                        {fileData.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {fileData.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => uploadFile(fileData, index)}
                          >
                            Erneut verarbeiten
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}