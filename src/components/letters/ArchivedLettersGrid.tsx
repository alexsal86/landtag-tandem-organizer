import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  FileText, 
  Download, 
  Eye,
  Calendar,
  User,
  Mail,
  Archive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ArchivedLetter {
  id: string;
  title: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  document_type: string;
  source_letter_id?: string;
  workflow_history?: any;
  archived_attachments?: any;
  created_at: string;
  updated_at: string;
}

interface ArchivedLettersGridProps {
  archivedLetters: ArchivedLetter[];
  onDownload: (letter: ArchivedLetter) => void;
  viewType: 'card' | 'list';
}

export const ArchivedLettersGrid: React.FC<ArchivedLettersGridProps> = ({
  archivedLetters,
  onDownload,
  viewType
}) => {
  const formatFileSize = (sizeInBytes?: number): string => {
    if (!sizeInBytes) return 'Unbekannt';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeInBytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const getWorkflowSummary = (workflow?: any) => {
    if (!workflow || !Array.isArray(workflow)) return null;
    
    const lastEntry = workflow[workflow.length - 1];
    if (!lastEntry) return null;
    
    return {
      action: lastEntry.action || 'Archiviert',
      date: lastEntry.timestamp,
      user: lastEntry.user_name || 'System'
    };
  };

  if (archivedLetters.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Keine archivierten Briefe</h3>
          <p className="text-muted-foreground">
            Archivierte Briefe werden hier angezeigt, sobald sie automatisch oder manuell archiviert wurden.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (viewType === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {archivedLetters.map((letter) => {
          const workflowSummary = getWorkflowSummary(letter.workflow_history);
          
          return (
            <Card key={letter.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-lg truncate">{letter.title}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Archiviert
                  </Badge>
                </div>
                {letter.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {letter.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{letter.file_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Archiviert: {format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}</span>
                  </div>
                  {workflowSummary && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{workflowSummary.action} von {workflowSummary.user}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span>Größe: {formatFileSize(letter.file_size)}</span>
                  </div>
                </div>
                
                {letter.archived_attachments && Array.isArray(letter.archived_attachments) && letter.archived_attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Anlagen:</p>
                    <div className="flex flex-wrap gap-1">
                      {letter.archived_attachments.map((attachment: any, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {attachment.name || `Anlage ${index + 1}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(letter)}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    PDF herunterladen
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // List view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-orange-600" />
          Archivierte Briefe ({archivedLetters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-0">
          {archivedLetters.map((letter, index) => {
            const workflowSummary = getWorkflowSummary(letter.workflow_history);
            
            return (
              <div 
                key={letter.id} 
                className={`p-4 hover:bg-muted/50 transition-colors ${
                  index !== archivedLetters.length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Archive className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      <h4 className="font-medium truncate">{letter.title}</h4>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                        Archiviert
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {letter.file_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(letter.created_at), "dd.MM.yyyy", { locale: de })}
                      </span>
                      {workflowSummary && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {workflowSummary.user}
                        </span>
                      )}
                      <span>{formatFileSize(letter.file_size)}</span>
                    </div>
                    
                    {letter.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {letter.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDownload(letter)}
                      className="gap-1"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};