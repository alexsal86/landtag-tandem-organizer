import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  MessageSquare,
  Download,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface Protocol {
  id: string;
  protocol_date: string;
  session_number: string;
  legislature_period: string;
  original_filename: string;
  processing_status: string;
  structured_data?: any;
  raw_text?: string;
}

interface AgendaItem {
  id: string;
  agenda_number: string;
  title: string;
  description?: string;
  page_number?: number;
  start_time?: string;
  end_time?: string;
  item_type: string;
}

interface Speech {
  id: string;
  speaker_name: string;
  speaker_party?: string;
  speaker_role?: string;
  speech_content: string;
  start_time?: string;
  end_time?: string;
  page_number?: number;
  speech_type: string;
  agenda_item_id?: string;
}

interface Session {
  id: string;
  session_type: string;
  timestamp: string;
  page_number?: number;
  notes?: string;
}

interface ProtocolViewerProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ProtocolViewer({ protocol, onClose }: ProtocolViewerProps) {
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgendaItem, setSelectedAgendaItem] = useState<string | null>(null);

  // Load protocol details
  useEffect(() => {
    const loadProtocolDetails = async () => {
      try {
        // Load agenda items
        const { data: agendaData, error: agendaError } = await supabase
          .from('protocol_agenda_items')
          .select('*')
          .eq('protocol_id', protocol.id)
          .order('agenda_number');

        if (agendaError) throw agendaError;

        // Load speeches
        const { data: speechesData, error: speechesError } = await supabase
          .from('protocol_speeches')
          .select('*')
          .eq('protocol_id', protocol.id)
          .order('page_number');

        if (speechesError) throw speechesError;

        // Load sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('protocol_sessions')
          .select('*')
          .eq('protocol_id', protocol.id)
          .order('timestamp');

        if (sessionsError) throw sessionsError;

        setAgendaItems(agendaData || []);
        setSpeeches(speechesData || []);
        setSessions(sessionsData || []);
      } catch (error) {
        console.error('Error loading protocol details:', error);
        toast.error('Fehler beim Laden der Protokolldetails');
      } finally {
        setLoading(false);
      }
    };

    loadProtocolDetails();
  }, [protocol.id]);

  // Format time
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    return timeString.slice(0, 5); // HH:MM
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get item type badge
  const getItemTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      regular: { label: 'Regulär', variant: 'default' },
      question: { label: 'Anfrage', variant: 'secondary' },
      motion: { label: 'Antrag', variant: 'outline' },
      government_statement: { label: 'Regierungserklärung', variant: 'destructive' }
    };
    
    const config = variants[type] || { label: type, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get speech type icon
  const getSpeechTypeIcon = (type: string) => {
    switch (type) {
      case 'main':
        return <MessageSquare className="h-4 w-4" />;
      case 'interjection':
        return <span className="text-xs">→</span>;
      case 'applause':
        return <span className="text-xs">👏</span>;
      case 'interruption':
        return <span className="text-xs">⚠</span>;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Filter speeches by agenda item
  const getSpeeches = (agendaItemId?: string) => {
    return speeches.filter(speech => 
      agendaItemId ? speech.agenda_item_id === agendaItemId : !speech.agenda_item_id
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Lade Protokolldetails...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onClose} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zur Übersicht
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                PDF herunterladen
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{protocol.original_filename}</h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(protocol.protocol_date)}
                </div>
                <div>Sitzung {protocol.session_number}</div>
                <div>Wahlperiode {protocol.legislature_period}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-2xl font-bold">{agendaItems.length}</div>
                <div className="text-sm text-muted-foreground">Tagesordnungspunkte</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold">{speeches.length}</div>
                <div className="text-sm text-muted-foreground">Wortmeldungen</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold">
                  {new Set(speeches.map(s => s.speaker_name)).size}
                </div>
                <div className="text-sm text-muted-foreground">Redner</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-sm text-muted-foreground">Sitzungsabschnitte</div>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="agenda">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="agenda">Tagesordnung</TabsTrigger>
          <TabsTrigger value="speeches">Reden</TabsTrigger>
          <TabsTrigger value="sessions">Sitzungsverlauf</TabsTrigger>
          <TabsTrigger value="search">Suche</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="raw">Rohtext</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <Card>
            <CardHeader>
              <CardTitle>Tagesordnung</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {agendaItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Keine Tagesordnungspunkte gefunden
                    </p>
                  ) : (
                    agendaItems.map((item) => (
                      <Card 
                        key={item.id} 
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedAgendaItem === item.id ? 'bg-primary/5 border-primary' : ''
                        }`}
                        onClick={() => setSelectedAgendaItem(
                          selectedAgendaItem === item.id ? null : item.id
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{item.agenda_number}</Badge>
                              {getItemTypeBadge(item.item_type)}
                              {item.page_number && (
                                <Badge variant="secondary">Seite {item.page_number}</Badge>
                              )}
                            </div>
                            <h3 className="font-medium">{item.title}</h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {(item.start_time || item.end_time) && (
                            <div className="text-sm text-muted-foreground ml-4">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(item.start_time)}
                                {item.end_time && ` - ${formatTime(item.end_time)}`}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {selectedAgendaItem === item.id && (
                          <div className="mt-4 border-t pt-4">
                            <h4 className="font-medium mb-2">Wortmeldungen zu diesem Punkt:</h4>
                            <div className="space-y-2">
                              {getSpeeches(item.id).map((speech) => (
                                <div key={speech.id} className="bg-muted/50 p-3 rounded">
                                  <div className="flex items-center gap-2 mb-2">
                                    {getSpeechTypeIcon(speech.speech_type)}
                                    <span className="font-medium">{speech.speaker_name}</span>
                                    {speech.speaker_party && (
                                      <Badge variant="outline" className="text-xs">
                                        {speech.speaker_party}
                                      </Badge>
                                    )}
                                    {speech.start_time && (
                                      <span className="text-xs text-muted-foreground">
                                        {formatTime(speech.start_time)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm line-clamp-3">
                                    {speech.speech_content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="speeches">
          <Card>
            <CardHeader>
              <CardTitle>Alle Wortmeldungen</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {speeches.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Keine Wortmeldungen gefunden
                    </p>
                  ) : (
                    speeches.map((speech) => (
                      <Card key={speech.id} className="p-4">
                        <div className="flex items-start gap-3">
                          {getSpeechTypeIcon(speech.speech_type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{speech.speaker_name}</span>
                              {speech.speaker_party && (
                                <Badge variant="outline">{speech.speaker_party}</Badge>
                              )}
                              {speech.speaker_role && (
                                <span className="text-sm text-muted-foreground">
                                  ({speech.speaker_role})
                                </span>
                              )}
                              {speech.start_time && (
                                <span className="text-sm text-muted-foreground">
                                  {formatTime(speech.start_time)}
                                </span>
                              )}
                              {speech.page_number && (
                                <Badge variant="secondary" className="text-xs">
                                  S. {speech.page_number}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{speech.speech_content}</p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sitzungsverlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Keine Sitzungsverläufe gefunden
                    </p>
                  ) : (
                    sessions.map((session, index) => (
                      <div key={session.id} className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-primary rounded-full" />
                          {index < sessions.length - 1 && (
                            <div className="w-px h-8 bg-border" />
                          )}
                        </div>
                        <Card className="flex-1 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                {formatTime(session.timestamp)}
                              </span>
                              <Badge variant="outline">
                                {session.session_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            {session.page_number && (
                              <Badge variant="secondary" className="text-xs">
                                Seite {session.page_number}
                              </Badge>
                            )}
                          </div>
                          {session.notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {session.notes}
                            </p>
                          )}
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <ProtocolSearch 
            protocolId={protocol.id}
            onResultSelect={(result) => {
              console.log('Selected result:', result);
              // Could navigate to specific section
            }}
          />
        </TabsContent>

        <TabsContent value="export">
          <ProtocolExport 
            protocolId={protocol.id}
            protocolTitle={protocol.original_filename}
          />
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Rohtext</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {protocol.raw_text ? (
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {protocol.raw_text}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Kein Rohtext verfügbar
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}