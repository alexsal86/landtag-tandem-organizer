import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  Award,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalyticsData {
  totalSpeeches: number;
  totalSpeakers: number;
  avgSpeechesPerSession: number;
  partyStats: Array<{
    party: string;
    speeches: number;
    speakers: number;
    percentage: number;
  }>;
  speakerStats: Array<{
    speaker: string;
    party: string;
    speeches: number;
    totalWords: number;
  }>;
  timelineData: Array<{
    date: string;
    speeches: number;
    speakers: number;
  }>;
  agendaStats: Array<{
    type: string;
    count: number;
  }>;
}

interface ProtocolAnalyticsProps {
  protocolId?: string;
  tenantId: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export function ProtocolAnalytics({ protocolId, tenantId }: ProtocolAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [protocolId, tenantId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Build queries based on whether we're analyzing a single protocol or all protocols
      let speechQuery = supabase
        .from('protocol_speeches')
        .select(`
          id, speaker_name, speaker_party, speech_content, page_number, start_time,
          parliament_protocols!inner(protocol_date, tenant_id)
        `)
        .eq('parliament_protocols.tenant_id', tenantId);

      let agendaQuery = supabase
        .from('protocol_agenda_items')
        .select(`
          id, title, item_type,
          parliament_protocols!inner(protocol_date, tenant_id)
        `)
        .eq('parliament_protocols.tenant_id', tenantId);

      if (protocolId) {
        speechQuery = speechQuery.eq('protocol_id', protocolId);
        agendaQuery = agendaQuery.eq('protocol_id', protocolId);
      }

      const [speechResult, agendaResult] = await Promise.all([
        speechQuery,
        agendaQuery
      ]);

      if (speechResult.error) throw speechResult.error;
      if (agendaResult.error) throw agendaResult.error;

      const speeches = speechResult.data || [];
      const agendaItems = agendaResult.data || [];

      // Calculate statistics
      const totalSpeeches = speeches.length;
      const uniqueSpeakers = new Set(speeches.map(s => s.speaker_name).filter(Boolean));
      const totalSpeakers = uniqueSpeakers.size;

      // Party statistics
      const partyMap = new Map<string, { speeches: number; speakers: Set<string> }>();
      speeches.forEach(speech => {
        if (speech.speaker_party) {
          const current = partyMap.get(speech.speaker_party) || { speeches: 0, speakers: new Set() };
          current.speeches += 1;
          if (speech.speaker_name) current.speakers.add(speech.speaker_name);
          partyMap.set(speech.speaker_party, current);
        }
      });

      const partyStats = Array.from(partyMap.entries()).map(([party, data]) => ({
        party,
        speeches: data.speeches,
        speakers: data.speakers.size,
        percentage: Math.round((data.speeches / totalSpeeches) * 100)
      })).sort((a, b) => b.speeches - a.speeches);

      // Speaker statistics
      const speakerMap = new Map<string, { party: string; speeches: number; totalWords: number }>();
      speeches.forEach(speech => {
        if (speech.speaker_name) {
          const current = speakerMap.get(speech.speaker_name) || { 
            party: speech.speaker_party || 'Unbekannt', 
            speeches: 0, 
            totalWords: 0 
          };
          current.speeches += 1;
          current.totalWords += (speech.speech_content || '').split(' ').length;
          speakerMap.set(speech.speaker_name, current);
        }
      });

      const speakerStats = Array.from(speakerMap.entries()).map(([speaker, data]) => ({
        speaker,
        party: data.party,
        speeches: data.speeches,
        totalWords: data.totalWords
      })).sort((a, b) => b.speeches - a.speeches).slice(0, 10);

      // Timeline data (only for multi-protocol view)
      let timelineData: Array<{ date: string; speeches: number; speakers: number }> = [];
      if (!protocolId) {
        const dateMap = new Map<string, { speeches: number; speakers: Set<string> }>();
        speeches.forEach(speech => {
          const date = speech.parliament_protocols.protocol_date;
          const current = dateMap.get(date) || { speeches: 0, speakers: new Set() };
          current.speeches += 1;
          if (speech.speaker_name) current.speakers.add(speech.speaker_name);
          dateMap.set(date, current);
        });

        timelineData = Array.from(dateMap.entries()).map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('de-DE'),
          speeches: data.speeches,
          speakers: data.speakers.size
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      // Agenda statistics
      const agendaMap = new Map<string, number>();
      agendaItems.forEach(item => {
        const type = item.item_type || 'Sonstiges';
        agendaMap.set(type, (agendaMap.get(type) || 0) + 1);
      });

      const agendaStats = Array.from(agendaMap.entries()).map(([type, count]) => ({
        type,
        count
      }));

      setAnalytics({
        totalSpeeches,
        totalSpeakers,
        avgSpeechesPerSession: protocolId ? totalSpeeches : Math.round(totalSpeeches / timelineData.length) || 0,
        partyStats,
        speakerStats,
        timelineData,
        agendaStats
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center text-muted-foreground">
            <BarChart className="h-12 w-12 mx-auto mb-4" />
            <p>Keine Daten für Analyse verfügbar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalSpeeches}</p>
                <p className="text-sm text-muted-foreground">Redebeiträge</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalSpeakers}</p>
                <p className="text-sm text-muted-foreground">Redner</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.avgSpeechesPerSession}</p>
                <p className="text-sm text-muted-foreground">Ø Reden/Sitzung</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Party Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Partei-Verteilung</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.partyStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.party} (${entry.percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="speeches"
                >
                  {analytics.partyStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Redner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.speakerStats.slice(0, 8).map((speaker, index) => (
                <div key={speaker.speaker} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <div>
                      <p className="font-medium text-sm">{speaker.speaker}</p>
                      <p className="text-xs text-muted-foreground">{speaker.party}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{speaker.speeches}</p>
                    <p className="text-xs text-muted-foreground">{speaker.totalWords} Wörter</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline (only for multi-protocol view) */}
      {!protocolId && analytics.timelineData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Aktivität über Zeit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="speeches" stroke="#8884d8" name="Redebeiträge" />
                <Line type="monotone" dataKey="speakers" stroke="#82ca9d" name="Redner" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agenda Item Types */}
      {analytics.agendaStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tagesordnung-Kategorien</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.agendaStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}