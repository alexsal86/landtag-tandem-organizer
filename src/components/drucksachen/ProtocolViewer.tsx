import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  MapPin,
  Clock,
  List,
  Code
} from 'lucide-react';
import { ProtocolSearch } from './ProtocolSearch';
import { ProtocolExport } from './ProtocolExport';
import { ProtocolOverview } from './ProtocolOverview';
import { ProtocolAgenda } from './ProtocolAgenda';
import { ProtocolRawData } from './ProtocolRawData';
import '@/styles/protocol-viewer.css';

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

interface SpeechEvent {
  type: string;
  text: string;
}

interface Speech {
  index: number;
  speaker: string;
  role?: string;
  party?: string;
  text: string;
  start_page?: number;
  agenda_item_number?: number;
  events?: SpeechEvent[];
}

interface ProtocolViewerProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ProtocolViewer({ protocol, onClose }: ProtocolViewerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTOPIndex, setSelectedTOPIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState<string | null>(null);

  // Extract data from structured_data JSONB
  const tocAgenda: TOCAgendaItem[] = useMemo(() => {
    return protocol.structured_data?.toc?.items || [];
  }, [protocol.structured_data]);

  const allSpeeches: Speech[] = useMemo(() => {
    return protocol.structured_data?.speeches || [];
  }, [protocol.structured_data]);

  const stats = useMemo(() => {
    return protocol.structured_data?.stats || {};
  }, [protocol.structured_data]);

  const sessionData = protocol.structured_data?.session || {};
  const sittingData = protocol.structured_data?.sitting || {};
  const layoutData = protocol.structured_data?.layout || {};
  const qaData = protocol.structured_data?._qa || {};

  // Get unique parties
  const parties = useMemo(() => {
    const partySet = new Set<string>();
    allSpeeches.forEach(speech => {
      if (speech.party) partySet.add(speech.party);
    });
    return Array.from(partySet).sort();
  }, [allSpeeches]);

  // Group speeches by TOP using agenda_item_number
  const groupedData = useMemo(() => {
    return tocAgenda.map(item => {
      const matchedSpeeches = allSpeeches.filter(speech => 
        speech.agenda_item_number === item.number
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
      'FDP/DVP': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'AfD': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'DIE LINKE': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[party || ''] || 'bg-muted text-muted-foreground';
  };

  // Get event class for styling
  const getEventClass = (type: string) => {
    if (type === 'Beifall') return 'text-green-600 font-semibold';
    if (type === 'Zuruf') return 'text-red-600 italic';
    if (type === 'Heiterkeit') return 'text-yellow-600';
    return 'text-blue-600'; // Default
  };

  // Render text with inline events
  const renderTextWithEvents = (text: string, events?: SpeechEvent[]) => {
    if (!events || events.length === 0) {
      return <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    let enhancedText = text;
    events.forEach(event => {
      const regex = new RegExp(escapeRegExp(event.text), 'g');
      enhancedText = enhancedText.replace(regex, `<span class="${getEventClass(event.type)}">${event.text}</span>`);
    });

    return <p dangerouslySetInnerHTML={{ __html: enhancedText }} className="text-sm whitespace-pre-wrap leading-relaxed" />;
  };

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  return (
    <div className="space-y-4 protocol-viewer">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zur Übersicht
            </Button>
            
            <div className="flex items-center gap-2">
              {sessionData.source_pdf_url && (
                <a href={sessionData.source_pdf_url} download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </a>
              )}
              <ProtocolExport 
                protocolId={protocol.id} 
                protocolTitle={protocol.original_filename}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <h1 className="text-2xl font-bold protocol-heading">{protocol.original_filename}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(protocol.protocol_date)}
              </div>
              <div>Sitzung {protocol.session_number}</div>
              <div>Wahlperiode {protocol.legislature_period}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Übersicht</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Tagesordnung</span>
          </TabsTrigger>
          <TabsTrigger value="speeches" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Reden</span>
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Rohdaten</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <ProtocolOverview
            sessionData={sessionData}
            sittingData={sittingData}
            stats={stats}
            layoutData={layoutData}
            tocAgenda={tocAgenda}
            allSpeeches={allSpeeches}
            parties={parties}
          />
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda" className="mt-6">
          <ProtocolAgenda tocAgenda={tocAgenda} />
        </TabsContent>

        {/* Speeches Tab */}
        <TabsContent value="speeches" className="mt-6">
          <div className="space-y-4">
            {/* Filter Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1 relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Suche in Reden..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                                {item.drucksachen && item.drucksachen.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Drucksachen: {item.drucksachen.join(', ')}
                                  </div>
                                )}
                                {item.extra && (
                                  <div className="text-xs italic text-muted-foreground mt-1">
                                    {item.extra}
                                  </div>
                                )}
                                {item.subentries && item.subentries.length > 0 && (
                                  <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                                    {item.subentries.map((sub, i) => (
                                      <li key={i}>{sub.text} ({sub.type})</li>
                                    ))}
                                  </ul>
                                )}
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
                            {speaker.pages && speaker.pages.length > 0 && ` (S. ${speaker.pages.join(', ')})`}
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
                              <div className="prose prose-sm max-w-none dark:prose-invert protocol-text">
                                {renderTextWithEvents(speech.text, speech.events)}
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
          </div>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw" className="mt-6">
          <ProtocolRawData structuredData={protocol.structured_data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
