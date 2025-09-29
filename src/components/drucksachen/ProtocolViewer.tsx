import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  MessageSquare,
  Download,
  FileText,
  Search,
  BarChart3
} from 'lucide-react';
import { ProtocolSearch } from './ProtocolSearch';
import { ProtocolExport } from './ProtocolExport';

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

interface TOCAgendaItem {
  number?: number;
  title: string;
  kind?: string;
  speakers?: Array<{
    name: string;
    role?: string;
    party?: string;
    pages?: number[];
  }>;
}

interface Speech {
  index: number;
  speaker: string;
  role?: string;
  party?: string;
  text: string;
  start_page?: number;
  agenda_item_number?: number;
}

interface ProtocolViewerProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ProtocolViewer({ protocol, onClose }: ProtocolViewerProps) {
  const [selectedTOPIndex, setSelectedTOPIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState<string | null>(null);

  // Extract data from structured_data JSONB
  const tocAgenda: TOCAgendaItem[] = useMemo(() => {
    return protocol.structured_data?.toc_agenda || protocol.structured_data?.toc?.items || [];
  }, [protocol.structured_data]);

  const allSpeeches: Speech[] = useMemo(() => {
    return protocol.structured_data?.speeches || [];
  }, [protocol.structured_data]);

  const stats = useMemo(() => {
    return protocol.structured_data?.stats || {};
  }, [protocol.structured_data]);

  // Get unique parties
  const parties = useMemo(() => {
    const partySet = new Set<string>();
    allSpeeches.forEach(speech => {
      if (speech.party) partySet.add(speech.party);
    });
    return Array.from(partySet).sort();
  }, [allSpeeches]);

  // Group speeches by TOP based on speaker names
  const groupedData = useMemo(() => {
    return tocAgenda.map(item => {
      const speakerNames = item.speakers?.map(s => s.name) || [];
      const matchedSpeeches = allSpeeches.filter(speech => 
        speakerNames.some(name => speech.speaker?.toLowerCase().includes(name.toLowerCase()))
      );
      
      return {
        ...item,
        matchedSpeeches
      };
    });
  }, [tocAgenda, allSpeeches]);

  // Filter speeches by party and search query
  const filteredSpeeches = (speeches: Speech[]) => {
    return speeches.filter(speech => {
      const matchesParty = !partyFilter || speech.party === partyFilter;
      const matchesSearch = !searchQuery || 
        speech.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        speech.speaker?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesParty && matchesSearch;
    });
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

  // Get party badge color
  const getPartyColor = (party?: string) => {
    const colors: Record<string, string> = {
      'GRÜNE': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'CDU': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'SPD': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'FDP': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'AfD': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'DIE LINKE': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[party || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zur Übersicht
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <ProtocolExport 
                protocolId={protocol.id} 
                protocolTitle={protocol.original_filename}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{protocol.original_filename}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(protocol.protocol_date)}
                </div>
                <div>Sitzung {protocol.session_number}</div>
                <div>Wahlperiode {protocol.legislature_period}</div>
              </div>
            </div>
            
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold">{tocAgenda.length}</div>
                    <div className="text-xs text-muted-foreground">TOPs</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold">{allSpeeches.length}</div>
                    <div className="text-xs text-muted-foreground">Reden</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold">
                      {new Set(allSpeeches.map(s => s.speaker)).size}
                    </div>
                    <div className="text-xs text-muted-foreground">Redner</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold">{parties.length}</div>
                    <div className="text-xs text-muted-foreground">Parteien</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Suche in Reden..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              {parties.map(party => (
                <Badge
                  key={party}
                  variant={partyFilter === party ? 'default' : 'outline'}
                  className={`cursor-pointer ${partyFilter === party ? getPartyColor(party) : ''}`}
                  onClick={() => setPartyFilter(partyFilter === party ? null : party)}
                >
                  {party}
                </Badge>
              ))}
              {partyFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPartyFilter(null)}
                  className="h-6 px-2 text-xs"
                >
                  Alle
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar: TOC Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tagesordnung</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-1 p-4 pt-0">
                {tocAgenda.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine Tagesordnung verfügbar
                  </p>
                ) : (
                  tocAgenda.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedTOPIndex(index)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTOPIndex === index
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5">
                          {item.number || index + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {item.title}
                          </p>
                          {item.speakers && item.speakers.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {item.speakers.length} Redner
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Content: TOP Details with Speeches */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">
                    TOP {groupedData[selectedTOPIndex]?.number || selectedTOPIndex + 1}
                  </Badge>
                  {groupedData[selectedTOPIndex]?.kind && (
                    <Badge variant="outline">
                      {groupedData[selectedTOPIndex].kind}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">
                  {groupedData[selectedTOPIndex]?.title || 'Kein Titel'}
                </CardTitle>
              </div>
            </div>
            {groupedData[selectedTOPIndex]?.speakers && 
             groupedData[selectedTOPIndex].speakers!.length > 0 && (
              <CardDescription className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Redner:</span>
                  {groupedData[selectedTOPIndex].speakers!.map((speaker, idx) => (
                    <Badge key={idx} variant="secondary" className={getPartyColor(speaker.party)}>
                      {speaker.name}
                      {speaker.party && ` (${speaker.party})`}
                    </Badge>
                  ))}
                </div>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {groupedData[selectedTOPIndex]?.matchedSpeeches &&
               filteredSpeeches(groupedData[selectedTOPIndex].matchedSpeeches).length > 0 ? (
                <Accordion type="single" collapsible className="space-y-3">
                  {filteredSpeeches(groupedData[selectedTOPIndex].matchedSpeeches).map((speech, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`speech-${idx}`}
                      className="border rounded-lg"
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{speech.speaker}</span>
                              {speech.party && (
                                <Badge variant="secondary" className={getPartyColor(speech.party)}>
                                  {speech.party}
                                </Badge>
                              )}
                              {speech.role && (
                                <span className="text-sm text-muted-foreground">
                                  {speech.role}
                                </span>
                              )}
                              {speech.start_page && (
                                <Badge variant="outline" className="text-xs">
                                  S. {speech.start_page}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {speech.text.substring(0, 100)}...
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-0 pb-4">
                        <Separator className="mb-4" />
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {speech.text}
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {searchQuery || partyFilter
                      ? 'Keine Reden mit den aktuellen Filtern gefunden'
                      : 'Keine Reden zu diesem Tagesordnungspunkt'}
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Search Component (hidden by default, could be shown in a modal) */}
      <div className="hidden">
        <ProtocolSearch
          protocolId={protocol.id}
          onResultSelect={(result) => {
            console.log('Selected result:', result);
          }}
        />
      </div>
    </div>
  );
}
