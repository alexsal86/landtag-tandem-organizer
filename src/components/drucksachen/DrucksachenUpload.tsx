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

  // Upload a single file
  const uploadFile = async (fileData: UploadFile, index: number) => {
    if (!currentTenant || !user) return;

    try {
      // Update status to uploading
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      // Create unique filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${timestamp}-${fileData.file.name}`;
      const filePath = `${currentTenant.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('parliament-protocols')
        .upload(filePath, fileData.file);

      if (uploadError) throw uploadError;

      // Parse PDF locally for immediate feedback
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'processing', progress: 100 } : f
      ));
      
      let parsedData = null;
      try {
        const pdfData = await parsePDFFile(fileData.file);
        const structuredData = analyzeProtocolStructure(pdfData.text);
        parsedData = structuredData;
        console.log('Local PDF analysis completed:', structuredData);
      } catch (parseError) {
        console.warn('Local PDF parsing failed:', parseError);
      }

      // Extract metadata from filename (if follows convention)
      const extractMetadata = (filename: string) => {
        // Try to extract session info from filename like "17_0129_24072025.pdf"
        const match = filename.match(/(\d+)_(\d+)_(\d{8})\.pdf$/);
        if (match) {
          const [, legislature, session, dateStr] = match;
          const year = dateStr.slice(4, 8);
          const month = dateStr.slice(2, 4);
          const day = dateStr.slice(0, 2);
          const protocolDate = `${year}-${month}-${day}`;
          
          return {
            legislature_period: legislature,
            session_number: session,
            protocol_date: protocolDate
          };
        }
        
        // Fallback to current date
        return {
          legislature_period: '17',
          session_number: '0',
          protocol_date: new Date().toISOString().split('T')[0]
        };
      };

      const metadata = extractMetadata(fileData.file.name);

      // Create protocol record in database
      const { data: protocolData, error: dbError } = await supabase
        .from('parliament_protocols')
        .insert({
          tenant_id: currentTenant.id,
          uploaded_by: user.id,
          original_filename: fileData.file.name,
          file_path: filePath,
          file_size: fileData.file.size,
          processing_status: 'uploaded',
          ...metadata
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update status to completed
      setUploadFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'completed', protocolId: protocolData.id } : f
      ));

      // Trigger analysis (would call edge function here)
      try {
        const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-parliament-protocol', {
          body: { protocolId: protocolData.id }
        });
        
        if (analysisError) {
          console.warn('Protocol analysis error:', analysisError);
          // Still mark as completed, just without detailed analysis
        } else {
          console.log('Analysis completed:', analysisResult);
        }
      } catch (error) {
        console.warn('Protocol analysis function not available:', error);
      }

      onUploadSuccess(protocolData);
      
    } catch (error) {
      console.error('Upload error:', error);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Protokoll hochladen</CardTitle>
          <CardDescription>
            Laden Sie PDF-Protokolle des Landtags Baden-Württemberg zur Analyse hoch
          </CardDescription>
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