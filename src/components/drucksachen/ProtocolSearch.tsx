import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  type: 'agenda_item' | 'speech' | 'session';
  title: string;
  content: string;
  speaker?: string;
  party?: string;
  page_number?: number;
  protocol_id: string;
  protocol_title: string;
  protocol_date: string;
}

interface ProtocolSearchProps {
  protocolId?: string;
  onResultSelect?: (result: SearchResult) => void;
}

export function ProtocolSearch({ protocolId, onResultSelect }: ProtocolSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'agenda_item' | 'speech' | 'session'>('all');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [availableParties, setAvailableParties] = useState<string[]>([]);

  // Load available speakers and parties for filters
  useEffect(() => {
    loadFilterOptions();
  }, [protocolId]);

  const loadFilterOptions = async () => {
    try {
      let query = supabase
        .from('protocol_speeches')
        .select('speaker_name, speaker_party');

      if (protocolId) {
        query = query.eq('protocol_id', protocolId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const speakers = [...new Set(data?.map(d => d.speaker_name).filter(Boolean) || [])];
      const parties = [...new Set(data?.map(d => d.speaker_party).filter(Boolean) || [])];

      setAvailableSpeakers(speakers.sort());
      setAvailableParties(parties.sort());
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const performSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Bitte geben Sie einen Suchbegriff ein');
      return;
    }

    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search in agenda items
      if (searchType === 'all' || searchType === 'agenda_item') {
        let agendaQuery = supabase
          .from('protocol_agenda_items')
          .select(`
            id, title, description, page_number, protocol_id,
            parliament_protocols!inner(original_filename, protocol_date)
          `)
          .ilike('title', `%${searchTerm}%`);

        if (protocolId) {
          agendaQuery = agendaQuery.eq('protocol_id', protocolId);
        }

        const { data: agendaData, error: agendaError } = await agendaQuery;
        if (agendaError) throw agendaError;

        agendaData?.forEach(item => {
          searchResults.push({
            id: item.id,
            type: 'agenda_item',
            title: item.title,
            content: item.description || '',
            page_number: item.page_number,
            protocol_id: item.protocol_id,
            protocol_title: item.parliament_protocols.original_filename,
            protocol_date: item.parliament_protocols.protocol_date
          });
        });
      }

      // Search in speeches
      if (searchType === 'all' || searchType === 'speech') {
        let speechQuery = supabase
          .from('protocol_speeches')
          .select(`
            id, speaker_name, speaker_party, speech_content, page_number, protocol_id,
            parliament_protocols!inner(original_filename, protocol_date)
          `)
          .ilike('speech_content', `%${searchTerm}%`);

        if (protocolId) {
          speechQuery = speechQuery.eq('protocol_id', protocolId);
        }
        if (speakerFilter) {
          speechQuery = speechQuery.eq('speaker_name', speakerFilter);
        }
        if (partyFilter) {
          speechQuery = speechQuery.eq('speaker_party', partyFilter);
        }

        const { data: speechData, error: speechError } = await speechQuery;
        if (speechError) throw speechError;

        speechData?.forEach(speech => {
          searchResults.push({
            id: speech.id,
            type: 'speech',
            title: `${speech.speaker_name} (${speech.speaker_party})`,
            content: speech.speech_content,
            speaker: speech.speaker_name,
            party: speech.speaker_party,
            page_number: speech.page_number,
            protocol_id: speech.protocol_id,
            protocol_title: speech.parliament_protocols.original_filename,
            protocol_date: speech.parliament_protocols.protocol_date
          });
        });
      }

      setResults(searchResults);
      
      if (searchResults.length === 0) {
        toast.info('Keine Ergebnisse gefunden');
      } else {
        toast.success(`${searchResults.length} Ergebnisse gefunden`);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      toast.error('Fehler bei der Suche');
    } finally {
      setIsSearching(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchType('all');
    setSpeakerFilter('');
    setPartyFilter('');
    setDateRange({ from: '', to: '' });
    setResults([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Protokoll-Suche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main search */}
          <div className="flex gap-2">
            <Input
              placeholder="Suchbegriff eingeben..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={performSearch} disabled={isSearching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Suchbereich" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Bereiche</SelectItem>
                <SelectItem value="agenda_item">Tagesordnung</SelectItem>
                <SelectItem value="speech">Redebeiträge</SelectItem>
                <SelectItem value="session">Sitzungsereignisse</SelectItem>
              </SelectContent>
            </Select>

            <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Redner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Redner</SelectItem>
                {availableSpeakers.map(speaker => (
                  <SelectItem key={speaker} value={speaker}>{speaker}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Partei" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Parteien</SelectItem>
                {availableParties.map(party => (
                  <SelectItem key={party} value={party}>{party}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Filter löschen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Suchergebnisse ({results.length})</span>
              <Badge variant="secondary">{searchTerm}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={`${result.type}-${result.id}-${index}`}
                  className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onResultSelect?.(result)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{result.type}</Badge>
                      {result.page_number && (
                        <Badge variant="secondary">Seite {result.page_number}</Badge>
                      )}
                      {result.party && (
                        <Badge>{result.party}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {new Date(result.protocol_date).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  
                  <h4 className="font-medium mb-1">{result.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.content}
                  </p>
                  
                  {!protocolId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {result.protocol_title}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}