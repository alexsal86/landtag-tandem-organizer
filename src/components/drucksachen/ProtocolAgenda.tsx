import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, FileText } from 'lucide-react';

interface TOCAgendaItem {
  number?: number;
  title: string;
  kind?: string;
  drucksachen?: string[];
  extra?: string | null;
  subentries?: Array<{
    type: string;
    text: string;
    pages?: number[];
  }>;
  speakers?: Array<{
    name: string;
    role?: string;
    party?: string;
    pages?: number[];
  }>;
  raw_header?: string;
  raw_lines?: string[];
}

interface ProtocolAgendaProps {
  tocAgenda: TOCAgendaItem[];
}

export function ProtocolAgenda({ tocAgenda }: ProtocolAgendaProps) {
  const getPartyClass = (party?: string) => {
    if (!party) return '';
    return `party-${party.toLowerCase().replace(/\//g, '').replace(/\s/g, '')}`;
  };

  if (tocAgenda.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <p>Keine Tagesordnung verfügbar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-6 pb-6">
        {tocAgenda.map((item, idx) => (
          <Card key={idx} className="protocol-agenda-item">
            <CardHeader>
              <div className="flex items-start gap-3">
                <Badge variant="default" className="text-lg px-3 py-1">
                  TOP {item.number || idx + 1}
                </Badge>
                <div className="flex-1">
                  <CardTitle className="text-xl protocol-heading mb-2">
                    {item.title}
                  </CardTitle>
                  {item.kind && (
                    <Badge variant="secondary" className="text-sm">
                      {item.kind}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drucksachen */}
              {item.drucksachen && item.drucksachen.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Drucksachen:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.drucksachen.map((ds, dsIdx) => (
                      <Badge key={dsIdx} variant="outline" className="protocol-code">
                        {ds}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra Information */}
              {item.extra && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Zusätzliche Information:
                  </div>
                  <p className="text-sm italic text-muted-foreground">{item.extra}</p>
                </div>
              )}

              {/* Subentries */}
              {item.subentries && item.subentries.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Unterpunkte:
                  </div>
                  <div className="protocol-agenda-tree space-y-2">
                    {item.subentries.map((sub, subIdx) => (
                      <div key={subIdx} className="text-sm">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {sub.type}
                          </Badge>
                          <span className="flex-1">{sub.text}</span>
                        </div>
                        {sub.pages && sub.pages.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1 ml-2">
                            Seiten: {sub.pages.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speakers */}
              {item.speakers && item.speakers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Redner ({item.speakers.length}):
                  </div>
                  <div className="space-y-2">
                    {item.speakers.map((speaker, spIdx) => (
                      <div key={spIdx} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                        <div className="flex-1">
                          <div className="font-medium">{speaker.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {speaker.role && (
                              <span className="text-xs text-muted-foreground">{speaker.role}</span>
                            )}
                            {speaker.party && (
                              <Badge variant="secondary" className={`text-xs ${getPartyClass(speaker.party)}`}>
                                {speaker.party}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {speaker.pages && speaker.pages.length > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            S. {speaker.pages.join(', ')}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Raw Data */}
              {(item.raw_header || (item.raw_lines && item.raw_lines.length > 0)) && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Originale Tagesordnung:
                  </div>
                  <div className="protocol-json-preview text-xs">
                    {item.raw_header && <div className="font-semibold mb-1">{item.raw_header}</div>}
                    {item.raw_lines && item.raw_lines.map((line, lineIdx) => (
                      <div key={lineIdx}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
