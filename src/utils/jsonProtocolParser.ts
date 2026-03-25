import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

export interface ProtocolEvent {
  label?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ProtocolSpeakerRef {
  name: string;
  role?: string;
  party?: string;
  pages?: number[];
}

export interface AgendaProtocolItem {
  number: string | number;
  title: string;
  description?: string;
  page_number?: number;
  item_type?: string;
  kind?: string;
  speakers?: ProtocolSpeakerRef[];
  drucksachen?: string[];
  subentries?: string[];
  agenda_number?: string;
}

interface JSONProtocolStructure {
  session: {
    number: number | null;
    legislative_period: number | null;
    date: string | null;
    source_pdf_url?: string | null;
    extracted_at: string;
  };
  speeches: Array<{
    index: number;
    speaker: string | { name: string; role?: string; party?: string };
    role?: string;
    party?: string;
    text: string;
    start_page?: number;
    page_number?: number;
    speech_type?: string;
    timestamp?: string;
    agenda_item_number?: number;
    events?: ProtocolEvent[];
    events_flat?: ProtocolEvent[];
  }>;
  agenda?: AgendaProtocolItem[];
  toc?: {
    items: Array<{
      number: number;
      title: string;
      kind?: string;
      speakers?: ProtocolSpeakerRef[];
    }>;
  };
  stats?: {
    pages: number;
    speeches: number;
  };
  statistics?: {
    total_speeches: number;
    total_pages: number;
    parties_represented: string[];
    session_duration?: string;
  };
}

export interface ParsedJSONProtocol {
  metadata: {
    session_number: string;
    legislature_period: string;
    protocol_date: string;
    source_pdf_url?: string | null;
    statistics?: {
      total_speeches: number;
      total_pages: number;
      parties_represented: string[];
      session_duration?: string;
    };
  };
  structured_data: {
    agendaItems: Array<{
      agenda_number: string;
      title: string;
      description?: string;
      page_number?: number;
      item_type: string;
      speakers: ProtocolSpeakerRef[];
      drucksachen: string[];
      subentries: string[];
    }>;
    speeches: Array<{
      speaker_name: string;
      speaker_party?: string;
      speaker_role?: string;
      speech_content: string;
      page_number?: number;
      speech_type: string;
      timestamp?: string;
      index: number;
      agenda_item_number?: number;
      events: ProtocolEvent[];
      events_flat: ProtocolEvent[];
    }>;
    sessions: Array<{
      session_type: string;
      timestamp: string;
      page_number?: number;
      notes?: string;
    }>;
  };
}

function isValidSpeaker(value: unknown): boolean {
  return typeof value === 'string' || (isRecord(value) && typeof value.name === 'string');
}

function isValidSession(session: unknown): session is JSONProtocolStructure['session'] {
  return (
    isRecord(session)
    && hasOwnProperty(session, 'extracted_at')
    && typeof session.extracted_at === 'string'
    && hasOwnProperty(session, 'date')
    && (typeof session.date === 'string' || session.date === null)
    && hasOwnProperty(session, 'number')
    && (typeof session.number === 'number' || session.number === null)
    && hasOwnProperty(session, 'legislative_period')
    && (typeof session.legislative_period === 'number' || session.legislative_period === null)
  );
}

function isValidSpeech(speech: unknown): speech is JSONProtocolStructure['speeches'][number] {
  return (
    isRecord(speech)
    && hasOwnProperty(speech, 'text')
    && typeof speech.text === 'string'
    && hasOwnProperty(speech, 'index')
    && typeof speech.index === 'number'
    && hasOwnProperty(speech, 'speaker')
    && isValidSpeaker(speech.speaker)
  );
}

export function validateJSONProtocol(data: unknown): data is JSONProtocolStructure {
  if (!isRecord(data)) return false;
  if (!hasOwnProperty(data, 'session') || !isValidSession(data.session)) return false;
  if (!hasOwnProperty(data, 'speeches') || !Array.isArray(data.speeches)) return false;

  return data.speeches.every(isValidSpeech);
}

type TocItem = NonNullable<JSONProtocolStructure['toc']>['items'][number];

function toAgendaProtocolItem(item: TocItem | AgendaProtocolItem): AgendaProtocolItem {
  return item;
}

export function parseJSONProtocol(jsonData: JSONProtocolStructure): ParsedJSONProtocol {
  const metadata = {
    session_number: jsonData.session.number?.toString() || '0',
    legislature_period: jsonData.session.legislative_period?.toString() || '17',
    protocol_date: jsonData.session.date || new Date().toISOString().split('T')[0],
    source_pdf_url: jsonData.session.source_pdf_url,
    statistics: jsonData.statistics || jsonData.stats ? {
      total_speeches: jsonData.stats?.speeches || jsonData.statistics?.total_speeches || jsonData.speeches.length,
      total_pages: jsonData.stats?.pages || jsonData.statistics?.total_pages || 0,
      parties_represented: jsonData.statistics?.parties_represented || Array.from(new Set(
        jsonData.speeches
          .map(s => s.party)
          .filter((party): party is string => Boolean(party))
      )),
      session_duration: jsonData.statistics?.session_duration
    } : undefined
  };

  const agendaItems = (jsonData.agenda || jsonData.toc?.items || [])
    .map(toAgendaProtocolItem)
    .map((item) => ({
      agenda_number: item.number?.toString() || item.agenda_number || '',
      title: item.title,
      description: item.description || item.kind,
      page_number: item.page_number || item.speakers?.[0]?.pages?.[0],
      item_type: item.item_type || item.kind || 'regular',
      speakers: item.speakers || [],
      drucksachen: item.drucksachen || [],
      subentries: item.subentries || []
    }));

  const speeches = jsonData.speeches.map(speech => {
    const speakerObj = typeof speech.speaker === 'object' ? speech.speaker : null;
    return {
      speaker_name: speakerObj ? speakerObj.name : (speech.speaker as string),
      speaker_party: speech.party || speakerObj?.party,
      speaker_role: speech.role || speakerObj?.role,
      speech_content: speech.text,
      page_number: speech.page_number || speech.start_page,
      speech_type: speech.speech_type || 'main',
      timestamp: speech.timestamp,
      index: speech.index,
      agenda_item_number: speech.agenda_item_number,
      events: speech.events || [],
      events_flat: speech.events_flat || []
    };
  });

  const sessions: Array<{
    session_type: string;
    timestamp: string;
    page_number?: number;
    notes?: string;
  }> = [];

  sessions.push({
    session_type: 'session_start',
    timestamp: jsonData.session.extracted_at,
    notes: `Sitzung ${metadata.session_number} der ${metadata.legislature_period}. Wahlperiode`
  });

  if (jsonData.agenda && jsonData.agenda.length > 0) {
    jsonData.agenda.forEach(item => {
      sessions.push({
        session_type: 'agenda_item',
        timestamp: jsonData.session.extracted_at,
        page_number: item.page_number,
        notes: `Tagesordnungspunkt ${item.number}: ${item.title}`
      });
    });
  }

  sessions.push({
    session_type: 'session_end',
    timestamp: jsonData.session.extracted_at,
    notes: 'Ende der Sitzung'
  });

  return {
    metadata,
    structured_data: {
      agendaItems,
      speeches,
      sessions
    }
  };
}

export function getJSONProtocolPreview(jsonData: JSONProtocolStructure): {
  sessionInfo: string;
  speechCount: number;
  agendaCount: number;
  parties: string[];
  dateInfo: string;
} {
  const parties = Array.from(new Set(
    jsonData.speeches
      .map(s => s.party)
      .filter((p): p is string => Boolean(p))
  ));

  const sessionInfo = `Sitzung ${jsonData.session.number || 'unbekannt'} (${jsonData.session.legislative_period || '17'}. Wahlperiode)`;
  const dateInfo = jsonData.session.date
    ? new Date(jsonData.session.date).toLocaleDateString('de-DE')
    : 'Datum unbekannt';

  return {
    sessionInfo,
    speechCount: jsonData.speeches.length,
    agendaCount: jsonData.agenda?.length || jsonData.toc?.items?.length || 0,
    parties,
    dateInfo
  };
}
