import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, FileText } from 'lucide-react';

interface Protocol {
  id: string;
  protocol_date: string;
  session_number: string;
  legislature_period: string;
  structured_data?: any;
}

interface ProtocolPlenaryViewProps {
  protocol: Protocol;
  structuredData: any;
}

export function ProtocolPlenaryView({ protocol, structuredData }: ProtocolPlenaryViewProps) {
  const sessionData = structuredData?.session || {};
  const sittingData = structuredData?.sitting || {};
  const speeches = structuredData?.speeches || [];
  const tocAgenda = structuredData?.toc?.items || [];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Datum unbekannt';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getPartyColor = (party?: string) => {
    if (!party) return 'bg-muted text-muted-foreground';
    const normalized = party.toLowerCase().replace(/[^a-z]/g, '');
    
    const partyMap: Record<string, string> = {
      'gruene': 'party-gruene',
      'grne': 'party-gruene',
      'cdu': 'party-cdu',
      'spd': 'party-spd',
      'fdp': 'party-fdp',
      'afd': 'party-afd',
      'linke': 'party-linke',
      'dielinke': 'party-linke'
    };
    
    return partyMap[normalized] || 'bg-muted text-muted-foreground';
  };

  const getEventClass = (eventType: string) => {
    const type = eventType.toLowerCase();
    
    // Beifall/Applaus
    if (type.includes('beifall')) return 'event-beifall';
    
    // Zurufe/Zwischenrufe
    if (type.includes('zuruf') || type.includes('zwischenruf')) return 'event-zuruf';
    
    // Heiterkeit/Lachen
    if (type.includes('heiterkeit') || type.includes('lachen')) return 'event-heiterkeit';
    
    // Unruhe
    if (type.includes('unruhe')) return 'event-unruhe';
    
    // Glocke des Präsidenten
    if (type.includes('glocke')) return 'event-glocke';
    
    // Default
    return 'event-default';
  };

  const renderSpeechContent = (text: string, events_flat: any[] = []) => {
    if (!text) return null;
    
    // Text in Zeilen aufteilen
    const lines = text.split('\n').filter(l => l.trim());
    
    // Events nach line_index gruppieren
    const eventsByLine = new Map<number, any[]>();
    events_flat.forEach(event => {
      const lineIdx = event.line_index;
      if (!eventsByLine.has(lineIdx)) {
        eventsByLine.set(lineIdx, []);
      }
      eventsByLine.get(lineIdx)!.push(event);
    });
    
    // Zeilen und Events kombiniert rendern
    return lines.map((line, idx) => (
      <React.Fragment key={idx}>
        {/* Textzeile */}
        <p className="mb-2 protocol-text leading-relaxed">
          {line}
        </p>
        
        {/* Events nach dieser Zeile */}
        {eventsByLine.has(idx) && eventsByLine.get(idx)!.map((event, eventIdx) => {
          // Spezialfall: Zwischenruf mit Redner
          if (event.type === 'Zwischenruf' && event.speaker) {
            return (
              <div key={`event-${idx}-${eventIdx}`} className="protocol-event event-zuruf">
                ({event.speaker} {event.party && `(${event.party})`}: {event.message})
              </div>
            );
          }
          
          // Standard-Event
          return (
            <div 
              key={`event-${idx}-${eventIdx}`} 
              className={`protocol-event italic text-sm my-2 ml-4 ${getEventClass(event.type)}`}
            >
              ({event.text})
            </div>
          );
        })}
      </React.Fragment>
    ));
  };

  return (
    <div className="plenary-protocol">
      {/* Header */}
      <Card className="mb-6 protocol-header">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">
            Landtag von Baden-Württemberg
          </CardTitle>
          <div className="text-lg font-semibold">
            {protocol.legislature_period}. Wahlperiode
          </div>
          <div className="text-xl font-bold mt-2">
            {protocol.session_number}. Sitzung
          </div>
          <div className="text-muted-foreground mt-2">
            {formatDate(protocol.protocol_date)}
          </div>
          {sittingData.time && (
            <div className="text-sm text-muted-foreground mt-1">
              Beginn: {sittingData.time} Uhr
            </div>
          )}
          {sittingData.location && (
            <div className="text-sm text-muted-foreground">
              Ort: {sittingData.location}
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Tagesordnung */}
        <aside className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Tagesordnung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {tocAgenda.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="protocol-agenda-item cursor-pointer"
                      onClick={() => {
                        const element = document.getElementById(`agenda-${item.number}`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <div className="font-semibold text-sm">
                        {item.number}. {item.title}
                      </div>
                      {item.kind && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.kind}
                        </div>
                      )}
                      {item.speakers && item.speakers.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.speakers.length} Redner
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        {/* Main: Speeches */}
        <main className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plenarprotokoll</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Als PDF exportieren
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[800px] pr-4">
                {speeches.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    Keine Reden gefunden
                  </div>
                ) : (
                  <div className="space-y-6">
                    {speeches.map((speech: any, idx: number) => {
                      // Find corresponding agenda item
                      const agendaItem = tocAgenda.find((item: any) => 
                        item.number === speech.agenda_item_number
                      );

                      return (
                        <div key={idx} className="speech-block">
                          {/* Agenda item header if it's a new item */}
                          {idx === 0 || speeches[idx - 1]?.agenda_item_number !== speech.agenda_item_number ? (
                            agendaItem && (
                              <div 
                                id={`agenda-${agendaItem.number}`}
                                className="mb-4 p-4 bg-primary/5 rounded-lg border-l-4 border-primary"
                              >
                                <div className="font-bold text-lg">
                                  Tagesordnungspunkt {agendaItem.number}
                                </div>
                                <div className="mt-1">{agendaItem.title}</div>
                                {agendaItem.kind && (
                                  <Badge variant="outline" className="mt-2">
                                    {agendaItem.kind}
                                  </Badge>
                                )}
                              </div>
                            )
                          ) : null}

                          {/* Speaker line - IM STIL DES ORIGINAL-PROTOKOLLS */}
                          <div className="speaker-line mb-3 flex items-start gap-2">
                            {/* Redner-Name: FETT wie im Original */}
                            <span className="font-bold text-base">
                              {speech.speaker_role && `${speech.speaker_role} `}
                              {speech.speaker_name || speech.speaker}
                            </span>
                            
                            {/* Partei-Badge */}
                            {speech.speaker_party && (
                              <Badge 
                                variant="outline" 
                                className={`${getPartyColor(speech.speaker_party)}`}
                              >
                                {speech.speaker_party}
                              </Badge>
                            )}
                            
                            {/* Timestamp rechts */}
                            {speech.timestamp && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {speech.timestamp} Uhr
                              </span>
                            )}
                          </div>

                          {/* Speech content mit inline Events */}
                          <div className="speech-content ml-8">
                            {renderSpeechContent(
                              speech.text || speech.speech_content, 
                              speech.events_flat || []
                            )}
                          </div>

                          {/* Page number - aus start_page oder page_number */}
                          {(speech.start_page || speech.page_number) && (
                            <div className="page-number text-right text-xs text-muted-foreground mt-2">
                              Seite {speech.start_page || speech.page_number}
                            </div>
                          )}

                          <Separator className="mt-4" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
