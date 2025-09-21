import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  MessageSquare, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AnalysisStats {
  agendaItems: number;
  speeches: number;
  sessions: number;
  speakers: number;
  textLength: number;
  processingTime?: number;
}

interface ProtocolAnalysisStatusProps {
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  stats?: AnalysisStats;
  filename: string;
  error?: string;
}

export function ProtocolAnalysisStatus({ 
  status, 
  progress, 
  stats, 
  filename, 
  error 
}: ProtocolAnalysisStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'uploading':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'blue',
          label: 'Wird hochgeladen...'
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'yellow',
          label: 'Analysiere Protokoll...'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'green',
          label: 'Analyse abgeschlossen'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'red',
          label: 'Fehler aufgetreten'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate flex-1">
            {filename}
          </CardTitle>
          <div className="flex items-center gap-2">
            {statusConfig.icon}
            <Badge 
              variant={status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        
        {(status === 'uploading' || status === 'processing') && (
          <Progress value={progress} className="h-2" />
        )}
      </CardHeader>

      {status === 'completed' && stats && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-semibold">{stats.agendaItems}</div>
                <div className="text-xs text-muted-foreground">Tagesordnung</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-semibold">{stats.speeches}</div>
                <div className="text-xs text-muted-foreground">Wortmeldungen</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-lg font-semibold">{stats.speakers}</div>
                <div className="text-xs text-muted-foreground">Redner</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-lg font-semibold">{stats.sessions}</div>
                <div className="text-xs text-muted-foreground">Zeitmarken</div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-muted-foreground">
            {(stats.textLength / 1000).toFixed(1)}k Zeichen extrahiert
            {stats.processingTime && ` • ${stats.processingTime}s Verarbeitung`}
          </div>
        </CardContent>
      )}

      {status === 'error' && error && (
        <CardContent className="pt-0">
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {error}
          </div>
        </CardContent>
      )}
    </Card>
  );
}