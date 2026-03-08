import React from "react";
import { Paperclip, Upload, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskDocument } from "./types";

interface DocumentsSectionProps {
  documents: TaskDocument[];
  uploading: boolean;
  currentUserId?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (doc: TaskDocument) => void;
  onDelete: (doc: TaskDocument) => void;
}

export function DocumentsSection({ documents, uploading, currentUserId, onUpload, onDownload, onDelete }: DocumentsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          <h3 className="font-medium">Dokumente ({documents.length})</h3>
        </div>
        <div className="relative">
          <input type="file" id="document-upload" className="hidden" onChange={onUpload} disabled={uploading} />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => document.getElementById("document-upload")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Dokument hinzufügen"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{doc.file_name}</p>
                {doc.file_size && <p className="text-xs text-muted-foreground">{(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onDownload(doc)}>
                <Download className="h-4 w-4" />
              </Button>
              {doc.user_id === currentUserId && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(doc)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Noch keine Dokumente hinzugefügt</p>}
      </div>
    </div>
  );
}
