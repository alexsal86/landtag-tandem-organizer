import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, MapPin, FileText, MessageSquare, Users, BarChart3 } from 'lucide-react';

interface ProtocolOverviewProps {
  sessionData: any;
  sittingData: any;
  stats: any;
  layoutData: any;
  tocAgenda: any[];
  allSpeeches: any[];
  parties: string[];
}

export function ProtocolOverview({
  sessionData,
  sittingData,
  stats,
  layoutData,
  tocAgenda,
  allSpeeches,
  parties
}: ProtocolOverviewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Session Information */}
      <Card>
        <CardHeader>
          <CardTitle>Sitzungsinformationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Sitzungsnummer</div>
              <div className="text-lg font-semibold">{sessionData.number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Wahlperiode</div>
              <div className="text-lg font-semibold">{sessionData.legislative_period}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Datum</div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(sessionData.date)}
              </div>
            </div>
            {sittingData.location && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Ort</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {sittingData.location}
                </div>
              </div>
            )}
            {sittingData.start_time && sittingData.end_time && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Sitzungszeit</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {sittingData.start_time} - {sittingData.end_time}
                </div>
              </div>
            )}
            {sessionData.extracted_at && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Extrahiert am</div>
                <div className="text-sm">
                  {new Date(sessionData.extracted_at).toLocaleString('de-DE')}
                </div>
              </div>
            )}
          </div>

          {sessionData.source_pdf_url && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Quelle</div>
              <a 
                href={sessionData.source_pdf_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {sessionData.source_pdf_url}
              </a>
            </div>
          )}

          {sessionData.next_meeting?.raw && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Nächste Sitzung</div>
              <div className="text-sm">{sessionData.next_meeting.raw}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiken</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{tocAgenda.length}</div>
                  <div className="text-sm text-muted-foreground">Tagesordnungspunkte</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{allSpeeches.length}</div>
                  <div className="text-sm text-muted-foreground">Reden</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">
                    {new Set(allSpeeches.map((s: any) => s.speaker)).size}
                  </div>
                  <div className="text-sm text-muted-foreground">Redner</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{parties.length}</div>
                  <div className="text-sm text-muted-foreground">Parteien</div>
                </div>
              </div>
            </Card>
          </div>

          {stats.pages && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground mb-1">Seitenzahl</div>
              <div className="text-lg font-semibold">{stats.pages} Seiten</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout Information */}
      {layoutData && (
        <Card>
          <CardHeader>
            <CardTitle>Verarbeitungsinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Layout angewendet:</span>
              <Badge variant={layoutData.applied ? 'default' : 'secondary'}>
                {layoutData.applied ? 'Ja' : 'Nein'}
              </Badge>
            </div>
            {layoutData.reason && (
              <div>
                <span className="text-sm text-muted-foreground">Methode: </span>
                <span className="text-sm protocol-code">{layoutData.reason}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sitting Details */}
      {sittingData.breaks && sittingData.breaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sitzungsunterbrechungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sittingData.breaks.map((breakItem: any, idx: number) => (
                <div key={idx} className="text-sm">
                  <Badge variant="outline">{breakItem.type}</Badge>
                  {breakItem.time && <span className="ml-2">{breakItem.time}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parties Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Vertretene Parteien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {parties.map(party => (
              <Badge 
                key={party} 
                variant="secondary"
                className={`party-${party.toLowerCase().replace(/\//g, '').replace(/\s/g, '')}`}
              >
                {party}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick TOC Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Tagesordnung (Übersicht)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tocAgenda.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-lg">
                <Badge variant="outline" className="shrink-0 mt-0.5">
                  {item.number || idx + 1}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.kind && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {item.kind}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
