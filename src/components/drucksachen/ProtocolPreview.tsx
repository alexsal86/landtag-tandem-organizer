import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  Users, 
  MessageSquare, 
  FileText,
  Eye,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtocolPreviewData {
  agendaItems: Array<{
    agenda_number: string;
    title: string;
    description?: string;
    item_type: string;
  }>;
  speeches: Array<{
    speaker_name: string;
    speaker_party?: string;
    speech_content: string;
    speech_type: string;
  }>;
  sessions: Array<{
    session_type: string;
    timestamp: string;
    notes?: string;
  }>;
  metadata: {
    sessionNumber: string;
    date: string;
    legislature: string;
  };
}

interface ProtocolPreviewProps {
  data: ProtocolPreviewData;
  onViewDetails: () => void;
}

export function ProtocolPreview({ data, onViewDetails }: ProtocolPreviewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getItemTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      regular: { label: 'Regulär', variant: 'default' },
      question: { label: 'Anfrage', variant: 'secondary' },
      motion: { label: 'Antrag', variant: 'outline' },
      government_statement: { label: 'Regierungserklärung', variant: 'destructive' }
    };
    
    const config = variants[type] || { label: type, variant: 'default' };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const uniqueSpeakers = Array.from(new Set(data.speeches.map(s => s.speaker_name)))
    .filter(name => name !== 'Parlament');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Protokoll-Vorschau
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            Details anzeigen
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(data.metadata.date)}
          </div>
          <div>Sitzung {data.metadata.sessionNumber}</div>
          <div>Wahlperiode {data.metadata.legislature}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.agendaItems.length}</div>
            <div className="text-xs text-blue-700">Tagesordnungspunkte</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{data.speeches.length}</div>
            <div className="text-xs text-green-700">Wortmeldungen</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{uniqueSpeakers.length}</div>
            <div className="text-xs text-purple-700">Redner</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{data.sessions.length}</div>
            <div className="text-xs text-orange-700">Zeitmarken</div>
          </div>
        </div>

        <Separator />

        {/* Agenda Items Preview */}
        {data.agendaItems.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tagesordnung (erste 3 Punkte)
            </h4>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {data.agendaItems.slice(0, 3).map((item, index) => (
                  <div key={index} className="p-2 bg-muted/50 rounded text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {item.agenda_number}
                      </Badge>
                      {getItemTypeBadge(item.item_type)}
                    </div>
                    <div className="font-medium">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </div>
                    )}
                  </div>
                ))}
                {data.agendaItems.length > 3 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    ... und {data.agendaItems.length - 3} weitere Punkte
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Speakers Preview */}
        {uniqueSpeakers.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Redner (erste 6)
            </h4>
            <div className="flex flex-wrap gap-1">
              {uniqueSpeakers.slice(0, 6).map((speaker, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {speaker.replace(/\([^)]*\)/, '').trim()}
                </Badge>
              ))}
              {uniqueSpeakers.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{uniqueSpeakers.length - 6} weitere
                </Badge>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Session Timeline Preview */}
        {data.sessions.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Sitzungsverlauf
            </h4>
            <div className="space-y-1">
              {data.sessions.slice(0, 4).map((session, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {session.timestamp}
                  </Badge>
                  <span className="text-muted-foreground">
                    {session.session_type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}